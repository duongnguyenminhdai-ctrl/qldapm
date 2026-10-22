const express = require("express");
const { askAITutor } = require("../controllers/aiTutor.controller");
const { protect, requirePro } = require("../middlewares/authMiddleware");
const { aiRateLimiter } = require("../middlewares/securityMiddleware");

const router = express.Router();

// Yêu cầu xác thực token và kiểm tra quyền VIP (người dùng đã mua gói tháng/pro hoặc admin)
router.use(protect);
router.use(requirePro);

// POST /api/ai/tutor (áp dụng rate limiting 20 requests/phút)
router.post("/tutor", aiRateLimiter, askAITutor);

module.exports = router;

