const User = require("../models/User");
const Notification = require("../models/Notification");
const { getIo } = require("../config/socketInstance");

/**
 * POST /api/friends/request
 * Gửi lời mời kết bạn theo email hoặc userId/recipientId
 */
exports.sendFriendRequest = async (req, res, next) => {
  try {
    const { email, recipientId, userId } = req.body;
    const currentUserId = req.user.id;

    const targetId = recipientId || userId;
    let recipient = null;

    if (targetId) {
      recipient = await User.findById(targetId);
      if (!recipient) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy người dùng này.",
        });
      }
    } else if (email && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      recipient = await User.findOne({ email: normalizedEmail });
      if (!recipient) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy người dùng với email này.",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã người dùng hoặc địa chỉ email.",
      });
    }

    if (String(recipient._id) === String(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: "Không thể tự kết bạn với chính mình.",
      });
    }

    // Kiểm tra đã là bạn bè chưa
    const currentUser = await User.findById(currentUserId);
    if (currentUser.friends && currentUser.friends.some((fId) => String(fId) === String(recipient._id))) {
      return res.status(400).json({
        success: false,
        message: "Hai bạn đã là bạn bè rồi.",
      });
    }

    // Kiểm tra recipient đã nhận lời mời chưa
    const alreadyRequested = recipient.friendRequests && recipient.friendRequests.some(
      (reqItem) => String(reqItem.from) === String(currentUserId)
    );
    if (alreadyRequested) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã gửi lời mời kết bạn trước đó rồi. Đang chờ phản hồi.",
      });
    }

    // Nếu người kia đã gửi lời mời cho mình thì tự động accept
    const incomingRequest = currentUser.friendRequests && currentUser.friendRequests.find(
      (reqItem) => String(reqItem.from) === String(recipient._id)
    );
    if (incomingRequest) {
      await User.updateOne(
        { _id: currentUserId },
        {
          $pull: { friendRequests: { from: recipient._id } },
          $addToSet: { friends: recipient._id },
        }
      );

      await User.updateOne(
        { _id: recipient._id },
        {
          $pull: { friendRequests: { from: currentUserId } },
          $addToSet: { friends: currentUserId },
        }
      );

      // Thông báo qua Socket: chỉ phát 1 lần tới recipient và cập nhật friend_status cho currentUser
      const io = getIo();
      if (io) {
        const friendDataForRecipient = {
          _id: currentUser._id,
          id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
          isOnline: currentUser.isOnline,
          lastSeen: currentUser.lastSeen,
        };

        let notifDoc = null;
        try {
          notifDoc = await Notification.create({
            recipient: recipient._id,
            sender: currentUserId,
            type: "FRIEND_ACCEPTED",
            title: "Lời mời kết bạn được chấp nhận",
            message: `${currentUser.name || "Một học viên"} đã chấp nhận lời mời kết bạn của bạn!`,
          });
        } catch (_) {}

        const notifId = notifDoc?._id ? String(notifDoc._id) : `facc_${currentUser._id}_${Date.now()}`;
        const acceptPayload = {
          _id: notifId,
          id: notifId,
          dedupKey: `FRIEND_ACCEPTED_${currentUser._id}`,
          type: "FRIEND_ACCEPTED",
          senderId: String(currentUser._id),
          senderName: currentUser.name || "Một học viên",
          senderAvatar: currentUser.avatar || "",
          title: "Lời mời kết bạn được chấp nhận",
          message: `${currentUser.name || "Một học viên"} đã chấp nhận lời mời kết bạn của bạn!`,
          createdAt: new Date().toISOString(),
        };

        io.to(`user:${recipient._id}`).emit("friend:accepted", {
          friend: friendDataForRecipient,
          friendId: currentUser._id,
        });
        io.to(`user:${recipient._id}`).emit("notification:new", acceptPayload);

        // Chỉ cập nhật trạng thái bạn bè cho currentUser, không bắn notification spam
        io.to(`user:${currentUserId}`).emit("friend_status_updated", {
          friendId: recipient._id,
          isFriend: true,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Người này đã gửi lời mời cho bạn trước đó. Hai bạn đã trở thành bạn bè!",
        data: { autoAccepted: true },
      });
    }

    // Thêm lời mời vào danh sách recipient
    recipient.friendRequests.push({
      from: currentUserId,
      createdAt: new Date(),
    });
    await recipient.save();

    // Tạo notification trong MongoDB
    try {
      await Notification.create({
        recipient: recipient._id,
        sender: currentUserId,
        type: "FRIEND_REQUEST",
        title: "Lời mời kết bạn mới",
        message: `${currentUser.name || "Một học viên"} đã gửi lời mời kết bạn cho bạn.`,
      });
    } catch (_) {}

    // Bắn realtime socket event tới recipient
    const io = getIo();
    if (io) {
      const notifId = `rn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const payload = {
        _id: notifId,
        id: notifId,
        dedupKey: `FRIEND_REQUEST_${currentUser._id}`,
        type: "FRIEND_REQUEST",
        senderId: String(currentUser._id),
        senderName: currentUser.name || "Một học viên",
        senderAvatar: currentUser.avatar || "",
        senderEmail: currentUser.email || "",
        title: "Lời mời kết bạn mới",
        message: `${currentUser.name || "Một học viên"} đã gửi lời mời kết bạn cho bạn.`,
        status: "pending",
        createdAt: new Date().toISOString(),
        from: {
          _id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
        },
      };
      // Chỉ phát 1 sự kiện lời mời kết bạn và 1 sự kiện thông báo tới đúng user nhận
      io.to(`user:${recipient._id}`).emit("receive_friend_request", payload);
      io.to(`user:${recipient._id}`).emit("notification:new", payload);
    }

    return res.status(200).json({
      success: true,
      message: `Đã gửi lời mời kết bạn tới ${recipient.name || recipient.email}!`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/friends/requests
 * Lấy danh sách lời mời kết bạn đang chờ (để hiển thị Notification Bell)
 */
exports.getFriendRequests = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    const user = await User.findById(currentUserId).populate({
      path: "friendRequests.from",
      select: "_id name email avatar isOnline lastSeen",
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    // Lọc bỏ request mà user nguồn bị xóa
    const validRequests = (user.friendRequests || []).filter((reqItem) => reqItem.from);

    return res.status(200).json({
      success: true,
      data: {
        requests: validRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/friends/accept
 * Chấp nhận kết bạn
 */
exports.acceptFriendRequest = async (req, res, next) => {
  try {
    const fromUserId = req.body?.fromUserId || req.body?.senderId;
    const currentUserId = req.user.id;

    if (!fromUserId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ID người gửi lời mời.",
      });
    }

    const currentUser = await User.findById(currentUserId);
    const fromUser = await User.findById(fromUserId);

    if (!currentUser || !fromUser) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    // 1. Kiểm tra xem đã là bạn bè chưa để tránh duplicate
    const isAlreadyFriend =
      currentUser.friends &&
      currentUser.friends.some((f) => String(f) === String(fromUserId));

    if (isAlreadyFriend) {
      // Dọn sạch lời mời nếu còn sót lại
      await User.updateOne(
        { _id: currentUserId },
        { $pull: { friendRequests: { from: fromUserId } } }
      );
      return res.status(200).json({
        success: true,
        message: `Hai bạn đã là bạn bè với ${fromUser.name}!`,
        data: {
          friend: {
            _id: fromUser._id,
            name: fromUser.name,
            email: fromUser.email,
            avatar: fromUser.avatar,
            isOnline: fromUser.isOnline,
            lastSeen: fromUser.lastSeen,
          },
        },
      });
    }

    // 2. Kiểm tra xem lời mời có tồn tại không
    const hasRequest =
      currentUser.friendRequests &&
      currentUser.friendRequests.some(
        (r) => String(r.from?._id || r.from) === String(fromUserId)
      );

    if (!hasRequest) {
      return res.status(200).json({
        success: true,
        alreadyHandled: true,
        message: "Lời mời kết bạn đã được xử lý hoặc không còn hiệu lực.",
        data: {
          friend: {
            _id: fromUser._id,
            name: fromUser.name,
            email: fromUser.email,
            avatar: fromUser.avatar,
            isOnline: fromUser.isOnline,
            lastSeen: fromUser.lastSeen,
          },
        },
      });
    }

    // 3. Cập nhật nguyên tử bằng MongoDB $pull và $addToSet để loại bỏ VersionError
    await User.updateOne(
      { _id: currentUserId },
      {
        $pull: { friendRequests: { from: fromUserId } },
        $addToSet: { friends: fromUserId },
      }
    );

    await User.updateOne(
      { _id: fromUserId },
      {
        $pull: { friendRequests: { from: currentUserId } },
        $addToSet: { friends: currentUserId },
      }
    );

    // Lưu notification vào DB cho User A
    let notifDoc = null;
    try {
      notifDoc = await Notification.create({
        recipient: fromUserId,
        sender: currentUserId,
        type: "FRIEND_ACCEPTED",
        title: "Lời mời kết bạn được chấp nhận",
        message: `${currentUser.name || "Một học viên"} đã chấp nhận lời mời kết bạn của bạn!`,
      });
    } catch (_) {}

    // Bắn realtime socket event: CHỈ 1 lần duy nhất cho người nhận, không phát lại notification cho chính mình
    const io = getIo();
    if (io) {
      const friendDataForA = {
        _id: currentUser._id,
        id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
        isOnline: currentUser.isOnline,
        lastSeen: currentUser.lastSeen,
      };

      const notifId = notifDoc?._id ? String(notifDoc._id) : `facc_${currentUser._id}_${Date.now()}`;
      const acceptNotifForA = {
        _id: notifId,
        id: notifId,
        dedupKey: `FRIEND_ACCEPTED_${currentUser._id}`,
        type: "FRIEND_ACCEPTED",
        senderId: String(currentUser._id),
        senderName: currentUser.name || "Một học viên",
        senderAvatar: currentUser.avatar || "",
        title: "Lời mời kết bạn được chấp nhận",
        message: `${currentUser.name || "Một học viên"} đã chấp nhận lời mời kết bạn của bạn!`,
        createdAt: new Date().toISOString(),
      };

      // 1. Cập nhật danh sách bạn bè cho User A
      io.to(`user:${fromUserId}`).emit("friend:accepted", {
        friend: friendDataForA,
        friendId: currentUser._id,
      });

      // 2. Gửi thông báo cho User A (1 lần duy nhất)
      io.to(`user:${fromUserId}`).emit("notification:new", acceptNotifForA);

      // 3. Cập nhật trạng thái bạn bè cho User B (chỉ status, không gửi notification toast cho người vừa bấm)
      io.to(`user:${currentUserId}`).emit("friend_status_updated", {
        friendId: fromUser._id,
        isFriend: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Đã trở thành bạn bè với ${fromUser.name}!`,
      data: {
        friend: {
          _id: fromUser._id,
          name: fromUser.name,
          email: fromUser.email,
          avatar: fromUser.avatar,
          isOnline: fromUser.isOnline,
          lastSeen: fromUser.lastSeen,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/friends/reject
 * Từ chối lời mời kết bạn
 */
exports.rejectFriendRequest = async (req, res, next) => {
  try {
    const fromUserId = req.body?.fromUserId || req.body?.senderId;
    const currentUserId = req.user.id;

    if (!fromUserId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ID người gửi lời mời.",
      });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    await User.updateOne(
      { _id: currentUserId },
      { $pull: { friendRequests: { from: fromUserId } } }
    );

    return res.status(200).json({
      success: true,
      message: "Đã từ chối lời mời kết bạn.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/friends/list
 * Lấy danh sách bạn bè kèm trạng thái isOnline và lastSeen
 */
exports.getFriendsList = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    const user = await User.findById(currentUserId).populate({
      path: "friends",
      select: "_id name email avatar isOnline lastSeen",
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        friends: user.friends || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/friends/unfriend
 * DELETE /api/friends/:friendId
 * Hủy kết bạn giữa 2 user và đồng bộ realtime qua socket
 */
exports.unfriend = async (req, res, next) => {
  try {
    const friendId = req.body?.friendId || req.body?.targetUserId || req.params?.friendId;
    const currentUserId = req.user.id;

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ID người bạn cần hủy kết bạn.",
      });
    }

    if (String(friendId) === String(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: "Không thể thực hiện thao tác với chính mình.",
      });
    }

    const currentUser = await User.findById(currentUserId);
    const friendUser = await User.findById(friendId);

    if (!currentUser || !friendUser) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    await User.updateOne(
      { _id: currentUserId },
      { $pull: { friends: friendId } }
    );

    await User.updateOne(
      { _id: friendId },
      { $pull: { friends: currentUserId } }
    );

    // Bắn realtime socket events tới cả 2 phía để cập nhật UI ngay lập tức
    const io = getIo();
    if (io) {
      const payloadToFriend = {
        friendId: currentUserId,
        userId: friendId,
        isFriend: false,
      };
      const payloadToCurrent = {
        friendId: String(friendId),
        userId: currentUserId,
        isFriend: false,
      };

      // Gửi cho friendUser
      io.to(`user:${friendId}`).emit("friend_removed", payloadToFriend);
      io.to(`user:${friendId}`).emit("friend:removed", payloadToFriend);
      io.to(`user:${friendId}`).emit("friend_status_updated", payloadToFriend);
      io.to(`user:${friendId}`).emit("friend:status-updated", payloadToFriend);

      // Gửi cho currentUser
      io.to(`user:${currentUserId}`).emit("friend_removed", payloadToCurrent);
      io.to(`user:${currentUserId}`).emit("friend:removed", payloadToCurrent);
      io.to(`user:${currentUserId}`).emit("friend_status_updated", payloadToCurrent);
      io.to(`user:${currentUserId}`).emit("friend:status-updated", payloadToCurrent);
    }

    return res.status(200).json({
      success: true,
      message: `Đã hủy kết bạn với ${friendUser.name || "người dùng"}.`,
      data: {
        friendId,
        isFriend: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

