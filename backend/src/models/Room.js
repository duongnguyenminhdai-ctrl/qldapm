const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Tên phòng là bắt buộc"],
      trim: true,
      maxlength: [100, "Tên phòng không được vượt quá 100 ký tự"],
    },
    roomCode: {
      type: String,
      required: [true, "Mã phòng là bắt buộc"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
      minlength: [6, "Mã phòng phải có đúng 6 ký tự"],
      maxlength: [6, "Mã phòng phải có đúng 6 ký tự"],
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Chủ phòng là bắt buộc"],
    },
    participants: [participantSchema],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
      index: true,
    },
    hostLeftAt: {
      type: Date,
      default: null,
      index: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Mô tả không được vượt quá 500 ký tự"],
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      default: "general", // "general", "chess", "tech", "languages", "math", "exam", "chill"
      trim: true,
      index: true,
    },
    type: {
      type: String,
      default: "study", // "study" | "chess"
      index: true,
    },
    chessState: {
      fen: {
        type: String,
        default: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      },
      whitePlayerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      blackPlayerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      gameStatus: {
        type: String,
        enum: ["waiting", "in_progress", "ended"],
        default: "waiting",
      },
      winner: {
        type: String,
        default: null,
      },
      startedAt: {
        type: Date,
        default: null,
      },
      durationSeconds: {
        type: Number,
        default: 600,
      },
    },
    maxMembers: {
      type: Number,
      default: 20,
      min: 2,
      max: 50,
    },
    accessType: {
      type: String,
      enum: ["OPEN", "APPROVAL_REQUIRED"],
      default: "OPEN",
    },
    pendingMembers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    approvedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    bannedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for public active room queries on Dashboard & Host pending check
roomSchema.index({ isActive: 1, status: 1, isPrivate: 1, createdAt: -1 });
roomSchema.index({ isActive: 1, status: 1, isPrivate: 1, category: 1, createdAt: -1 });
roomSchema.index({ hostId: 1, status: 1, isActive: 1 });

// Virtual getters để tương thích với các component cũ nếu có
roomSchema.virtual("name").get(function () {
  return this.title;
}).set(function (val) {
  this.title = val;
});

roomSchema.virtual("inviteCode").get(function () {
  return this.roomCode;
});

roomSchema.virtual("host").get(function () {
  return this.hostId;
});

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);

module.exports = Room;
