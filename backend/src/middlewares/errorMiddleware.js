const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);

  res.status(statusCode).json({
    success: false,
    message: err.message || "Lỗi máy chủ nội bộ",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

const notFound = (req, res, next) => {
  const error = new Error(`Không tìm thấy: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorHandler, notFound };
