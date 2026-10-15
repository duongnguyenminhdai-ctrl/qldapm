const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Room = require("../models/Room");
const {
  createAndSendNotification,
  checkAndSendStreakAlert,
} = require("../services/notification.service");

/**
 * GET /api/notifications
 * Lấy danh sách thông báo của user hiện tại (hỗ trợ phân trang ?page=1&limit=10, sắp xếp createdAt giảm dần), trả kèm unreadCount
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // Chỉ lấy thông báo về kết bạn, chuỗi streak, lời mời phòng và tin nhắn hệ thống (loại trừ tệp phòng học)
    const filter = { recipient: userId, type: { $ne: "FILE_SHARED" } };

    const [unreadCount, totalItems, rawNotifications] = await Promise.all([
      Notification.countDocuments({
        recipient: userId,
        isRead: false,
        type: { $ne: "FILE_SHARED" },
      }),
      Notification.countDocuments(filter),
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "name email avatar"),
    ]);

    // Lọc trùng lặp STREAK_ALERT trong cùng ngày và gộp MESSAGE theo người gửi
    const seenStreakDays = new Set();
    const seenMessageSenders = new Map();
    const notifications = [];

    for (const n of rawNotifications) {
      if (n.type === "STREAK_ALERT") {
        const dayKey = new Date(n.createdAt).toDateString();
        if (seenStreakDays.has(dayKey)) continue;
        seenStreakDays.add(dayKey);
        notifications.push(n);
      } else if (n.type === "MESSAGE" && n.sender?._id) {
        const senderKey = String(n.sender._id);
        if (seenMessageSenders.has(senderKey)) {
          const existingItem = seenMessageSenders.get(senderKey);
          if (!n.isRead) {
            existingItem.unreadMessageCount = (existingItem.unreadMessageCount || 1) + 1;
          }
          continue;
        }
        const itemObj = n.toObject ? n.toObject() : { ...n };
        if (!itemObj.unreadMessageCount) {
          itemObj.unreadMessageCount = 1;
        }
        seenMessageSenders.set(senderKey, itemObj);
        notifications.push(itemObj);
      } else {
        notifications.push(n);
      }
    }

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: {
        notifications,
        unreadCount,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Đánh dấu một thông báo là đã đọc
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "ID thông báo không hợp lệ.",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { $set: { isRead: true } },
      { new: true }
    ).populate("sender", "name email avatar");

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo.",
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu thông báo là đã đọc.",
      data: notification,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Đánh dấu toàn bộ thông báo của user là đã đọc
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu toàn bộ thông báo là đã đọc.",
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/notifications/:id
 * Xóa một thông báo
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "ID thông báo không hợp lệ.",
      });
    }

    const deleted = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo để xóa.",
      });
    }

    // Nếu thông báo là TRANSCRIPT và có đường dẫn file lưu trữ:
    // Kiểm tra xem có thông báo nào khác còn tham chiếu đến file này không,
    // nếu không còn (hoặc đã xóa), xóa file trên đĩa để chống rác hệ thống
    if (deleted.metadata?.transcriptFilePath) {
      try {
        const filePath = deleted.metadata.transcriptFilePath;
        const otherRef = await Notification.findOne({
          _id: { $ne: deleted._id },
          "metadata.transcriptFilePath": filePath,
        });
        if (!otherRef && fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`[Notification] Đã tự động xóa file bản chép lời: ${filePath}`);
        }
      } catch (fileErr) {
        console.warn("[Notification] Lỗi khi xóa file bản chép lời:", fileErr.message);
      }
    }

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      message: "Đã xóa thông báo.",
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/download-transcript/:fileName
 * Tải xuống file text bản chép lời được lưu từ phiên học
 */
exports.downloadTranscript = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tên file cần tải.",
      });
    }

    // Chống path traversal
    const safeFileName = path.basename(fileName);
    const filePath = path.join(__dirname, "../../uploads/transcripts", safeFileName);

    // Kiểm tra quyền: Người dùng phải là người nhận một thông báo chứa file này (hoặc ADMIN)
    const notif = await Notification.findOne({
      recipient: userId,
      type: "TRANSCRIPT",
      "metadata.transcriptFileName": safeFileName,
    });

    if (!notif && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền tải bản chép lời này.",
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File bản chép lời không tồn tại hoặc đã bị xóa.",
      });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(safeFileName)}"`
    );
    return res.sendFile(path.resolve(filePath));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/streak-check
 * Kích hoạt kiểm tra cảnh báo chuỗi học tập (Streak Alert)
 */
exports.checkStreakAlert = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notif = await checkAndSendStreakAlert(userId);

    return res.status(200).json({
      success: true,
      message: notif
        ? "Đã tạo cảnh báo streak thành công."
        : "Không có cảnh báo streak mới cần gửi.",
      data: notif,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/room-invite
 * Mời bạn bè vào phòng học (ROOM_INVITE)
 */
exports.inviteFriendToRoom = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { friendId, roomCode, roomName } = req.body;

    if (!friendId || !roomCode) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin người bạn hoặc mã phòng.",
      });
    }

    const sender = await User.findById(senderId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người bạn này.",
      });
    }

    const notif = await createAndSendNotification({
      recipientId: friendId,
      senderId: senderId,
      type: "ROOM_INVITE",
      title: "Lời mời tham gia phòng học",
      message: `${sender?.name || "Bạn của bạn"} đã mời bạn tham gia phòng học "${roomName || roomCode}".`,
      link: `/room/${roomCode}`,
    });

    return res.status(200).json({
      success: true,
      message: `Đã gửi lời mời tham gia phòng học tới ${friend.name}.`,
      data: notif,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/notifications/sender/:senderId
 * Xóa sạch toàn bộ thông báo tin nhắn từ một người gửi cụ thể (khi mở chat)
 */
exports.deleteMessagesBySender = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const senderId = req.params.senderId;

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      return res.status(400).json({
        success: false,
        message: "ID người gửi không hợp lệ.",
      });
    }

    await Notification.deleteMany({
      recipient: userId,
      sender: senderId,
      type: "MESSAGE",
    });

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
      type: { $ne: "FILE_SHARED" },
    });

    return res.status(200).json({
      success: true,
      message: "Đã xóa toàn bộ thông báo tin nhắn từ người này.",
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};
