const express = require("express");
const { askAITutor } = require("../controllers/aiTutor.controller");
const { protect, requirePro } = require("../middlewares/authMiddleware");

const router = express.Router();

// Yêu cầu xác thực token và kiểm tra quyền VIP (người dùng đã mua gói tháng/pro hoặc admin)
router.use(protect);
router.use(requirePro);

// POST /api/ai/tutor
router.post("/tutor", askAITutor);

module.exports = router;

