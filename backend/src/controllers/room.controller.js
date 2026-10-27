const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Room = require("../models/Room");
const { getIo } = require("../config/socketInstance");

// Bộ ký tự tạo mã phòng 6 ký tự in hoa dễ đọc, tránh gây nhầm lẫn (bỏ 0, O, 1, I)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Sinh chuỗi ngẫu nhiên 6 ký tự in hoa
 */
const generateRandomCode = (length = 6) => {
  let result = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS[randomBytes[i] % CODE_CHARS.length];
  }
  return result;
};

/**
 * Sinh roomCode duy nhất bằng cách kiểm tra trùng lặp trong MongoDB
 */
const generateUniqueRoomCode = async () => {
  let code = "";
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    code = generateRandomCode(6);
    const found = await Room.exists({ roomCode: code });
    if (!found) {
      exists = false;
    }
    attempts++;
  }

  if (exists) {
    throw new Error("Không thể tạo mã phòng duy nhất sau nhiều lần thử.");
  }

  return code;
};

/**
 * POST /api/rooms/create
 * Body: { title, description, isPrivate, maxMembers } (title hoặc name)
 */
const createRoom = async (req, res, next) => {
  try {
    const rawTitle = req.body.title || req.body.name;
    const { description, isPrivate, maxMembers, category, accessType } = req.body;

    if (!rawTitle || !rawTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên phòng là bắt buộc.",
      });
    }

    const roomCode = await generateUniqueRoomCode();
    const userId = req.user.id;
    const finalAccessType = accessType === "APPROVAL_REQUIRED" ? "APPROVAL_REQUIRED" : "OPEN";
    const io = getIo();
    const { destroyAndCleanupRoom } = require("../sockets");

    // RÀNG BUỘC: Kiểm tra trong DB nếu user đã là Host của một phòng đang 'active' hoặc 'waiting_host' (còn trong hạn 10 phút)
    const existingActiveRoom = await Room.findOne({
      hostId: userId,
      $or: [{ status: "active" }, { status: "waiting_host" }, { isActive: true }],
    });

    if (existingActiveRoom) {
      if (existingActiveRoom.hostLeftAt) {
        const elapsedMs = Date.now() - new Date(existingActiveRoom.hostLeftAt).getTime();
        if (elapsedMs < 10 * 60 * 1000) {
          return res.status(400).json({
            success: false,
            message: "Bạn đang có phòng học đang hoạt động, không thể tạo thêm phòng mới.",
            roomCode: existingActiveRoom.roomCode,
          });
        } else {
          // Đã quá 10 phút: dọn dẹp phòng cũ đã hết hạn
          const oldCode = (existingActiveRoom.roomCode || "").toUpperCase();
          if (typeof destroyAndCleanupRoom === "function") {
            await destroyAndCleanupRoom(oldCode, io, "Hệ thống", "Hết thời gian chờ phòng cũ");
          } else {
            await Room.updateOne(
              { _id: existingActiveRoom._id },
              { $set: { status: "closed", isActive: false, hostLeftAt: null, participants: [] } }
            );
          }
        }
      } else {
        // Phòng đang thực sự hoạt động và host chưa rời
        return res.status(400).json({
          success: false,
          message: "Bạn đang có phòng học đang hoạt động, không thể tạo thêm phòng mới.",
          roomCode: existingActiveRoom.roomCode,
        });
      }
    }

    // Đảm bảo dọn sạch triệt để mọi phòng ma còn sót lại của user
    await Room.updateMany(
      { hostId: userId, $or: [{ status: "closed" }, { isActive: false }] },
      { $set: { hostLeftAt: null, participants: [] } }
    );

    const isChess = (category && category.trim().toLowerCase() === "chess") || req.body.type === "chess";
    const requestedMax = parseInt(maxMembers, 10) || 20;
    let finalMaxMembers = 20;

    if (isChess) {
      finalMaxMembers = 2;
    } else {
      const isVip = Boolean(req.user?.role === "ADMIN" || req.user?.isPro);
      if (requestedMax > 20) {
        if (!isVip) {
          return res.status(403).json({
            success: false,
            code: "VIP_REQUIRED_MAX_MEMBERS",
            message: "Tính năng mở rộng phòng học trên 20 người (tối đa 60 người) chỉ dành riêng cho tài khoản VIP.",
          });
        }
        finalMaxMembers = Math.min(60, Math.max(2, requestedMax));
      } else {
        finalMaxMembers = Math.max(2, requestedMax);
      }
    }
    const finalCategory = isChess ? "chess" : (category && category.trim() ? category.trim().toLowerCase() : "general");
    const finalType = isChess ? "chess" : "study";

    const room = await Room.create({
      title: rawTitle.trim(),
      description: description ? description.trim() : "",
      roomCode,
      hostId: userId,
      accessType: finalAccessType,
      approvedUsers: [userId],
      pendingMembers: [],
      participants: [
        {
          userId,
          joinedAt: new Date(),
        },
      ],
      isPrivate: Boolean(isPrivate),
      category: finalCategory,
      type: finalType,
      maxMembers: finalMaxMembers,
      isActive: true,
      status: "active",
      hostLeftAt: null,
      chessState: isChess ? {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        whitePlayerId: userId,
        gameStatus: "waiting",
        durationSeconds: 600,
      } : undefined,
    });

    const populatedRoom = await Room.findById(room._id)
      .populate("hostId", "name email avatar isPro title equippedTitle")
      .populate("participants.userId", "name email avatar isPro title equippedTitle");

    // Broadcast realtime cho dashboard & sảnh chờ mà không cần F5
    try {
      if (io) {
        if (!populatedRoom.isPrivate) {
          io.emit("dashboard:room-created", { room: populatedRoom });
          io.emit("room_created", { room: populatedRoom });
        }
        io.emit("room_list_updated", {
          roomCode: populatedRoom.roomCode,
          action: "created",
          room: populatedRoom,
        });
      }
    } catch (_) {}

    return res.status(201).json({
      success: true,
      message: "Tao phong hoc thanh cong.",
      data: {
        room: populatedRoom,
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * POST /api/rooms/join
 * Body: { roomCode }
 */
const joinRoom = async (req, res, next) => {
  try {
    const { roomCode } = req.body;

    if (!roomCode || !roomCode.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập mã phòng.",
      });
    }

    const formattedCode = roomCode.trim().toUpperCase();
    const userId = req.user.id;

    const room = await Room.findOne({
      roomCode: formattedCode,
      isActive: true,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Phòng học không tồn tại hoặc đã kết thúc.",
      });
    }

    // Logic khóa tham gia phòng khác: Trong thời gian 10 phút chờ, Host bị chặn không được tham gia phòng khác
    const pendingHostRoom = await Room.findOne({
      hostId: userId,
      status: "active",
      isActive: true,
      hostLeftAt: { $ne: null },
      roomCode: { $ne: formattedCode },
    });

    if (pendingHostRoom) {
      const elapsedMs = Date.now() - new Date(pendingHostRoom.hostLeftAt).getTime();
      if (elapsedMs < 10 * 60 * 1000) {
        const remainingSeconds = Math.max(0, Math.ceil((10 * 60 * 1000 - elapsedMs) / 1000));
        return res.status(403).json({
          success: false,
          hasPendingHostRoom: true,
          pendingRoomCode: pendingHostRoom.roomCode,
          pendingRoomTitle: pendingHostRoom.title,
          remainingSeconds,
          message: "Bạn đang có một phòng học đang chờ. Hãy quay lại phòng của bạn để tiếp tục hoặc bấm kết thúc phiên học.",
        });
      } else {
        const io = getIo();
        const { destroyAndCleanupRoom } = require("../sockets");
        if (typeof destroyAndCleanupRoom === "function") {
          await destroyAndCleanupRoom(pendingHostRoom.roomCode, io, "Hệ thống", "Hết thời gian chờ phòng cũ");
        }
      }
    }

    // Nếu chính Host quay trở lại phòng của mình -> Hủy bộ đếm timeout và reset hostLeftAt
    if (String(room.hostId) === String(userId) && room.hostLeftAt) {
      await Room.updateOne({ _id: room._id }, { $set: { hostLeftAt: null } });
      try {
        const { cancelHostAbsenceTimer } = require("../sockets");
        if (typeof cancelHostAbsenceTimer === "function") {
          cancelHostAbsenceTimer(formattedCode);
        }
      } catch (_) {}
      const io = getIo();
      if (io) {
        io.to(formattedCode).emit("room:host-returned", {
          message: "Chủ phòng đã quay trở lại cuộc gọi.",
        });
      }
    }

    // Kiểm tra xem phòng có bị khóa tạm thời bởi chủ phòng không
    if (room.isLocked && String(room.hostId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        isLocked: true,
        message: "Phòng học hiện đang bị khóa bởi chủ phòng.",
      });
    }

    // Kiểm tra xem user có bị cấm (banned) khỏi phòng này không
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

    // Kiểm tra quyền truy cập (Waiting Room / Approval required)
    if (room.accessType === "APPROVAL_REQUIRED") {
      const isHost = String(room.hostId) === String(userId);
      const isApproved =
        room.approvedUsers &&
        room.approvedUsers.some((aId) => String(aId) === String(userId));

      if (!isHost && !isApproved) {
        return res.status(403).json({
          success: false,
          requiresApproval: true,
          message: "Phòng học yêu cầu chủ phòng xét duyệt trước khi tham gia.",
          data: {
            room: {
              roomCode: formattedCode,
              title: room.title,
              accessType: room.accessType,
              hostId: room.hostId,
            },
          },
        });
      }
    }

    // Kiểm tra xem user đã có trong participants chưa (so sánh chuỗi ObjectId)
    const alreadyParticipant = room.participants.some(
      (p) => String(p.userId?._id || p.userId || "") === String(userId)
    );

    if (!alreadyParticipant) {
      // Kiểm tra giới hạn số lượng thành viên (tính theo số user duy nhất)
      const uniqueCount = new Set(
        room.participants.map((p) => String(p.userId?._id || p.userId || "")).filter(Boolean)
      ).size;

      if (uniqueCount >= room.maxMembers) {
        return res.status(400).json({
          success: false,
          message: `Phòng học đã đạt giới hạn tối đa (${room.maxMembers} thành viên).`,
        });
      }

      // Cập nhật nguyên tử: chỉ push nếu userId thực sự chưa có trong mảng
      await Room.updateOne(
        {
          _id: room._id,
          "participants.userId": { $ne: userId },
        },
        {
          $push: {
            participants: {
              userId,
              joinedAt: new Date(),
            },
          },
        }
      );
    }

    let populatedRoom = await Room.findById(room._id)
      .populate("hostId", "name email avatar isPro title equippedTitle")
      .populate("participants.userId", "name email avatar isPro title equippedTitle");

    // Khử sạch trùng lặp trong mảng participants nếu có
    if (populatedRoom && Array.isArray(populatedRoom.participants)) {
      const seen = new Set();
      const uniqueParticipants = [];
      let hasDuplicates = false;
      for (const p of populatedRoom.participants) {
        const uId = String(p.userId?._id || p.userId || "");
        if (uId && !seen.has(uId)) {
          seen.add(uId);
          uniqueParticipants.push(p);
        } else if (uId) {
          hasDuplicates = true;
        }
      }
      if (hasDuplicates) {
        await Room.updateOne(
          { _id: room._id },
          {
            $set: {
              participants: uniqueParticipants.map((p) => ({
                userId: p.userId?._id || p.userId,
                joinedAt: p.joinedAt,
              })),
            },
          }
        );
        populatedRoom.participants = uniqueParticipants;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Tham gia phòng thành công.",
      data: {
        room: populatedRoom,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rooms/:roomCode
 * Lấy thông tin phòng theo roomCode để validate trước khi vào
 */
const getRoomByCode = async (req, res, next) => {
  try {
    const codeParam = req.params.roomCode.trim().toUpperCase();

    // Tìm kiếm bằng roomCode, nếu không thấy và là ObjectId thì tìm theo _id
    let room = await Room.findOne({
      roomCode: codeParam,
      isActive: true,
    })
      .populate("hostId", "name email avatar isPro title equippedTitle")
      .populate("participants.userId", "name email avatar isPro title equippedTitle")
      .lean();

    if (!room && codeParam.match(/^[0-9a-fA-F]{24}$/)) {
      room = await Room.findById(codeParam)
        .populate("hostId", "name email avatar isPro title equippedTitle")
        .populate("participants.userId", "name email avatar isPro title equippedTitle")
        .lean();
    }

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        message: "Phòng học không tồn tại hoặc đã đóng.",
      });
    }

    // Khử trùng triệt để mảng participants trước khi trả về client
    if (room && Array.isArray(room.participants)) {
      const seenUIds = new Set();
      const cleanParticipants = [];
      let hadDuplicates = false;
      for (const p of room.participants) {
        const uId = String(p.userId?._id || p.userId || "");
        if (uId && !seenUIds.has(uId)) {
          seenUIds.add(uId);
          cleanParticipants.push(p);
        } else if (uId) {
          hadDuplicates = true;
        }
      }
      room.participants = cleanParticipants;
      if (hadDuplicates) {
        Room.updateOne({ _id: room._id }, { $set: { participants: cleanParticipants } }).catch(() => {});
      }
    }

    // Xác thực userId từ req.user hoặc header token
    let currentUserId = req.user?.id || req.user?._id;
    if (!currentUserId && req.headers.authorization?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(req.headers.authorization.split(" ")[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
        currentUserId = decoded.id;
      } catch (_) {}
    }

    // Kiểm tra logic khóa tham gia phòng khác nếu user là Host của một phòng khác đang chờ
    if (currentUserId) {
      const pendingHostRoom = await Room.findOne({
        hostId: currentUserId,
        status: "active",
        isActive: true,
        hostLeftAt: { $ne: null },
        roomCode: { $ne: room.roomCode },
      });

      if (pendingHostRoom) {
        const elapsedMs = Date.now() - new Date(pendingHostRoom.hostLeftAt).getTime();
        if (elapsedMs < 10 * 60 * 1000) {
          const remainingSeconds = Math.max(0, Math.ceil((10 * 60 * 1000 - elapsedMs) / 1000));
          return res.status(403).json({
            success: false,
            hasPendingHostRoom: true,
            pendingRoomCode: pendingHostRoom.roomCode,
            pendingRoomTitle: pendingHostRoom.title,
            remainingSeconds,
            message: "Bạn đang có một phòng học đang chờ. Hãy quay lại phòng của bạn để tiếp tục hoặc bấm kết thúc phiên học.",
          });
        }
      }

      // Nếu chính Host vào lại phòng của mình -> Hủy bộ đếm timeout và reset hostLeftAt
      if (String(room.hostId?._id || room.hostId) === String(currentUserId) && room.hostLeftAt) {
        await Room.updateOne({ _id: room._id }, { $set: { hostLeftAt: null } });
        try {
          const { cancelHostAbsenceTimer } = require("../sockets");
          if (typeof cancelHostAbsenceTimer === "function") {
            cancelHostAbsenceTimer(room.roomCode);
          }
        } catch (_) {}
        const io = getIo();
        if (io) {
          io.to(room.roomCode).emit("room:host-returned", {
            message: "Chủ phòng đã quay trở lại cuộc gọi.",
          });
        }
        room.hostLeftAt = null;
      }
    }

    // Kiểm tra xem user có bị cấm khỏi phòng không nếu có req.user
    if (
      currentUserId &&
      room.bannedUsers &&
      room.bannedUsers.some((bId) => String(bId) === String(currentUserId))
    ) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        message: "Bạn đã bị cấm tham gia phòng học này.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        room,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rooms
 * Lấy danh sách các phòng đang mở (isActive: true), hỗ trợ query search, category, sort, pagination
 */
const getRooms = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 8));
    const skip = (page - 1) * limit;

    const { search, category, sort } = req.query;
    // Lấy các phòng công khai đang active VÀ có ít nhất 1 thành viên
    const filter = {
      isActive: true,
      status: "active",
      isPrivate: { $ne: true },
      "participants.0": { $exists: true },
    };

    // Tìm kiếm theo tên, mô tả hoặc mã phòng
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { roomCode: { $regex: `^${escaped}`, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
      ];
    }

    // Lọc theo thể loại phòng học
    if (category && category.trim() && category !== "all") {
      filter.category = category.trim().toLowerCase();
    }

    // Lấy user ID nếu có token trong header để tìm phòng chờ của Host
    let currentUserId = req.user?.id || req.user?._id;
    if (!currentUserId && req.headers.authorization?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(req.headers.authorization.split(" ")[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
        currentUserId = decoded.id;
      } catch (_) {}
    }

    let myPendingRoomObj = null;
    if (currentUserId) {
      const myPendingRoom = await Room.findOne({
        hostId: currentUserId,
        status: "active",
        isActive: true,
        hostLeftAt: { $ne: null },
      })
        .populate("hostId", "name email avatar isPro title equippedTitle")
        .populate("participants.userId", "name email avatar isPro title equippedTitle")
        .lean();

      if (myPendingRoom) {
        const elapsedMs = Date.now() - new Date(myPendingRoom.hostLeftAt).getTime();
        if (elapsedMs < 10 * 60 * 1000) {
          const remainingSeconds = Math.max(0, Math.ceil((10 * 60 * 1000 - elapsedMs) / 1000));
          const pObj = { ...myPendingRoom };
          pObj.isMyPendingRoom = true;
          pObj.hostLeftRemainingSeconds = remainingSeconds;
          pObj.participantCount = Array.isArray(pObj.participants) ? pObj.participants.length : 0;
          myPendingRoomObj = pObj;
        } else {
          // Timeout -> tự động dọn dẹp phòng cũ
          const io = getIo();
          const { destroyAndCleanupRoom } = require("../sockets");
          if (typeof destroyAndCleanupRoom === "function") {
            await destroyAndCleanupRoom(myPendingRoom.roomCode, io, "Hệ thống", "Hết thời gian chờ phòng cũ");
          }
        }
      }
    }

    // Chạy song song countDocuments và query rooms qua Promise.all để giảm một nửa độ trễ mạng
    let sortObj = { createdAt: -1 };
    if (sort === "oldest") sortObj = { createdAt: 1 };
    else if (sort === "name_asc") sortObj = { title: 1 };

    const totalItemsPromise = Room.countDocuments(filter);
    let roomsPromise;

    if (sort === "popular") {
      roomsPromise = Room.aggregate([
        { $match: filter },
        {
          $addFields: {
            participantCount: { $size: { $ifNull: ["$participants", []] } },
          },
        },
        { $match: { participantCount: { $gt: 0 } } },
        { $sort: { participantCount: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]).then((aggrRooms) =>
        Room.populate(aggrRooms, [
          { path: "hostId", select: "name email avatar isPro title equippedTitle" },
          { path: "participants.userId", select: "name email avatar isPro title equippedTitle" },
        ])
      );
    } else {
      roomsPromise = Room.find(filter)
        .populate("hostId", "name email avatar isPro title equippedTitle")
        .populate("participants.userId", "name email avatar isPro title equippedTitle")
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean();
    }

    const [totalItems, rooms] = await Promise.all([totalItemsPromise, roomsPromise]);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const paginationMeta = {
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    // Chuẩn hóa và làm sạch participants
    let normalizedRooms = rooms
      .map((r) => {
        const rObj = r.toObject ? r.toObject() : { ...r };
        if (Array.isArray(rObj.participants)) {
          const seen = new Set();
          const uniqueParticipants = [];
          for (const p of rObj.participants) {
            const uId = String(p?.userId?._id || p?.userId || "");
            if (uId && !seen.has(uId)) {
              seen.add(uId);
              uniqueParticipants.push(p);
            }
          }
          rObj.participants = uniqueParticipants;
          rObj.participantCount = uniqueParticipants.length;
        } else {
          rObj.participants = [];
          rObj.participantCount = 0;
        }
        if (myPendingRoomObj && (rObj.roomCode || "").toUpperCase() === (myPendingRoomObj.roomCode || "").toUpperCase()) {
          rObj.isMyPendingRoom = true;
          rObj.hostLeftRemainingSeconds = myPendingRoomObj.hostLeftRemainingSeconds;
        }
        return rObj;
      })
      .filter((r) => (r.participantCount || r.participants?.length || 0) > 0);

    // Ghim phòng của Host lên ĐẦU TIÊN
    if (myPendingRoomObj) {
      const rest = normalizedRooms.filter(
        (r) => (r.roomCode || "").toUpperCase() !== (myPendingRoomObj.roomCode || "").toUpperCase()
      );
      normalizedRooms = [myPendingRoomObj, ...rest];
    }

    return res.status(200).json({
      success: true,
      count: normalizedRooms.length,
      data: {
        rooms: normalizedRooms,
        myPendingRoom: myPendingRoomObj,
        pagination: paginationMeta,
      },
      pagination: paginationMeta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rooms/leave hoặc POST /api/rooms/:roomCode/leave
 * Hỗ trợ cả request từ fetch thông thường (có Authorization header) lẫn navigator.sendBeacon (chứa token/userId trong body).
 * Body: { roomCode, roomId, userId, token }
 */
const leaveRoom = async (req, res, next) => {
  try {
    const rawCode =
      req.params?.roomCode ||
      req.body?.roomCode ||
      req.body?.roomId ||
      req.query?.roomCode;

    if (!rawCode) {
      return res.status(400).json({
        success: false,
        message: "Mã phòng (roomCode) là bắt buộc.",
      });
    }

    // 1. Xác thực danh tính người dùng (Bắt buộc lấy trực tiếp từ token qua req.user, triệt tiêu việc nhận req.body.userId giả mạo)
    let userId = req.user?._id || req.user?.id;

    if (!userId) {
      let token = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      } else if (req.body?.token) {
        token = req.body.token;
      } else if (req.query?.token) {
        token = req.query.token;
      }

      if (token && process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
          userId = decoded.id || decoded._id;
        } catch (_) {}
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không xác định được danh tính người dùng rời phòng. Vui lòng đăng nhập lại.",
      });
    }

    const uIdStr = String(userId);
    const codeParam = String(rawCode).trim().toUpperCase();

    // 2. Tìm kiếm phòng học theo roomCode hoặc _id
    let room = await Room.findOne({
      roomCode: codeParam,
      isActive: true,
    });

    if (!room && codeParam.match(/^[0-9a-fA-F]{24}$/)) {
      room = await Room.findById(codeParam);
    }

    if (!room) {
      return res.status(200).json({
        success: true,
        message: "Phòng học không tồn tại hoặc đã được dọn sạch trước đó.",
      });
    }

    const normalizedCode = room.roomCode.toUpperCase();
    const hostIdStr = String(room.hostId?._id || room.hostId || "");
    const isHost = hostIdStr === uIdStr;
    const io = getIo();
    const roomAgeMs = Date.now() - new Date(room.createdAt).getTime();

    // 3. Nếu là Chủ phòng (Host) rời phòng
    const isLeaveOnly = req.body?.action === "leave_only" || req.body?.terminate === false;
    const shouldTerminate = req.body?.terminate === true || req.body?.action === "terminate" || (!isLeaveOnly && (!room.participants || room.participants.length <= 1));

    if (isHost && shouldTerminate) {
      const { destroyAndCleanupRoom } = require("../sockets");
      if (typeof destroyAndCleanupRoom === "function") {
        await destroyAndCleanupRoom(normalizedCode, io, "Chủ phòng", "Chủ phòng đã kết thúc phiên học");
      } else {
        await Room.deleteMany({ _id: room._id });
        if (io) {
          io.emit("dashboard:room-deleted", { roomCode: normalizedCode });
          io.emit("room_list_updated", { roomCode: normalizedCode, action: "deleted" });
          io.emit("room:deleted", { roomCode: normalizedCode });
          io.emit("room_terminated", { message: "Chủ phòng đã kết thúc phiên học", reason: "host_terminated" });
        }
      }

      return res.status(200).json({
        success: true,
        isHost: true,
        terminated: true,
        message: "Chủ phòng đã kết thúc phiên học cho mọi người.",
      });
    }

    // 4. Nếu là thành viên thông thường hoặc Host chọn 'Chỉ rời cuộc gọi' -> Loại bỏ khỏi danh sách participants
    if (isHost && isLeaveOnly) {
      await Room.updateOne(
        { _id: room._id },
        {
          $set: { hostLeftAt: new Date() },
          $pull: {
            participants: {
              userId: uIdStr,
            },
          },
        }
      );
      const { startHostAbsenceTimer } = require("../sockets");
      if (typeof startHostAbsenceTimer === "function") {
        startHostAbsenceTimer(normalizedCode, io, req.body?.userName || "Chủ phòng");
      }
    } else {
      await Room.updateOne(
        { _id: room._id },
        {
          $pull: {
            participants: {
              userId: uIdStr,
            },
          },
        }
      );
    }

    const updatedRoom = await Room.findById(room._id)
      .populate("hostId", "name email avatar isPro title equippedTitle")
      .populate("participants.userId", "name email avatar isPro title equippedTitle");

    // Nếu không còn thành viên nào trong phòng -> Dọn sạch và đóng phòng ngay để tránh phòng ma
    if (!updatedRoom || !updatedRoom.participants || updatedRoom.participants.length === 0) {
      const { destroyAndCleanupRoom } = require("../sockets");
      if (typeof destroyAndCleanupRoom === "function") {
        await destroyAndCleanupRoom(normalizedCode, io, "Hệ thống");
      } else {
        await Room.deleteMany({ _id: room._id });
        if (io) {
          io.emit("dashboard:room-deleted", { roomCode: normalizedCode });
          io.emit("room_list_updated", { roomCode: normalizedCode, action: "deleted" });
          io.emit("room:deleted", { roomCode: normalizedCode });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Phòng học không còn người tham gia và đã được tự động dọn sạch.",
        membersCount: 0,
      });
    }

    // Nếu vẫn còn thành viên -> Broadcast cập nhật lại số lượng và danh sách cho các client khác
    const remainingParticipants = updatedRoom.participants || [];
    const membersCount = remainingParticipants.length;

    if (io) {
      const { emitUserLeftSafely } = require("../sockets");
      if (typeof emitUserLeftSafely === "function") {
        emitUserLeftSafely(io, normalizedCode, uIdStr, null, req.body?.userName || "Thành viên");
      } else {
        io.to(normalizedCode).emit("room:user-left", {
          userId: uIdStr,
          name: req.body?.userName || "Thành viên",
        });
      }
      io.to(normalizedCode).emit("room:members-sync", {
        roomCode: normalizedCode,
        participants: remainingParticipants,
        membersCount,
        hostId: updatedRoom.hostId,
      });
      io.emit("room:members-sync", {
        roomCode: normalizedCode,
        participants: remainingParticipants,
        membersCount,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rời phòng thành công.",
      membersCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/rooms/:roomCode/settings
 * Body: { maxMembers, accessType, title, description }
 * Cập nhật cấu hình phòng học (sức chứa maxMembers, quyền truy cập).
 * Chỉ Host hoặc ADMIN mới có quyền. Sức chứa > 20 yêu cầu tài khoản VIP.
 */
const updateRoomSettings = async (req, res, next) => {
  try {
    const { roomCode } = req.params;
    const { maxMembers, accessType, title, description } = req.body;
    const userId = String(req.user.id || req.user._id);

    if (!roomCode) {
      return res.status(400).json({ success: false, message: "Mã phòng không hợp lệ." });
    }

    const normalizedCode = roomCode.trim().toUpperCase();
    const room = await Room.findOne({ roomCode: normalizedCode });
    if (!room) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng học." });
    }

    // Chỉ Host hoặc ADMIN mới có quyền chỉnh sửa
    const isHost = String(room.hostId) === userId;
    const isAdmin = req.user.role === "ADMIN";
    if (!isHost && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Chỉ chủ phòng mới có quyền thay đổi cài đặt phòng học.",
      });
    }

    const updateFields = {};

    if (maxMembers !== undefined && room.category !== "chess") {
      const parsedMax = parseInt(maxMembers, 10);
      if (isNaN(parsedMax) || parsedMax < 2) {
        return res.status(400).json({
          success: false,
          message: "Sức chứa tối thiểu của phòng học là 2 người.",
        });
      }

      const isVip = Boolean(req.user?.role === "ADMIN" || req.user?.isPro);
      if (parsedMax > 20 && !isVip) {
        return res.status(403).json({
          success: false,
          code: "VIP_REQUIRED_MAX_MEMBERS",
          message: "Tính năng nâng sức chứa phòng học lên trên 20 người (tối đa 60 người) chỉ dành riêng cho tài khoản VIP.",
        });
      }

      updateFields.maxMembers = Math.min(60, Math.max(2, parsedMax));
    }

    if (accessType && ["OPEN", "APPROVAL_REQUIRED"].includes(accessType)) {
      updateFields.accessType = accessType;
    }
    if (title && title.trim()) {
      updateFields.title = title.trim();
    }
    if (description !== undefined) {
      updateFields.description = String(description).trim();
    }

    const updated = await Room.findByIdAndUpdate(room._id, { $set: updateFields }, { new: true })
      .populate("hostId", "name email avatar isPro title equippedTitle");

    const io = getIo();
    if (io) {
      io.to(normalizedCode).emit("room:settings-updated", {
        roomCode: normalizedCode,
        maxMembers: updated.maxMembers,
        accessType: updated.accessType,
        title: updated.title,
        description: updated.description,
      });
      io.emit("room_list_updated", { roomCode: normalizedCode, action: "updated" });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật cài đặt phòng học thành công.",
      data: { room: updated },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomByCode,
  getRooms,
  updateRoomSettings,
};

