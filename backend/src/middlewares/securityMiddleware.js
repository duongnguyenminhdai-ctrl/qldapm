/**
 * Middleware bảo mật Header (thay thế/bổ trợ Helmet) & Rate Limiting (chống Brute-Force).
 */

const securityHeaders = (req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), display-capture=(self), geolocation=()"
  );

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
};

// Lưu trữ số lần request theo IP trong bộ nhớ RAM
const ipRequests = new Map();

// Dọn dẹp IP hết hạn định kỳ mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRequests.entries()) {
    if (now > data.resetTime) {
      ipRequests.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate Limiter cho các endpoint xác thực nhạy cảm (Login, Register, OTP).
 * Tối đa 25 request trong 5 phút trên một địa chỉ IP.
 */
const authRateLimiter = (req, res, next) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "127.0.0.1";

  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 phút
  const maxRequests = 30; // 30 requests

  const record = ipRequests.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count += 1;
  }

  ipRequests.set(ip, record);

  if (record.count > maxRequests) {
    const retrySec = Math.ceil((record.resetTime - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `Quá nhiều yêu cầu đăng nhập/xác thực từ địa chỉ IP này. Vui lòng thử lại sau ${retrySec} giây.`,
    });
  }

  next();
};

module.exports = {
  securityHeaders,
  authRateLimiter,
};
