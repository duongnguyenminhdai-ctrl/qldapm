const User = require("../models/User");
const { getIo } = require("../config/socketInstance");

/**
 * POST /api/friends/request
 * Gửi lời mời kết bạn theo email
 */
exports.sendFriendRequest = async (req, res, next) => {
  try {
    const { email } = req.body;
    const currentUserId = req.user.id;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập địa chỉ email.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Tìm người nhận
    const recipient = await User.findOne({ email: normalizedEmail });
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng với email này.",
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
      currentUser.friends.push(recipient._id);
      currentUser.friendRequests = currentUser.friendRequests.filter(
        (r) => String(r.from) !== String(recipient._id)
      );
      await currentUser.save();

      recipient.friends.push(currentUser._id);
      await recipient.save();

      // Thông báo qua Socket nếu có
      const io = getIo();
      if (io) {
        io.to(`user:${recipient._id}`).emit("friend:accepted", {
          friend: {
            _id: currentUser._id,
            name: currentUser.name,
            email: currentUser.email,
            avatar: currentUser.avatar,
            isOnline: currentUser.isOnline,
            lastSeen: currentUser.lastSeen,
          },
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

    // Bắn realtime socket event tới recipient
    const io = getIo();
    if (io) {
      io.to(`user:${recipient._id}`).emit("friend:request-received", {
        from: {
          _id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
        },
        createdAt: new Date(),
      });
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
    const { fromUserId } = req.body;
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

    // Kiểm tra xem lời mời có tồn tại không
    const hasRequest = currentUser.friendRequests && currentUser.friendRequests.some(
      (r) => String(r.from) === String(fromUserId)
    );

    if (!hasRequest) {
      return res.status(400).json({
        success: false,
        message: "Lời mời kết bạn không tồn tại hoặc đã được xử lý.",
      });
    }

    // Xóa khỏi friendRequests của currentUser
    currentUser.friendRequests = currentUser.friendRequests.filter(
      (r) => String(r.from) !== String(fromUserId)
    );

    // Thêm vào danh sách friends của cả hai nếu chưa có
    if (!currentUser.friends.includes(fromUserId)) {
      currentUser.friends.push(fromUserId);
    }
    await currentUser.save();

    if (!fromUser.friends.includes(currentUserId)) {
      fromUser.friends.push(currentUserId);
      await fromUser.save();
    }

    // Bắn realtime socket event
    const io = getIo();
    if (io) {
      io.to(`user:${fromUserId}`).emit("friend:accepted", {
        friend: {
          _id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
          isOnline: currentUser.isOnline,
          lastSeen: currentUser.lastSeen,
        },
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
    const { fromUserId } = req.body;
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

    currentUser.friendRequests = (currentUser.friendRequests || []).filter(
      (r) => String(r.from) !== String(fromUserId)
    );
    await currentUser.save();

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
