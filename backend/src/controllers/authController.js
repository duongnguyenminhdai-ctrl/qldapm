const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const OtpVerification = require("../models/OtpVerification");
const { sendOtpEmail } = require("../utils/mailer");

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role || "USER",
  status: user.status || "ACTIVE",
  birthYear: user.birthYear || null,
  phone: user.phone || "",
  school: user.school || "",
  bio: user.bio || "",
  createdAt: user.createdAt,
  isPro: user.isPro || false,
  proExpiresAt: user.proExpiresAt || null,
  title: user.title || "Học viên",
  equippedTitle: user.equippedTitle || "Nhập môn học giả",
  unlockedTitleIds: user.unlockedTitleIds || ["nhap-mon-hoc-gia", "thieu-uy"],
  streak: user.streak || 1,
  totalStudySeconds: user.totalStudySeconds || 0,
  proMonths: user.proMonths || (user.isPro ? 1 : 0),
  isVerified: user.isVerified ?? true,
  authProvider: user.authProvider || "LOCAL",
});

/**
 * POST /api/auth/register (truyền thống giữ tương thích ngược)
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email này đã được sử dụng.",
        errors: {
          email: "Email này đã được sử dụng.",
        },
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      isVerified: true,
      authProvider: "LOCAL",
    });
    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công.",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email này đã được sử dụng.",
        errors: {
          email: "Email này đã được sử dụng.",
        },
      });
    }
    next(error);
  }
};

/**
 * POST /api/auth/register-request-otp
 * Body: { name, email, password, confirmPassword }
 */
