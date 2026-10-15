const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên người dùng là bắt buộc"],
      trim: true,
      maxlength: [50, "Tên không được vượt quá 50 ký tự"],
    },
    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
    password: {
      type: String,
      required: [true, "Mật khẩu là bắt buộc"],
      minlength: [6, "Mật khẩu phải có ít nhất 6 ký tự"],
      select: false,
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "BLOCKED"],
      default: "ACTIVE",
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    authProvider: {
      type: String,
      enum: ["LOCAL", "GOOGLE"],
      default: "LOCAL",
    },
    googleId: {
      type: String,
      default: null,
      index: { sparse: true, unique: true },
    },
    avatar: {
      type: String,
      default: "",
    },
    birthYear: {
      type: Number,
      default: null,
      min: [1900, "Năm sinh không hợp lệ"],
      max: [new Date().getFullYear(), "Năm sinh không được vượt quá năm hiện tại"],
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    school: {
      type: String,
      default: "",
      trim: true,
      maxlength: [100, "Địa chỉ/Trường học không vượt quá 100 ký tự"],
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: [300, "Tiểu sử không vượt quá 300 ký tự"],
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequests: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    isPro: {
      type: Boolean,
      default: false,
    },
    proExpiresAt: {
      type: Date,
      default: null,
    },
    title: {
      type: String,
      default: "Học viên",
    },
    equippedTitle: {
      type: String,
      default: "Nhập môn học giả",
    },
    unlockedTitleIds: {
      type: [String],
      default: ["nhap-mon-hoc-gia", "thieu-uy"],
    },
    streak: {
      type: Number,
      default: 1,
    },
    totalStudySeconds: {
      type: Number,
      default: 0,
    },
    lastStudyDate: {
      type: Date,
      default: null,
    },
    lastStreakAlertSentAt: {
      type: Date,
      default: null,
    },
    proMonths: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
