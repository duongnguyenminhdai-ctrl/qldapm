const express = require("express");
const {
  askAITutor,
  transcribeAudio,
  summarizeTranscript,
} = require("../controllers/aiTutor.controller");
const { protect, requirePro } = require("../middlewares/authMiddleware");
const { aiRateLimiter } = require("../middlewares/securityMiddleware");

const router = express.Router();

// Yêu cầu xác thực token và kiểm tra quyền VIP (người dùng đã mua gói tháng/pro hoặc admin)
router.use(protect);
router.use(requirePro);

// POST /api/ai/tutor (áp dụng rate limiting 20 requests/phút)
router.post("/tutor", aiRateLimiter, askAITutor);

// POST /api/ai/transcribe-audio (chép lời đoạn âm thanh bằng Gemini)
router.post("/transcribe-audio", transcribeAudio);

// POST /api/ai/summarize-transcript (tóm tắt biên bản buổi học)
router.post("/summarize-transcript", summarizeTranscript);

module.exports = router;
