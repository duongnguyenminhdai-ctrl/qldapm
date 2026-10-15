const mongoose = require("mongoose");

const servicePackageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên gói dịch vụ là bắt buộc"],
      trim: true,
      maxlength: [100, "Tên gói không được quá 100 ký tự"],
    },
    code: {
      type: String,
      required: [true, "Mã gói dịch vụ là bắt buộc"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Giá tiền là bắt buộc"],
      min: [0, "Giá tiền không thể âm"],
    },
    days: {
      type: Number,
      required: [true, "Thời hạn (ngày) là bắt buộc"],
      min: [1, "Thời hạn tối thiểu là 1 ngày"],
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const ServicePackage = mongoose.model("ServicePackage", servicePackageSchema);

module.exports = ServicePackage;
