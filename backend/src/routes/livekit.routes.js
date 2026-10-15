const express = require("express");
const { getLiveKitToken } = require("../controllers/livekit.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @route   GET /api/livekit/token
 * @desc    Lấy token truy cập LiveKit Cloud cho phòng và user xác thực
 * @access  Private
 */
router.get("/token", protect, getLiveKitToken);

module.exports = router;
