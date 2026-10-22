require("dotenv").config();

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Process Guard] Unhandled Rejection phát sinh:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Process Guard] Uncaught Exception phát sinh:", error);
});

const http = require("http");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const { Server } = require("socket.io");

const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const roomRoutes = require("./src/routes/index");
const livekitRoutes = require("./src/routes/livekit.routes");
const friendRoutes = require("./src/routes/friend.routes");
const messageRoutes = require("./src/routes/message.routes");
const paymentRoutes = require("./src/routes/payment.routes");
const titleRoutes = require("./src/routes/title.routes");
const { equipTitle } = require("./src/controllers/title.controller");
const { protect } = require("./src/middlewares/authMiddleware");
const uploadRoutes = require("./src/routes/upload.routes");
const adminRoutes = require("./src/routes/admin.routes");
const notificationRoutes = require("./src/routes/notification.routes");
const cardRoutes = require("./src/routes/card.routes");
const aiTutorRoutes = require("./src/routes/aiTutor.routes");
const seedSuperAdmin = require("./src/utils/seedAdmin");
const { notFound, errorHandler } = require("./src/middlewares/errorMiddleware");
const { securityHeaders, authRateLimiter } = require("./src/middlewares/securityMiddleware");
const initSocket = require("./src/sockets/index");
const { setIo } = require("./src/config/socketInstance");

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const startServer = async () => {
  try {
    await connectDB();
    await seedSuperAdmin();

    // Dọn dẹp triệt để các phòng tồn đọng / mồ côi (0 người) từ phiên trước khi khởi động
    const { cleanupStaleRoomsOnStartup } = require("./src/utils/roomCleanup");
    await cleanupStaleRoomsOnStartup();

    const app = express();
    app.set("trust proxy", 1);

    // Áp dụng HTTP Security Headers
    app.use(securityHeaders);

    // Hỗ trợ linh hoạt các port client (3000, 3001, 3002...), Vercel domains và CLIENT_URL (danh sách cách nhau bởi dấu phẩy)
    const allowedOrigins = CLIENT_URL.split(",").map((url) => url.trim());
    const isOriginAllowed = (origin) => {
      if (!origin) return true;
      if (allowedOrigins.includes(origin)) return true;
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
      if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
      try {
        const parsed = new URL(origin);
        if (parsed.hostname.endsWith(".vercel.app")) return true;
      } catch (e) {
        // origin không hợp lệ
      }
      return false;
    };

    app.use(
      cors({
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS blocked for origin: ${origin}`));
          }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["x-refreshed-token"],
      })
    );

    // Kích hoạt nén phản hồi HTTP Gzip/Deflate để giảm kích thước payload đến 70%
    app.use(
      compression({
        threshold: 1024, // Chỉ nén các phản hồi từ 1KB trở lên
      })
    );

    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    app.get("/", (req, res) => {
      res.status(200).json({
        success: true,
        message: "Virtual Study Room API đang chạy.",
        version: "1.0.0",
      });
    });

    app.get("/api/health", (req, res) => {
      res.status(200).json({
        success: true,
        message: "OK",
        timestamp: new Date().toISOString(),
      });
    });

    app.use("/api/auth", authRateLimiter, authRoutes);
    app.use("/api/users", authRateLimiter, authRoutes);
    app.use("/api/rooms", roomRoutes);
    app.use("/api/livekit", livekitRoutes);
    app.use("/api/friends", friendRoutes);
    app.use("/api/messages", messageRoutes);
    app.use("/api/payment", paymentRoutes);
    app.use("/api/titles", titleRoutes);
    // Alias routes cho việc trang bị danh hiệu (hỗ trợ POST, PUT, PATCH)
    app
      .route("/api/user/equip-title")
      .post(protect, equipTitle)
      .put(protect, equipTitle)
      .patch(protect, equipTitle);
    app
      .route("/api/badges/equip")
      .post(protect, equipTitle)
      .put(protect, equipTitle)
      .patch(protect, equipTitle);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/cards", cardRoutes);
    app.use("/api/ai", aiTutorRoutes);

    app.use(notFound);
    app.use(errorHandler);

    const httpServer = http.createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS blocked for origin: ${origin}`));
          }
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    initSocket(io);
    setIo(io); // Đăng ký singleton để controller dùng được

    httpServer.listen(PORT, () => {
      console.log(`[Server] Đang lắng nghe tại http://localhost:${PORT}`);
      console.log(`[Server] CORS origin: ${CLIENT_URL}`);
    });

    const shutdown = () => {
      httpServer.close(() => {
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 1000);
    };

    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } catch (error) {
    console.error("[Server] Không thể khởi động server:");
    console.error(`         ${error.message}`);
    process.exit(1);
  }
};

startServer();