const registerRequestOtp = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Họ và tên là bắt buộc.",
        errors: { name: "Họ và tên là bắt buộc." },
      });
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ.",
        errors: { email: "Email không hợp lệ." },
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự.",
        errors: { password: "Mật khẩu phải có ít nhất 6 ký tự." },
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu xác nhận không khớp.",
        errors: { confirmPassword: "Mật khẩu xác nhận không khớp." },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email này đã được sử dụng.",
        errors: { email: "Email này đã được sử dụng." },
      });
    }

    // Sinh mã OTP 6 số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Xóa OTP cũ cùng loại
    await OtpVerification.deleteMany({ email: cleanEmail, type: "REGISTER" });

    // Lưu bản ghi OtpVerification
    await OtpVerification.create({
      email: cleanEmail,
      otpHash,
      type: "REGISTER",
      data: {
        name: name.trim(),
        password,
      },
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Gửi email OTP qua Nodemailer
    try {
      await sendOtpEmail({
        email: cleanEmail,
        otp,
        type: "REGISTER",
        name: name.trim(),
      });
    } catch (mailError) {
      console.error("[Auth] Lỗi gửi email OTP đăng ký:", mailError);
      return res.status(500).json({
        success: false,
        message: "Không thể gửi email OTP. Vui lòng kiểm tra lại cấu hình email hệ thống.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mã xác thực OTP 6 số đã được gửi tới email của bạn. Vui lòng kiểm tra hòm thư.",
      data: {
        email: cleanEmail,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register-verify-otp
 * Body: { email, otp }
 */
const registerVerifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email và mã OTP là bắt buộc.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const record = await OtpVerification.findOne({
      email: cleanEmail,
      type: "REGISTER",
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) {
      // Nếu không tìm thấy OTP, kiểm tra xem tài khoản vừa được tạo thành công ngay trước đó không (chống duplicate request)
      const recentlyCreated = await User.findOne({
        email: cleanEmail,
        createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
      });

      if (recentlyCreated) {
        const token = generateToken(recentlyCreated._id);
        return res.status(200).json({
          success: true,
          message: "Đăng ký tài khoản thành công!",
          data: {
            user: formatUser(recentlyCreated),
            token,
          },
        });
      }

      return res.status(400).json({
        success: false,
        message: "Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu gửi lại mã.",
      });
    }

    const isMatch = await bcrypt.compare(cleanOtp, record.otpHash);
    if (!isMatch) {
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts >= 5) {
        await OtpVerification.deleteOne({ _id: record._id });
        return res.status(400).json({
          success: false,
          message: "Bạn đã nhập sai mã OTP quá 5 lần. Mã đã bị hủy vì lý do bảo mật. Vui lòng yêu cầu mã mới.",
        });
      }
      await record.save();
      return res.status(400).json({
        success: false,
        message: `Mã OTP không chính xác. Bạn còn ${5 - record.attempts} lần thử.`,
      });
    }

    // Kiểm tra xem email đã được tạo chưa
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      await OtpVerification.deleteMany({ email: cleanEmail, type: "REGISTER" });
      return res.status(409).json({
        success: false,
        message: "Email này đã được đăng ký trước đó.",
      });
    }

    // Tạo User chính thức
    const user = await User.create({
      name: record.data.name,
      email: cleanEmail,
      password: record.data.password,
      isVerified: true,
      authProvider: "LOCAL",
    });

    // Xóa OTP sau khi dùng xong
    await OtpVerification.deleteMany({ email: cleanEmail, type: "REGISTER" });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công!",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password-request-otp
 * Body: { email }
 */
const forgotPasswordRequestOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập địa chỉ email hợp lệ.",
        errors: { email: "Email không hợp lệ." },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Email này chưa được đăng ký trong hệ thống Virtual Study Room.",
        errors: { email: "Email chưa được đăng ký." },
      });
    }

    if (user.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    await OtpVerification.deleteMany({ email: cleanEmail, type: "RESET_PASSWORD" });

    await OtpVerification.create({
      email: cleanEmail,
      otpHash,
      type: "RESET_PASSWORD",
      data: { userId: user._id },
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    try {
      await sendOtpEmail({
        email: cleanEmail,
        otp,
        type: "RESET_PASSWORD",
        name: user.name,
      });
    } catch (mailError) {
      console.error("[Auth] Lỗi gửi email OTP quên mật khẩu:", mailError);
      return res.status(500).json({
        success: false,
        message: "Không thể gửi email OTP. Vui lòng kiểm tra lại cấu hình email hệ thống.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mã xác nhận 6 số đã được gửi tới email của bạn.",
      data: { email: cleanEmail },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password-verify-otp
 * Body: { email, otp }
 */
const forgotPasswordVerifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email và mã OTP là bắt buộc.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const record = await OtpVerification.findOne({
      email: cleanEmail,
      type: "RESET_PASSWORD",
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu gửi lại mã.",
      });
    }

    const isMatch = await bcrypt.compare(cleanOtp, record.otpHash);
    if (!isMatch) {
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts >= 5) {
        await OtpVerification.deleteOne({ _id: record._id });
        return res.status(400).json({
          success: false,
          message: "Bạn đã nhập sai mã OTP quá 5 lần. Mã đã bị hủy vì lý do bảo mật. Vui lòng yêu cầu mã mới.",
        });
      }
      await record.save();
      return res.status(400).json({
        success: false,
        message: `Mã OTP không chính xác. Bạn còn ${5 - record.attempts} lần thử.`,
      });
    }

    // Cấp reset token có thời hạn 15 phút
    const resetToken = jwt.sign(
      { email: cleanEmail, purpose: "RESET_PASSWORD" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.status(200).json({
      success: true,
      message: "Xác thực OTP thành công. Vui lòng nhập mật khẩu mới.",
      data: {
        resetToken,
        email: cleanEmail,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { email, resetToken, newPassword, confirmPassword }
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;

    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin đặt lại mật khẩu.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu xác nhận không khớp.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Xác thực resetToken
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      if (
        decoded.purpose !== "RESET_PASSWORD" ||
        decoded.email !== cleanEmail
      ) {
        return res.status(400).json({
          success: false,
          message: "Token đặt lại mật khẩu không hợp lệ.",
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thao tác lại từ đầu.",
      });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    user.password = newPassword;
    await user.save();

    await OtpVerification.deleteMany({ email: cleanEmail, type: "RESET_PASSWORD" });

    return res.status(200).json({
      success: true,
      message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/resend-otp
 * Body: { email, type: 'REGISTER' | 'RESET_PASSWORD' }
 */
const resendOtp = async (req, res, next) => {
  try {
    const { email, type } = req.body;

    if (!email || !type || !["REGISTER", "RESET_PASSWORD"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Thông tin yêu cầu gửi lại mã không hợp lệ.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const lastRecord = await OtpVerification.findOne({
      email: cleanEmail,
      type,
    }).sort({ createdAt: -1 });

    if (!lastRecord) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy phiên xác thực trước đó. Vui lòng thao tác lại.",
      });
    }

    // Cooldown 45s
    const elapsed = Date.now() - new Date(lastRecord.updatedAt || lastRecord.createdAt).getTime();
    if (elapsed < 45 * 1000) {
      const waitSec = Math.ceil((45 * 1000 - elapsed) / 1000);
      return res.status(429).json({
        success: false,
        message: `Vui lòng chờ ${waitSec} giây trước khi yêu cầu gửi lại mã.`,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    lastRecord.otpHash = otpHash;
    lastRecord.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await lastRecord.save();

    await sendOtpEmail({
      email: cleanEmail,
      otp,
      type,
      name: lastRecord.data?.name || "",
    });

    return res.status(200).json({
      success: true,
      message: "Mã OTP mới đã được gửi tới email của bạn.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/google
 * Body: { credential }
 */
const googleLogin = async (req, res, next) => {
  try {
    const { credential, accessToken } = req.body;

    if (!credential && !accessToken) {
      return res.status(400).json({
        success: false,
        message: "Thiếu token xác thực Google (credential hoặc accessToken).",
      });
    }

    let googleId, email, name, picture;

    if (credential) {
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        return res.status(500).json({
          success: false,
          message: "Chưa cấu hình GOOGLE_CLIENT_ID trên server.",
        });
      }

      const googleClient = new OAuth2Client(googleClientId);
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: googleClientId,
        });
        const payload = ticket.getPayload();
        googleId = payload.sub;
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      } catch (verifyErr) {
        console.error("[Google Auth] Lỗi verifyIdToken:", verifyErr.message);
        return res.status(401).json({
          success: false,
          message: "Xác thực tài khoản Google thất bại hoặc token không hợp lệ.",
        });
      }
    } else if (accessToken) {
      try {
        const userinfoRes = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!userinfoRes.ok) {
          return res.status(401).json({
            success: false,
            message: "Token Google truy cập không hợp lệ hoặc đã hết hạn.",
          });
        }

        const payload = await userinfoRes.json();
        googleId = payload.sub;
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      } catch (tokenErr) {
        console.error("[Google Auth] Lỗi verify accessToken:", tokenErr.message);
        return res.status(401).json({
          success: false,
          message: "Không thể lấy thông tin người dùng từ Google.",
        });
      }
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Không thể lấy thông tin email từ tài khoản Google.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Khởi tạo tài khoản mới từ Google
      const randomPassword = crypto.randomBytes(32).toString("hex");
      user = await User.create({
        name: name || "Học viên Google",
        email: cleanEmail,
        password: randomPassword,
        avatar: picture || "",
        googleId,
        authProvider: "GOOGLE",
        isVerified: true,
        role: "USER",
        status: "ACTIVE",
      });
    } else {
      if (user.status === "BLOCKED") {
        return res.status(403).json({
          success: false,
          message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
        });
      }

      let changed = false;
      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        changed = true;
      }
      if (!user.isVerified) {
        user.isVerified = true;
        changed = true;
      }
      if (changed) {
        await user.save();
      }
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Đăng nhập Google thành công.",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng.",
        errors: {
          email: "Email hoặc mật khẩu không đúng.",
        },
      });
    }

    if (user.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng.",
        errors: {
          password: "Email hoặc mật khẩu không đúng.",
        },
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công.",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: formatUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, avatar, birthYear, phone, school, bio } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Họ và tên không được để trống.",
          errors: { name: "Họ và tên không được để trống." },
        });
      }
      user.name = name.trim();
    }

    if (avatar !== undefined) {
      user.avatar = typeof avatar === "string" ? avatar.trim() : "";
    }

    if (birthYear !== undefined) {
      if (birthYear === null || birthYear === "") {
        user.birthYear = null;
      } else {
        const year = Number(birthYear);
        const currentYear = new Date().getFullYear();
        if (isNaN(year) || year < 1920 || year > currentYear) {
          return res.status(400).json({
            success: false,
            message: `Năm sinh không hợp lệ (từ 1920 đến ${currentYear}).`,
            errors: { birthYear: `Năm sinh không hợp lệ (từ 1920 đến ${currentYear}).` },
          });
        }
        user.birthYear = year;
      }
    }

    if (phone !== undefined) {
      const cleanPhone = typeof phone === "string" ? phone.trim() : "";
      if (cleanPhone && !/^[0-9+() -]{8,15}$/.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: "Số điện thoại không hợp lệ.",
          errors: { phone: "Số điện thoại không hợp lệ." },
        });
      }
      user.phone = cleanPhone;
    }

    if (school !== undefined) {
      user.school = typeof school === "string" ? school.trim().slice(0, 100) : "";
    }

    if (bio !== undefined) {
      user.bio = typeof bio === "string" ? bio.trim().slice(0, 300) : "";
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Cập nhật hồ sơ thành công.",
      data: {
        user: formatUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Xác nhận mật khẩu mới không khớp.",
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
      });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không chính xác.",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công. Vui lòng ghi nhớ mật khẩu mới của bạn.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  registerRequestOtp,
  registerVerifyOtp,
  forgotPasswordRequestOtp,
  forgotPasswordVerifyOtp,
  resetPassword,
  resendOtp,
  googleLogin,
};

