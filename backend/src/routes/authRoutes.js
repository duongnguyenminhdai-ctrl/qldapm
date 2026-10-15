const express = require("express");
const {
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
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
} = require("../middlewares/validateAuth");

const router = express.Router();

// Đăng ký & Đăng nhập truyền thống
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);

// Đăng ký xác thực OTP qua Email
router.post("/register-request-otp", registerRequestOtp);
router.post("/register-verify-otp", registerVerifyOtp);

// Quên mật khẩu & Đặt lại mật khẩu qua OTP Email
router.post("/forgot-password-request-otp", forgotPasswordRequestOtp);
router.post("/forgot-password-verify-otp", forgotPasswordVerifyOtp);
router.post("/reset-password", resetPassword);

// Gửi lại mã OTP
router.post("/resend-otp", resendOtp);

// Đăng nhập Google (OAuth2)
router.post("/google", googleLogin);

// Thông tin cá nhân & Đổi mật khẩu
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfileValidation, updateProfile);
router.put("/change-password", protect, changePasswordValidation, changePassword);
router.post("/change-password", protect, changePasswordValidation, changePassword);

module.exports = router;
