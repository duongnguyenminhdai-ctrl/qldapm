const mongoose = require("mongoose");

const otpVerificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["REGISTER", "RESET_PASSWORD"],
      required: true,
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Tự động xóa khỏi MongoDB sau khi expiresAt hết hạn (TTL index)
    },
  },
  {
    timestamps: true,
  }
);

// Hỗ trợ truy vấn nhanh theo email + type
otpVerificationSchema.index({ email: 1, type: 1, createdAt: -1 });

const OtpVerification = mongoose.model(
  "OtpVerification",
  otpVerificationSchema
);

module.exports = OtpVerification;
