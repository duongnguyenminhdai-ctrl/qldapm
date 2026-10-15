const fs = require("fs");
const path = require("path");
const Room = require("../models/Room");
const User = require("../models/User");
const RoomFile = require("../models/RoomFile");
const Notification = require("../models/Notification");
const jwt = require("jsonwebtoken");
const {
  getRoomDrawings,
  getRoomImages,
  deleteRoom: deleteWhiteboardRoom,
  registerWhiteboardHandlers,
} = require("./whiteboard.socket");
const { cleanupRoomFiles, extractCloudinaryInfo } = require("../utils/roomCleanup");
const cloudinary = require("../config/cloudinary");
const { sendNotificationToMultiple } = require("../services/notification.service");

// Quản lý trạng thái realtime trong bộ nhớ (Pomodoro + Lịch sử tin nhắn gần nhất)
const roomStates = new Map();

// Bộ đệm lưu trữ timer ân hạn khi client ngắt kết nối tạm thời (F5 / rớt mạng ngắn)
const disconnectGraceTimers = new Map(); // key: `${normalizedCode}_${userId}` -> timer

function getOrCreateRoomState(roomCode) {
  const code = (roomCode || "").trim().toUpperCase();
  if (!roomStates.has(code)) {
    roomStates.set(code, {
      pomodoro: {
        duration: 1500, // 25 phút mặc định
        remaining: 1500,
        isRunning: false,
        mode: "focus",
        timerId: null,
      },
      messages: [],
      notifications: [], // Lưu trữ các thông báo trong phiên phòng học (Tin nhắn, File, Giơ tay)
      userTranscripts: new Map(), // userId -> Array<{ text, speakerName, time, createdAt }> (chép lời RIÊNG BIỆT cho từng VIP)
      titleVisibility: new Map(), // userId -> boolean (true: hiện, false: ẩn)
      raisedHands: new Map(), // userId -> { isHandRaised: boolean, userName: string, raisedAt: number }
      sessionParticipantIds: new Set(),
      pendingRequests: new Map(), // userId -> { userId, name, email, avatar, socketId, requestedAt }
      focusStatuses: new Map(), // userId -> { icon, label }
      pinnedItem: null, // { id, type, senderName, text, fileUrl, fileName, pinnedBy, pinnedAt }
      polls: new Map(), // pollId -> { id, question, options, createdBy, createdAt, totalVotes }
    });
  }
  const state = roomStates.get(code);
  if (!state.notifications) state.notifications = [];
  if (!state.userTranscripts) state.userTranscripts = new Map();
  if (!state.sessionParticipantIds) state.sessionParticipantIds = new Set();
  if (!state.pendingRequests) state.pendingRequests = new Map();
  if (!state.focusStatuses) state.focusStatuses = new Map();
  if (state.pinnedItem === undefined) state.pinnedItem = null;
  if (!state.polls) state.polls = new Map();
  return state;
}

/**
 * Thêm thông báo trong phiên phòng học và broadcast realtime tới phòng
 */
function addRoomNotification(roomCode, notif, io) {
  if (!roomCode || !notif) return;
  const state = getOrCreateRoomState(roomCode);
  state.notifications.push(notif);
  if (state.notifications.length > 50) state.notifications.shift();
  if (io) {
    io.to((roomCode || "").trim().toUpperCase()).emit("room:notification-new", notif);
  }
}

/**
 * Helper: Ghi nhận thời gian học thực tế vào tài khoản người dùng
 */
async function recordStudyTime(userId, joinTimestamp) {
  if (!userId || !joinTimestamp) return;
  const studySec = Math.round((Date.now() - joinTimestamp) / 1000);
  if (studySec >= 5) {
    try {
      await User.updateOne(
        { _id: userId },
        {
          $inc: { totalStudySeconds: studySec },
          $set: { lastSeen: new Date(), lastStudyDate: new Date() },
        }
      );
      console.log(`[Socket] Cong ${studySec}s thoi gian hoc cho user [${userId}]`);
    } catch (err) {
      console.warn("[Socket] Loi cap nhat totalStudySeconds:", err.message);
    }
  }
}

/**
 * Quét sạch toàn bộ dữ liệu của phòng học khi phòng đóng:
 * 1. Toàn bộ tài liệu, ảnh đính kèm (Cloudinary + MongoDB RoomFile)
 * 2. Toàn bộ bảng vẽ, nét vẽ, ảnh dán trên bảng (RAM whiteboard)
 * 3. Toàn bộ tin nhắn chat trong phiên học (RAM messages)
 * 4. Toàn bộ trạng thái Pomodoro, bộ hẹn giờ (RAM timers)
 * 5. Bản ghi phòng học trong cơ sở dữ liệu (MongoDB Room)
 * 6. Thông báo giải tán phòng và cập nhật Dashboard
 */
/**
 * Lưu bản chép lời RIÊNG BIỆT của một người dùng thành file .txt và gửi thông báo riêng tư
 * Chỉ gửi duy nhất cho người đã bật chép lời, không gửi cho bất kỳ ai khác
 */
