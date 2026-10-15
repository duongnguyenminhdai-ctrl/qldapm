require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const roomRoutes = require("./src/routes/index");
const livekitRoutes = require("./src/routes/livekit.routes");
const friendRoutes = require("./src/routes/friend.routes");
const messageRoutes = require("./src/routes/message.routes");
const paymentRoutes = require("./src/routes/payment.routes");
const titleRoutes = require("./src/routes/title.routes");
const uploadRoutes = require("./src/routes/upload.routes");
const adminRoutes = require("./src/routes/admin.routes");
const notificationRoutes = require("./src/routes/notification.routes");
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

    const app = express();

    // Áp dụng HTTP Security Headers
    app.use(securityHeaders);

    app.use(
      cors({
        origin: CLIENT_URL,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["x-refreshed-token"],
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
    app.use("/api/rooms", roomRoutes);
    app.use("/api/livekit", livekitRoutes);
    app.use("/api/friends", friendRoutes);
    app.use("/api/messages", messageRoutes);
    app.use("/api/payment", paymentRoutes);
    app.use("/api/titles", titleRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/ai", aiTutorRoutes);

    app.use(notFound);
    app.use(errorHandler);

    const httpServer = http.createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin: CLIENT_URL,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    initSocket(io);
    setIo(io); // Đăng ký singleton để controller dùng được

    const { cleanupOrphanedRoomFiles } = require("./src/utils/roomCleanup");
    cleanupOrphanedRoomFiles().catch(() => {});

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
