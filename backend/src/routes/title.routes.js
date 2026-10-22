const express = require("express");
const { getTitles, equipTitle } = require("../controllers/title.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// GET  /api/titles       - Lấy danh sách milestones & titles cùng trạng thái mở khóa
router.get("/", protect, getTitles);

// POST, PUT, PATCH /api/titles/equip - Trang bị danh hiệu đã mở khóa
router
  .route("/equip")
  .post(protect, equipTitle)
  .put(protect, equipTitle)
  .patch(protect, equipTitle);

router
  .route("/equip/:titleId")
  .post(protect, equipTitle)
  .put(protect, equipTitle)
  .patch(protect, equipTitle);

module.exports = router;
