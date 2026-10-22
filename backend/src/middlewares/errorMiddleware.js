const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || "Lỗi máy chủ nội bộ";

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Dữ liệu hoặc mã định danh không hợp lệ: ${err.value}`;
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors || {}).map((val) => val.message).join(", ");
  }

  console.error(`[Error] ${req.method} ${req.originalUrl} (${statusCode}):`, message);

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

const notFound = (req, res, next) => {
  const error = new Error(`Không tìm thấy: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorHandler, notFound };
