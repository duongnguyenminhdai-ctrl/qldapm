const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

/**
 * Middleware xác thực JWT.
 * Đọc token từ header Authorization: Bearer <token>
 * Gắn payload đã giải mã vào req.user nếu hợp lệ.
 * Nếu token vừa hết hạn từ người dùng hợp lệ, tự động cấp mới và gửi kèm trong header x-refreshed-token.
 */
const protect = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Không có token xác thực. Vui lòng đăng nhập.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Kiểm tra xem tài khoản có bị khóa không
    const currentUser = await User.findById(decoded.id).select("status role");
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại.",
      });
    }

    if (currentUser.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
      });
    }

    req.user.role = currentUser.role;
    req.user.status = currentUser.status;
    return next();
  } catch (error) {
    // Chỉ cho phép tự động gia hạn nếu token vừa mới hết hạn trong vòng tối đa 2 ngày
    if (error.name === "TokenExpiredError") {
      try {
        const decoded = jwt.decode(token);
        const MAX_REFRESH_GRACE_SEC = 2 * 24 * 60 * 60; // 48 giờ
        const isWithinGracePeriod =
          decoded?.exp && Date.now() / 1000 - decoded.exp <= MAX_REFRESH_GRACE_SEC;

        if (decoded && decoded.id && isWithinGracePeriod) {
          const user = await User.findById(decoded.id);
          if (user) {
            if (user.status === "BLOCKED") {
              return res.status(403).json({
                success: false,
                message: "Tài khoản của bạn đã bị khóa.",
              });
            }
            req.user = { id: String(user._id), role: user.role, status: user.status };
            const newToken = generateToken(user._id);
            res.setHeader("Access-Control-Expose-Headers", "x-refreshed-token");
            res.setHeader("x-refreshed-token", newToken);
            return next();
          }
        }
      } catch (refreshErr) {
        console.warn("[AuthMiddleware] Auto-refresh failed:", refreshErr.message);
      }
    }

    return res.status(401).json({
      success: false,
      message: "Token hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
      error: error.message,
    });
  }
};

/**
 * Middleware phân quyền Quản trị viên (RBAC: ADMIN).
 * Chặn toàn bộ request nếu user không có role ADMIN (trả về 403 Forbidden).
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa xác thực người dùng. Vui lòng đăng nhập.",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    if (user.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa.",
      });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Truy cập bị từ chối: Yêu cầu quyền Quản trị viên (ADMIN).",
      });
    }

    req.adminUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Middleware phân quyền VIP / Pro (người dùng đã mua gói hoặc Admin).
 * Chặn request nếu người dùng chưa nâng cấp gói Pro hoặc gói đã hết hạn.
 */
const requirePro = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Chưa xác thực người dùng. Vui lòng đăng nhập.",
      });
    }

    const user = await User.findById(req.user.id).select(
      "isPro proExpiresAt role status name"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    if (user.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa.",
      });
    }

    // Tự động cập nhật nếu gói Pro đã hết hạn
    if (user.isPro && user.proExpiresAt && new Date() > user.proExpiresAt) {
      user.isPro = false;
      await user.save();
    }

    const isVip =
      user.role === "ADMIN" ||
      (user.isPro && (!user.proExpiresAt || new Date() <= user.proExpiresAt));

    if (!isVip) {
      return res.status(403).json({
        success: false,
        isProRequired: true,
        message:
          "Tính năng Study AI Tutor là đặc quyền dành cho thành viên VIP (gói Pro). Vui lòng nâng cấp tài khoản để sử dụng.",
      });
    }

    req.proUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Middleware xác thực tùy chọn.
 * Nếu có token hợp lệ thì gắn req.user, nếu không có thì vẫn next().
 */
const optionalProtect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    req.user = null;
    return next();
  }
};

module.exports = { protect, requireAdmin, requirePro, optionalProtect };
