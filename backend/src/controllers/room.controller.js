const crypto = require("crypto");
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
      category: category && category.trim() ? category.trim().toLowerCase() : "general",
      maxMembers: maxMembers || 20,
      isActive: true,
    });

    const populatedRoom = await Room.findById(room._id)
      .populate("hostId", "name email avatar isPro title equippedTitle")
      .populate("participants.userId", "name email avatar isPro title equippedTitle");

    // Broadcast realtime cho dashboard mà không cần F5 (chỉ phát khi phòng công khai)
    try {
      const io = getIo();
      if (io && !populatedRoom.isPrivate) {
        io.emit("dashboard:room-created", { room: populatedRoom });
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
      .populate("participants.userId", "name email avatar isPro title equippedTitle");

    if (!room && codeParam.match(/^[0-9a-fA-F]{24}$/)) {
      room = await Room.findById(codeParam)
        .populate("hostId", "name email avatar isPro title equippedTitle")
        .populate("participants.userId", "name email avatar isPro title equippedTitle");
    }

    if (!room || !room.isActive) {
      return res.status(404).json({
        success: false,
        message: "Phòng học không tồn tại hoặc đã đóng.",
      });
    }

    // Kiểm tra xem user có bị cấm khỏi phòng không nếu có req.user
    if (
      req.user &&
      room.bannedUsers &&
      room.bannedUsers.some((bId) => String(bId) === String(req.user.id))
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
    const filter = { isActive: true, isPrivate: false };

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

    // Đếm tổng số lượng bản ghi thỏa mãn bộ lọc
    const totalItems = await Room.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    let rooms;
    if (sort === "popular") {
      // Sắp xếp theo số lượng thành viên đang tham gia (nhiều nhất trước)
      rooms = await Room.aggregate([
        { $match: filter },
        {
          $addFields: {
            participantCount: { $size: { $ifNull: ["$participants", []] } },
          },
        },
        { $sort: { participantCount: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]);
      // Populate hostId và participants.userId cho aggregation
      rooms = await Room.populate(rooms, [
        { path: "hostId", select: "name email avatar isPro title equippedTitle" },
        { path: "participants.userId", select: "name email avatar isPro title equippedTitle" },
      ]);
    } else {
      let sortObj = { createdAt: -1 };
      if (sort === "oldest") sortObj = { createdAt: 1 };
      else if (sort === "name_asc") sortObj = { title: 1 };

      rooms = await Room.find(filter)
        .populate("hostId", "name email avatar isPro title equippedTitle")
        .populate("participants.userId", "name email avatar isPro title equippedTitle")
        .sort(sortObj)
        .skip(skip)
        .limit(limit);
    }

    const paginationMeta = {
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    // Chuẩn hóa và làm sạch participants cho mỗi phòng khi gửi về client
    const normalizedRooms = rooms.map((r) => {
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
      }
      return rObj;
    });

    return res.status(200).json({
      success: true,
      count: normalizedRooms.length,
      data: {
        rooms: normalizedRooms,
        pagination: paginationMeta,
      },
      pagination: paginationMeta,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  joinRoom,
  getRoomByCode,
  getRooms,
};