async function saveUserTranscriptAndNotify({ roomCode, roomName, userId, segments, io }) {
  if (!userId || !Array.isArray(segments) || segments.length === 0) return null;
  try {
    const transcriptsDir = path.join(__dirname, "../../uploads/transcripts");
    if (!fs.existsSync(transcriptsDir)) {
      fs.mkdirSync(transcriptsDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("vi-VN").replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const fileName = `ban-chep-loi-${roomCode}-${userId}-${Date.now()}.txt`;
    const filePath = path.join(transcriptsDir, fileName);

    let txtContent = `=================================================================\n`;
    txtContent += `BẢN CHÉP LỜI CÁ NHÂN PHÒNG HỌC: ${roomName || roomCode} (${roomCode})\n`;
    txtContent += `Thời gian lưu: ${timeStr} ngày ${dateStr}\n`;
    txtContent += `Tổng số đoạn phát biểu ghi nhận: ${segments.length}\n`;
    txtContent += `Lưu ý: Đây là bản chép lời cá nhân dành riêng cho tài khoản của bạn (Tính năng VIP).\n`;
    txtContent += `=================================================================\n\n`;

    segments.forEach((t) => {
      txtContent += `[${t.time || timeStr}] ${t.speakerName || "Bạn"}:\n${t.text}\n\n`;
    });

    await fs.promises.writeFile(filePath, txtContent, "utf8");
    console.log(`[Transcription] Đã lưu bản chép lời riêng cho user [${userId}]: ${filePath}`);

    const notif = await Notification.create({
      recipient: userId,
      sender: null,
      type: "TRANSCRIPT",
      title: `📝 Bản chép lời cá nhân: ${roomName || roomCode}`,
      message: `Phiên học đã kết thúc. Bản chép lời cá nhân (.txt) của bạn đã được bảo mật và lưu trữ riêng tư. Bạn có thể bấm để tải xuống.`,
      link: `/api/notifications/download-transcript/${fileName}`,
      metadata: {
        transcriptFileName: fileName,
        transcriptFilePath: filePath,
        roomCode,
        roomName,
        fileSize: Buffer.byteLength(txtContent, "utf8"),
        createdAt: new Date().toISOString(),
      },
      isRead: false,
    });

    if (io) {
      io.to(`user:${userId}`).emit("notification:new", notif);
    }
    return notif;
  } catch (err) {
    console.error(`[Transcription] Lỗi lưu bản chép lời cho user [${userId}]:`, err.message);
    return null;
  }
}

async function destroyAndCleanupRoom(roomCode, io, hostName = "Chủ phòng") {
  if (!roomCode) return;
  const normalizedCode = roomCode.trim().toUpperCase();

  console.log(`[RoomCleanup] === BẮT ĐẦU QUÉT SẠCH TOÀN BỘ PHÒNG HỌC ${normalizedCode} ===`);

  // 0. Lấy thông tin phòng trước khi dọn dẹp để phục vụ tạo bản chép lời & gửi thông báo
  let roomDoc = null;
  try {
    roomDoc = await Room.findOne({ roomCode: normalizedCode });
  } catch (_) {}
  const roomName = roomDoc?.name || `Phòng học ${normalizedCode}`;

  // 1. Dọn dẹp tài liệu & ảnh trên Cloudinary và MongoDB RoomFile
  try {
    await cleanupRoomFiles(normalizedCode);
  } catch (err) {
    console.error(`[RoomCleanup] Lỗi dọn tài liệu:`, err.message);
  }

  // 2. Dọn sạch toàn bộ nét vẽ và ảnh trên bảng vẽ (Whiteboard)
  try {
    deleteWhiteboardRoom(normalizedCode);
    console.log(`[RoomCleanup] Đã xóa toàn bộ nét vẽ và ảnh bảng vẽ của phòng ${normalizedCode}`);
  } catch (err) {
    console.error(`[RoomCleanup] Lỗi dọn bảng vẽ:`, err.message);
  }

  // 3. Bảo toàn bản chép lời: Xuất file .txt và gửi thông báo chuông sảnh RIÊNG BIỆT cho từng người đã bật chép lời
  try {
    const state = roomStates.get(normalizedCode);
    if (state && state.userTranscripts && state.userTranscripts.size > 0) {
      for (const [uId, segments] of state.userTranscripts.entries()) {
        if (segments && segments.length > 0) {
          await saveUserTranscriptAndNotify({
            roomCode: normalizedCode,
            roomName,
            userId: uId,
            segments,
            io,
          });
        }
      }
    }
  } catch (transcriptErr) {
    console.error(`[RoomCleanup] Lỗi xử lý bản chép lời riêng biệt:`, transcriptErr.message);
  }

  // 4. Dọn sạch toàn bộ tin nhắn chat trong phiên học & trạng thái Pomodoro trong RAM
  try {
    const state = roomStates.get(normalizedCode);
    if (state?.pomodoro?.timerId) {
      clearInterval(state.pomodoro.timerId);
    }
    roomStates.delete(normalizedCode);
    console.log(`[RoomCleanup] Đã xóa toàn bộ tin nhắn chat và bộ đếm Pomodoro của phòng ${normalizedCode}`);
  } catch (err) {
    console.error(`[RoomCleanup] Lỗi dọn roomStates:`, err.message);
  }

  // 5. Hủy các timer ân hạn disconnect của phòng
  for (const [key, timer] of disconnectGraceTimers.entries()) {
    if (key.startsWith(`${normalizedCode}_`)) {
      clearTimeout(timer);
      disconnectGraceTimers.delete(key);
    }
  }

  // 6. Xóa vĩnh viễn bản ghi Room trong MongoDB
  try {
    await Room.deleteOne({ roomCode: normalizedCode });
    console.log(`[RoomCleanup] Đã xóa phòng ${normalizedCode} khỏi MongoDB`);
  } catch (err) {
    console.error(`[RoomCleanup] Lỗi xóa phòng khỏi DB:`, err.message);
  }

  // 7. Phát thông báo giải tán phòng cho tất cả thành viên trong phòng và phòng chờ
  if (io) {
    io.to(normalizedCode).emit("room:host-closed", {
      hostName,
      message: `Phiên học đã kết thúc. Toàn bộ tài liệu và bảng vẽ đã được dọn sạch. Bản chép lời của bạn được bảo toàn.`,
    });
    io.to(`waiting:${normalizedCode}`).emit("room:join-rejected", {
      roomCode: normalizedCode,
      message: "Chủ phòng đã đóng phòng học.",
    });
    io.emit("dashboard:room-deleted", { roomCode: normalizedCode });
  }

  console.log(`[RoomCleanup] === HOÀN TẤT DỌN SẠCH PHÒNG ${normalizedCode} ===`);
}

function startPomodoro(code, io) {
  const state = getOrCreateRoomState(code);
  if (state.pomodoro.isRunning) return;

  state.pomodoro.isRunning = true;
  if (state.pomodoro.timerId) {
    clearInterval(state.pomodoro.timerId);
  }

  // Ticker đếm ngược mỗi 1 giây
  state.pomodoro.timerId = setInterval(() => {
    if (state.pomodoro.remaining > 0) {
      state.pomodoro.remaining -= 1;
      io.to(code).emit("pomodoro:sync", {
        duration: state.pomodoro.duration,
        remaining: state.pomodoro.remaining,
        isRunning: true,
        mode: state.pomodoro.mode,
      });
    } else {
      // Hết giờ
      clearInterval(state.pomodoro.timerId);
      state.pomodoro.timerId = null;
      state.pomodoro.isRunning = false;

      // Thêm tin nhắn hệ thống vào chat
      const sysMsg = {
        id: `sys_${Date.now()}`,
        text: "Phiên Pomodoro đã hoàn thành. Hãy nghỉ ngơi một chút!",
        sender: { id: "system", name: "Hệ thống" },
        time: new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        system: true,
      };
      state.messages.push(sysMsg);
      if (state.messages.length > 100) state.messages.shift();

      io.to(code).emit("chat:new-message", sysMsg);
      io.to(code).emit("pomodoro:sync", {
        duration: state.pomodoro.duration,
        remaining: 0,
        isRunning: false,
        mode: state.pomodoro.mode,
      });
      io.to(code).emit("pomodoro:completed");
    }
  }, 1000);

  io.to(code).emit("pomodoro:sync", {
    duration: state.pomodoro.duration,
    remaining: state.pomodoro.remaining,
    isRunning: true,
    mode: state.pomodoro.mode,
  });
}

function pausePomodoro(code, io) {
  const state = getOrCreateRoomState(code);
  state.pomodoro.isRunning = false;
  if (state.pomodoro.timerId) {
    clearInterval(state.pomodoro.timerId);
    state.pomodoro.timerId = null;
  }

  io.to(code).emit("pomodoro:sync", {
    duration: state.pomodoro.duration,
    remaining: state.pomodoro.remaining,
    isRunning: false,
    mode: state.pomodoro.mode,
  });
}

function resetPomodoro(code, io) {
  const state = getOrCreateRoomState(code);
  state.pomodoro.isRunning = false;
  if (state.pomodoro.timerId) {
    clearInterval(state.pomodoro.timerId);
    state.pomodoro.timerId = null;
  }

  state.pomodoro.remaining = state.pomodoro.duration;

  io.to(code).emit("pomodoro:sync", {
    duration: state.pomodoro.duration,
    remaining: state.pomodoro.remaining,
    isRunning: false,
    mode: state.pomodoro.mode,
  });
}

function setPomodoroDuration(code, minutes, io) {
  const state = getOrCreateRoomState(code);
  const min = Math.max(5, Math.min(60, Number(minutes) || 25));
  const seconds = min * 60;

  state.pomodoro.duration = seconds;
  state.pomodoro.remaining = seconds;
  state.pomodoro.isRunning = false;

  if (state.pomodoro.timerId) {
    clearInterval(state.pomodoro.timerId);
    state.pomodoro.timerId = null;
  }

  io.to(code).emit("pomodoro:sync", {
    duration: seconds,
    remaining: seconds,
    isRunning: false,
    mode: state.pomodoro.mode,
  });
}

/**
 * Socket.io Quản lý sự kiện phòng học trực tuyến thời gian thực
 */
const initSocket = (io) => {
  // Middleware xác thực JWT token ngay trong handshake kết nối Socket.io
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "") ||
        socket.handshake.query?.token;

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded && decoded.id) {
            socket.authUserId = String(decoded.id);
            socket.authUser = decoded;
          }
        } catch (_) {
          socket.authUserId = null;
          socket.authUser = null;
        }
      }
      return next();
    } catch (_) {
      return next();
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client ket noi: ${socket.id} (authUserId: ${socket.authUserId || "anonymous"})`);

    /**
     * Sự kiện: user:authenticate
     * Client emit khi có user đăng nhập để tham gia room cá nhân và cập nhật presence
     * Bảo mật: Kiểm tra danh tính thật, chống nghe lén kênh riêng tư user:userId
     */
    socket.on("user:authenticate", async ({ userId, token }) => {
      let effectiveUserId = socket.authUserId;
      if (!effectiveUserId && token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded?.id) {
            effectiveUserId = String(decoded.id);
            socket.authUserId = effectiveUserId;
          }
        } catch (_) {}
      }

      // Nếu không có token hợp lệ hoặc cố ý gửi userId khác với token của mình -> chặn lại
      if (effectiveUserId && userId && String(effectiveUserId) !== String(userId)) {
        console.warn(`[Socket Security] Phát hiện mạo danh user:authenticate! Socket: ${socket.id}, Auth: ${effectiveUserId}, Payload: ${userId}`);
        return;
      }

      const verifiedUserId = effectiveUserId || userId;
      if (!verifiedUserId) return;

      socket.authUserId = String(verifiedUserId);
      socket.join(`user:${verifiedUserId}`);

      try {
        const userDoc = await User.findByIdAndUpdate(
          verifiedUserId,
          { isOnline: true, lastSeen: new Date() },
          { new: true }
        ).populate("friends", "_id");

        if (userDoc && userDoc.friends) {
          // Báo cho tất cả bạn bè biết user này vừa online
          userDoc.friends.forEach((friend) => {
            io.to(`user:${friend._id}`).emit("friend:status-change", {
              userId: verifiedUserId,
              isOnline: true,
              lastSeen: userDoc.lastSeen,
            });
          });
        }
      } catch (err) {
        console.error("[Socket] Loi authenticate user presence:", err.message);
      }
    });

    /**
     * Sự kiện: conversation:join
     * Client join room conversation để nhận realtime messages
     */
    socket.on("conversation:join", ({ conversationId }) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    /**
     * Sự kiện: conversation:leave
     */
    socket.on("conversation:leave", ({ conversationId }) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    /**
     * Sự kiện: join-room
     */
    socket.on("join-room", async (arg1, arg2, callback) => {
      try {
        let roomCode = "";
        let user = null;
        let cb = typeof callback === "function" ? callback : null;

        if (typeof arg1 === "object" && arg1 !== null && arg1.roomCode) {
          roomCode = arg1.roomCode;
          user = arg1.user;
          if (typeof arg2 === "function") cb = arg2;
        } else {
          roomCode = arg1;
          user = arg2;
        }

        if (!roomCode) {
          if (typeof cb === "function") {
            cb({ success: false, message: "Thieu roomCode" });
          }
          return;
        }

        const normalizedCode = roomCode.trim().toUpperCase();

        // Kiểm tra phòng và kiểm tra lệnh cấm (ban)
        const checkRoom = await Room.findOne({ roomCode: normalizedCode });
        if (!checkRoom) {
          if (typeof cb === "function") {
            cb({ success: false, message: "Phòng không tồn tại hoặc đã đóng." });
          }
          return;
        }

        const userId = user?.id || user?._id;
        const uIdStr = String(userId || "");

        if (
          userId &&
          checkRoom.bannedUsers &&
          checkRoom.bannedUsers.some((id) => String(id) === String(userId))
        ) {
          if (typeof cb === "function") {
            cb({
              success: false,
              isBanned: true,
              message: "Bạn đã bị cấm tham gia phòng học này.",
            });
          }
          return;
        }

        const isHostUser = String(checkRoom.hostId?._id || checkRoom.hostId) === uIdStr;

        // Kiểm tra phòng có bị khóa tạm thời bởi chủ phòng không
        if (checkRoom.isLocked && !isHostUser) {
          if (typeof cb === "function") {
            cb({
              success: false,
              isLocked: true,
              message: "Phòng học hiện đang bị khóa bởi chủ phòng.",
            });
          }
          return;
        }

        // Kiểm tra quyền truy cập phòng (Access Permission / Waiting Room)
        if (checkRoom.accessType === "APPROVAL_REQUIRED") {
          const isHost = isHostUser;
          const isApproved =
            checkRoom.approvedUsers &&
            checkRoom.approvedUsers.some((id) => String(id) === uIdStr);

          if (!isHost && !isApproved) {
            if (typeof cb === "function") {
              cb({
                success: false,
                requiresApproval: true,
                message: "Phòng học yêu cầu chủ phòng xét duyệt trước khi tham gia.",
                room: {
                  title: checkRoom.title,
                  roomCode: normalizedCode,
                  hostId: checkRoom.hostId,
                  accessType: checkRoom.accessType,
                },
              });
            }
            return;
          }
        }

        socket.join(normalizedCode);

        // Lưu thông tin vào socket instance
        socket.roomCode = normalizedCode;
        socket.userData = user;
        socket.userId = uIdStr;
        socket.joinTimestamp = Date.now();

        // Lấy trạng thái phòng & cập nhật trạng thái hiển thị danh hiệu nếu có
        const roomState = getOrCreateRoomState(normalizedCode);
        if (uIdStr) {
          roomState.sessionParticipantIds.add(uIdStr);
        }

        // Nếu là Host, gửi danh sách người đang chờ duyệt (nếu có)
        const isHost = String(checkRoom.hostId?._id || checkRoom.hostId) === uIdStr;
        if (isHost && roomState.pendingRequests) {
          socket.emit("room:pending-updated", {
            roomCode: normalizedCode,
            pendingList: Array.from(roomState.pendingRequests.values()),
          });
        }
        if (uIdStr && user && user.isTitleVisible !== undefined) {
          roomState.titleVisibility.set(uIdStr, Boolean(user.isTitleVisible));
        }

        // Nếu user này vừa ngắt kết nối do F5 hoặc rớt mạng ngắn, hủy timer xóa phòng
        if (uIdStr) {
          const graceKey = `${normalizedCode}_${uIdStr}`;
          if (disconnectGraceTimers.has(graceKey)) {
            console.log(`[Socket] User [${user?.name || uIdStr}] đã kết nối lại phòng ${normalizedCode} -> Hủy timer ân hạn`);
            clearTimeout(disconnectGraceTimers.get(graceKey));
            disconnectGraceTimers.delete(graceKey);
          }
        }

        // Cập nhật mảng participants trong database nếu có userId
        if (userId) {
          try {
            await Room.findOneAndUpdate(
              {
                roomCode: normalizedCode,
                "participants.userId": { $ne: userId },
              },
              {
                $push: {
                  participants: {
                    userId,
                    joinedAt: new Date(),
                  },
                },
              }
            );
          } catch (dbErr) {
            console.error("[Socket] Loi cap nhat participants DB:", dbErr.message);
          }
        }

        // Phát sự kiện user-joined tới các thành viên khác trong phòng
        socket.to(normalizedCode).emit("room:user-joined", user);

        // Lấy thông tin phòng và danh sách participants mới nhất từ DB
        const currentRoom = await Room.findOne({ roomCode: normalizedCode })
          .populate("hostId", "name email avatar isPro title equippedTitle")
          .populate("participants.userId", "name email avatar isPro title equippedTitle");

        // Gửi danh sách toàn bộ participants cho chính client vừa tham gia
        if (currentRoom) {
          socket.emit("room:members-sync", {
            roomCode: normalizedCode,
            participants: currentRoom.participants,
            hostId: currentRoom.hostId,
            titleVisibility: Object.fromEntries(roomState.titleVisibility),
            raisedHands: Object.fromEntries(roomState.raisedHands),
            focusStatuses: Object.fromEntries(roomState.focusStatuses),
            isLocked: Boolean(currentRoom.isLocked),
            pinnedItem: roomState.pinnedItem,
          });
          // Đồng bộ số lượng thành viên ra Dashboard realtime
          io.emit("room:members-sync", {
            roomCode: normalizedCode,
            participants: currentRoom.participants,
          });
        }

        // Gửi lịch sử chat và trạng thái Pomodoro hiện tại
        socket.emit("chat:sync-messages", roomState.messages);

        // Đồng bộ danh sách tài liệu phòng học đã chia sẻ
        RoomFile.find({ roomCode: normalizedCode })
          .sort({ createdAt: -1 })
          .then((files) => {
            socket.emit("room:sync-files", files);
          })
          .catch((err) => {
            console.error("[Socket] Loi sync RoomFiles:", err.message);
          });
        socket.emit("pomodoro:sync", {
          duration: roomState.pomodoro.duration,
          remaining: roomState.pomodoro.remaining,
          isRunning: roomState.pomodoro.isRunning,
          mode: roomState.pomodoro.mode,
        });

        // Gửi lịch sử nét vẽ và hình ảnh bảng trắng hiện có trong bộ đệm
        const drawings = getRoomDrawings(normalizedCode);
        const images = getRoomImages(normalizedCode);
        socket.emit("whiteboard:sync", drawings);
        socket.emit("board:sync-images", images);

        // Đồng bộ danh sách thông báo của phiên phòng học
        socket.emit("room:notifications-sync", roomState.notifications || []);

        console.log(
          `[Socket] User [${user?.name || userId || socket.id}] da gia nhap phong ${normalizedCode}`
        );

        if (typeof cb === "function") {
          cb({
            success: true,
            participants: currentRoom ? currentRoom.participants : [],
            hostId: currentRoom ? currentRoom.hostId : null,
            titleVisibility: Object.fromEntries(roomState.titleVisibility),
            raisedHands: Object.fromEntries(roomState.raisedHands),
            focusStatuses: Object.fromEntries(roomState.focusStatuses),
            isLocked: Boolean(currentRoom ? currentRoom.isLocked : checkRoom.isLocked),
            pinnedItem: roomState.pinnedItem,
            messages: roomState.messages,
            notifications: roomState.notifications || [],
            drawings,
            images,
            accessType: checkRoom ? checkRoom.accessType : "OPEN",
            pendingList: isHost && roomState.pendingRequests ? Array.from(roomState.pendingRequests.values()) : [],
            pomodoro: {
              duration: roomState.pomodoro.duration,
              remaining: roomState.pomodoro.remaining,
              isRunning: roomState.pomodoro.isRunning,
              mode: roomState.pomodoro.mode,
            },
          });
        }
      } catch (err) {
        console.error("[Socket] Loi khi xu ly join-room:", err.message);
        if (typeof cb === "function") {
          cb({ success: false, error: err.message });
        }
      }
    });

    /**
     * Sự kiện: room:request-members-sync
     * Cho phép client yêu cầu đồng bộ tức thì danh sách thành viên chuẩn từ server (khi window focus hoặc sau reconnect)
     */
    socket.on("room:request-members-sync", async ({ roomCode } = {}) => {
      try {
        const code = (roomCode || socket.roomCode || "").trim().toUpperCase();
        if (!code) return;

        const currentRoom = await Room.findOne({ roomCode: code })
          .populate("hostId", "name email avatar isPro title equippedTitle")
          .populate("participants.userId", "name email avatar isPro title equippedTitle");

        if (currentRoom) {
          const roomState = getOrCreateRoomState(code);
          socket.emit("room:members-sync", {
            roomCode: code,
            participants: currentRoom.participants,
            hostId: currentRoom.hostId,
            titleVisibility: Object.fromEntries(roomState.titleVisibility),
            raisedHands: Object.fromEntries(roomState.raisedHands),
            focusStatuses: Object.fromEntries(roomState.focusStatuses),
            isLocked: Boolean(currentRoom.isLocked),
            pinnedItem: roomState.pinnedItem,
          });
        }
      } catch (err) {
        console.error("[Socket] Lỗi xử lý room:request-members-sync:", err.message);
      }
    });

    /**
     * Sự kiện: room:request-join
     * Client người dùng đang chờ phê duyệt emit yêu cầu vào phòng
     */
    socket.on("room:request-join", async (data, callback) => {
      try {
        const code = (data?.roomCode || data?.roomId || "").trim().toUpperCase();
        const user = data?.user || socket.userData;
        const uId = String(user?.id || user?._id || socket.userId || "");
        const cb = typeof callback === "function" ? callback : null;

        if (!code || !uId) {
          if (cb) cb({ success: false, message: "Thiếu thông tin phòng hoặc người dùng." });
          return;
        }

        const room = await Room.findOne({ roomCode: code, isActive: true });
        if (!room) {
          socket.emit("room:join-rejected", { roomCode: code, message: "Phòng học không tồn tại hoặc đã đóng." });
          if (cb) cb({ success: false, message: "Phòng học không tồn tại hoặc đã đóng." });
          return;
        }

        // Kiểm tra nếu bị cấm
        if (room.bannedUsers && room.bannedUsers.some((bId) => String(bId) === uId)) {
          socket.emit("room:join-rejected", { roomCode: code, message: "Bạn đã bị cấm vào phòng học này." });
          if (cb) cb({ success: false, isBanned: true, message: "Bạn đã bị cấm vào phòng học này." });
          return;
        }

        const isHost = String(room.hostId?._id || room.hostId) === uId;

        // Kiểm tra nếu phòng bị khóa tạm thời
        if (room.isLocked && !isHost) {
          socket.emit("room:join-rejected", {
            roomCode: code,
            isLocked: true,
            message: "Phòng học hiện đang bị khóa bởi chủ phòng.",
          });
          if (cb) cb({ success: false, isLocked: true, message: "Phòng học hiện đang bị khóa bởi chủ phòng." });
          return;
        }

        const isApproved =
          room.accessType === "OPEN" ||
          (room.approvedUsers && room.approvedUsers.some((aId) => String(aId) === uId));

        if (isHost || isApproved) {
          socket.emit("room:join-approved", { roomCode: code });
          if (cb) cb({ success: true, isApproved: true });
          return;
        }

        // Lưu thông tin người chờ
        const state = getOrCreateRoomState(code);
        const existingPending = state.pendingRequests.get(uId);
        const now = Date.now();
        // Tránh spam thông báo / toast nếu client emit lặp lại trong 5 giây
        const shouldNotify = !existingPending || (now - (existingPending._lastNotified || 0) > 5000);

        const pendingUser = {
          userId: uId,
          name: user?.name || "Người dùng",
          email: user?.email || "",
          avatar: user?.avatar || "",
          socketId: socket.id,
          requestedAt: new Date().toISOString(),
          _lastNotified: now,
        };

        state.pendingRequests.set(uId, pendingUser);
        socket.waitingRoomCode = code;
        socket.waitingUserId = uId;
        socket.join(`waiting:${code}`);

        // Đồng bộ vào MongoDB Room.pendingMembers nếu chưa có
        try {
          await Room.updateOne(
            { roomCode: code, "pendingMembers.user": { $ne: uId } },
            { $push: { pendingMembers: { user: uId, requestedAt: new Date() } } }
          );
        } catch (_) {}

        const pendingList = Array.from(state.pendingRequests.values());

        // Báo cho chủ phòng (chỉ gửi 1 thông báo và 1 toast nếu cùng phiên)
        if (shouldNotify) {
          const hostIdStr = String(room.hostId?._id || room.hostId);

          // 1. Gửi sự kiện Toast tới Chủ phòng
          io.to(`user:${hostIdStr}`).emit("room:join-requested", {
            roomCode: code,
            pendingUser,
            pendingList,
          });

          // 2. Gửi thông báo tới Chuông phòng học của Chủ phòng
          const joinNotif = {
            id: `join_req_${uId}`,
            type: "JOIN_REQUEST",
            senderId: uId,
            senderName: user?.name || "Người dùng",
            senderAvatar: user?.avatar || "",
            title: "Yêu cầu vào phòng",
            message: `${user?.name || "Người dùng"} đang chờ bạn phê duyệt vào phòng`,
            body: `${user?.name || "Người dùng"} đang chờ bạn phê duyệt vào phòng`,
            createdAt: new Date().toISOString(),
            hostOnly: true,
            targetUserId: uId,
          };
          io.to(`user:${hostIdStr}`).emit("room:notification-new", joinNotif);
        }

        io.to(code).emit("room:pending-updated", {
          roomCode: code,
          pendingList,
        });

        console.log(`[Socket] User [${pendingUser.name} (${uId})] đang chờ duyệt vào phòng ${code}`);
        if (cb) cb({ success: true, pending: true, pendingUser });
      } catch (err) {
        console.error("[Socket] Lỗi room:request-join:", err.message);
      }
    });

    /**
     * Sự kiện: room:handle-join-request
     * Chủ phòng duyệt (APPROVE) hoặc từ chối (REJECT / APPROVE_ALL) yêu cầu vào phòng
     */
    socket.on("room:handle-join-request", async ({ roomCode, targetUserId, action }, callback) => {
      try {
        const code = (roomCode || socket.roomCode || "").trim().toUpperCase();
        const callerId = String(socket.userData?.id || socket.userData?._id || socket.userId || socket.authUserId || "");
        const cb = typeof callback === "function" ? callback : null;

        if (!code) return;
        const room = await Room.findOne({ roomCode: code, isActive: true });
        if (!room) {
          if (cb) cb({ success: false, message: "Phòng học không tồn tại." });
          return;
        }

        // Chỉ chủ phòng mới có quyền duyệt
        if (String(room.hostId?._id || room.hostId) !== callerId) {
          if (cb) cb({ success: false, message: "Chỉ chủ phòng mới có quyền duyệt thành viên." });
          return;
        }

        const state = getOrCreateRoomState(code);

        if (action === "APPROVE" && targetUserId) {
          const targetUIdStr = String(targetUserId);
          state.pendingRequests.delete(targetUIdStr);

          // Cập nhật MongoDB
          try {
            await Room.updateOne(
              { roomCode: code },
              {
                $addToSet: { approvedUsers: targetUIdStr },
                $pull: { pendingMembers: { user: targetUIdStr } },
              }
            );
          } catch (_) {}

          // Phát sự kiện được duyệt cho user đích
          io.to(`user:${targetUIdStr}`).emit("room:join-approved", { roomCode: code });
          io.to(`waiting:${code}`).emit("room:check-approval", {
            approvedUserId: targetUIdStr,
            roomCode: code,
          });

          const pendingList = Array.from(state.pendingRequests.values());
          io.to(code).emit("room:pending-updated", { roomCode: code, pendingList });
          if (cb) cb({ success: true, pendingList });
        } else if (action === "REJECT" && targetUserId) {
          const targetUIdStr = String(targetUserId);
          state.pendingRequests.delete(targetUIdStr);

          try {
            await Room.updateOne(
              { roomCode: code },
              { $pull: { pendingMembers: { user: targetUIdStr } } }
            );
          } catch (_) {}

          io.to(`user:${targetUIdStr}`).emit("room:join-rejected", {
            roomCode: code,
            message: "Yêu cầu tham gia phòng của bạn đã bị từ chối.",
          });
          io.to(`waiting:${code}`).emit("room:check-rejection", {
            rejectedUserId: targetUIdStr,
            roomCode: code,
            message: "Yêu cầu tham gia phòng của bạn đã bị từ chối.",
          });

          const pendingList = Array.from(state.pendingRequests.values());
          io.to(code).emit("room:pending-updated", { roomCode: code, pendingList });
          if (cb) cb({ success: true, pendingList });
        } else if (action === "APPROVE_ALL") {
          const allPending = Array.from(state.pendingRequests.values());
          state.pendingRequests.clear();

          const ids = allPending.map((p) => p.userId);
          try {
            await Room.updateOne(
              { roomCode: code },
              {
                $addToSet: { approvedUsers: { $each: ids } },
                $set: { pendingMembers: [] },
              }
            );
          } catch (_) {}

          for (const p of allPending) {
            io.to(`user:${p.userId}`).emit("room:join-approved", { roomCode: code });
          }
          io.to(`waiting:${code}`).emit("room:join-approved", { roomCode: code });

          io.to(code).emit("room:pending-updated", { roomCode: code, pendingList: [] });
          if (cb) cb({ success: true, pendingList: [] });
        }
      } catch (err) {
        console.error("[Socket] Lỗi room:handle-join-request:", err.message);
      }
    });

    /**
     * Sự kiện: room:cancel-join-request
     * Người dùng tự hủy yêu cầu chờ vào phòng
     */
    socket.on("room:cancel-join-request", async ({ roomCode, userId } = {}) => {
      try {
        const code = (roomCode || socket.waitingRoomCode || "").trim().toUpperCase();
        const uId = String(userId || socket.waitingUserId || socket.userId || "");
        if (!code || !uId) return;

        const state = roomStates.get(code);
        if (state?.pendingRequests?.has(uId)) {
          state.pendingRequests.delete(uId);
          try {
            await Room.updateOne(
              { roomCode: code },
              { $pull: { pendingMembers: { user: uId } } }
            );
          } catch (_) {}
          const pendingList = Array.from(state.pendingRequests.values());
          io.to(code).emit("room:pending-updated", { roomCode: code, pendingList });
        }
        socket.leave(`waiting:${code}`);
        socket.waitingRoomCode = null;
        socket.waitingUserId = null;
      } catch (err) {
        console.error("[Socket] Lỗi room:cancel-join-request:", err.message);
      }
    });

    /**
     * Sự kiện: room:toggle-title-visibility
     * Bật/tắt hiển thị danh hiệu của chính user cho mọi người trong phòng
     */
    socket.on("room:toggle-title-visibility", ({ roomCode, isVisible, userId }) => {
      const code = (roomCode || socket.roomCode || "").trim().toUpperCase();
      const uId = String(userId || socket.userId || socket.userData?.id || socket.userData?._id || "");
      if (!code || !uId) return;

      const state = getOrCreateRoomState(code);
      state.titleVisibility.set(uId, Boolean(isVisible));

      // Phát sự kiện tới tất cả client trong phòng
      io.to(code).emit("room:user-title-visibility", {
        userId: uId,
        isVisible: Boolean(isVisible),
      });
    });

    /**
     * Sự kiện: room:toggle-hand
     * Client emit: room:toggle-hand { roomId, isHandRaised: boolean }
     * Server broadcast: room:hand-updated { userId, userName, isHandRaised }
     */
    socket.on("room:toggle-hand", (data) => {
      const roomCode = (data?.roomId || data?.roomCode || socket.roomCode || "").trim().toUpperCase();
      const isHandRaised = Boolean(data?.isHandRaised);
      const uId = String(socket.userData?.id || socket.userData?._id || socket.userId || data?.userId || socket.id || "");
      const userName = socket.userData?.name || data?.userName || "Thành viên";
      if (!roomCode || !uId) return;

      const state = getOrCreateRoomState(roomCode);
      const currentlyRaised = Boolean(state.raisedHands.get(uId)?.isHandRaised);

      // Chống phát lặp sự kiện: nếu trạng thái không thay đổi thì bỏ qua
      if (currentlyRaised === isHandRaised) {
        return;
      }

      if (isHandRaised) {
        state.raisedHands.set(uId, { isHandRaised: true, userName, raisedAt: Date.now() });

        // Tạo thông báo giơ tay trong phiên phòng học
        const handNotif = {
          id: `rn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: "HAND_RAISED",
          senderId: uId,
          senderName: userName,
          senderAvatar: socket.userData?.avatar || "",
          title: "Giơ tay phát biểu",
          message: `${userName} vừa giơ tay phát biểu ✋`,
          createdAt: new Date().toISOString(),
        };
        addRoomNotification(roomCode, handNotif, io);
      } else {
        state.raisedHands.delete(uId);
      }

      // Broadcast cho toàn bộ thành viên trong phòng
      io.to(roomCode).emit("room:hand-updated", {
        userId: uId,
        userName,
        isHandRaised,
      });
      console.log(`[Socket] User [${userName} (${uId})] ${isHandRaised ? "GIO TAY" : "HA TAY"} phong ${roomCode}`);
    });

    /**
     * Sự kiện: room:send-reaction
     * Client emit: room:send-reaction { roomId, emoji, senderName }
     * Server broadcast: room:receive-reaction { emoji, senderName }
     */
    socket.on("room:send-reaction", (data) => {
      const roomCode = (data?.roomId || data?.roomCode || socket.roomCode || "").trim().toUpperCase();
      const emoji = data?.emoji;
      const senderName = data?.senderName || socket.userData?.name || "Thành viên";
      if (!roomCode || !emoji) return;

      // Rate limit chống spam trên server: tối thiểu 400ms giữa các lần bắn reaction cho mỗi socket
      const now = Date.now();
      if (socket.lastReactionAt && now - socket.lastReactionAt < 400) {
        return;
      }
      socket.lastReactionAt = now;

      // Broadcast reaction cho mọi người trong phòng
      io.to(roomCode).emit("room:receive-reaction", {
        emoji,
        senderName,
        reactionId: `rx_${now}_${Math.random().toString(36).slice(2, 7)}`,
      });
    });

    /**
     * Sự kiện: chat:send-message
     * payload: { roomCode, text, file }
     */
    socket.on("chat:send-message", async (data) => {
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const text = (data?.text || "").trim();
        const file = data?.file || (data?.fileUrl ? {
          fileUrl: data.fileUrl,
          fileName: data.fileName || "Tài liệu",
          fileType: data.fileType || "document",
          fileSize: data.fileSize || 0,
        } : null);

        if (!roomCode || (!text && !file)) return;

        const roomState = getOrCreateRoomState(roomCode);
        const user = socket.userData;

        const time = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const replyTo = data?.replyTo
          ? {
              messageId: data.replyTo.messageId,
              senderName: data.replyTo.senderName,
              contentPreview: (data.replyTo.contentPreview || "").slice(0, 100),
            }
          : null;

        const newMsg = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          text,
          file: file || null,
          replyTo,
          author: user?.name || "Người dùng",
          sender: {
            id: String(user?.id || user?._id || socket.id),
            name: user?.name || "Người dùng",
            avatar: user?.avatar || "",
          },
          time,
          system: false,
          isRecalled: false,
          recalledAt: null,
          recalledBy: null,
        };

        roomState.messages.push(newMsg);
        if (roomState.messages.length > 100) {
          roomState.messages.shift();
        }

        io.to(roomCode).emit("chat:new-message", newMsg);

        // Lưu metadata vào RoomFile nếu có đính kèm file
        if (file && file.fileUrl) {
          try {
            const senderUserId = user?.id || user?._id || null;
            if (senderUserId) {
              const savedFile = await RoomFile.create({
                roomCode,
                messageId: newMsg.id,
                senderId: senderUserId,
                senderName: user?.name || "Thành viên",
                senderAvatar: user?.avatar || "",
                fileUrl: file.fileUrl,
                fileName: file.fileName || "Tài liệu",
                fileType: file.fileType || "document",
                fileSize: file.fileSize || 0,
                publicId: file.publicId || "",
                resourceType: file.resourceType || (file.fileType === "image" ? "image" : "raw"),
              });
              io.to(roomCode).emit("room:file-shared", savedFile);

              // Bắn thông báo realtime tới phòng học (chỉ tồn tại trong phiên phòng học)
              const fileNotif = {
                id: `rn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                type: file.fileType === "image" ? "IMAGE_SHARED" : "FILE_SHARED",
                senderId: String(senderUserId || socket.id),
                senderName: user?.name || "Thành viên",
                senderAvatar: user?.avatar || "",
                title: file.fileType === "image" ? "Ảnh mới trong phòng" : "Tài liệu mới trong phòng",
                message: `${user?.name || "Thành viên"} vừa chia sẻ "${file.fileName || "Tệp tin"}"`,
                fileUrl: file.fileUrl,
                fileName: file.fileName,
                fileType: file.fileType || "document",
                createdAt: new Date().toISOString(),
              };
              addRoomNotification(roomCode, fileNotif, io);
            }
          } catch (dbErr) {
            console.error("[Socket] Loi luu RoomFile:", dbErr.message);
          }
        } else if (text) {
          // Tin nhắn văn bản thông thường
          const chatNotif = {
            id: `rn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: "CHAT_MESSAGE",
            senderId: String(user?.id || user?._id || socket.id),
            senderName: user?.name || "Người dùng",
            senderAvatar: user?.avatar || "",
            title: `Tin nhắn từ ${user?.name || "Thành viên"}`,
            message: text.length > 70 ? text.slice(0, 70) + "..." : text,
            createdAt: new Date().toISOString(),
          };
          addRoomNotification(roomCode, chatNotif, io);
        }
      } catch (err) {
        console.error("[Socket] Loi chat:send-message:", err.message);
      }
    });

    /**
     * Sự kiện: chat:recall-message
     * Thu hồi tin nhắn đa phương tiện realtime (hỗ trợ cả Chat phòng học và Chat cá nhân/nhóm)
     * payload: { roomCode?, conversationId?, messageId }
     */
    socket.on("chat:recall-message", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const conversationId = data?.conversationId;
        const messageId = data?.messageId;

        if (!messageId) {
          return cb({ success: false, message: "Thiếu mã tin nhắn cần thu hồi." });
        }

        // TRƯỜNG HỢP 1: Thu hồi tin nhắn trong Hội thoại cá nhân / nhóm (Conversation)
        if (conversationId || (!roomCode && messageId)) {
          const currentUserId = String(
            socket.userData?.id || socket.userData?._id || socket.userId || socket.authUserId || ""
          );

          const message = await Message.findById(messageId);
          if (!message) {
            return cb({ success: false, message: "Không tìm thấy tin nhắn." });
          }

          if (currentUserId && String(message.sender) !== currentUserId) {
            return cb({
              success: false,
              message: "Bạn chỉ có thể thu hồi tin nhắn do chính bạn gửi.",
            });
          }

          const fileToDelete = message.fileUrl || message.image;
          if (fileToDelete) {
            try {
              const fileInfo = extractCloudinaryInfo(fileToDelete);
              if (fileInfo?.publicId && cloudinary?.uploader) {
                await cloudinary.uploader.destroy(fileInfo.publicId, {
                  resource_type: fileInfo.resourceType || "auto",
                  invalidate: true,
                });
              }
            } catch (cErr) {
              console.warn("[Socket recall] Lỗi xóa Cloudinary:", cErr.message);
            }
          }

          message.isRevoked = true;
          message.revokedAt = new Date();
          message.isRecalled = true;
          message.recalledAt = new Date();
          message.text = "";
          message.image = "";
          message.fileUrl = "";
          message.fileName = "";
          message.fileType = "";
          message.fileSize = 0;
          await message.save();

          const populatedMessage = await Message.findById(message._id).populate(
            "sender",
            "_id name email avatar"
          );

          const convId = conversationId || message.conversationId;
          const conv = await Conversation.findById(convId);
          if (conv) {
            const latestMessage = await Message.findOne({
              conversationId: convId,
            }).sort({ createdAt: -1 });

            if (latestMessage) {
              conv.lastMessage = {
                text:
                  latestMessage.isRevoked || latestMessage.isRecalled
                    ? "Tin nhắn đã bị thu hồi"
                    : latestMessage.text || "Tin nhắn",
                sender: latestMessage.sender,
                createdAt: latestMessage.createdAt,
              };
              await conv.save();
            }
          }

          const payload = {
            messageId: message._id,
            conversationId: convId,
            message: populatedMessage,
          };

          io.to(`conversation:${convId}`).emit("chat:message-revoked", payload);
          io.to(`conversation:${convId}`).emit("chat:message-recalled", payload);
          io.to(String(convId)).emit("chat:message-revoked", payload);
          io.to(String(convId)).emit("chat:message-recalled", payload);

          if (conv && Array.isArray(conv.participants)) {
            conv.participants.forEach((pId) => {
              const uidStr = String(pId?._id || pId);
              io.to(`user:${uidStr}`).emit("chat:message-revoked", payload);
              io.to(`user:${uidStr}`).emit("chat:message-recalled", payload);
              io.to(`user:${uidStr}`).emit("chat:conversation-updated", {
                conversationId: conv._id,
                lastMessage: conv.lastMessage,
              });
            });
          }

          return cb({ success: true, message: "Đã thu hồi tin nhắn thành công." });
        }

        // TRƯỜNG HỢP 2: Thu hồi tin nhắn trong phòng học trực tuyến (Room Chat)
        if (!roomCode) {
          return cb({ success: false, message: "Thiếu thông tin phòng học." });
        }

        const roomState = getOrCreateRoomState(roomCode);
        const msg = roomState.messages.find((m) => m.id === messageId);
        if (!msg) {
          return cb({ success: false, message: "Không tìm thấy tin nhắn hoặc tin nhắn đã bị xóa." });
        }

        if (msg.isRecalled) {
          return cb({ success: false, message: "Tin nhắn này đã được thu hồi trước đó." });
        }

        const currentUserId = String(
          socket.userData?.id || socket.userData?._id || socket.userId || socket.id || ""
        );
        const senderUserId = String(msg.sender?.id || msg.sender?._id || "");

        // Kiểm tra xem người yêu cầu có phải là Chủ phòng (Host) không
        let isHost = false;
        try {
          const roomDoc = await Room.findOne({ roomCode });
          if (roomDoc && currentUserId) {
            isHost = String(roomDoc.hostId) === currentUserId;
          }
        } catch (_) {}

        // Chỉ chính chủ người gửi hoặc Chủ phòng mới có quyền thu hồi
        if (currentUserId !== senderUserId && !isHost) {
          return cb({
            success: false,
            message: "Bạn không có quyền thu hồi tin nhắn này.",
          });
        }

        const fileData = msg.file || (msg.fileUrl ? { fileUrl: msg.fileUrl, fileName: msg.fileName } : null);
        const recalledFileUrl = fileData?.fileUrl || null;

        // 1. Nếu có tệp đính kèm / hình ảnh -> Xóa trên Cloudinary và trong RoomFile
        if (recalledFileUrl) {
          try {
            const filesToDelete = await RoomFile.find({
              roomCode,
              $or: [{ messageId: msg.id }, { fileUrl: recalledFileUrl }],
            });

            for (const f of filesToDelete) {
              let publicId = f.publicId;
              let resourceType = f.resourceType;
              if (!publicId && f.fileUrl) {
                const parsed = extractCloudinaryInfo(f.fileUrl);
                if (parsed) {
                  publicId = parsed.publicId;
                  resourceType = parsed.resourceType;
                }
              }

              if (publicId && cloudinary?.uploader) {
                const resType = resourceType || (f.fileType === "image" ? "image" : "raw");
                await cloudinary.uploader.destroy(publicId, { resource_type: resType });
                console.log(`[RecallMessage] Đã xóa Cloudinary: ${publicId} (${resType})`);
              }
            }

            await RoomFile.deleteMany({
              roomCode,
              $or: [{ messageId: msg.id }, { fileUrl: recalledFileUrl }],
            });

            // Broadcast sự kiện xóa tệp cho toàn phòng để tab Tài liệu lập tức cập nhật
            io.to(roomCode).emit("room:file-deleted", {
              fileUrl: recalledFileUrl,
              messageId: msg.id,
            });
          } catch (fileErr) {
            console.warn("[RecallMessage] Lỗi dọn tệp đính kèm:", fileErr.message);
          }
        }

        // 2. Cập nhật trạng thái tin nhắn trong bộ nhớ RAM của phòng học
        const recalledAt = new Date().toISOString();
        const recalledByName = socket.userData?.name || "Người dùng";

        msg.isRecalled = true;
        msg.recalledAt = recalledAt;
        msg.recalledBy = recalledByName;
        msg.text = "";
        msg.file = null;
        msg.fileUrl = null;
        msg.fileName = null;

        // 3. Broadcast sự kiện thu hồi realtime tới tất cả mọi người trong phòng
        io.to(roomCode).emit("chat:message-recalled", {
          roomCode,
          messageId: msg.id,
          recalledBy: recalledByName,
          recalledAt,
          fileUrl: recalledFileUrl,
        });

        // 4. Đồng thời loại bỏ thông báo tương ứng trong session notifications nếu có
        if (roomState.notifications && roomState.notifications.length > 0) {
          roomState.notifications = roomState.notifications.filter((n) => {
            if (recalledFileUrl && n.fileUrl === recalledFileUrl) return false;
            return true;
          });
        }

        return cb({ success: true, message: "Đã thu hồi tin nhắn thành công." });
      } catch (err) {
        console.error("[Socket] Lỗi chat:recall-message:", err.message);
        return cb({ success: false, message: "Không thể thu hồi tin nhắn: " + err.message });
      }
    });

    /**
     * Sự kiện: room:transcript-segment
     * Nhận đoạn chép lời từ client và lưu RIÊNG BIỆT cho user đó
     */
    socket.on("room:transcript-segment", ({ roomCode, text, speakerName, userId }) => {
      try {
        if (!roomCode || !text || !text.trim()) return;
        const normalizedCode = (roomCode || "").trim().toUpperCase();
        const targetUserId = String(
          userId || socket.userId || socket.userData?.id || socket.userData?._id || ""
        );
        if (!targetUserId) return;

        const state = getOrCreateRoomState(normalizedCode);
        if (!state.userTranscripts.has(targetUserId)) {
          state.userTranscripts.set(targetUserId, []);
        }

        const timeStr = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        state.userTranscripts.get(targetUserId).push({
          text: text.trim(),
          speakerName: speakerName || socket.userData?.name || "Bạn",
          time: timeStr,
          createdAt: new Date(),
        });
      } catch (err) {
        console.warn("[Socket] Lỗi nhận room:transcript-segment:", err.message);
      }
    });

    /**
     * Sự kiện: room:transcript-sync
     * Nhận đồng bộ toàn bộ mảng lịch sử chép lời từ client cho riêng user đó
     */
    socket.on("room:transcript-sync", ({ roomCode, fullHistory, userId }) => {
      try {
        if (!roomCode || !Array.isArray(fullHistory)) return;
        const normalizedCode = (roomCode || "").trim().toUpperCase();
        const targetUserId = String(
          userId || socket.userId || socket.userData?.id || socket.userData?._id || ""
        );
        if (!targetUserId) return;

        const state = getOrCreateRoomState(normalizedCode);
        state.userTranscripts.set(
          targetUserId,
          fullHistory.map((item) => ({
            text: item.text || "",
            speakerName: item.speakerName || "Bạn",
            time: item.time || new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            createdAt: new Date(),
          }))
        );
      } catch (err) {
        console.warn("[Socket] Lỗi nhận room:transcript-sync:", err.message);
      }
    });

    /**
     * Sự kiện: pomodoro:start
     */
    socket.on("pomodoro:start", (data) => {
      const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
      if (roomCode) startPomodoro(roomCode, io);
    });

    /**
     * Sự kiện: pomodoro:pause
     */
    socket.on("pomodoro:pause", (data) => {
      const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
      if (roomCode) pausePomodoro(roomCode, io);
    });

    /**
     * Sự kiện: pomodoro:reset
     */
    socket.on("pomodoro:reset", (data) => {
      const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
      if (roomCode) resetPomodoro(roomCode, io);
    });

    /**
     * Sự kiện: pomodoro:set-duration
     * payload: { roomCode, minutes }
     */
    socket.on("pomodoro:set-duration", (data) => {
      const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
      const minutes = data?.minutes;
      if (roomCode && minutes) setPomodoroDuration(roomCode, minutes, io);
    });

    // Đăng ký các sự kiện vẽ bảng trắng Whiteboard
    registerWhiteboardHandlers(io, socket);

    /**
     * Sự kiện: room:kick-member
     * Host mời tạm thời một thành viên ra khỏi phòng
     * payload: { roomCode, targetUserId, reason }
     */
    socket.on("room:kick-member", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const targetUserId = data?.targetUserId;
        const reason = data?.reason || "Chủ phòng đã mời bạn ra khỏi phòng";
        let hostUserId = socket.userData?.id || socket.userData?._id || socket.authUserId;

        // Xác thực token JWT nếu được client truyền kèm
        if (data?.token) {
          try {
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
            if (decoded?.id) {
              hostUserId = String(decoded.id);
              socket.authUserId = hostUserId;
              if (!socket.userData) {
                socket.userData = { id: hostUserId };
              }
            }
          } catch (jwtErr) {
            console.warn("[Socket] Token kick khong hop le:", jwtErr.message);
          }
        }

        if (!roomCode || !targetUserId) {
          return cb({ success: false, message: "Thiếu thông tin roomCode hoặc targetUserId" });
        }

        const room = await Room.findOne({ roomCode });
        if (!room) {
          return cb({ success: false, message: "Phòng học không tồn tại" });
        }

        const roomHostIdStr = String(room.hostId?._id || room.hostId);
        if (!hostUserId || roomHostIdStr !== String(hostUserId)) {
          return cb({ success: false, message: "Chỉ chủ phòng mới có quyền mời thành viên rời phòng" });
        }

        if (String(targetUserId) === String(hostUserId)) {
          return cb({ success: false, message: "Chủ phòng không thể tự mời chính mình rời phòng" });
        }

        // Tìm thông tin của target user để hiển thị tên
        let targetName = "Thành viên";
        const targetUserDoc = await User.findById(targetUserId);
        if (targetUserDoc) targetName = targetUserDoc.name;

        // Xóa targetUserId khỏi mảng participants
        await Room.findOneAndUpdate(
          { roomCode },
          { $pull: { participants: { userId: targetUserId } } }
        );

        // Hủy timer ân hạn disconnect nếu có
        const graceKey = `${roomCode}_${targetUserId}`;
        if (disconnectGraceTimers.has(graceKey)) {
          clearTimeout(disconnectGraceTimers.get(graceKey));
          disconnectGraceTimers.delete(graceKey);
        }

        // Thêm tin nhắn hệ thống vào khung chat
        const roomState = getOrCreateRoomState(roomCode);
        const sysMsg = {
          id: `sys_${Date.now()}`,
          text: `"${targetName}" đã được chủ phòng mời ra khỏi phòng học.`,
          sender: { id: "system", name: "Hệ thống" },
          time: new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          system: true,
        };
        roomState.messages.push(sysMsg);
        if (roomState.messages.length > 100) roomState.messages.shift();
        io.to(roomCode).emit("chat:new-message", sysMsg);

        // Xóa trạng thái giơ tay nếu có
        if (roomState?.raisedHands && roomState.raisedHands.has(String(targetUserId))) {
          roomState.raisedHands.delete(String(targetUserId));
          io.to(roomCode).emit("room:hand-updated", {
            userId: String(targetUserId),
            userName: targetName,
            isHandRaised: false,
          });
        }

        // Phát sự kiện kick đến toàn bộ room (bao gồm targetUser)
        io.to(roomCode).emit("room:user-kicked", {
          roomCode,
          targetUserId: String(targetUserId),
          targetName,
          reason,
          hostName: socket.userData?.name || "Chủ phòng",
        });

        // Xóa socket của targetUser khỏi roomCode
        const socketsInRoom = await io.in(roomCode).fetchSockets();
        for (const s of socketsInRoom) {
          const sUserId = s.userData?.id || s.userData?._id || s.authUserId;
          if (String(sUserId) === String(targetUserId)) {
            s.leave(roomCode);
            s.roomCode = null;
          }
        }

        // Đồng bộ lại danh sách thành viên mới nhất
        const updatedRoom = await Room.findOne({ roomCode })
          .populate("hostId", "name email avatar isPro title equippedTitle")
          .populate("participants.userId", "name email avatar isPro title equippedTitle");

        if (updatedRoom) {
          io.to(roomCode).emit("room:members-sync", {
            roomCode,
            participants: updatedRoom.participants,
            hostId: updatedRoom.hostId,
          });
          io.emit("room:members-sync", {
            roomCode,
            participants: updatedRoom.participants,
          });
        }

        console.log(`[Socket] Host [${socket.userData?.name}] da KICK thanh vien [${targetName}] khoi phong ${roomCode}`);
        cb({ success: true, message: `Đã mời "${targetName}" ra khỏi phòng.` });
      } catch (err) {
        console.error("[Socket] Loi kick-member:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: room:ban-member
     * Host cấm thành viên vào phòng cho đến khi phòng đóng
     * payload: { roomCode, targetUserId, reason }
     */
    socket.on("room:ban-member", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const targetUserId = data?.targetUserId;
        const reason = data?.reason || "Chủ phòng đã cấm bạn vào phòng này";
        let hostUserId = socket.userData?.id || socket.userData?._id || socket.authUserId;

        // Xác thực token JWT nếu được client truyền kèm
        if (data?.token) {
          try {
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
            if (decoded?.id) {
              hostUserId = String(decoded.id);
              socket.authUserId = hostUserId;
              if (!socket.userData) {
                socket.userData = { id: hostUserId };
              }
            }
          } catch (jwtErr) {
            console.warn("[Socket] Token ban khong hop le:", jwtErr.message);
          }
        }

        if (!roomCode || !targetUserId) {
          return cb({ success: false, message: "Thiếu thông tin roomCode hoặc targetUserId" });
        }

        const room = await Room.findOne({ roomCode });
        if (!room) {
          return cb({ success: false, message: "Phòng học không tồn tại" });
        }

        const roomHostIdStr = String(room.hostId?._id || room.hostId);
        if (!hostUserId || roomHostIdStr !== String(hostUserId)) {
          return cb({ success: false, message: "Chỉ chủ phòng mới có quyền cấm thành viên" });
        }

        if (String(targetUserId) === String(hostUserId)) {
          return cb({ success: false, message: "Chủ phòng không thể tự cấm chính mình" });
        }

        // Tìm thông tin của target user để hiển thị tên
        let targetName = "Thành viên";
        const targetUserDoc = await User.findById(targetUserId);
        if (targetUserDoc) targetName = targetUserDoc.name;

        // Xóa targetUserId khỏi participants và thêm vào bannedUsers
        await Room.findOneAndUpdate(
          { roomCode },
          {
            $pull: { participants: { userId: targetUserId } },
            $addToSet: { bannedUsers: targetUserId },
          }
        );

        // Hủy timer ân hạn disconnect nếu có
        const graceKey = `${roomCode}_${targetUserId}`;
        if (disconnectGraceTimers.has(graceKey)) {
          clearTimeout(disconnectGraceTimers.get(graceKey));
          disconnectGraceTimers.delete(graceKey);
        }

        // Thêm tin nhắn hệ thống vào khung chat
        const roomState = getOrCreateRoomState(roomCode);
        const sysMsg = {
          id: `sys_${Date.now()}`,
          text: `"${targetName}" đã bị chủ phòng cấm tham gia phòng học này.`,
          sender: { id: "system", name: "Hệ thống" },
          time: new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          system: true,
        };
        roomState.messages.push(sysMsg);
        if (roomState.messages.length > 100) roomState.messages.shift();
        io.to(roomCode).emit("chat:new-message", sysMsg);

        // Xóa trạng thái giơ tay nếu có
        if (roomState?.raisedHands && roomState.raisedHands.has(String(targetUserId))) {
          roomState.raisedHands.delete(String(targetUserId));
          io.to(roomCode).emit("room:hand-updated", {
            userId: String(targetUserId),
            userName: targetName,
            isHandRaised: false,
          });
        }

        // Phát sự kiện ban đến toàn bộ room (bao gồm targetUser)
        io.to(roomCode).emit("room:user-banned", {
          roomCode,
          targetUserId: String(targetUserId),
          targetName,
          reason,
          hostName: socket.userData?.name || "Chủ phòng",
        });

        // Xóa socket của targetUser khỏi roomCode
        const socketsInRoom = await io.in(roomCode).fetchSockets();
        for (const s of socketsInRoom) {
          const sUserId = s.userData?.id || s.userData?._id || s.authUserId;
          if (String(sUserId) === String(targetUserId)) {
            s.leave(roomCode);
            s.roomCode = null;
          }
        }

        // Đồng bộ lại danh sách thành viên mới nhất
        const updatedRoom = await Room.findOne({ roomCode })
          .populate("hostId", "name email avatar isPro title equippedTitle")
          .populate("participants.userId", "name email avatar isPro title equippedTitle");

        if (updatedRoom) {
          io.to(roomCode).emit("room:members-sync", {
            roomCode,
            participants: updatedRoom.participants,
            hostId: updatedRoom.hostId,
          });
          io.emit("room:members-sync", {
            roomCode,
            participants: updatedRoom.participants,
          });
        }

        console.log(`[Socket] Host [${socket.userData?.name}] da BAN thanh vien [${targetName}] khoi phong ${roomCode}`);
        cb({ success: true, message: `Đã cấm "${targetName}" tham gia phòng học.` });
      } catch (err) {
        console.error("[Socket] Loi ban-member:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: room:toggle-lock
     * Host bật/tắt khóa phòng học tạm thời
     * payload: { roomCode, isLocked }
     */
    socket.on("room:toggle-lock", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const isLocked = Boolean(data?.isLocked);
        const uId = String(socket.userData?.id || socket.userData?._id || socket.userId || socket.authUserId || "");

        if (!roomCode) {
          return cb({ success: false, message: "Thiếu mã phòng." });
        }

        const room = await Room.findOne({ roomCode });
        if (!room) {
          return cb({ success: false, message: "Phòng không tồn tại." });
        }

        if (String(room.hostId) !== uId) {
          return cb({ success: false, message: "Chỉ chủ phòng mới có quyền khóa/mở khóa phòng." });
        }

        await Room.updateOne({ roomCode }, { $set: { isLocked } });

        // Broadcast realtime cập nhật khóa phòng cho mọi người trong phòng và Dashboard
        io.to(roomCode).emit("room:lock-updated", { isLocked, roomCode });
        io.emit("dashboard:room-updated", { roomCode, isLocked });

        // Tin nhắn hệ thống thông báo trạng thái
        const roomState = getOrCreateRoomState(roomCode);
        const sysMsg = {
          id: `sys_${Date.now()}`,
          text: `Chủ phòng đã ${isLocked ? "khóa tạm thời" : "mở khóa"} phòng học.`,
          sender: { id: "system", name: "Hệ thống" },
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          system: true,
        };
        roomState.messages.push(sysMsg);
        if (roomState.messages.length > 100) roomState.messages.shift();
        io.to(roomCode).emit("chat:new-message", sysMsg);

        console.log(`[Socket] Host ${socket.userData?.name} da ${isLocked ? "KHOA" : "MO KHOA"} phong ${roomCode}`);
        cb({ success: true, isLocked });
      } catch (err) {
        console.error("[Socket] Lỗi room:toggle-lock:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: room:force-mute-user
     * Host tắt mic của một thành viên từ xa
     * payload: { roomCode, targetUserId }
     */
    socket.on("room:force-mute-user", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const targetUserId = String(data?.targetUserId || "");
        const uId = String(socket.userData?.id || socket.userData?._id || socket.userId || socket.authUserId || "");

        if (!roomCode || !targetUserId) {
          return cb({ success: false, message: "Thiếu dữ liệu." });
        }

        const room = await Room.findOne({ roomCode });
        if (!room) return cb({ success: false, message: "Phòng không tồn tại." });

        if (String(room.hostId) !== uId) {
          return cb({ success: false, message: "Chỉ chủ phòng mới có quyền tắt mic thành viên." });
        }

        const hostName = socket.userData?.name || "Chủ phòng";
        io.to(roomCode).emit("room:user-force-muted", { targetUserId, hostName });
        io.to(`user:${targetUserId}`).emit("room:user-force-muted", { targetUserId, hostName });

        cb({ success: true, targetUserId });
      } catch (err) {
        console.error("[Socket] Lỗi room:force-mute-user:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: room:force-mute-all
     * Host tắt mic của tất cả thành viên trong phòng (ngoại trừ Host)
     * payload: { roomCode }
     */
    socket.on("room:force-mute-all", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const uId = String(socket.userData?.id || socket.userData?._id || socket.userId || socket.authUserId || "");

        if (!roomCode) return cb({ success: false, message: "Thiếu mã phòng." });

        const room = await Room.findOne({ roomCode });
        if (!room) return cb({ success: false, message: "Phòng không tồn tại." });

        if (String(room.hostId) !== uId) {
          return cb({ success: false, message: "Chỉ chủ phòng mới có quyền tắt mic tất cả." });
        }

        const hostName = socket.userData?.name || "Chủ phòng";
        io.to(roomCode).emit("room:all-force-muted", { hostId: uId, hostName });

        // Tin nhắn hệ thống
        const roomState = getOrCreateRoomState(roomCode);
        const sysMsg = {
          id: `sys_${Date.now()}`,
          text: `Chủ phòng đã tắt mic của tất cả thành viên.`,
          sender: { id: "system", name: "Hệ thống" },
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          system: true,
        };
        roomState.messages.push(sysMsg);
        if (roomState.messages.length > 100) roomState.messages.shift();
        io.to(roomCode).emit("chat:new-message", sysMsg);

        cb({ success: true });
      } catch (err) {
        console.error("[Socket] Lỗi room:force-mute-all:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: room:transfer-host
     * Host chuyển quyền chủ phòng cho một thành viên khác
     * payload: { roomCode, newHostId }
     */
    socket.on("room:transfer-host", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const newHostId = String(data?.newHostId || "");
        const uId = String(socket.userData?.id || socket.userData?._id || socket.userId || socket.authUserId || "");

        if (!roomCode || !newHostId) {
          return cb({ success: false, message: "Thiếu thông tin phòng hoặc chủ phòng mới." });
        }

        const room = await Room.findOne({ roomCode });
        if (!room) return cb({ success: false, message: "Phòng không tồn tại." });

        if (String(room.hostId) !== uId) {
          return cb({ success: false, message: "Chỉ chủ phòng hiện tại mới có quyền chuyển quyền chủ phòng." });
        }

        if (uId === newHostId) {
          return cb({ success: false, message: "Bạn hiện đã là chủ phòng." });
        }

        const newHostUser = await User.findById(newHostId);
        if (!newHostUser) {
          return cb({ success: false, message: "Không tìm thấy thông tin thành viên được chỉ định." });
        }

        const oldHostName = socket.userData?.name || "Chủ phòng cũ";
        const newHostName = newHostUser.name || "Thành viên";

        // Cập nhật DB
        await Room.updateOne({ roomCode }, { $set: { hostId: newHostId } });

        // Phát sự kiện chuyển quyền chủ phòng
        io.to(roomCode).emit("room:host-transferred", {
          roomCode,
          previousHostId: uId,
          newHostId,
          newHostName,
          oldHostName,
        });

        // Tin nhắn hệ thống
        const roomState = getOrCreateRoomState(roomCode);
        const sysMsg = {
          id: `sys_${Date.now()}`,
          text: `"${oldHostName}" đã trao quyền Chủ phòng cho "${newHostName}".`,
          sender: { id: "system", name: "Hệ thống" },
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          system: true,
        };
        roomState.messages.push(sysMsg);
        if (roomState.messages.length > 100) roomState.messages.shift();
        io.to(roomCode).emit("chat:new-message", sysMsg);

        // Đồng bộ lại danh sách members với hostId mới
        const updatedRoom = await Room.findOne({ roomCode })
          .populate("hostId", "name email avatar isPro title equippedTitle")
          .populate("participants.userId", "name email avatar isPro title equippedTitle");

        if (updatedRoom) {
          io.to(roomCode).emit("room:members-sync", {
            roomCode,
            participants: updatedRoom.participants,
            hostId: updatedRoom.hostId,
            titleVisibility: Object.fromEntries(roomState.titleVisibility),
            raisedHands: Object.fromEntries(roomState.raisedHands),
            focusStatuses: Object.fromEntries(roomState.focusStatuses),
            isLocked: Boolean(updatedRoom.isLocked),
            pinnedItem: roomState.pinnedItem,
          });
        }

        console.log(`[Socket] Phong ${roomCode}: Host chuyen tu [${oldHostName}] sang [${newHostName}]`);
        cb({ success: true, newHostId, newHostName });
      } catch (err) {
        console.error("[Socket] Lỗi room:transfer-host:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: room:update-focus-status
     * Thành viên cập nhật trạng thái tập trung cá nhân (Preset icon + label hoặc null để xóa)
     * payload: { roomCode, userId, status: { icon, label } | null }
     */
    socket.on("room:update-focus-status", (data) => {
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const uId = String(data?.userId || socket.userData?.id || socket.userData?._id || socket.userId || "");
        const status = data?.status; // { icon, label } hoặc null

        if (!roomCode || !uId) return;

        const roomState = getOrCreateRoomState(roomCode);
        if (status && status.label) {
          roomState.focusStatuses.set(uId, {
            icon: status.icon || "🎯",
            label: status.label.slice(0, 30),
          });
        } else {
          roomState.focusStatuses.delete(uId);
        }

        // Broadcast realtime tới toàn bộ phòng
        io.to(roomCode).emit("room:focus-status-updated", {
          userId: uId,
          status: status && status.label ? { icon: status.icon || "🎯", label: status.label.slice(0, 30) } : null,
        });
      } catch (err) {
        console.error("[Socket] Lỗi room:update-focus-status:", err.message);
      }
    });

    /**
     * Sự kiện: chat:pin-item
     * Ghim tin nhắn hoặc tài liệu lên đầu khung Chat
     * payload: { roomCode, item }
     */
    socket.on("chat:pin-item", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const item = data?.item;

        if (!roomCode || !item || !item.id) {
          return cb({ success: false, message: "Thiếu dữ liệu ghim." });
        }

        const roomState = getOrCreateRoomState(roomCode);
        const pinnedObj = {
          id: item.id,
          type: item.type || "message", // 'message' | 'file'
          senderName: item.senderName || item.author || "Thành viên",
          text: item.text || "",
          fileUrl: item.fileUrl || item.file?.fileUrl || "",
          fileName: item.fileName || item.file?.fileName || "",
          fileType: item.fileType || item.file?.fileType || "",
          pinnedBy: socket.userData?.name || "Thành viên",
          pinnedAt: new Date().toISOString(),
        };

        roomState.pinnedItem = pinnedObj;
        io.to(roomCode).emit("chat:item-pinned", { pinnedItem: pinnedObj, roomCode });

        // Thông báo hệ thống nhẹ
        const sysMsg = {
          id: `sys_${Date.now()}`,
          text: `"${pinnedObj.pinnedBy}" đã ghim một ${pinnedObj.type === "file" ? "tài liệu" : "tin nhắn"}.`,
          sender: { id: "system", name: "Hệ thống" },
          time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          system: true,
        };
        roomState.messages.push(sysMsg);
        if (roomState.messages.length > 100) roomState.messages.shift();
        io.to(roomCode).emit("chat:new-message", sysMsg);

        cb({ success: true, pinnedItem: pinnedObj });
      } catch (err) {
        console.error("[Socket] Lỗi chat:pin-item:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: chat:unpin-item
     * Bỏ ghim tin nhắn/tài liệu
     * payload: { roomCode }
     */
    socket.on("chat:unpin-item", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        if (!roomCode) return cb({ success: false, message: "Thiếu mã phòng." });

        const roomState = getOrCreateRoomState(roomCode);
        roomState.pinnedItem = null;

        io.to(roomCode).emit("chat:item-unpinned", { roomCode });
        cb({ success: true });
      } catch (err) {
        console.error("[Socket] Lỗi chat:unpin-item:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: chat:create-poll
     * Tạo bình chọn nhanh trong chat
     * payload: { roomCode, question, options: [string] }
     */
    socket.on("chat:create-poll", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const question = (data?.question || "").trim();
        const rawOptions = Array.isArray(data?.options) ? data.options : [];

        if (!roomCode || !question) {
          return cb({ success: false, message: "Vui lòng nhập câu hỏi bình chọn." });
        }

        const validOptions = rawOptions
          .map((opt) => String(opt).trim())
          .filter(Boolean);

        if (validOptions.length < 2 || validOptions.length > 4) {
          return cb({ success: false, message: "Bình chọn cần từ 2 đến 4 lựa chọn." });
        }

        const roomState = getOrCreateRoomState(roomCode);
        const user = socket.userData;
        const pollId = `poll_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        const poll = {
          id: pollId,
          question,
          options: validOptions.map((text, idx) => ({
            id: idx,
            text,
            votes: [], // danh sách userIds đã vote option này
          })),
          createdBy: {
            id: String(user?.id || user?._id || socket.id),
            name: user?.name || "Người dùng",
            avatar: user?.avatar || "",
          },
          createdAt: new Date().toISOString(),
          totalVotes: 0,
        };

        roomState.polls.set(pollId, poll);

        // Tạo tin nhắn dạng poll trong messages stream
        const time = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const pollMsg = {
          id: pollId,
          type: "poll",
          poll,
          text: `[Bình chọn] ${question}`,
          author: user?.name || "Người dùng",
          sender: {
            id: String(user?.id || user?._id || socket.id),
            name: user?.name || "Người dùng",
            avatar: user?.avatar || "",
          },
          time,
          system: false,
          createdAt: new Date(),
        };

        roomState.messages.push(pollMsg);
        if (roomState.messages.length > 100) roomState.messages.shift();

        // Broadcast realtime tới phòng
        io.to(roomCode).emit("chat:new-message", pollMsg);

        // Bắn room notification
        const pollNotif = {
          id: `rn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: "CHAT_MESSAGE",
          senderId: String(user?.id || user?._id || socket.id),
          senderName: user?.name || "Người dùng",
          senderAvatar: user?.avatar || "",
          title: `Bình chọn: ${question.slice(0, 35)}`,
          message: `${user?.name || "Thành viên"} vừa tạo một cuộc bình chọn nhanh`,
          createdAt: new Date().toISOString(),
        };
        addRoomNotification(roomCode, pollNotif, io);

        cb({ success: true, poll });
      } catch (err) {
        console.error("[Socket] Lỗi chat:create-poll:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: poll:vote
     * Thành viên biểu quyết vào một lựa chọn
     * payload: { roomCode, pollId, optionIndex, userId }
     */
    socket.on("poll:vote", async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const pollId = data?.pollId;
        const optionIndex = Number(data?.optionIndex);
        const voterUserId = String(
          data?.userId || socket.userData?.id || socket.userData?._id || socket.userId || socket.id || ""
        );

        if (!roomCode || !pollId || isNaN(optionIndex) || !voterUserId) {
          return cb({ success: false, message: "Thiếu dữ liệu bình chọn." });
        }

        const roomState = getOrCreateRoomState(roomCode);
        const poll = roomState.polls.get(pollId);
        if (!poll) {
          return cb({ success: false, message: "Không tìm thấy cuộc bình chọn." });
        }

        if (optionIndex < 0 || optionIndex >= poll.options.length) {
          return cb({ success: false, message: "Lựa chọn không hợp lệ." });
        }

        // Mỗi thành viên chỉ vote 1 lần: Xóa vote cũ ở mọi lựa chọn
        poll.options.forEach((opt) => {
          opt.votes = opt.votes.filter((uid) => uid !== voterUserId);
        });

        // Thêm vote vào lựa chọn mới
        poll.options[optionIndex].votes.push(voterUserId);

        // Tính lại tổng số lượt vote
        poll.totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes.length, 0);

        // Đồng bộ vào tin nhắn tương ứng trong roomState.messages nếu có
        const msgIndex = roomState.messages.findIndex((m) => m.id === pollId);
        if (msgIndex !== -1) {
          roomState.messages[msgIndex].poll = { ...poll };
        }

        // Broadcast cập nhật số liệu realtime cho cả phòng
        io.to(roomCode).emit("poll:vote-updated", {
          pollId,
          options: poll.options,
          totalVotes: poll.totalVotes,
          poll,
        });

        cb({ success: true, poll });
      } catch (err) {
        console.error("[Socket] Lỗi poll:vote:", err.message);
        cb({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: leave-room
     */
    socket.on("leave-room", async (data, callback) => {
      try {
        let roomCode = socket.roomCode;
        let userId = socket.userData?.id || socket.userData?._id || socket.userId;
        const userName = socket.userData?.name || "Thành viên";

        if (socket.joinTimestamp && userId) {
          await recordStudyTime(userId, socket.joinTimestamp);
          socket.joinTimestamp = null;
        }

        if (typeof data === "object" && data !== null) {
          if (data.roomCode) roomCode = data.roomCode;
          if (data.userId) userId = data.userId;
        } else if (typeof data === "string") {
          roomCode = data;
        }

        if (roomCode && userId) {
          const normalizedCode = roomCode.trim().toUpperCase();
          const graceKey = `${normalizedCode}_${userId}`;
          if (disconnectGraceTimers.has(graceKey)) {
            clearTimeout(disconnectGraceTimers.get(graceKey));
            disconnectGraceTimers.delete(graceKey);
          }
        }

        if (roomCode) {
          const normalizedCode = roomCode.trim().toUpperCase();

          // Xóa trạng thái giơ tay nếu có
          const state = roomStates.get(normalizedCode);
          const targetUId = String(userId || socket.id || "");
          if (state?.raisedHands && targetUId && state.raisedHands.has(targetUId)) {
            state.raisedHands.delete(targetUId);
            io.to(normalizedCode).emit("room:hand-updated", {
              userId: targetUId,
              userName,
              isHandRaised: false,
            });
          }

          // Kiểm tra xem người rời có phải host không
          let isHost = false;
          try {
            const roomDoc = await Room.findOne({ roomCode: normalizedCode });
            if (roomDoc && userId) {
              isHost = String(roomDoc.hostId) === String(userId);
            }
          } catch (dbErr) {
            console.error("[Socket] Loi kiem tra host:", dbErr.message);
          }

          // Xóa user khỏi mảng participants trong database
          if (userId) {
            try {
              await Room.findOneAndUpdate(
                { roomCode: normalizedCode },
                {
                  $pull: {
                    participants: {
                      userId,
                    },
                  },
                }
              );
            } catch (dbErr) {
              console.error("[Socket] Loi xoa participant khoi DB:", dbErr.message);
            }
          }

          // Nếu người rời phòng có bản chép lời riêng, lưu file và gửi thông báo riêng tư cho họ ngay
          const userKey = String(userId || socket.userId || "");
          if (!isHost && userKey && state?.userTranscripts?.has(userKey)) {
            const userSegments = state.userTranscripts.get(userKey);
            state.userTranscripts.delete(userKey);
            if (userSegments && userSegments.length > 0) {
              await saveUserTranscriptAndNotify({
                roomCode: normalizedCode,
                roomName: "Phòng học " + normalizedCode,
                userId: userKey,
                segments: userSegments,
                io,
              });
            }
          }

          if (isHost) {
            // Chủ phòng rời đi => Đóng phòng và quét sạch toàn bộ dữ liệu
            await destroyAndCleanupRoom(normalizedCode, io, userName);
          } else {
            // Thông báo thành viên thường rời phòng
            io.to(normalizedCode).emit("room:user-left", {
              userId,
              socketId: socket.id,
              name: userName,
            });

            // Đồng bộ lại số lượng thành viên ra Dashboard và phòng realtime
            try {
              const updatedDoc = await Room.findOne({ roomCode: normalizedCode })
                .populate("hostId", "name email avatar isPro title equippedTitle")
                .populate("participants.userId", "name email avatar isPro title equippedTitle");
              if (updatedDoc) {
                // Nếu sau khi thành viên rời đi mà phòng không còn ai => tự động dọn sạch
                if (!updatedDoc.participants || updatedDoc.participants.length === 0) {
                  console.log(`[Socket] Phòng ${normalizedCode} không còn ai, tự động dọn sạch và đóng phòng`);
                  await destroyAndCleanupRoom(normalizedCode, io, "Hệ thống");
                } else {
                  const state = getOrCreateRoomState(normalizedCode);
                  io.to(normalizedCode).emit("room:members-sync", {
                    roomCode: normalizedCode,
                    participants: updatedDoc.participants || [],
                    hostId: updatedDoc.hostId,
                    titleVisibility: Object.fromEntries(state.titleVisibility),
                    raisedHands: Object.fromEntries(state.raisedHands),
                  });
                  io.emit("room:members-sync", {
                    roomCode: normalizedCode,
                    participants: updatedDoc.participants || [],
                  });
                }
              }
            } catch (_) {}
          }

          socket.leave(normalizedCode);
          console.log(
            `[Socket] User [${userId || socket.id}] da roi phong ${normalizedCode}${
              isHost ? " (HOST - dong phong)" : ""
            }`
          );
        }

        socket.roomCode = null;
        socket.userData = null;

        if (typeof callback === "function") {
          callback({ success: true });
        }
      } catch (err) {
        console.error("[Socket] Loi khi xu ly leave-room:", err.message);
        if (typeof callback === "function") {
          callback({ success: false, error: err.message });
        }
      }
    });

    /**
     * Sự kiện ngắt kết nối (disconnect)
     * Áp dụng thời gian ân hạn 15 giây để người dùng F5 hoặc rớt mạng ngắn không bị mất phòng
     */
    socket.on("disconnect", async (reason) => {
      console.log(`[Socket] Client ngat ket noi: ${socket.id} (${reason})`);

      const roomCode = socket.roomCode;
      const user = socket.userData;
      const userId = user?.id || user?._id || socket.userId;
      const userName = user?.name || "Thành viên";

      if (socket.joinTimestamp && userId) {
        recordStudyTime(userId, socket.joinTimestamp);
        socket.joinTimestamp = null;
      }

      // Tự động dọn dẹp nếu người ngắt kết nối là người đang chờ trong phòng chờ
      if (socket.waitingRoomCode && socket.waitingUserId) {
        const wCode = socket.waitingRoomCode;
        const wUId = socket.waitingUserId;
        const state = roomStates.get(wCode);
        if (state?.pendingRequests?.has(wUId)) {
          state.pendingRequests.delete(wUId);
          try {
            await Room.updateOne({ roomCode: wCode }, { $pull: { pendingMembers: { user: wUId } } });
          } catch (_) {}
          const pendingList = Array.from(state.pendingRequests.values());
          io.to(wCode).emit("room:pending-updated", { roomCode: wCode, pendingList });
        }
      }

      // Tự động xóa trạng thái giơ tay của người đó trên toàn phòng khi disconnect
      if (roomCode) {
        const normalizedCode = roomCode.trim().toUpperCase();
        const state = roomStates.get(normalizedCode);
        const targetUId = String(userId || socket.id || "");
        if (state?.raisedHands && targetUId && state.raisedHands.has(targetUId)) {
          state.raisedHands.delete(targetUId);
          io.to(normalizedCode).emit("room:hand-updated", {
            userId: targetUId,
            userName,
            isHandRaised: false,
          });
        }
      }

      if (roomCode && userId) {
        const normalizedCode = roomCode.trim().toUpperCase();
        const uIdStr = String(userId);
        const graceKey = `${normalizedCode}_${uIdStr}`;

        if (disconnectGraceTimers.has(graceKey)) {
          clearTimeout(disconnectGraceTimers.get(graceKey));
        }

        console.log(`[Socket] User [${userName}] (${uIdStr}) tạm thời ngắt kết nối socket ${socket.id}. Bắt đầu ân hạn 45 giây...`);

        // Đặt thời gian ân hạn 45 giây (chống rớt mạng tạm thời, Next.js fast refresh, F5)
        const timer = setTimeout(async () => {
          disconnectGraceTimers.delete(graceKey);

          try {
            // 1. KIỂM TRA QUAN TRỌNG NHẤT: User này có socket nào khác đang hoạt động trong phòng không?
            const socketsInRoom = await io.in(normalizedCode).fetchSockets();
            const isStillActiveInRoom = socketsInRoom.some((s) => {
              const sid = String(s.userData?.id || s.userData?._id || s.userId || s.authUserId || "");
              return sid && sid === uIdStr;
            });

            if (isStillActiveInRoom) {
              console.log(
                `[Socket] User [${userName}] (${uIdStr}) VẪN ĐANG KẾT NỐI trong phòng ${normalizedCode} (reconnected/active) -> HỦY BỎ việc xóa khỏi phòng!`
              );
              return;
            }

            // 2. Kiểm tra xem có phải host không
            let isHost = false;
            try {
              const roomDoc = await Room.findOne({ roomCode: normalizedCode });
              if (roomDoc && roomDoc.hostId) {
                isHost = String(roomDoc.hostId._id || roomDoc.hostId) === uIdStr;
              }
            } catch (dbErr) {
              console.error("[Socket] Lỗi kiểm tra host (grace):", dbErr.message);
            }

            // 3. Nếu là Host và thực sự không còn socket nào trong phòng => Đóng phòng
            if (isHost) {
              console.log(`[Socket] Host [${userName}] thực sự đã rời phòng ${normalizedCode} quá thời gian ân hạn -> Đóng phòng`);
              await destroyAndCleanupRoom(normalizedCode, io, userName);
              return;
            }

            // 4. Nếu là thành viên thường thực sự ngắt kết nối
            if (userId) {
              try {
                await Room.findOneAndUpdate(
                  { roomCode: normalizedCode },
                  {
                    $pull: {
                      participants: {
                        userId: uIdStr,
                      },
                    },
                  }
                );
              } catch (dbErr) {
                console.error("[Socket] Lỗi cập nhật DB khi hết hạn grace:", dbErr.message);
              }
            }

            io.to(normalizedCode).emit("room:user-left", {
              userId: uIdStr,
              socketId: socket.id,
              name: userName,
            });

            try {
              const updatedDoc = await Room.findOne({ roomCode: normalizedCode })
                .populate("hostId", "name email avatar isPro title equippedTitle")
                .populate("participants.userId", "name email avatar isPro title equippedTitle");
              if (updatedDoc) {
                // Nếu sau khi ngắt kết nối mà phòng không còn ai => tự động dọn sạch
                if (!updatedDoc.participants || updatedDoc.participants.length === 0) {
                  console.log(`[Socket] Phòng ${normalizedCode} không còn ai (grace timeout), tự động dọn sạch`);
                  await destroyAndCleanupRoom(normalizedCode, io, "Hệ thống");
                } else {
                  const state = getOrCreateRoomState(normalizedCode);
                  io.to(normalizedCode).emit("room:members-sync", {
                    roomCode: normalizedCode,
                    participants: updatedDoc.participants || [],
                    hostId: updatedDoc.hostId,
                    titleVisibility: Object.fromEntries(state.titleVisibility),
                    raisedHands: Object.fromEntries(state.raisedHands),
                  });
                  io.emit("room:members-sync", {
                    roomCode: normalizedCode,
                    participants: updatedDoc.participants || [],
                  });
                }
              }
            } catch (_) {}
          } catch (err) {
            console.error("[Socket] Lỗi xử lý timeout disconnect grace:", err.message);
          }
        }, 45000);

        disconnectGraceTimers.set(graceKey, timer);
      }

      // Xử lý hiện diện offline của user khi ngắt kết nối
      const authUserId = socket.authUserId;
      if (authUserId) {
        try {
          const now = new Date();
          const userDoc = await User.findByIdAndUpdate(
            authUserId,
            { isOnline: false, lastSeen: now },
            { new: true }
          ).populate("friends", "_id");

          if (userDoc && userDoc.friends) {
            userDoc.friends.forEach((friend) => {
              io.to(`user:${friend._id}`).emit("friend:status-change", {
                userId: authUserId,
                isOnline: false,
                lastSeen: now,
              });
            });
          }
        } catch (err) {
          console.error("[Socket] Loi cap nhat offline presence:", err.message);
        }
      }
    });
  });

  console.log("[Socket] Socket.io server da san sang nhan ket noi.");
};

initSocket.addRoomNotification = addRoomNotification;

module.exports = initSocket;

