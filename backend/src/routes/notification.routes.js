const express = require("express");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMessagesBySender,
  checkStreakAlert,
  inviteFriendToRoom,
  downloadTranscript,
} = require("../controllers/notification.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// Tất cả endpoints đều yêu cầu đăng nhập
router.use(protect);

// GET /api/notifications/download-transcript/:fileName - Tải file .txt bản chép lời
router.get("/download-transcript/:fileName", downloadTranscript);

// GET /api/notifications - Lấy danh sách thông báo & unreadCount
router.get("/", getNotifications);

// PATCH /api/notifications/read-all - Đánh dấu toàn bộ đã đọc
router.patch("/read-all", markAllAsRead);

// PATCH /api/notifications/:id/read - Đánh dấu 1 thông báo đã đọc
router.patch("/:id/read", markAsRead);

// DELETE /api/notifications/sender/:senderId - Xóa toàn bộ thông báo tin nhắn từ 1 người gửi
router.delete("/sender/:senderId", deleteMessagesBySender);

// DELETE /api/notifications/:id - Xóa 1 thông báo
router.delete("/:id", deleteNotification);

// POST /api/notifications/streak-check - Kiểm tra và nhắc nhở streak
router.post("/streak-check", checkStreakAlert);

// POST /api/notifications/room-invite - Mời bạn vào phòng
router.post("/room-invite", inviteFriendToRoom);

module.exports = router;
