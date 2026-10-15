const mongoose = require("mongoose");

const roomFileSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    messageId: {
      type: String,
      default: "",
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    senderName: {
      type: String,
      default: "Thành viên",
    },
    senderAvatar: {
      type: String,
      default: "",
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      default: "document",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    publicId: {
      type: String,
      default: "",
    },
    resourceType: {
      type: String,
      default: "raw",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying room files sorted by recency
roomFileSchema.index({ roomCode: 1, createdAt: -1 });

const RoomFile = mongoose.models.RoomFile || mongoose.model("RoomFile", roomFileSchema);

module.exports = RoomFile;
