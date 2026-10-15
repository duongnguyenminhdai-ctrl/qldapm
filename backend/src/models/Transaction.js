const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  bankCode: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ["PENDING", "SUCCESS", "FAILED"],
    default: "PENDING",
  },
  vnpayTransactionNo: {
    type: String,
    default: "",
  },
  vnpayResponseCode: {
    type: String,
    default: "",
  },
  packageCode: {
    type: String,
    default: "PRO_1M",
  },
  days: {
    type: Number,
    default: 30,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

transactionSchema.index({ userId: 1, createdAt: -1 });

transactionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
