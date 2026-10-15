const { uploadBufferToCloudinary } = require("../middlewares/uploadMiddleware");
const RoomFile = require("../models/RoomFile");
const Room = require("../models/Room");
const { getIo } = require("../config/socketInstance");
const { sendNotificationToMultiple } = require("../services/notification.service");

/**
 * POST /api/upload
 * Nhận file từ multipart/form-data và upload lên Cloudinary
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng đính kèm file cần tải lên.",
      });
    }

    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    return res.status(200).json({
      success: true,
      message: "Tải file lên thành công.",
      data: {
        fileUrl: result.fileUrl,
        fileName: result.fileName,
        fileType: result.fileType,
        fileSize: result.fileSize,
        publicId: result.publicId,
        resourceType: result.resourceType,
      },
    });
  } catch (error) {
    console.error("[Upload] Error uploading to Cloudinary:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể tải file lên Cloudinary.",
    });
  }
};

/**
 * GET /api/rooms/:roomCode/files
 * Lấy danh sách tài liệu đã được chia sẻ trong phòng học kèm search, filter, sort, pagination
 */
const getRoomFiles = async (req, res) => {
  try {
    const roomCode = (req.params.roomCode || "").trim().toUpperCase();
    if (!roomCode) {
      return res.status(400).json({
        success: false,
        message: "Mã phòng không hợp lệ.",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 6));
    const skip = (page - 1) * limit;

    const { search, fileType, sort } = req.query;
    const filter = { roomCode };

    // Tìm kiếm theo tên file hoặc tên người gửi
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { fileName: { $regex: escaped, $options: "i" } },
        { senderName: { $regex: escaped, $options: "i" } },
      ];
    }

    // Lọc theo loại tệp
    if (fileType && fileType !== "all") {
      const type = fileType.trim().toLowerCase();
      if (type === "image") {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { fileType: "image" },
            { fileName: { $regex: /\.(jpg|jpeg|png|webp|gif|svg)$/i } },
          ],
        });
      } else if (type === "document") {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { fileType: "document" },
            { fileName: { $regex: /\.(pdf|doc|docx|txt|xls|xlsx|ppt|pptx)$/i } },
          ],
        });
      } else if (type === "code") {
        filter.$and = filter.$and || [];
        filter.$and.push({
          fileName: { $regex: /\.(js|jsx|ts|tsx|py|cpp|c|html|css|json|java|sql|md)$/i },
        });
      } else if (type === "archive") {
        filter.$and = filter.$and || [];
        filter.$and.push({
          fileName: { $regex: /\.(zip|rar|7z|tar|gz)$/i },
        });
      }
    }

    // Xác định kiểu sắp xếp
    let sortObj = { createdAt: -1 };
    if (sort === "oldest") sortObj = { createdAt: 1 };
    else if (sort === "size_desc") sortObj = { fileSize: -1, createdAt: -1 };
    else if (sort === "name_asc") sortObj = { fileName: 1 };

    const totalItems = await RoomFile.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const files = await RoomFile.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .populate("senderId", "name email avatar");

    const paginationMeta = {
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return res.status(200).json({
      success: true,
      count: files.length,
      data: {
        files,
        pagination: paginationMeta,
      },
      files,
      pagination: paginationMeta,
    });
  } catch (error) {
    console.error("[RoomFile] Error getRoomFiles:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách tài liệu phòng học.",
    });
  }
};

/**
 * POST /api/rooms/:roomCode/files
 * Lưu metadata tài liệu đã chia sẻ trong phòng học
 */
const saveRoomFile = async (req, res) => {
  try {
    const roomCode = (req.params.roomCode || "").trim().toUpperCase();
    const { fileUrl, fileName, fileType, fileSize } = req.body;

    if (!roomCode || !fileUrl || !fileName) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin file hoặc mã phòng.",
      });
    }

    const currentUserId = req.user.id;
    const userDoc = await User.findById(currentUserId).select("name avatar");

    const newRoomFile = await RoomFile.create({
      roomCode,
      senderId: currentUserId,
      senderName: userDoc?.name || "Thành viên",
      senderAvatar: userDoc?.avatar || "",
      fileUrl,
      fileName,
      fileType: fileType || "document",
      fileSize: fileSize || 0,
      publicId: req.body.publicId || "",
      resourceType: req.body.resourceType || (fileType === "image" ? "image" : "raw"),
    });

    const populated = await RoomFile.findById(newRoomFile._id).populate(
      "senderId",
      "name email avatar"
    );

    // Phát socket realtime tới roomCode
    const io = getIo();
    if (io) {
      io.to(roomCode).emit("room:file-shared", populated);

      // Bắn thông báo realtime tới phòng học (chỉ tồn tại trong phiên phòng học)
      const roomNotif = {
        id: `rn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: fileType === "image" ? "IMAGE_SHARED" : "FILE_SHARED",
        senderId: String(validSenderId || ""),
        senderName: sender?.name || req.body.senderName || "Thành viên",
        senderAvatar: sender?.avatar || req.body.senderAvatar || "",
        title: fileType === "image" ? "Ảnh mới trong phòng" : "Tài liệu mới trong phòng",
        message: `${sender?.name || req.body.senderName || "Thành viên"} vừa chia sẻ "${fileName}"`,
        fileUrl,
        fileName,
        fileType: fileType || "document",
        createdAt: new Date().toISOString(),
      };

      try {
        const initSocket = require("../sockets/index");
        if (typeof initSocket.addRoomNotification === "function") {
          initSocket.addRoomNotification(roomCode, roomNotif, io);
        } else {
          io.to(roomCode).emit("room:notification-new", roomNotif);
        }
      } catch (_) {
        io.to(roomCode).emit("room:notification-new", roomNotif);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Chia sẻ tài liệu vào phòng thành công.",
      data: populated,
    });
  } catch (error) {
    console.error("[RoomFile] Error saveRoomFile:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lưu tài liệu phòng học.",
    });
  }
};

module.exports = {
  uploadFile,
  getRoomFiles,
  saveRoomFile,
};
