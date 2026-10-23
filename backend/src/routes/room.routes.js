const express = require("express");
const {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomByCode,
  getRooms,
  updateRoomSettings,
} = require("../controllers/room.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// Lấy danh sách phòng công khai
router.get("/", getRooms);

// Tạo phòng mới (yêu cầu đăng nhập)
router.post("/create", protect, createRoom);

// Cập nhật cấu hình phòng (sức chứa maxMembers lên đến 60 người cho VIP, quyền truy cập)
router.patch("/:roomCode/settings", protect, updateRoomSettings);

// Tham gia phòng bằng mã (yêu cầu đăng nhập)
router.post("/join", protect, joinRoom);

// Rời phòng (yêu cầu đăng nhập xác thực token để ngăn giả mạo Host hủy phòng)
router.post("/leave", protect, leaveRoom);
router.post("/:roomCode/leave", protect, leaveRoom);

// Hỗ trợ POST / tương thích cũ nếu có client gọi POST /
router.post("/", protect, createRoom);

// Lấy thông tin phòng bằng mã phòng hoặc ID
router.get("/:roomCode", getRoomByCode);

module.exports = router;
