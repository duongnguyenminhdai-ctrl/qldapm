const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { getIo } = require("../config/socketInstance");
const { createAndSendNotification } = require("../services/notification.service");
const { fixUtf8FileName } = require("../utils/fileEncoding");

/**
 * GET /api/messages/conversations
 * Lấy danh sách hội thoại của user
 */
exports.getConversations = async (req, res, next) => {
  try {
    const currentUserId = String(req.user.id || req.user._id);

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .populate("participants", "_id name email avatar isOnline lastSeen")
      .populate("lastMessage.sender", "_id name avatar")
      .sort({ updatedAt: -1 });

    // Khử trùng lặp (Deduplicate) các đoạn chat 1-1 với cùng 1 người nếu trước đó bị tạo trùng
    const seenPartners = new Set();
    const uniqueConversations = [];

    for (const conv of conversations) {
      if (conv.isGroup) {
        uniqueConversations.push(conv);
      } else {
        const partner = conv.participants?.find(
          (p) => String(p._id || p.id) !== currentUserId
        );
        const partnerId = partner ? String(partner._id || partner.id) : null;
        if (!partnerId) {
          uniqueConversations.push(conv);
        } else if (!seenPartners.has(partnerId)) {
          seenPartners.add(partnerId);
          uniqueConversations.push(conv);
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        conversations: uniqueConversations,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/create-group
 * Tạo nhóm chat mới với danh sách friend IDs được chọn
 */
exports.createGroup = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { name, participantIds } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất 1 bạn bè vào nhóm.",
      });
    }

    const allParticipants = Array.from(
      new Set([String(currentUserId), ...participantIds.map(String)])
    );

    const groupName = name && name.trim() ? name.trim() : "Nhóm học tập";

    const conversation = await Conversation.create({
      isGroup: true,
      name: groupName,
      participants: allParticipants,
      lastMessage: {
        text: `Đã tạo nhóm "${groupName}"`,
        sender: currentUserId,
        createdAt: new Date(),
      },
    });

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "_id name email avatar isOnline lastSeen")
      .populate("lastMessage.sender", "_id name avatar");

    const io = getIo();
    if (io) {
      allParticipants.forEach((pId) => {
        io.to(`user:${pId}`).emit("chat:conversation-created", populated);
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        conversation: populated,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/direct
 * Lấy hoặc tạo cuộc hội thoại 1-1 với bạn bè
 */
exports.getOrCreateDirectConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ID bạn bè.",
      });
    }

    const u1 = mongoose.Types.ObjectId.isValid(currentUserId)
      ? new mongoose.Types.ObjectId(currentUserId)
      : currentUserId;
    const u2 = mongoose.Types.ObjectId.isValid(friendId)
      ? new mongoose.Types.ObjectId(friendId)
      : friendId;

    // Tìm kiếm cuộc trò chuyện 1-1 chính xác chứa cả 2 thành viên
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [u1, u2], $size: 2 },
    })
      .populate("participants", "_id name email avatar isOnline lastSeen")
      .populate("lastMessage.sender", "_id name avatar");

    if (!conversation) {
      // Tìm dạng string fallback phòng trường hợp lưu dạng string
      conversation = await Conversation.findOne({
        isGroup: false,
        $and: [
          { participants: String(currentUserId) },
          { participants: String(friendId) },
          { participants: { $size: 2 } },
        ],
      })
        .populate("participants", "_id name email avatar isOnline lastSeen")
        .populate("lastMessage.sender", "_id name avatar");
    }

    if (!conversation) {
      const newConv = await Conversation.create({
        isGroup: false,
        participants: [u1, u2],
      });
      conversation = await Conversation.findById(newConv._id)
        .populate("participants", "_id name email avatar isOnline lastSeen")
        .populate("lastMessage.sender", "_id name avatar");
    }

    return res.status(200).json({
      success: true,
      data: {
        conversation,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/messages/:conversationId
 * Lấy tin nhắn chi tiết của hội thoại
 */
exports.getMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { conversationId } = req.params;

    // Kiểm tra user có thuộc conversation không
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập cuộc trò chuyện này.",
      });
    }

    const messages = await Message.find({ conversationId })
      .populate("sender", "_id name email avatar")
      .populate("reactions.userId", "_id name avatar")
      .sort({ createdAt: 1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      data: {
        messages: messages || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/send
 * Gửi tin nhắn mới (hỗ trợ text, voice message audio, hình ảnh và tệp)
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const {
      conversationId,
      text,
      content,
      image,
      fileUrl,
      fileName,
      fileType,
      fileSize,
      type,
      audioUrl,
      duration,
    } = req.body;

    const trimmedText = typeof (content || text) === "string" ? (content || text).trim() : "";
    const trimmedImage = typeof image === "string" ? image.trim() : "";
    const trimmedFileUrl = typeof fileUrl === "string" ? fileUrl.trim() : "";
    const trimmedAudioUrl = typeof audioUrl === "string" ? audioUrl.trim() : "";

    const messageType =
      type === "audio" || trimmedAudioUrl
        ? "audio"
        : type === "image" || trimmedImage
        ? "image"
        : "text";

    if (
      !conversationId ||
      (!trimmedText && !trimmedImage && !trimmedFileUrl && !trimmedAudioUrl)
    ) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập nội dung tin nhắn, ghi âm giọng nói hoặc đính kèm tệp tin.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền gửi tin nhắn vào cuộc trò chuyện này.",
      });
    }

    const safeFileName = fixUtf8FileName(fileName);

    const message = await Message.create({
      conversationId,
      sender: currentUserId,
      type: messageType,
      text: trimmedText,
      audioUrl: trimmedAudioUrl,
      duration: Number(duration) || 0,
      image: trimmedImage,
      fileUrl: trimmedFileUrl,
      fileName: safeFileName || "",
      fileType: fileType || (messageType === "audio" ? "audio/webm" : ""),
      fileSize: fileSize || 0,
    });

    // Cập nhật lastMessage trong conversation
    let lastText = trimmedText;
    if (!lastText) {
      if (messageType === "audio") lastText = "🎤 [Tin nhắn thoại]";
      else if (trimmedImage) lastText = "[Hình ảnh]";
      else if (trimmedFileUrl) lastText = `[Tài liệu: ${fileName || "Tập tin"}]`;
    }

    conversation.lastMessage = {
      text: lastText,
      sender: currentUserId,
      createdAt: message.createdAt,
    };
    await conversation.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "_id name email avatar")
      .populate("reactions.userId", "_id name avatar");

    // Phát socket realtime tới room conversationId và tới từng participant (nếu chưa join room)
    const io = getIo();
    if (io) {
      io.to(`conversation:${conversationId}`).emit("chat:message", populatedMessage);

      // Nếu là voice message, phát sự kiện new_voice_message chuẩn xác theo yêu cầu
      if (messageType === "audio") {
        io.to(`conversation:${conversationId}`).emit("new_voice_message", populatedMessage);
      }

      // Thông báo cập nhật danh sách hội thoại tới tất cả participants
      conversation.participants.forEach((pId) => {
        io.to(`user:${pId}`).emit("chat:conversation-updated", {
          conversationId,
          lastMessage: conversation.lastMessage,
          message: populatedMessage,
        });
        if (messageType === "audio") {
          io.to(`user:${pId}`).emit("new_voice_message", populatedMessage);
        }
      });
    }

    // Bắn thông báo in-app tới chuông thông báo ở Dashboard của người nhận
    const senderName = populatedMessage?.sender?.name || "Bạn bè";
    let messageSnippet = trimmedText;
    if (!messageSnippet) {
      if (
        trimmedImage ||
        fileType === "image" ||
        fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ) {
        messageSnippet = "📷 Đã gửi một hình ảnh";
      } else if (trimmedFileUrl || fileName) {
        messageSnippet = `📎 Đã gửi tệp đính kèm: ${fileName || "Tài liệu"}`;
      } else {
        messageSnippet = "Đã gửi cho bạn một tin nhắn";
      }
    } else if (trimmedFileUrl || trimmedImage) {
      messageSnippet = `${messageSnippet} [Đính kèm: ${fileName || "Tệp tin"}]`;
    }

    conversation.participants.forEach((pId) => {
      if (String(pId) !== String(currentUserId)) {
        createAndSendNotification({
          recipientId: pId,
          senderId: currentUserId,
          type: "MESSAGE",
          title: `Tin nhắn từ ${senderName}`,
          message: messageSnippet,
          link: `/dashboard?chat=${conversationId}`,
        }).catch((err) =>
          console.warn("[MessageController] Send in-app notif error:", err.message)
        );
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        message: populatedMessage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/messages/:id/revoke
 * Thu hồi tin nhắn tương tự Messenger của Meta
 */
exports.revokeMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn.",
      });
    }

    // Chỉ người gửi tin nhắn mới có quyền thu hồi
    if (String(message.sender) !== String(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "Bạn chỉ có thể thu hồi tin nhắn do chính bạn gửi.",
      });
    }

    if (message.isRevoked) {
      return res.status(400).json({
        success: false,
        message: "Tin nhắn này đã được thu hồi trước đó.",
      });
    }

    // Dọn dẹp tài nguyên Cloudinary nếu có đính kèm file hoặc ảnh
    const fileToDelete = message.fileUrl || message.image;
    if (fileToDelete) {
      try {
        const { extractCloudinaryInfo } = require("../utils/roomCleanup");
        const cloudinary = require("../config/cloudinary");
        const fileInfo = extractCloudinaryInfo(fileToDelete);
        if (fileInfo?.publicId && cloudinary?.uploader) {
          await cloudinary.uploader.destroy(fileInfo.publicId, {
            resource_type: fileInfo.resourceType || "auto",
            invalidate: true,
          });
        }
      } catch (cloudErr) {
        console.warn("[revokeMessage] Lỗi xóa file Cloudinary:", cloudErr.message);
      }
    }

    // Đánh dấu đã thu hồi và xóa sạch nội dung/tệp đính kèm
    message.isRevoked = true;
    message.revokedAt = new Date();
    message.isRecalled = true;
    message.recalledAt = new Date();
    message.text = "";
    message.image = "";
    message.fileUrl = "";
    message.fileName = "";
    message.fileType = "";
    message.fileSize = 0;
    await message.save();

    const populatedMessage = await Message.findById(message._id).populate(
      "sender",
      "_id name email avatar"
    );

    // Cập nhật conversation lastMessage nếu tin nhắn này là tin mới nhất
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation) {
      const latestMessage = await Message.findOne({
        conversationId: message.conversationId,
      }).sort({ createdAt: -1 });

      if (latestMessage) {
        let lastText = latestMessage.isRevoked
          ? "Tin nhắn đã bị thu hồi"
          : latestMessage.text;
        if (!lastText && !latestMessage.isRevoked) {
          if (latestMessage.image) lastText = "[Hình ảnh]";
          else if (latestMessage.fileUrl)
            lastText = `[Tài liệu: ${latestMessage.fileName || "Tập tin"}]`;
        }
        conversation.lastMessage = {
          text: lastText || "Tin nhắn đã bị thu hồi",
          sender: latestMessage.sender,
          createdAt: latestMessage.createdAt,
        };
        await conversation.save();
      }

      // Phát realtime qua socket tới phòng conversation và các cá nhân
      const io = getIo();
      if (io) {
        const payload = {
          messageId: message._id,
          conversationId: message.conversationId,
          message: populatedMessage,
        };

        // Phát realtime tới các room của conversation
        io.to(`conversation:${message.conversationId}`).emit(
          "chat:message-revoked",
          payload
        );
        io.to(`conversation:${message.conversationId}`).emit(
          "chat:message-recalled",
          payload
        );
        io.to(String(message.conversationId)).emit(
          "chat:message-revoked",
          payload
        );
        io.to(String(message.conversationId)).emit(
          "chat:message-recalled",
          payload
        );

        if (Array.isArray(conversation.participants)) {
          conversation.participants.forEach((pId) => {
            const uidStr = String(pId?._id || pId);
            io.to(`user:${uidStr}`).emit("chat:message-revoked", payload);
            io.to(`user:${uidStr}`).emit("chat:message-recalled", payload);
            io.to(`user:${uidStr}`).emit("chat:conversation-updated", {
              conversationId: conversation._id,
              lastMessage: conversation.lastMessage,
            });
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Đã thu hồi tin nhắn thành công.",
      data: {
        message: populatedMessage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST or PATCH /api/messages/:id/react
 * Thả hoặc hủy cảm xúc (Emoji reaction) phong cách Messenger
 * Body: { emoji }
 */
exports.reactToMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const messageId = req.params.id;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== "string") {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn biểu tượng cảm xúc.",
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn.",
      });
    }

    // BẢO MẬT: Kiểm tra xem user có phải là thành viên trong cuộc trò chuyện chứa tin nhắn này không (chống IDOR)
    const isMember = await Conversation.exists({
      _id: message.conversationId,
      participants: currentUserId,
    });
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền tương tác với tin nhắn trong cuộc trò chuyện này.",
      });
    }

    if (!Array.isArray(message.reactions)) {
      message.reactions = [];
    }

    const existingIndex = message.reactions.findIndex(
      (r) => String(r.userId) === String(currentUserId)
    );

    let userReaction = null;
    if (existingIndex > -1) {
      // Nếu cùng 1 emoji -> Hủy cảm xúc (toggle off)
      if (message.reactions[existingIndex].emoji === emoji) {
        message.reactions.splice(existingIndex, 1);
        userReaction = null;
      } else {
        // Khác emoji -> Cập nhật sang emoji mới
        message.reactions[existingIndex].emoji = emoji;
        message.reactions[existingIndex].createdAt = new Date();
        userReaction = emoji;
      }
    } else {
      // Chưa thả cảm xúc -> Thêm mới
      message.reactions.push({
        userId: currentUserId,
        emoji,
        createdAt: new Date(),
      });
      userReaction = emoji;
    }

    await message.save();

    const populated = await Message.findById(message._id)
      .populate("sender", "_id name email avatar")
      .populate("reactions.userId", "_id name avatar");

    const payload = {
      messageId: String(message._id),
      conversationId: String(message.conversationId),
      reactions: populated.reactions || [],
      userId: String(currentUserId),
      emoji: userReaction,
    };

    const io = getIo();
    if (io) {
      io.to(`conversation:${message.conversationId}`).emit(
        "message_reaction_updated",
        payload
      );
      io.to(`conversation:${message.conversationId}`).emit(
        "chat:message-reaction-updated",
        payload
      );

      const conversation = await Conversation.findById(message.conversationId).select("participants");
      if (conversation?.participants) {
        conversation.participants.forEach((pId) => {
          io.to(`user:${pId}`).emit("message_reaction_updated", payload);
          io.to(`user:${pId}`).emit("chat:message-reaction-updated", payload);
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        messageId: message._id,
        reactions: populated.reactions,
        userReaction,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/messages/conversations/:conversationId
 * Xóa toàn bộ đoạn chat theo phong cách Messenger (Xóa hội thoại và các tin nhắn bên trong)
 */
exports.deleteConversation = async (req, res, next) => {
  try {
    const currentUserId = String(req.user.id || req.user._id);
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ID cuộc trò chuyện cần xóa.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền xóa.",
      });
    }

    const participantIds = conversation.participants.map(String);

    // Xóa tất cả tin nhắn thuộc conversation này
    await Message.deleteMany({ conversationId });
    // Xóa conversation
    await Conversation.deleteOne({ _id: conversationId });

    // Phát socket realtime tới các thành viên tham gia
    const io = getIo();
    if (io) {
      participantIds.forEach((pId) => {
        io.to(`user:${pId}`).emit("chat:conversation-deleted", { conversationId });
        io.to(`user:${pId}`).emit("conversation:deleted", { conversationId });
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đã xóa cuộc trò chuyện thành công.",
      data: { conversationId },
    });
  } catch (error) {
    next(error);
  }
};
