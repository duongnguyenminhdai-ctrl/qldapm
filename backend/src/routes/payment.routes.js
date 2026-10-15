const express = require("express");
const {
  createPaymentUrl,
  vnpayReturn,
  getProStatus,
  getActivePackages,
} = require("../controllers/payment.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// GET  /api/payment/packages        — Danh sách gói dịch vụ đang mở bán
router.get("/packages", getActivePackages);

// POST /api/payment/create-payment-url  — Tạo link thanh toán VNPay
router.post("/create-payment-url", protect, createPaymentUrl);

// GET  /api/payment/vnpay-return        — VNPay redirect callback (KHÔNG có protect, VNPay gọi)
router.get("/vnpay-return", vnpayReturn);

// GET  /api/payment/pro-status          — Kiểm tra trạng thái Pro của user
router.get("/pro-status", protect, getProStatus);

module.exports = router;
