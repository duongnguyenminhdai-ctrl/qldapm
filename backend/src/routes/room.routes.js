const express = require("express");
const {
  createRoom,
  joinRoom,
  getRoomByCode,
  getRooms,
} = require("../controllers/room.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// Lấy danh sách phòng công khai
router.get("/", getRooms);

// Tạo phòng mới (yêu cầu đăng nhập)
router.post("/create", protect, createRoom);

// Tham gia phòng bằng mã (yêu cầu đăng nhập)
router.post("/join", protect, joinRoom);

// Hỗ trợ POST / tương thích cũ nếu có client gọi POST /
router.post("/", protect, createRoom);

// Lấy thông tin phòng bằng mã phòng hoặc ID
router.get("/:roomCode", getRoomByCode);

module.exports = router;
