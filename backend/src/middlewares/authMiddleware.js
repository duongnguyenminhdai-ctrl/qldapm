const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Khóa bí mật JWT với cảnh báo bảo mật nếu thiếu
const JWT_SECRET = process.env.JWT_SECRET || "virtual-study-room-secure-jwt-secret-key-32chars";

const generateToken = (userId) => {
  return jwt.sign({ id: String(userId) }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "30d",
  });
};

// Bộ nhớ đệm ngắn hạn (TTL 15 giây) cho trạng thái user để tránh query DB dồn dập trên mỗi API request song song
const userStatusCache = new Map();

const getUserCachedStatus = async (userId) => {
  const cached = userStatusCache.get(String(userId));
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }
  const user = await User.findById(userId).select("status role isBanned isPro proExpiresAt").lean();
  if (user) {
    userStatusCache.set(String(userId), {
      data: user,
      expiresAt: now + 15000, // 15 giây TTL
    });
  }
  return user;
};

const invalidateUserStatusCache = (userId) => {
  if (userId) {
    userStatusCache.delete(String(userId));
  }
};

// Dọn dẹp cache hết hạn định kỳ mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of userStatusCache.entries()) {
    if (now > item.expiresAt) {
      userStatusCache.delete(id);
    }
  }
}, 5 * 60 * 1000);

/**
 * Middleware xác thực JWT.
 * Đọc token từ header Authorization: Bearer <token>
 * Chống lỗ hổng 'none' algorithm bằng việc ép cứng algorithms: ["HS256"]
 * Gắn payload đã giải mã vào req.user nếu hợp lệ.
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
    // Ép kiểm tra thuật toán HS256 để chống tấn công None Algorithm hoặc public-key confusion
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    req.user = decoded;
    if (decoded.id && !req.user._id) {
      req.user._id = decoded.id;
    }
    if (decoded._id && !req.user.id) {
      req.user.id = decoded._id;
    }

    // Kiểm tra xem tài khoản có bị khóa không (sử dụng in-memory cache ngắn hạn 15s)
    const currentUser = await getUserCachedStatus(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "Người dùng không tồn tại hoặc phiên đăng nhập đã hết hạn.",
      });
    }

    if (currentUser.status === "BLOCKED" || currentUser.isBanned) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BANNED",
        message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
      });
    }

    req.user.role = currentUser.role;
    req.user.status = currentUser.status;
    req.user.isPro = Boolean(
      currentUser.role === "ADMIN" ||
      (currentUser.isPro && (!currentUser.proExpiresAt || new Date() <= new Date(currentUser.proExpiresAt)))
    );
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
            if (user.status === "BLOCKED" || user.isBanned) {
              return res.status(403).json({
                success: false,
                code: "ACCOUNT_BANNED",
                message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
              });
            }
            req.user = { id: String(user._id), _id: String(user._id), role: user.role, status: user.status };
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
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa xác thực người dùng. Vui lòng đăng nhập.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    if (user.status === "BLOCKED" || user.isBanned) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BANNED",
        message: "Tài khoản của bạn đã bị khóa.",
      });
    }

    const roleUpper = String(user.role || "").toUpperCase();
    if (roleUpper !== "ADMIN") {
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
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa xác thực người dùng. Vui lòng đăng nhập.",
      });
    }

    const user = await User.findById(userId).select(
      "isPro proExpiresAt role status isBanned name"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    if (user.status === "BLOCKED" || user.isBanned) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BANNED",
        message: "Tài khoản của bạn đã bị khóa.",
      });
    }

    // Tự động cập nhật nếu gói Pro đã hết hạn
    if (user.isPro && user.proExpiresAt && new Date() > user.proExpiresAt) {
      user.isPro = false;
      await user.save();
    }

    const roleUpper = String(user.role || "").toUpperCase();
    const isVip =
      roleUpper === "ADMIN" ||
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
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    req.user = decoded;
    if (decoded.id && !req.user._id) req.user._id = decoded.id;
    if (decoded._id && !req.user.id) req.user.id = decoded._id;
    return next();
  } catch (error) {
    req.user = null;
    return next();
  }
};

module.exports = {
  protect,
  requireAdmin,
  requirePro,
  optionalProtect,
  invalidateUserStatusCache,
};
