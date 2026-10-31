const { AccessToken } = require("livekit-server-sdk");
const Room = require("../models/Room");
const User = require("../models/User");

/**
 * Controller sinh token truy cập LiveKit Cloud
 * GET /api/livekit/token?room=:roomCode&username=:username
 */
const getLiveKitToken = async (req, res, next) => {
  try {
    const roomCode = (req.query.room || req.query.roomCode || "").trim().toUpperCase();
    const username = (req.query.username || req.user?.name || "Người dùng").trim();

    if (!roomCode) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã phòng (room hoặc roomCode).",
      });
    }

    const userId = req.user?.id || req.user?._id;
    let dbUser = null;

    // Kiểm tra tính hợp lệ và quyền truy cập phòng của user
    if (userId) {
      const [room, userDoc] = await Promise.all([
        Room.findOne({ roomCode }),
        User.findById(userId).select("name avatar equippedTitle title isPro"),
      ]);
      dbUser = userDoc;

      if (!room || !room.isActive || room.status === "closed") {
        return res.status(404).json({
          success: false,
          message: "Phòng học không tồn tại hoặc đã đóng.",
        });
      }

      if (
        room.bannedUsers &&
        room.bannedUsers.some((bId) => String(bId) === String(userId))
      ) {
        return res.status(403).json({
          success: false,
          isBanned: true,
          message: "Bạn đã bị cấm tham gia phòng học này cho đến khi phòng đóng.",
        });
      }

      const isHost = String(room.hostId) === String(userId);

      // Kiểm tra phòng bị khóa
      if (room.isLocked && !isHost) {
        return res.status(403).json({
          success: false,
          isLocked: true,
          message: "Phòng học hiện đang bị khóa bởi chủ phòng.",
        });
      }

      // Kiểm tra phòng chờ duyệt
      if (room.accessType === "APPROVAL_REQUIRED" && !isHost) {
        const isApproved =
          room.approvedUsers &&
          room.approvedUsers.some((aId) => String(aId) === String(userId));
        if (!isApproved) {
          return res.status(403).json({
            success: false,
            requiresApproval: true,
            message: "Bạn cần được chủ phòng phê duyệt trước khi kết nối âm thanh và hình ảnh.",
          });
        }
      }
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(500).json({
        success: false,
        message: "Server chưa cấu hình LiveKit Cloud credentials (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL).",
      });
    }

    const baseId = String(req.user?.id || req.user?._id || `user_${Date.now()}`);
    const isMultiDevice = Boolean(
      req.body?.isMultiDevice ||
      req.query?.isMultiDevice === "true" ||
      req.query?.multiDevice === "true"
    );
    const identity = isMultiDevice ? `${baseId}_dev_${Date.now().toString(36)}` : baseId;

    // Khởi tạo AccessToken từ LiveKit Server SDK
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: username,
      ttl: "6h",
      metadata: JSON.stringify({
        userId: baseId,
        equippedTitle: dbUser?.equippedTitle || "Nhập môn học giả",
        title: dbUser?.title || "Học viên",
        avatar: dbUser?.avatar || "",
        isPro: Boolean(dbUser?.isPro),
        isMultiDevice,
      }),
    });

    // Cấp quyền tham gia phòng, publish & subscribe audio/video/screen
    at.addGrant({
      room: roomCode,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return res.status(200).json({
      success: true,
      token,
      livekitUrl,
      identity,
      name: username,
      room: roomCode,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLiveKitToken,
};
