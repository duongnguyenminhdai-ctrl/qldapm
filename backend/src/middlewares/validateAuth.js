const { body, validationResult } = require("express-validator");

/**
 * Chuẩn hóa lỗi express-validator thành object theo field + message tiếng Việt.
 * Response 400: { success, message, errors: { field: message } }
 */
const handleValidationErrors = (req, res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const errors = {};
  for (const item of result.array({ onlyFirstError: true })) {
    const field = item.path || item.param;
    if (field && !errors[field]) {
      errors[field] = item.msg;
    }
  }

  const firstMessage = Object.values(errors)[0] || "Dữ liệu không hợp lệ.";

  return res.status(400).json({
    success: false,
    message: firstMessage,
    errors,
  });
};

const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Họ và tên không được để trống.")
    .isLength({ max: 50 })
    .withMessage("Họ và tên không được vượt quá 50 ký tự."),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email không được để trống.")
    .isEmail()
    .withMessage("Email không đúng định dạng.")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Mật khẩu không được để trống.")
    .isLength({ min: 6 })
    .withMessage("Mật khẩu phải từ 6 ký tự trở lên."),
  handleValidationErrors,
];

const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email không được để trống.")
    .isEmail()
    .withMessage("Email không đúng định dạng.")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Mật khẩu không được để trống."),
  handleValidationErrors,
];

const updateProfileValidation = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Họ và tên không được để trống.")
    .isLength({ max: 50 })
    .withMessage("Họ và tên không được vượt quá 50 ký tự."),
  body("avatar")
    .optional({ values: "falsy" })
    .trim()
    .isString()
    .withMessage("Avatar không hợp lệ.")
    .isLength({ max: 500 })
    .withMessage("Đường dẫn avatar không được vượt quá 500 ký tự."),
  body("birthYear")
    .optional({ values: "falsy" })
    .isInt({ min: 1920, max: new Date().getFullYear() })
    .withMessage(`Năm sinh phải từ 1920 đến ${new Date().getFullYear()}.`),
  body("phone")
    .optional({ values: "falsy" })
    .trim()
    .matches(/^[0-9+() -]{8,15}$/)
    .withMessage("Số điện thoại không đúng định dạng."),
  body("school")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Địa chỉ/Trường học không vượt quá 100 ký tự."),
  body("bio")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Tiểu sử không vượt quá 300 ký tự."),
  handleValidationErrors,
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Vui lòng nhập mật khẩu hiện tại."),
  body("newPassword")
    .notEmpty()
    .withMessage("Vui lòng nhập mật khẩu mới.")
    .isLength({ min: 6 })
    .withMessage("Mật khẩu mới phải có ít nhất 6 ký tự."),
  body("confirmPassword")
    .notEmpty()
    .withMessage("Vui lòng xác nhận lại mật khẩu mới.")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Xác nhận mật khẩu mới không khớp.");
      }
      return true;
    }),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  handleValidationErrors,
};
