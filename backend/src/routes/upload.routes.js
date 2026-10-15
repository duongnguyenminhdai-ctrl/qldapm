const express = require("express");
const { uploadFile, getRoomFiles, saveRoomFile } = require("../controllers/upload.controller");
const { upload } = require("../middlewares/uploadMiddleware");
const { protect, optionalProtect } = require("../middlewares/authMiddleware");

const router = express.Router();

// POST /api/upload - Upload file lên Cloudinary (Yêu cầu đăng nhập)
router.post("/", protect, upload.single("file"), uploadFile);

// GET /api/upload/rooms/:roomCode/files - Lấy danh sách tài liệu phòng
router.get("/rooms/:roomCode/files", optionalProtect, getRoomFiles);

// POST /api/upload/rooms/:roomCode/files - Lưu tài liệu chia sẻ trong phòng (Yêu cầu đăng nhập)
router.post("/rooms/:roomCode/files", protect, saveRoomFile);

module.exports = router;
