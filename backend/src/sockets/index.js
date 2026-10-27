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
const { createAndSendNotification, sendNotificationToMultiple } = require("../services/notification.service");
const { calculateStreakUpdate, getVietnamDateString } = require("../utils/streakHelper");
const { transcribeAudioWithGemini } = require("../services/aiTutor.service");

// Quản lý trạng thái realtime trong bộ nhớ (Pomodoro + Lịch sử tin nhắn gần nhất)
const roomStates = new Map();

// Bộ đệm lưu trữ timer ân hạn khi client ngắt kết nối tạm thời (F5 / rớt mạng ngắn)
const disconnectGraceTimers = new Map(); // key: `${normalizedCode}_${userId}` -> timer

// Bộ đếm timeout 10 phút khi Host rời phòng mà không chỉ định host mới
const hostAbsenceTimers = new Map(); // key: normalizedCode -> { timer, startedAt }

// Bộ đếm timeout 10 phút khi phòng chỉ còn đúng 1 người duy nhất (Empty Room Timeout)
const aloneRoomTimers = new Map(); // key: normalizedCode -> { timer, expiresAt }

// Bộ đếm thời lượng phòng tối đa 24 giờ kể từ createdAt (Max Duration)
const roomMaxDurationTimers = new Map(); // key: normalizedCode -> timer

// Quản lý độc quyền phiên học (Single Active Room Session per user)
const activeRoomSessions = new Map(); // key: userId -> value: { socketId, roomId, roomCode, userAgent }

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
      chess: {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        history: [],
        whitePlayerId: null,
        blackPlayerId: null,
        whitePlayerName: "",
        blackPlayerName: "",
        gameStatus: "waiting",
        readyPlayers: [],
        winner: null,
        reason: null,
        remainingSeconds: 600,
        timerId: null,
        closingTimerId: null,
        closingSeconds: 60,
      },
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
  if (!state.chess) {
    state.chess = {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      history: [],
      whitePlayerId: null,
      blackPlayerId: null,
      whitePlayerName: "",
      blackPlayerName: "",
      gameStatus: "waiting",
      readyPlayers: [],
      winner: null,
      reason: null,
      remainingSeconds: 600,
      closingSeconds: 60,
    };
  }
  if (!state.chessTimers) {
    state.chessTimers = {
      timerId: null,
      closingTimerId: null,
      rollTimerId: null,
    };
  }
  return state;
}

/**
 * Trả về đối tượng trạng thái cờ vua thuần túy (primitive / plain JSON),
 * loại bỏ hoàn toàn timerId, circular references hoặc instance object
 */
function getCleanChessState(chessState) {
  if (!chessState) return null;
  return {
    fen: typeof chessState.fen === "string" ? chessState.fen : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    history: Array.isArray(chessState.history)
      ? chessState.history.map((h) => {
          if (typeof h === "string") return h;
          return {
            from: String(h?.from || ""),
            to: String(h?.to || ""),
            promotion: String(h?.promotion || "q"),
            san: String(h?.san || ""),
          };
        })
      : [],
    whitePlayerId: chessState.whitePlayerId ? String(chessState.whitePlayerId) : null,
    blackPlayerId: chessState.blackPlayerId ? String(chessState.blackPlayerId) : null,
    whitePlayerName: String(chessState.whitePlayerName || ""),
    blackPlayerName: String(chessState.blackPlayerName || ""),
    gameStatus: String(chessState.gameStatus || "waiting"),
    readyPlayers: Array.isArray(chessState.readyPlayers) ? chessState.readyPlayers.map(String) : [],
    winner: chessState.winner ? String(chessState.winner) : null,
    reason: chessState.reason ? String(chessState.reason) : null,
    remainingSeconds: typeof chessState.remainingSeconds === "number" ? chessState.remainingSeconds : 600,
    closingSeconds: typeof chessState.closingSeconds === "number" ? chessState.closingSeconds : 60,
  };
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
 * Helper: Ghi nhận thời gian học thực tế vào tài khoản người dùng, tích lũy dailyStudyMinutes và thưởng thẻ bài khi đủ 180 phút
 */
async function recordStudyTime(userId, joinTimestamp, ioInstance = null) {
  if (!userId || !joinTimestamp) return;
  const studySec = Math.round((Date.now() - joinTimestamp) / 1000);
  if (studySec >= 5) {
    try {
      const user = await User.findById(userId);
      if (user) {
        user.totalStudySeconds = (user.totalStudySeconds || 0) + studySec;
        user.lastSeen = new Date();
        user.lastStudyDate = new Date();

        const todayStr = getVietnamDateString();
        if (user.dailyStudyDate !== todayStr) {
          user.dailyStudyDate = todayStr;
          user.dailyStudyMinutes = 0;
        }

        const addedMinutes = Math.floor(studySec / 60);
        if (addedMinutes > 0) {
          user.dailyStudyMinutes = (user.dailyStudyMinutes || 0) + addedMinutes;
        }

        // Kiểm tra điều kiện thưởng 1 lượt mở thẻ: tích lũy đủ 180 phút trong ngày và chưa nhận hôm nay
        if (user.dailyStudyMinutes >= 180 && user.lastCardRewardDate !== todayStr) {
          user.cardDraws = (user.cardDraws || 0) + 1;
          user.lastCardRewardDate = todayStr;

          // Tạo thông báo hệ thống và gửi realtime
          await createAndSendNotification({
            recipientId: user._id,
            type: "CARD_REWARD",
            title: "Thẻ Bài Học Giả",
            message: "Bạn có thể nhận card! Đạt mốc 180 phút học tập hôm nay.",
            link: "/?openCardModal=true",
          });

          const { getIo } = require("../config/socketInstance");
          const activeIo = ioInstance || getIo();
          if (activeIo) {
            activeIo.to(`user:${user._id}`).emit("card:reward-available", {
              cardDraws: user.cardDraws,
              message: "Bạn có thể nhận card!",
            });
            activeIo.to(`user:${user._id}`).emit("card:updated", {
              cardDraws: user.cardDraws,
              dailyStudyMinutes: user.dailyStudyMinutes,
            });
          }
        }

        const streakUpdate = calculateStreakUpdate(user);
        if (streakUpdate.shouldUpdate) {
          user.streak = streakUpdate.streak;
          user.lastActiveDate = streakUpdate.lastActiveDate;
        }

        await user.save();
        console.log(`[Socket] Cong ${studySec}s (${addedMinutes}p) thoi gian hoc cho user [${userId}] (daily: ${user.dailyStudyMinutes}p, cardDraws: ${user.cardDraws})`);
      }
    } catch (err) {
      console.warn("[Socket] Loi cap nhat totalStudySeconds, streak & card reward:", err.message);
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

// Set bảo vệ chống gọi dọn dẹp phòng đồng thời nhiều lần (Race condition mutex)
const activeCleanups = new Set();
// Map lưu vết emit user-left để chống lặp thông báo giữa socket và REST controller
const recentUserLeftEmits = new Map();

function emitUserLeftSafely(io, roomCode, userId, socketId, name) {
  if (!io || !roomCode || !userId) return;
  const normalizedCode = String(roomCode).trim().toUpperCase();
  const uIdStr = String(userId);
  const key = `${normalizedCode}_${uIdStr}`;
  const now = Date.now();
  if (recentUserLeftEmits.has(key) && now - recentUserLeftEmits.get(key) < 5000) {
    return;
  }
  recentUserLeftEmits.set(key, now);
  setTimeout(() => recentUserLeftEmits.delete(key), 8000);

  io.to(normalizedCode).emit("room:user-left", {
    userId: uIdStr,
    socketId,
    name: name || "Thành viên",
  });
}

/**
 * Bắt đầu đếm ngược 10 phút khi phòng chỉ còn đúng 1 người duy nhất (Empty Room Timeout)
 */
function startAloneCountdown(roomCode, io) {
  if (!roomCode || !io) return;
  const code = roomCode.trim().toUpperCase();
  if (aloneRoomTimers.has(code)) return;

  const ALONE_TIMEOUT_MS = 10 * 60 * 1000; // 10 phút
  const expiresAt = Date.now() + ALONE_TIMEOUT_MS;
  console.log(`[Socket] Phòng ${code} chỉ còn 1 người duy nhất. Bắt đầu đếm ngược 10 phút.`);

  const timer = setTimeout(async () => {
    aloneRoomTimers.delete(code);
    console.log(`[Socket] Hết 10 phút một mình trong phòng ${code}. Tự động đóng phòng.`);
    io.to(code).emit("room_terminated", {
      message: "Bạn là người duy nhất trong phòng và phiên học đã tự động đóng sau 10 phút.",
      reason: "alone_timeout",
    });
    await destroyAndCleanupRoom(code, io, "Hệ thống", "Hết thời gian chờ phòng 1 người (10 phút)");
  }, ALONE_TIMEOUT_MS);

  aloneRoomTimers.set(code, { timer, expiresAt });

  io.to(code).emit("room:alone-warning", {
    message: "Bạn là người duy nhất trong phòng. Phiên học sẽ tự đóng sau 10:00",
    remainingSeconds: 600,
    expiresAt,
  });
}

/**
 * Hủy đếm ngược khi có thêm người tham gia phòng (> 1 người)
 */
function cancelAloneCountdown(roomCode, io) {
  if (!roomCode) return;
  const code = roomCode.trim().toUpperCase();
  if (aloneRoomTimers.has(code)) {
    clearTimeout(aloneRoomTimers.get(code).timer);
    aloneRoomTimers.delete(code);
    if (io) {
      io.to(code).emit("room:alone-cancelled");
    }
  }
}

/**
 * Kiểm tra và lên lịch đóng phòng sau thời lượng tối đa 24 giờ kể từ createdAt (Max Duration)
 */
function checkAndScheduleMaxDuration(roomDoc, io) {
  if (!roomDoc || !roomDoc.roomCode || !io) return;
  const code = roomDoc.roomCode.trim().toUpperCase();
  const createdAtTime = new Date(roomDoc.createdAt || Date.now()).getTime();
  const roomAgeMs = Date.now() - createdAtTime;
  const MAX_ROOM_DURATION_MS = 24 * 60 * 60 * 1000; // 24 giờ

  if (roomAgeMs >= MAX_ROOM_DURATION_MS) {
    console.log(`[Socket] Phòng ${code} đã đạt thời lượng tối đa 24 giờ. Đóng phòng ngay.`);
    io.to(code).emit("room_terminated", {
      message: "Phiên học đã đạt thời lượng tối đa 24 giờ và tự động kết thúc.",
      reason: "max_duration",
    });
    destroyAndCleanupRoom(code, io, "Hệ thống", "Đạt thời lượng tối đa 24 giờ");
    return;
  }

  if (!roomMaxDurationTimers.has(code)) {
    const timeLeftMs = MAX_ROOM_DURATION_MS - roomAgeMs;
    const timer = setTimeout(async () => {
      roomMaxDurationTimers.delete(code);
      console.log(`[Socket] Hết thời hạn tối đa 24 giờ cho phòng ${code}. Đóng phòng.`);
      io.to(code).emit("room_terminated", {
        message: "Phiên học đã đạt thời lượng tối đa 24 giờ và tự động kết thúc.",
        reason: "max_duration",
      });
      await destroyAndCleanupRoom(code, io, "Hệ thống", "Đạt thời lượng tối đa 24 giờ");
    }, timeLeftMs);

    roomMaxDurationTimers.set(code, timer);
  }
}

/**
 * Bắt đầu đếm ngược 10 phút khi Host chọn 'Chỉ rời cuộc gọi'
 */
function startHostAbsenceTimer(roomCode, io, userName = "Chủ phòng") {
  if (!roomCode) return;
  const normalizedCode = roomCode.trim().toUpperCase();
  if (hostAbsenceTimers.has(normalizedCode)) {
    clearTimeout(hostAbsenceTimers.get(normalizedCode).timer);
  }
  const hostAbsenceTimeoutMs = 10 * 60 * 1000; // 10 phút
  const timer = setTimeout(async () => {
    hostAbsenceTimers.delete(normalizedCode);
    console.log(`[Socket] Hết 10 phút host vắng mặt không quay lại phòng ${normalizedCode}. Tự động đóng phòng.`);
    if (io) {
      io.to(normalizedCode).emit("room_terminated", {
        message: "Phiên học tự động đóng do chủ phòng đã rời cuộc gọi quá 10 phút.",
        reason: "host_timeout",
      });
    }
    await destroyAndCleanupRoom(normalizedCode, io, "Hệ thống", "Chủ phòng không quay lại sau 10 phút");
  }, hostAbsenceTimeoutMs);

  hostAbsenceTimers.set(normalizedCode, { timer, startedAt: Date.now() });

  if (io) {
    io.to(normalizedCode).emit("room:host-left-temporary", {
      message: "Chủ phòng đã rời cuộc gọi. Phiên học sẽ tự đóng sau 10 phút nếu chủ phòng không quay lại.",
      timeoutMs: hostAbsenceTimeoutMs,
    });
    io.emit("dashboard:room-updated", { roomCode: normalizedCode });
    io.emit("room_list_updated", { roomCode: normalizedCode, action: "updated" });
  }
}

async function destroyAndCleanupRoom(roomCode, io, hostName = "Chủ phòng", reason = "Chủ phòng đã kết thúc phiên học") {
  if (!roomCode) return;
  const normalizedCode = roomCode.trim().toUpperCase();

  if (activeCleanups.has(normalizedCode)) {
    console.log(`[RoomCleanup] Phòng ${normalizedCode} đang được dọn dẹp bởi tiến trình khác, bỏ qua gọi trùng lặp.`);
    return;
  }
  activeCleanups.add(normalizedCode);
  setTimeout(() => activeCleanups.delete(normalizedCode), 10000);

  console.log(`[RoomCleanup] === BẮT ĐẦU QUÉT SẠCH TOÀN BỘ PHÒNG HỌC ${normalizedCode} ===`);

  // 0. Lấy thông tin phòng trước khi dọn dẹp để phục vụ tạo bản chép lời & gửi thông báo
  let roomDoc = null;
  try {
    roomDoc = await Room.findOne({ roomCode: normalizedCode });
  } catch (_) {}

  // Đánh dấu đóng phòng ngay lập tức trong DB để chặn các truy vấn mới
  try {
    await Room.updateOne(
      { roomCode: normalizedCode },
      { $set: { status: "closed", isActive: false, participants: [] } }
    );
  } catch (_) {}

  const roomName = roomDoc?.name || roomDoc?.title || `Phòng học ${normalizedCode}`;

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
    if (state?.chessTimers?.rollTimerId) {
      clearTimeout(state.chessTimers.rollTimerId);
      state.chessTimers.rollTimerId = null;
    }
    if (state?.chessTimers?.timerId) {
      clearInterval(state.chessTimers.timerId);
      state.chessTimers.timerId = null;
    }
    if (state?.chessTimers?.closingTimerId) {
      clearInterval(state.chessTimers.closingTimerId);
      state.chessTimers.closingTimerId = null;
    }
    if (state?.chess?.timerId) {
      clearInterval(state.chess.timerId);
      delete state.chess.timerId;
    }
    if (state?.chess?.closingTimerId) {
      clearInterval(state.chess.closingTimerId);
      delete state.chess.closingTimerId;
    }
    roomStates.delete(normalizedCode);
    console.log(`[RoomCleanup] Đã xóa toàn bộ tin nhắn chat và bộ đếm Pomodoro của phòng ${normalizedCode}`);
  } catch (err) {
    console.error(`[RoomCleanup] Lỗi dọn roomStates:`, err.message);
  }

  // 5. Hủy các timer ân hạn disconnect và các bộ đếm timeout vòng đời phòng
  for (const [key, timer] of disconnectGraceTimers.entries()) {
    if (key.startsWith(`${normalizedCode}_`)) {
      clearTimeout(timer);
      disconnectGraceTimers.delete(key);
    }
  }
  if (hostAbsenceTimers.has(normalizedCode)) {
    clearTimeout(hostAbsenceTimers.get(normalizedCode).timer);
    hostAbsenceTimers.delete(normalizedCode);
  }
  if (aloneRoomTimers.has(normalizedCode)) {
    clearTimeout(aloneRoomTimers.get(normalizedCode).timer);
    aloneRoomTimers.delete(normalizedCode);
  }
  if (roomMaxDurationTimers.has(normalizedCode)) {
    clearTimeout(roomMaxDurationTimers.get(normalizedCode));
    roomMaxDurationTimers.delete(normalizedCode);
  }

  // 6. Xóa vĩnh viễn bản ghi Room trong MongoDB để không bao giờ còn phòng "ma" 0 người
  try {
    await Room.deleteMany({ roomCode: normalizedCode });
    console.log(`[RoomCleanup] Đã xóa vĩnh viễn phòng ${normalizedCode} khỏi MongoDB`);
  } catch (err) {
    console.error(`[RoomCleanup] Lỗi xóa phòng khỏi DB:`, err.message);
  }

  // 7. Phát thông báo giải tán phòng cho tất cả thành viên trong phòng, phòng chờ và SẢNH CHÍNH
  if (io) {
    const finalReason = reason || "Chủ phòng đã kết thúc phiên học";
    // Chuẩn hóa sự kiện 'room_terminated' ép redirect và hiển thị thông báo
    io.to(normalizedCode).emit("room_terminated", {
      hostName,
      message: finalReason,
      reason: finalReason,
    });
    io.to(normalizedCode).emit("room:host-closed", {
      hostName,
      message: finalReason,
    });
    io.to(`waiting:${normalizedCode}`).emit("room:join-rejected", {
      roomCode: normalizedCode,
      message: "Chủ phòng đã đóng phòng học.",
    });

    // Broadcast cập nhật tức thì ra sảnh chính (Dashboard / Modal) để xóa card ngay lập tức mà không cần F5
    io.emit("dashboard:room-deleted", { roomCode: normalizedCode });
    io.emit("room_list_updated", {
      roomCode: normalizedCode,
      action: "deleted",
      status: "closed",
    });
    io.emit("room:deleted", { roomCode: normalizedCode });
    io.emit("room:closed", { roomCode: normalizedCode });
    io.emit("room:members-sync", {
      roomCode: normalizedCode,
      participants: [],
      membersCount: 0,
    });
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
 * Bắt đầu đếm ngược 60s để tự động đóng phòng cờ vua sau khi ván đấu kết thúc
 */
function startChessClosingCountdown(code, ioInstance, state) {
  if (!code || !ioInstance || !state) return;
  if (!state.chessTimers) state.chessTimers = { timerId: null, closingTimerId: null, rollTimerId: null };
  if (state.chessTimers.closingTimerId) {
    clearInterval(state.chessTimers.closingTimerId);
    state.chessTimers.closingTimerId = null;
  }
  state.chess.closingSeconds = 60;
  ioInstance.to(code).emit("chess:closing_countdown", { closingSeconds: 60 });
  ioInstance.to(code).emit("chess_closing_countdown", { closingSeconds: 60 });

  state.chessTimers.closingTimerId = setInterval(async () => {
    state.chess.closingSeconds -= 1;
    const currentSeconds = Number(state.chess.closingSeconds);
    ioInstance.to(code).emit("chess:closing_countdown", { closingSeconds: currentSeconds });
    ioInstance.to(code).emit("chess_closing_countdown", { closingSeconds: currentSeconds });

    if (state.chess.closingSeconds <= 0) {
      clearInterval(state.chessTimers.closingTimerId);
      state.chessTimers.closingTimerId = null;
      console.log(`[Chess] Hết 60s sau ván đấu cờ vua phòng ${code}. Đóng phòng tự động.`);
      await destroyAndCleanupRoom(code, ioInstance, "Hệ thống", "Ván đấu kết thúc. Phòng tự động đóng sau 60 giây.");
    }
  }, 1000);
}

/**
 * Xử lý khi một người chơi cờ vua rời phòng hoặc ngắt kết nối trong khi trận đấu đang diễn ra.
 * Người chơi còn lại sẽ được xử Thắng ngay lập tức (Xử thua do bỏ cuộc - Forfeit/Abandonment).
 */
function handleChessPlayerAbandonment(roomCode, departingUserId, ioInstance, departingUserName) {
  if (!roomCode || !departingUserId || !ioInstance) return;
  const code = roomCode.trim().toUpperCase();
  const state = roomStates.get(code);
  if (!state || !state.chess) return;

  const uIdStr = String(departingUserId);
  const isWhite = uIdStr === String(state.chess.whitePlayerId);
  const isBlack = uIdStr === String(state.chess.blackPlayerId);

  // Chỉ kích hoạt xử thua nếu trận đấu đang chơi (playing) hoặc đang bốc thăm (rolling)
  if ((isWhite || isBlack) && (state.chess.gameStatus === "playing" || state.chess.gameStatus === "rolling")) {
    console.log(`[Chess] Người chơi ${uIdStr} (${isWhite ? "Trắng" : "Đen"}) đã rời phòng trong khi ván đấu đang diễn ra -> Xử thua do bỏ cuộc`);

    if (state.chessTimers) {
      if (state.chessTimers.rollTimerId) {
        clearTimeout(state.chessTimers.rollTimerId);
        state.chessTimers.rollTimerId = null;
      }
      if (state.chessTimers.timerId) {
        clearInterval(state.chessTimers.timerId);
        state.chessTimers.timerId = null;
      }
    }

    state.chess.gameStatus = "finished";
    const winnerColor = isWhite ? "black" : "white";
    const winnerName = isWhite ? (state.chess.blackPlayerName || "Đen") : (state.chess.whitePlayerName || "Trắng");
    const leaverName = departingUserName || (isWhite ? state.chess.whitePlayerName : state.chess.blackPlayerName) || "Đối thủ";

    state.chess.winner = winnerColor;
    state.chess.reason = "abandonment";

    const cleanState = getCleanChessState(state.chess);
    const gameOverData = {
      winner: winnerColor,
      reason: "abandonment",
      message: `${leaverName} đã rời phòng. ${winnerColor === "white" ? "Trắng" : "Đen"} (${winnerName}) giành chiến thắng do đối thủ bỏ cuộc!`,
      result: {
        type: "abandonment",
        winner: winnerColor,
        winnerColor: winnerColor === "white" ? "w" : "b",
        reason: "abandonment",
        message: `${leaverName} đã rời phòng. Bạn đã thắng do đối thủ bỏ cuộc!`,
      },
      chessState: cleanState,
    };

    ioInstance.to(code).emit("chess:game_over", gameOverData);
    ioInstance.to(code).emit("chess_game_over", gameOverData);

    startChessClosingCountdown(code, ioInstance, state);
  }
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
          const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
          if (decoded && decoded.id) {
            socket.authUserId = String(decoded.id);
            socket.authUser = decoded;
          } else {
            return next(new Error("Token xác thực không hợp lệ."));
          }
        } catch (jwtErr) {
          return next(new Error("Xác thực socket thất bại: Token hết hạn hoặc chữ ký không hợp lệ."));
        }
      }
      return next();
    } catch (_) {
      return next();
    }
  });

  // Quét định kỳ kiểm tra và đóng các phòng quá thời hạn tối đa 24 giờ kể từ createdAt
  setInterval(async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredRooms = await Room.find({
        status: "active",
        createdAt: { $lt: twentyFourHoursAgo },
      }).select("roomCode title createdAt");

      for (const r of expiredRooms) {
        const code = (r.roomCode || "").toUpperCase();
        console.log(`[MaxDurationCron] Phát hiện phòng ${code} hoạt động quá 24h -> Tự động giải phóng tài nguyên.`);
        io.to(code).emit("room_terminated", {
          message: "Phiên học đã đạt thời lượng tối đa 24 giờ và tự động kết thúc.",
          reason: "max_duration",
        });
        await destroyAndCleanupRoom(code, io, "Hệ thống", "Đạt thời lượng tối đa 24 giờ");
      }
    } catch (cronErr) {
      console.warn("[MaxDurationCron] Lỗi quét phòng 24h:", cronErr.message);
    }
  }, 10 * 60 * 1000);

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
          const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
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
     * Sự kiện: accept_friend_request
     * Client emit { senderId, receiverId } hoặc { fromUserId }
     */
    socket.on("accept_friend_request", async (data, callback) => {
      try {
        const fromUserId = data?.senderId || data?.fromUserId;
        const currentUserId = String(
          socket.authUserId || socket.userId || data?.receiverId || ""
        );
        if (!fromUserId || !currentUserId) {
          if (typeof callback === "function") callback({ success: false, message: "Thiếu ID người dùng" });
          return;
        }

        const currentUser = await User.findById(currentUserId);
        const fromUser = await User.findById(fromUserId);
        if (!currentUser || !fromUser) {
          if (typeof callback === "function") callback({ success: false, message: "Không tìm thấy người dùng" });
          return;
        }

        if (currentUser.friends && currentUser.friends.some((f) => String(f) === String(fromUserId))) {
          if (typeof callback === "function") callback({ success: true, alreadyFriends: true });
          return;
        }

        currentUser.friendRequests = (currentUser.friendRequests || []).filter(
          (r) => String(r.from) !== String(fromUserId)
        );
        if (!currentUser.friends.includes(fromUserId)) {
          currentUser.friends.push(fromUserId);
        }
        await currentUser.save();

        if (!fromUser.friends.includes(currentUserId)) {
          fromUser.friends.push(currentUserId);
          await fromUser.save();
        }

        let notifDoc = null;
        try {
          notifDoc = await Notification.create({
            recipient: fromUserId,
            sender: currentUserId,
            type: "FRIEND_ACCEPTED",
            title: "Lời mời kết bạn được chấp nhận",
            message: `${currentUser.name || "Một học viên"} đã chấp nhận lời mời kết bạn của bạn!`,
          });
        } catch (_) {}

        const friendDataForA = {
          _id: currentUser._id,
          id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
          isOnline: currentUser.isOnline,
          lastSeen: currentUser.lastSeen,
        };

        const notifId = notifDoc?._id ? String(notifDoc._id) : `facc_${currentUser._id}_${Date.now()}`;
        const acceptNotifForA = {
          _id: notifId,
          id: notifId,
          dedupKey: `FRIEND_ACCEPTED_${currentUser._id}`,
          type: "FRIEND_ACCEPTED",
          senderId: String(currentUser._id),
          senderName: currentUser.name || "Một học viên",
          senderAvatar: currentUser.avatar || "",
          title: "Lời mời kết bạn được chấp nhận",
          message: `${currentUser.name || "Một học viên"} đã chấp nhận lời mời kết bạn của bạn!`,
          createdAt: new Date().toISOString(),
        };

        // 1. Cập nhật danh sách bạn bè cho User A
        io.to(`user:${fromUserId}`).emit("friend:accepted", {
          friend: friendDataForA,
          friendId: currentUser._id,
        });

        // 2. Gửi thông báo cho User A (1 lần duy nhất)
        io.to(`user:${fromUserId}`).emit("notification:new", acceptNotifForA);

        // 3. Cập nhật trạng thái bạn bè cho User B (chỉ status, không gửi notification toast cho người vừa bấm)
        io.to(`user:${currentUserId}`).emit("friend_status_updated", {
          friendId: fromUser._id,
          isFriend: true,
        });

        try {
          await Notification.create({
            recipient: fromUserId,
            sender: currentUserId,
            type: "FRIEND_ACCEPTED",
            title: "Lời mời kết bạn được chấp nhận",
            message: `${currentUser.name || "Một học viên"} đã chấp nhận lời mời kết bạn của bạn!`,
          });
        } catch (_) {}

        if (typeof callback === "function") callback({ success: true });
      } catch (err) {
        console.error("[Socket] Lỗi accept_friend_request:", err.message);
        if (typeof callback === "function") callback({ success: false, message: err.message });
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
     * Sự kiện: react_message / message:react
     * Client thả hoặc đổi/hủy cảm xúc trên tin nhắn
     */
    socket.on("react_message", async (data, callback) => {
      try {
        const { messageId, conversationId, emoji } = data || {};
        const userId = String(socket.authUserId || socket.userId || data?.userId || "");
        if (!messageId || !emoji || !userId) {
          if (typeof callback === "function") callback({ success: false, message: "Thiếu dữ liệu reaction" });
          return;
        }

        const Message = require("../models/Message");
        const Conversation = require("../models/Conversation");
        const msg = await Message.findById(messageId);
        if (!msg) {
          if (typeof callback === "function") callback({ success: false, message: "Không tìm thấy tin nhắn" });
          return;
        }

        if (!Array.isArray(msg.reactions)) msg.reactions = [];
        const existingIdx = msg.reactions.findIndex((r) => String(r.userId) === userId);

        let userEmoji = null;
        if (existingIdx > -1) {
          if (msg.reactions[existingIdx].emoji === emoji) {
            msg.reactions.splice(existingIdx, 1);
            userEmoji = null;
          } else {
            msg.reactions[existingIdx].emoji = emoji;
            msg.reactions[existingIdx].createdAt = new Date();
            userEmoji = emoji;
          }
        } else {
          msg.reactions.push({ userId, emoji, createdAt: new Date() });
          userEmoji = emoji;
        }

        await msg.save();
        const populated = await Message.findById(msg._id)
          .populate("sender", "_id name email avatar")
          .populate("reactions.userId", "_id name avatar");

        const targetConvId = conversationId || String(msg.conversationId);
        const reactionPayload = {
          messageId: String(msg._id),
          conversationId: targetConvId,
          reactions: populated.reactions || [],
          userId,
          emoji: userEmoji,
        };

        io.to(`conversation:${targetConvId}`).emit("message_reaction_updated", reactionPayload);
        io.to(`conversation:${targetConvId}`).emit("chat:message-reaction-updated", reactionPayload);

        const conv = await Conversation.findById(targetConvId).select("participants");
        if (conv?.participants) {
          conv.participants.forEach((pId) => {
            io.to(`user:${pId}`).emit("message_reaction_updated", reactionPayload);
            io.to(`user:${pId}`).emit("chat:message-reaction-updated", reactionPayload);
          });
        }

        if (typeof callback === "function") callback({ success: true, data: reactionPayload });
      } catch (err) {
        console.error("[Socket] Lỗi react_message:", err.message);
        if (typeof callback === "function") callback({ success: false, message: err.message });
      }
    });

    socket.on("message:react", (data, cb) => {
      socket.listeners("react_message")?.[0]?.(data, cb);
    });

    /**
     * Sự kiện: send_message / chat:send-message
     * Cho phép gửi tin nhắn / tin nhắn thoại trực tiếp qua Socket
     */
    socket.on("send_message", async (data, callback) => {
      try {
        const { conversationId, type, audioUrl, duration, text, content, senderId, receiverId } = data || {};
        const userId = String(socket.authUserId || socket.userId || senderId || "");
        if (!conversationId && !receiverId) {
          if (typeof callback === "function") callback({ success: false, message: "Thiếu conversationId hoặc receiverId" });
          return;
        }

        const Message = require("../models/Message");
        const Conversation = require("../models/Conversation");
        let convId = conversationId;
        if (!convId && receiverId && userId) {
          let conv = await Conversation.findOne({
            isGroup: false,
            participants: { $all: [userId, receiverId], $size: 2 },
          });
          if (!conv) {
            conv = await Conversation.create({
              isGroup: false,
              participants: [userId, receiverId],
            });
          }
          convId = String(conv._id);
        }

        const msgType = type === "audio" || audioUrl ? "audio" : "text";
        const messageText = typeof (content || text) === "string" ? (content || text).trim() : "";
        const finalAudioUrl = typeof audioUrl === "string" ? audioUrl.trim() : "";

        const newMsg = await Message.create({
          conversationId: convId,
          sender: userId,
          type: msgType,
          text: messageText,
          audioUrl: finalAudioUrl,
          duration: Number(duration) || 0,
        });

        const conv = await Conversation.findById(convId);
        if (conv) {
          conv.lastMessage = {
            text: msgType === "audio" ? "🎤 [Tin nhắn thoại]" : messageText,
            sender: userId,
            createdAt: newMsg.createdAt,
          };
          await conv.save();
        }

        const populatedMsg = await Message.findById(newMsg._id)
          .populate("sender", "_id name email avatar")
          .populate("reactions.userId", "_id name avatar");

        io.to(`conversation:${convId}`).emit("chat:message", populatedMsg);
        if (msgType === "audio") {
          io.to(`conversation:${convId}`).emit("new_voice_message", populatedMsg);
        }

        if (conv?.participants) {
          conv.participants.forEach((pId) => {
            io.to(`user:${pId}`).emit("chat:conversation-updated", {
              conversationId: convId,
              lastMessage: conv.lastMessage,
              message: populatedMsg,
            });
            if (msgType === "audio") {
              io.to(`user:${pId}`).emit("new_voice_message", populatedMsg);
            }
          });
        }

        if (typeof callback === "function") callback({ success: true, data: populatedMsg });
      } catch (err) {
        console.error("[Socket] Lỗi send_message:", err.message);
        if (typeof callback === "function") callback({ success: false, message: err.message });
      }
    });

    /**
     * Sự kiện: join-room
     */
    socket.on("join-room", async (arg1, arg2, callback) => {
      try {
        let roomCode = "";
        let cb = typeof callback === "function" ? callback : null;

        if (typeof arg1 === "object" && arg1 !== null && arg1.roomCode) {
          roomCode = arg1.roomCode;
          if (typeof arg2 === "function") cb = arg2;
        } else {
          roomCode = arg1;
        }

        if (!roomCode) {
          if (typeof cb === "function") {
            cb({ success: false, message: "Thieu roomCode" });
          }
          return;
        }

        // BẢO MẬT: Bắt buộc lấy thông tin định danh từ token đã xác thực ở handshake hoặc token gửi kèm (chống mạo danh danh tính)
        let effectiveUserId =
          socket.authUserId ||
          socket.authUser?.id ||
          socket.authUser?._id ||
          socket.user?._id ||
          socket.user?.id;

        const passedToken =
          (typeof arg1 === "object" && arg1?.token) ||
          socket.handshake.auth?.token ||
          socket.handshake.query?.token;

        if (!effectiveUserId && passedToken) {
          try {
            const decoded = jwt.verify(passedToken, process.env.JWT_SECRET, { algorithms: ["HS256"] });
            if (decoded?.id || decoded?._id) {
              effectiveUserId = String(decoded.id || decoded._id);
              socket.authUserId = effectiveUserId;
              socket.authUser = decoded;
            }
          } catch (_) {}
        }

        if (!effectiveUserId) {
          console.warn(`[Socket Security] Từ chối join-room ẩn danh không xác thực! Socket ID: ${socket.id}, Room: ${roomCode}`);
          socket.emit("error", "Unauthorized");
          if (typeof cb === "function") {
            cb({ success: false, message: "Unauthorized: Vui lòng đăng nhập để tham gia phòng học.", code: "UNAUTHORIZED" });
          }
          return;
        }

        // Lấy thông tin người dùng thực sự từ Database (TUYỆT ĐỐI không tin cậy payload `user` từ client)
        const verifiedUserDoc = await User.findById(effectiveUserId).select(
          "name email avatar role status isBanned isPro equippedTitle title"
        );

        if (!verifiedUserDoc || verifiedUserDoc.status === "BLOCKED" || verifiedUserDoc.isBanned) {
          socket.emit("error", "Unauthorized");
          if (typeof cb === "function") {
            cb({ success: false, message: "Tài khoản không hợp lệ hoặc đã bị khóa.", code: "ACCOUNT_BANNED" });
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

        const userId = String(verifiedUserDoc._id);
        const uIdStr = String(verifiedUserDoc._id);

        // Kiểm tra độc quyền phiên phòng học (Single Active Room Session / Switch Device như Google Meet)
        const existingSession = activeRoomSessions.get(uIdStr);
        if (existingSession && existingSession.socketId !== socket.id) {
          const oldSocket = io.sockets.sockets.get(existingSession.socketId);
          if (oldSocket && oldSocket.connected) {
            console.log(
              `[Socket Session] Xung đột phiên thiết bị cho user ${uIdStr}. Socket cũ: ${existingSession.socketId} (phòng ${existingSession.roomCode}), Socket mới: ${socket.id}`
            );
            socket.emit("room:device-conflict", {
              currentRoomId: existingSession.roomId,
              currentRoomCode: existingSession.roomCode,
              targetRoomCode: normalizedCode,
            });
            if (typeof cb === "function") {
              cb({
                success: false,
                deviceConflict: true,
                code: "DEVICE_CONFLICT",
                message:
                  "Tài khoản của bạn hiện đang tham gia một phòng học trên thiết bị khác.",
                currentRoomId: existingSession.roomId,
                currentRoomCode: existingSession.roomCode,
                targetRoomCode: normalizedCode,
              });
            }
            return;
          } else {
            // Socket cũ không còn kết nối, giải phóng phiên cũ
            activeRoomSessions.delete(uIdStr);
          }
        }

        if (
          checkRoom.bannedUsers &&
          checkRoom.bannedUsers.some((id) => String(id) === uIdStr)
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

        // Logic khóa tham gia phòng khác: Trong 10 phút chờ, Host bị chặn không được tham gia bất kỳ phòng khác
        if (uIdStr && !isHostUser) {
          const pendingHostRoom = await Room.findOne({
            hostId: uIdStr,
            status: "active",
            isActive: true,
            hostLeftAt: { $ne: null },
            roomCode: { $ne: normalizedCode },
          });

          if (pendingHostRoom && pendingHostRoom.hostLeftAt) {
            const elapsed = Date.now() - new Date(pendingHostRoom.hostLeftAt).getTime();
            if (elapsed < 10 * 60 * 1000) {
              if (typeof cb === "function") {
                return cb({
                  success: false,
                  hasPendingHostRoom: true,
                  pendingRoomCode: pendingHostRoom.roomCode,
                  message:
                    "Bạn đang có một phòng học đang chờ. Hãy quay lại phòng của bạn để tiếp tục hoặc bấm kết thúc phiên học.",
                });
              }
              return;
            }
          }
        }

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

        // Lưu thông tin vào socket instance (Được bảo vệ 100%: Dùng định danh đã verify từ Database, KHÔNG nhận từ client)
        socket.roomCode = normalizedCode;
        socket.userData = {
          id: uIdStr,
          _id: uIdStr,
          name: verifiedUserDoc.name,
          email: verifiedUserDoc.email,
          avatar: verifiedUserDoc.avatar,
          role: verifiedUserDoc.role || "USER",
          status: verifiedUserDoc.status || "ACTIVE",
          isPro: Boolean(verifiedUserDoc.isPro),
          equippedTitle: verifiedUserDoc.equippedTitle || verifiedUserDoc.title || "Học viên",
          title: verifiedUserDoc.title || "Học viên",
          isTitleVisible:
            typeof arg1 === "object" && arg1?.user?.isTitleVisible !== undefined
              ? Boolean(arg1.user.isTitleVisible)
              : true,
        };
        socket.userId = uIdStr;
        socket.joinTimestamp = Date.now();
        socket.lastHeartbeatTime = Date.now();

        // Lấy trạng thái phòng & cập nhật trạng thái hiển thị danh hiệu nếu có
        const roomState = getOrCreateRoomState(normalizedCode);
        if (uIdStr) {
          roomState.sessionParticipantIds.add(uIdStr);
        }

        // Nếu là Host, gửi danh sách người đang chờ duyệt (nếu có)
        const roomHostStr = String(checkRoom.hostId?._id || checkRoom.hostId || checkRoom.host?._id || checkRoom.host || "");
        const isHost = Boolean(roomHostStr && (roomHostStr === uIdStr || (socket.authUserId && roomHostStr === String(socket.authUserId))));
        if (isHost && roomState.pendingRequests) {
          socket.emit("room:pending-updated", {
            roomCode: normalizedCode,
            pendingList: Array.from(roomState.pendingRequests.values()),
          });
        }
        if (uIdStr && socket.userData.isTitleVisible !== undefined) {
          roomState.titleVisibility.set(uIdStr, Boolean(socket.userData.isTitleVisible));
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

        // Nếu người vừa tham gia là Host và phòng đang chạy timer 10 phút vắng mặt -> Hủy timer
        if (isHost && (hostAbsenceTimers.has(normalizedCode) || checkRoom.hostLeftAt)) {
          console.log(`[Socket] Host [${user?.name || uIdStr}] đã quay trở lại phòng ${normalizedCode} -> Hủy bộ đếm timeout vắng mặt.`);
          if (hostAbsenceTimers.has(normalizedCode)) {
            clearTimeout(hostAbsenceTimers.get(normalizedCode).timer);
            hostAbsenceTimers.delete(normalizedCode);
          }
          await Room.updateOne({ roomCode: normalizedCode }, { $set: { hostLeftAt: null } });
          io.to(normalizedCode).emit("room:host-returned", {
            message: "Chủ phòng đã quay trở lại cuộc gọi.",
          });
          io.emit("dashboard:room-updated", { roomCode: normalizedCode });
          io.emit("room_list_updated", { roomCode: normalizedCode, action: "updated" });
        }

        // Lên lịch kết thúc phiên học sau 24 giờ tối đa
        checkAndScheduleMaxDuration(checkRoom, io);

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

        // Nếu phòng có nhiều hơn 1 người -> Hủy bỏ timer đếm ngược phòng 1 người
        if (currentRoom && currentRoom.participants && currentRoom.participants.length > 1) {
          cancelAloneCountdown(normalizedCode, io);
        }

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

        // Đồng bộ trạng thái có ai trong phòng đang bật chép lời hay không
        const hasActiveTranscription = (roomState.transcriptionListeners?.size || 0) > 0;
        socket.emit("room:transcription-status-changed", {
          hasActiveListener: hasActiveTranscription,
        });

        // Cập nhật phiên độc quyền hoạt động của user trên socket này
        activeRoomSessions.set(uIdStr, {
          socketId: socket.id,
          roomId: checkRoom._id ? String(checkRoom._id) : normalizedCode,
          roomCode: normalizedCode,
          userAgent: socket.handshake?.headers?.["user-agent"] || "",
        });

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
        const callerId = String(socket.authUserId || socket.userData?.id || socket.userData?._id || socket.userId || "");
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
      const uId = String(socket.authUserId || socket.userData?.id || socket.userData?._id || socket.userId || "");
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
      const uId = String(socket.authUserId || socket.userData?.id || socket.userData?._id || socket.userId || socket.id || "");
      const userName = socket.userData?.name || "Thành viên";
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

      // Broadcast reaction cho mọi người trong phòng TRỪ người gửi
      // (client người gửi đã tự triggerReaction "Bạn" tức thì ở frontend)
      socket.to(roomCode).emit("room:receive-reaction", {
        emoji,
        senderName,
        reactionId: `rx_${now}_${Math.random().toString(36).slice(2, 7)}`,
        senderSocketId: socket.id,
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

          if (!currentUserId || String(message.sender) !== String(currentUserId)) {
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
        const senderUserId = String(
          msg.sender?.id || msg.sender?._id || msg.poll?.createdBy?.id || ""
        );

        // Kiểm tra xem người yêu cầu có phải là Chủ phòng (Host) không
        let isHost = false;
        try {
          const roomDoc = await Room.findOne({ roomCode });
          if (roomDoc && currentUserId) {
            isHost = String(roomDoc.hostId) === currentUserId;
          }
        } catch (_) {}

        if (!isHost && socket.userData?.role === "ADMIN") {
          isHost = true;
        }

        // Chỉ chính chủ người gửi hoặc Chủ phòng mới có quyền thu hồi
        if (!currentUserId || (currentUserId !== senderUserId && !isHost)) {
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
        const pollId = msg.poll?.id || (msg.type === "poll" ? msg.id : null);

        msg.isRecalled = true;
        msg.recalledAt = recalledAt;
        msg.recalledBy = recalledByName;
        msg.text = msg.type === "poll" || msg.poll ? "Bình chọn này đã được thu hồi" : "";
        msg.file = null;
        msg.fileUrl = null;
        msg.fileName = null;

        if (msg.poll) {
          msg.poll.isRecalled = true;
          msg.poll.recalledAt = recalledAt;
          msg.poll.recalledBy = recalledByName;
          msg.poll.options = [];
          msg.poll.totalVotes = 0;
        }

        if (pollId && roomState.polls?.has(pollId)) {
          const p = roomState.polls.get(pollId);
          if (p) {
            p.isRecalled = true;
            p.recalledAt = recalledAt;
            p.recalledBy = recalledByName;
            p.options = [];
            p.totalVotes = 0;
          }
        }

        // 3. Broadcast sự kiện thu hồi realtime tới tất cả mọi người trong phòng
        const recallPayload = {
          roomCode,
          messageId: msg.id,
          pollId: pollId || undefined,
          recalledBy: recalledByName,
          recalledAt,
          fileUrl: recalledFileUrl,
          isPoll: Boolean(pollId),
        };

        io.to(roomCode).emit("chat:message-recalled", recallPayload);
        io.to(roomCode).emit("message_recalled", recallPayload);
        if (pollId) {
          io.to(roomCode).emit("poll_recalled", {
            pollId,
            messageId: msg.id,
            recalledBy: recalledByName,
            recalledAt,
          });
          io.to(roomCode).emit("poll:recalled", {
            pollId,
            messageId: msg.id,
            recalledBy: recalledByName,
            recalledAt,
          });
          io.to(roomCode).emit("poll:vote-updated", {
            pollId,
            isRecalled: true,
            options: [],
            totalVotes: 0,
            poll: msg.poll,
          });
          io.to(roomCode).emit("poll_updated", {
            pollId,
            isRecalled: true,
            options: [],
            totalVotes: 0,
            poll: msg.poll,
          });
        }

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
     * Nhận đoạn chép lời từ client và broadcast tới tất cả thành viên trong phòng (cho người bật chép lời)
     */
    socket.on("room:transcript-segment", ({ roomCode, text, speakerName, userId, id }) => {
      try {
        if (!roomCode || !text || !text.trim()) return;
        const normalizedCode = (roomCode || "").trim().toUpperCase();
        const targetUserId = String(
          userId || socket.userId || socket.userData?.id || socket.userData?._id || ""
        );
        const resolvedSpeakerName = speakerName || socket.userData?.name || "Thành viên";

        const state = getOrCreateRoomState(normalizedCode);
        if (!state.userTranscripts.has(targetUserId)) {
          state.userTranscripts.set(targetUserId, []);
        }

        const timeStr = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const segment = {
          id: id || `ts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          roomCode: normalizedCode,
          text: text.trim(),
          speakerName: resolvedSpeakerName,
          speakerId: targetUserId,
          userId: targetUserId,
          time: timeStr,
          createdAt: new Date(),
        };

        state.userTranscripts.get(targetUserId).push(segment);

        // Broadcast đoạn chép lời cho toàn bộ phòng để người bật chép lời nhận được (cả bản thân lẫn người khác nói)
        io.to(normalizedCode).emit("room:receive-transcript", segment);
      } catch (err) {
        console.warn("[Socket] Lỗi nhận room:transcript-segment:", err.message);
      }
    });

    /**
     * Sự kiện: room:transcript-interim
     * Broadcast đoạn thoại đang nói dở (interim text) để hiển thị nhấp nháy thời gian thực
     */
    socket.on("room:transcript-interim", ({ roomCode, text, speakerName, userId }) => {
      try {
        if (!roomCode) return;
        const normalizedCode = (roomCode || "").trim().toUpperCase();
        const targetUserId = String(
          userId || socket.userId || socket.userData?.id || socket.userData?._id || ""
        );
        const resolvedSpeakerName = speakerName || socket.userData?.name || "Thành viên";

        socket.to(normalizedCode).emit("room:receive-transcript-interim", {
          roomCode: normalizedCode,
          speakerId: targetUserId,
          userId: targetUserId,
          speakerName: resolvedSpeakerName,
          text: (text || "").trim(),
        });
      } catch (_) {}
    });

    /**
     * Sự kiện: room:speech-audio-chunk
     * Nhận đoạn âm thanh từ client và chép lời bằng Google Gemini Flash Multimodal AI
     */
    socket.on("room:speech-audio-chunk", async ({ roomCode, audioBase64, mimeType, speakerName, userId, id }) => {
      try {
        if (!roomCode || !audioBase64) return;
        const normalizedCode = (roomCode || "").trim().toUpperCase();
        const targetUserId = String(
          userId || socket.userId || socket.userData?.id || socket.userData?._id || ""
        );
        const resolvedSpeakerName = speakerName || socket.userData?.name || "Thành viên";

        const text = await transcribeAudioWithGemini({
          audioBase64,
          mimeType: mimeType || "audio/webm",
          roomSubject: normalizedCode,
        });

        if (text && text.trim() && !text.includes("[EMPTY]")) {
          const timeStr = new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          });

          const segment = {
            id: id || `gm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            roomCode: normalizedCode,
            text: text.trim(),
            speakerName: resolvedSpeakerName,
            speakerId: targetUserId,
            userId: targetUserId,
            time: timeStr,
            aiPowered: true,
            createdAt: new Date(),
          };

          const state = getOrCreateRoomState(normalizedCode);
          if (!state.userTranscripts.has(targetUserId)) {
            state.userTranscripts.set(targetUserId, []);
          }
          state.userTranscripts.get(targetUserId).push(segment);

          // Broadcast đoạn chép lời chuẩn xác từ Gemini cho toàn bộ phòng
          io.to(normalizedCode).emit("room:receive-transcript", segment);
        }
      } catch (err) {
        console.warn("[Socket] Lỗi xử lý room:speech-audio-chunk với Gemini:", err.message);
      }
    });

    /**
     * Sự kiện: room:transcription-toggle
     * Bật/tắt trạng thái có người đang theo dõi chép lời trong phòng
     */
    socket.on("room:transcription-toggle", ({ roomCode, isEnabled }) => {
      try {
        const normalizedCode = (roomCode || "").trim().toUpperCase();
        if (!normalizedCode) return;
        const state = getOrCreateRoomState(normalizedCode);
        if (!state.transcriptionListeners) {
          state.transcriptionListeners = new Set();
        }
        if (isEnabled) {
          state.transcriptionListeners.add(socket.id);
        } else {
          state.transcriptionListeners.delete(socket.id);
        }
        const hasActiveListener = state.transcriptionListeners.size > 0;
        io.to(normalizedCode).emit("room:transcription-status-changed", {
          hasActiveListener,
        });
      } catch (err) {
        console.warn("[Socket] Lỗi room:transcription-toggle:", err.message);
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
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
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
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
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
        const uId = String(socket.authUserId || socket.userData?.id || socket.userData?._id || socket.userId || "");
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
     * Sự kiện: chat:create-poll / create_poll
     * Tạo bình chọn nhanh trong chat (phong cách Zalo)
     * payload: { roomCode, question, options: [string], allowMultiple, allowAddOptions }
     */
    const handleCreatePoll = async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const question = (data?.question || "").trim();
        const rawOptions = Array.isArray(data?.options) ? data.options : [];
        const allowMultiple = Boolean(data?.allowMultiple);
        const allowAddOptions = Boolean(data?.allowAddOptions);

        if (!roomCode || !question) {
          return cb({ success: false, message: "Vui lòng nhập câu hỏi bình chọn." });
        }

        const validOptions = rawOptions
          .map((opt) => String(opt).trim())
          .filter(Boolean);

        if (validOptions.length < 2 || validOptions.length > 10) {
          return cb({ success: false, message: "Bình chọn cần từ 2 đến 10 lựa chọn." });
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
            votes: [], // Danh sách { userId, name, avatar }
          })),
          allowMultiple,
          allowAddOptions,
          isClosed: false,
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
        io.to(roomCode).emit("new_poll_created", { roomCode, poll, message: pollMsg });

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

        cb({ success: true, poll, message: pollMsg });
      } catch (err) {
        console.error("[Socket] Lỗi chat:create-poll:", err.message);
        cb({ success: false, message: err.message });
      }
    };

    socket.on("chat:create-poll", handleCreatePoll);
    socket.on("create_poll", handleCreatePoll);

    /**
     * Sự kiện: poll:vote / submit_vote
     * Thành viên biểu quyết vào một lựa chọn
     * payload: { roomCode, pollId, optionIndex, userId, userName, userAvatar }
     */
    const handlePollVote = async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const pollId = data?.pollId;
        const optionIndex = Number(data?.optionIndex);
        const voterUserId = String(
          socket.authUserId || socket.userData?.id || socket.userData?._id || socket.userId || socket.id || ""
        );
        const voterName = socket.userData?.name || data?.userName || "Thành viên";
        const voterAvatar = socket.userData?.avatar || data?.userAvatar || "";
        const voterProfile = { userId: voterUserId, name: voterName, avatar: voterAvatar };

        if (!roomCode || !pollId || isNaN(optionIndex) || !voterUserId) {
          return cb({ success: false, message: "Thiếu dữ liệu bình chọn." });
        }

        const roomState = getOrCreateRoomState(roomCode);
        const poll = roomState.polls.get(pollId);
        if (!poll) {
          return cb({ success: false, message: "Không tìm thấy cuộc bình chọn." });
        }

        if (poll.isClosed) {
          return cb({ success: false, message: "Bình chọn này đã kết thúc." });
        }

        if (optionIndex < 0 || optionIndex >= poll.options.length) {
          return cb({ success: false, message: "Lựa chọn không hợp lệ." });
        }

        const helperGetId = (v) => (typeof v === "object" && v !== null ? String(v.userId || v.id) : String(v));

        const targetOption = poll.options[optionIndex];
        const alreadyVotedTarget = targetOption.votes.some((v) => helperGetId(v) === voterUserId);

        if (poll.allowMultiple) {
          // Chế độ Chọn nhiều đáp án: toggle vote trên option được chọn
          if (alreadyVotedTarget) {
            targetOption.votes = targetOption.votes.filter((v) => helperGetId(v) !== voterUserId);
          } else {
            targetOption.votes.push(voterProfile);
          }
        } else {
          // Chế độ Chọn 1 đáp án: xóa vote ở các option khác
          poll.options.forEach((opt, idx) => {
            if (idx !== optionIndex) {
              opt.votes = opt.votes.filter((v) => helperGetId(v) !== voterUserId);
            }
          });

          // Toggle lại option này nếu người dùng bấm bỏ chọn
          if (alreadyVotedTarget) {
            targetOption.votes = targetOption.votes.filter((v) => helperGetId(v) !== voterUserId);
          } else {
            targetOption.votes.push(voterProfile);
          }
        }

        // Tính lại tổng số lượt vote
        poll.totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes.length, 0);

        // Đồng bộ vào tin nhắn tương ứng trong roomState.messages nếu có
        const msgIndex = roomState.messages.findIndex((m) => m.id === pollId || m.poll?.id === pollId);
        if (msgIndex !== -1) {
          roomState.messages[msgIndex].poll = { ...poll };
        }

        // Broadcast cập nhật số liệu realtime cho cả phòng
        const updatePayload = {
          pollId,
          options: poll.options,
          totalVotes: poll.totalVotes,
          isClosed: poll.isClosed,
          poll,
        };
        io.to(roomCode).emit("poll:vote-updated", updatePayload);
        io.to(roomCode).emit("poll_updated", updatePayload);

        cb({ success: true, poll });
      } catch (err) {
        console.error("[Socket] Lỗi poll:vote:", err.message);
        cb({ success: false, message: err.message });
      }
    };

    socket.on("poll:vote", handlePollVote);
    socket.on("submit_vote", handlePollVote);

    /**
     * Sự kiện: poll:lock / lock_poll
     * Khóa bình chọn (Dành cho Chủ phòng hoặc Người tạo poll)
     * payload: { roomCode, pollId }
     */
    const handleLockPoll = async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const pollId = data?.pollId;
        const currentUid = String(socket.userData?.id || socket.userData?._id || socket.userId || socket.id || "");

        if (!roomCode || !pollId) {
          return cb({ success: false, message: "Thiếu dữ liệu yêu cầu." });
        }

        const roomState = getOrCreateRoomState(roomCode);
        const poll = roomState.polls.get(pollId);
        if (!poll) {
          return cb({ success: false, message: "Không tìm thấy cuộc bình chọn." });
        }

        let isAuthorized = false;
        if (poll.createdBy?.id === currentUid) {
          isAuthorized = true;
        } else {
          try {
            const roomDoc = await Room.findOne({ roomCode });
            if (roomDoc && String(roomDoc.hostId) === currentUid) {
              isAuthorized = true;
            }
          } catch (e) {}
        }

        if (!isAuthorized && socket.userData?.role !== "ADMIN") {
          return cb({ success: false, message: "Bạn không có quyền khóa bình chọn này." });
        }

        poll.isClosed = true;

        // Cập nhật messages
        const msgIndex = roomState.messages.findIndex((m) => m.id === pollId || m.poll?.id === pollId);
        if (msgIndex !== -1) {
          roomState.messages[msgIndex].poll = { ...poll };
        }

        const updatePayload = {
          pollId,
          isClosed: true,
          options: poll.options,
          totalVotes: poll.totalVotes,
          poll,
        };
        io.to(roomCode).emit("poll:locked", updatePayload);
        io.to(roomCode).emit("poll:vote-updated", updatePayload);
        io.to(roomCode).emit("poll_updated", updatePayload);

        cb({ success: true, poll });
      } catch (err) {
        console.error("[Socket] Lỗi poll:lock:", err.message);
        cb({ success: false, message: err.message });
      }
    };

    socket.on("poll:lock", handleLockPoll);
    socket.on("lock_poll", handleLockPoll);

    /**
     * Sự kiện: poll:add-option / add_poll_option
     * Thêm phương án mới cho bình chọn
     * payload: { roomCode, pollId, optionText }
     */
    const handleAddPollOption = async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const pollId = data?.pollId;
        const optionText = String(data?.optionText || "").trim();

        if (!roomCode || !pollId || !optionText) {
          return cb({ success: false, message: "Vui lòng nhập phương án mới." });
        }

        const roomState = getOrCreateRoomState(roomCode);
        const poll = roomState.polls.get(pollId);
        if (!poll) {
          return cb({ success: false, message: "Không tìm thấy cuộc bình chọn." });
        }

        if (poll.isClosed) {
          return cb({ success: false, message: "Cuộc bình chọn này đã kết thúc." });
        }

        if (!poll.allowAddOptions) {
          return cb({ success: false, message: "Bình chọn này không cho phép thêm phương án mới." });
        }

        if (poll.options.length >= 10) {
          return cb({ success: false, message: "Bình chọn đã đạt giới hạn tối đa 10 phương án." });
        }

        if (poll.options.some((o) => o.text.trim().toLowerCase() === optionText.toLowerCase())) {
          return cb({ success: false, message: "Phương án này đã tồn tại." });
        }

        const newOption = {
          id: poll.options.length,
          text: optionText.slice(0, 100),
          votes: [],
        };

        poll.options.push(newOption);

        // Cập nhật messages
        const msgIndex = roomState.messages.findIndex((m) => m.id === pollId || m.poll?.id === pollId);
        if (msgIndex !== -1) {
          roomState.messages[msgIndex].poll = { ...poll };
        }

        const updatePayload = {
          pollId,
          options: poll.options,
          totalVotes: poll.totalVotes,
          isClosed: poll.isClosed,
          poll,
        };
        io.to(roomCode).emit("poll:vote-updated", updatePayload);
        io.to(roomCode).emit("poll_updated", updatePayload);

        cb({ success: true, poll, newOption });
      } catch (err) {
        console.error("[Socket] Lỗi poll:add-option:", err.message);
        cb({ success: false, message: err.message });
      }
    };

    socket.on("poll:add-option", handleAddPollOption);
    socket.on("add_poll_option", handleAddPollOption);

    /**
     * Sự kiện: poll:recall / chat:recall-poll / recall_poll
     * Thu hồi cuộc bình chọn trong phòng học realtime
     * payload: { roomCode, messageId, pollId }
     */
    const handleRecallPoll = async (data, callback) => {
      const cb = typeof callback === "function" ? callback : () => {};
      try {
        const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        const pollId = data?.pollId || data?.id;
        const messageId = data?.messageId;

        if (!roomCode || (!pollId && !messageId)) {
          return cb({ success: false, message: "Thiếu thông tin cuộc bình chọn cần thu hồi." });
        }

        const roomState = getOrCreateRoomState(roomCode);
        let poll = pollId ? roomState.polls.get(pollId) : null;
        let msg = roomState.messages.find(
          (m) =>
            (messageId && m.id === messageId) ||
            (pollId && (m.id === pollId || m.poll?.id === pollId))
        );

        if (!poll && msg?.poll) {
          poll = msg.poll;
        }

        if (!poll && !msg) {
          return cb({ success: false, message: "Không tìm thấy cuộc bình chọn để thu hồi." });
        }

        const currentUserId = String(
          socket.userData?.id || socket.userData?._id || socket.userId || socket.id || ""
        );
        const creatorId = String(
          poll?.createdBy?.id || msg?.sender?.id || msg?.sender?._id || ""
        );

        // Kiểm tra quyền Chủ phòng (Host) hoặc Admin hoặc Người tạo poll
        let isHost = false;
        try {
          const roomDoc = await Room.findOne({ roomCode });
          if (roomDoc && currentUserId) {
            isHost = String(roomDoc.hostId) === currentUserId;
          }
        } catch (_) {}

        if (!isHost && socket.userData?.role === "ADMIN") {
          isHost = true;
        }

        const isCreator = Boolean(currentUserId && creatorId && currentUserId === creatorId);

        if (!isCreator && !isHost) {
          return cb({
            success: false,
            message: "Bạn không có quyền thu hồi cuộc bình chọn này.",
          });
        }

        if ((poll && poll.isRecalled) || (msg && msg.isRecalled)) {
          return cb({
            success: true,
            message: "Cuộc bình chọn đã được thu hồi trước đó.",
          });
        }

        const recalledAt = new Date().toISOString();
        const recalledByName = socket.userData?.name || "Người dùng";
        const effectivePollId = pollId || poll?.id || msg?.poll?.id || msg?.id;
        const effectiveMsgId = msg?.id || messageId || effectivePollId;

        if (poll) {
          poll.isRecalled = true;
          poll.recalledAt = recalledAt;
          poll.recalledBy = recalledByName;
          poll.options = [];
          poll.totalVotes = 0;
        }

        if (msg) {
          msg.isRecalled = true;
          msg.recalledAt = recalledAt;
          msg.recalledBy = recalledByName;
          msg.text = "Bình chọn này đã được thu hồi";
          if (msg.poll) {
            msg.poll.isRecalled = true;
            msg.poll.recalledAt = recalledAt;
            msg.poll.recalledBy = recalledByName;
            msg.poll.options = [];
            msg.poll.totalVotes = 0;
          }
        }

        if (effectivePollId && roomState.polls.has(effectivePollId)) {
          const p = roomState.polls.get(effectivePollId);
          p.isRecalled = true;
          p.recalledAt = recalledAt;
          p.recalledBy = recalledByName;
          p.options = [];
          p.totalVotes = 0;
        }

        const broadcastPayload = {
          roomCode,
          pollId: effectivePollId,
          messageId: effectiveMsgId,
          recalledBy: recalledByName,
          recalledAt,
          isPoll: true,
          isRecalled: true,
        };

        io.to(roomCode).emit("chat:message-recalled", broadcastPayload);
        io.to(roomCode).emit("message_recalled", broadcastPayload);
        io.to(roomCode).emit("poll_recalled", broadcastPayload);
        io.to(roomCode).emit("poll:recalled", broadcastPayload);
        io.to(roomCode).emit("poll:vote-updated", {
          pollId: effectivePollId,
          isRecalled: true,
          options: [],
          totalVotes: 0,
          poll,
        });
        io.to(roomCode).emit("poll_updated", {
          pollId: effectivePollId,
          isRecalled: true,
          options: [],
          totalVotes: 0,
          poll,
        });

        return cb({ success: true, message: "Đã thu hồi bình chọn thành công." });
      } catch (err) {
        console.error("[Socket] Lỗi poll:recall:", err.message);
        return cb({ success: false, message: err.message });
      }
    };

    socket.on("chat:recall-poll", handleRecallPoll);
    socket.on("recall_poll", handleRecallPoll);
    socket.on("poll:recall", handleRecallPoll);

    // Heartbeat định kỳ ghi nhận thời gian học khi đang trong phòng
    socket.on("room:study-heartbeat", async () => {
      const uId = socket.userData?.id || socket.userData?._id || socket.userId;
      if (!uId) return;
      const lastCheck = socket.lastHeartbeatTime || socket.joinTimestamp;
      if (!lastCheck) return;
      const elapsedSec = Math.round((Date.now() - lastCheck) / 1000);
      if (elapsedSec >= 45) {
        await recordStudyTime(uId, lastCheck, io);
        socket.lastHeartbeatTime = Date.now();
      }
    });

    /**
     * Sự kiện: leave-room / leave_room
     */
    const handleLeaveRoom = async (data, callback) => {
      try {
        let roomCode = socket.roomCode;
        let userId = socket.userData?.id || socket.userData?._id || socket.userId;
        const userName = socket.userData?.name || "Thành viên";

        const lastCheck = socket.lastHeartbeatTime || socket.joinTimestamp;
        if (lastCheck && userId) {
          await recordStudyTime(userId, lastCheck, io);
          socket.joinTimestamp = null;
          socket.lastHeartbeatTime = null;
        }

        if (typeof data === "object" && data !== null) {
          if (data.roomCode) roomCode = data.roomCode;
          else if (data.roomId) roomCode = data.roomId;
        } else if (typeof data === "string") {
          roomCode = data;
        }

        if (roomCode) {
          let normalizedCode = roomCode.trim().toUpperCase();

          // Nếu roomCode truyền vào là MongoDB ObjectId 24 ký tự hex, tìm roomCode thật
          if (normalizedCode.match(/^[0-9A-F]{24}$/i)) {
            try {
              const rDoc = await Room.findById(normalizedCode).select("roomCode");
              if (rDoc?.roomCode) {
                normalizedCode = rDoc.roomCode.toUpperCase();
              }
            } catch (_) {}
          }

          if (userId) {
            const graceKey = `${normalizedCode}_${userId}`;
            if (disconnectGraceTimers.has(graceKey)) {
              clearTimeout(disconnectGraceTimers.get(graceKey));
              disconnectGraceTimers.delete(graceKey);
            }
          }

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

          // Xóa trạng thái ready cờ vua nếu có
          if (state?.chess?.readyPlayers && targetUId) {
            state.chess.readyPlayers = state.chess.readyPlayers.filter((id) => String(id) !== targetUId);
            const readyData = {
              readyPlayers: state.chess.readyPlayers,
              readyUserIds: state.chess.readyPlayers,
              chessState: getCleanChessState(state.chess),
            };
            io.to(normalizedCode).emit("chess:ready_update", readyData);
            io.to(normalizedCode).emit("chess_ready_update", readyData);
          }

          // Xử lý bỏ cuộc cờ vua nếu ván đấu đang diễn ra và người rời là 1 trong 2 đấu thủ
          handleChessPlayerAbandonment(normalizedCode, targetUId, io, userName);

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

          const isTerminate =
            typeof data === "object" &&
            data !== null &&
            (data.terminate === true || data.action === "terminate");

          if (isHost && isTerminate) {
            // Host chủ động bấm "Kết thúc cuộc gọi cho mọi người"
            console.log(`[Socket] Host [${userName}] kết thúc cuộc gọi cho mọi người tại phòng ${normalizedCode}`);
            io.to(normalizedCode).emit("room_terminated", {
              message: "Chủ phòng đã kết thúc phiên học",
              reason: "host_terminated",
              hostName: userName,
            });
            await destroyAndCleanupRoom(normalizedCode, io, userName, "Chủ phòng đã kết thúc phiên học");
          } else if (isHost) {
            // Host chủ động chọn "Chỉ rời cuộc gọi"
            const socketsInRoom = await io.in(normalizedCode).fetchSockets();
            const hasOtherHostSocket = socketsInRoom.some((s) => {
              if (s.id === socket.id) return false;
              const sid = String(s.userData?.id || s.userData?._id || s.userId || s.authUserId || "");
              return sid && sid === String(userId);
            });

            if (hasOtherHostSocket) {
              console.log(`[Socket] Host vẫn còn socket khác đang mở trong phòng ${normalizedCode}`);
            } else {
              // Host rời cuộc gọi, phòng vẫn tiếp tục nếu còn học viên
              const updatedDoc = await Room.findOne({ roomCode: normalizedCode })
                .populate("hostId", "name email avatar isPro title equippedTitle")
                .populate("participants.userId", "name email avatar isPro title equippedTitle");

              const remainingCount = updatedDoc?.participants?.length || 0;
              if (remainingCount === 0) {
                console.log(`[Socket] Host rời phòng và không còn ai trong phòng ${normalizedCode} -> Đóng và dọn sạch phòng`);
                await destroyAndCleanupRoom(normalizedCode, io, userName, "Phòng không còn thành viên");
              } else {
                console.log(`[Socket] Host [${userName}] chỉ rời cuộc gọi trong phòng ${normalizedCode}. Kích hoạt đếm ngược 10 phút vắng mặt.`);
                await Room.updateOne({ roomCode: normalizedCode }, { $set: { hostLeftAt: new Date() } });
                startHostAbsenceTimer(normalizedCode, io, userName);
                emitUserLeftSafely(io, normalizedCode, userId, socket.id, userName);

                // Nếu chỉ còn đúng 1 người duy nhất trong phòng -> Kích hoạt đếm ngược 10 phút
                if (remainingCount === 1) {
                  startAloneCountdown(normalizedCode, io);
                } else if (remainingCount > 1) {
                  cancelAloneCountdown(normalizedCode, io);
                }

                const state = getOrCreateRoomState(normalizedCode);
                io.to(normalizedCode).emit("room:members-sync", {
                  roomCode: normalizedCode,
                  participants: updatedDoc.participants || [],
                  membersCount: remainingCount,
                  hostId: updatedDoc.hostId,
                  titleVisibility: Object.fromEntries(state.titleVisibility),
                  raisedHands: Object.fromEntries(state.raisedHands),
                });
                io.emit("room:members-sync", {
                  roomCode: normalizedCode,
                  participants: updatedDoc.participants || [],
                  membersCount: remainingCount,
                });
              }
            }
          } else {
            // Thông báo thành viên thường rời phòng
            emitUserLeftSafely(io, normalizedCode, userId, socket.id, userName);

            // Đồng bộ lại số lượng thành viên ra Dashboard và phòng realtime
            try {
              const updatedDoc = await Room.findOne({ roomCode: normalizedCode })
                .populate("hostId", "name email avatar isPro title equippedTitle")
                .populate("participants.userId", "name email avatar isPro title equippedTitle");

              // Nếu sau khi thành viên rời đi mà phòng không còn ai (0 người) => Đóng và dọn sạch ngay
              if (!updatedDoc || !updatedDoc.participants || updatedDoc.participants.length === 0) {
                console.log(`[Socket] Phòng ${normalizedCode} không còn ai (0 thành viên) sau khi thành viên rời -> Tự động đóng và dọn sạch`);
                await destroyAndCleanupRoom(normalizedCode, io, "Hệ thống", "Phòng không còn thành viên");
              } else {
                const remainingCount = updatedDoc.participants ? updatedDoc.participants.length : 0;
                // Nếu phòng chỉ còn đúng 1 người duy nhất -> Kích hoạt cơ chế đếm ngược 10 phút
                if (remainingCount === 1) {
                  startAloneCountdown(normalizedCode, io);
                } else if (remainingCount > 1) {
                  cancelAloneCountdown(normalizedCode, io);
                }

                const state = getOrCreateRoomState(normalizedCode);
                io.to(normalizedCode).emit("room:members-sync", {
                  roomCode: normalizedCode,
                  participants: updatedDoc.participants || [],
                  membersCount: remainingCount,
                  hostId: updatedDoc.hostId,
                  titleVisibility: Object.fromEntries(state.titleVisibility),
                  raisedHands: Object.fromEntries(state.raisedHands),
                });
                io.emit("room:members-sync", {
                  roomCode: normalizedCode,
                  participants: updatedDoc.participants || [],
                  membersCount: remainingCount,
                });
              }
            } catch (_) {}
          }

          socket.leave(normalizedCode);
          console.log(
            `[Socket] User [${userId || socket.id}] da roi phong ${normalizedCode}${
              isHost ? " (HOST)" : ""
            }`
          );
        }

        if (userId) {
          const current = activeRoomSessions.get(String(userId));
          if (current && current.socketId === socket.id) {
            activeRoomSessions.delete(String(userId));
          }
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
    };

    socket._handleLeaveRoom = handleLeaveRoom;

    /**
     * Sự kiện xác nhận chiếm quyền phiên học từ thiết bị mới (Single Active Room Session / Switch to this device)
     */
    const handleConfirmSwitchDevice = async (payload = {}, callback) => {
      try {
        const cb = typeof callback === "function" ? callback : null;
        let effectiveUserId =
          socket.authUserId ||
          socket.authUser?.id ||
          socket.authUser?._id ||
          socket.user?._id ||
          socket.user?.id ||
          socket.userData?.id ||
          socket.userData?._id ||
          socket.userId;

        const passedToken =
          payload.token ||
          socket.handshake.auth?.token ||
          socket.handshake.query?.token;

        if (!effectiveUserId && passedToken) {
          try {
            const decoded = jwt.verify(passedToken, process.env.JWT_SECRET, {
              algorithms: ["HS256"],
            });
            if (decoded?.id || decoded?._id) {
              effectiveUserId = String(decoded.id || decoded._id);
              socket.authUserId = effectiveUserId;
              socket.authUser = decoded;
            }
          } catch (_) {}
        }

        if (!effectiveUserId) {
          if (cb) cb({ success: false, message: "Unauthorized: Không xác định được người dùng." });
          return;
        }

        const uIdStr = String(effectiveUserId);
        const existingSession = activeRoomSessions.get(uIdStr);

        if (existingSession && existingSession.socketId !== socket.id) {
          console.log(
            `[Socket Session] Xác nhận chiếm quyền phiên học cho user ${uIdStr}: Ngắt phiên thiết bị cũ ${existingSession.socketId} (phòng ${existingSession.roomCode})`
          );

          // 1. Gửi lệnh ngắt kết nối đến socket cũ
          io.to(existingSession.socketId).emit("room:force-evicted", {
            reason: "SWITCHED_TO_ANOTHER_DEVICE",
            message:
              "Bạn đã rời phòng học do tài khoản vừa được chuyển sang sử dụng trên một thiết bị khác.",
          });

          // 2. Thực hiện logic rời phòng cho socket cũ (trừ sĩ số phòng, emit sự kiện user-left cho các học viên khác)
          const oldSocket = io.sockets.sockets.get(existingSession.socketId);
          if (oldSocket) {
            const oldRoomCode = existingSession.roomCode;
            if (oldRoomCode) {
              const graceKey = `${oldRoomCode}_${uIdStr}`;
              if (disconnectGraceTimers.has(graceKey)) {
                clearTimeout(disconnectGraceTimers.get(graceKey));
                disconnectGraceTimers.delete(graceKey);
              }
            }
            if (typeof oldSocket._handleLeaveRoom === "function") {
              await oldSocket._handleLeaveRoom({ roomCode: existingSession.roomCode });
            } else {
              oldSocket.leave(existingSession.roomCode);
            }
          }
        }

        const targetRoomId =
          payload.roomId ||
          payload.roomCode ||
          existingSession?.roomId ||
          socket.roomCode ||
          "";
        const targetRoomCode =
          payload.roomCode ||
          payload.roomId ||
          existingSession?.roomCode ||
          socket.roomCode ||
          "";

        // 3. Gán phiên mới cho socket hiện tại
        activeRoomSessions.set(uIdStr, {
          socketId: socket.id,
          roomId: targetRoomId ? String(targetRoomId) : "",
          roomCode: targetRoomCode ? String(targetRoomCode).trim().toUpperCase() : "",
          userAgent: socket.handshake?.headers?.["user-agent"] || "",
        });

        if (cb) {
          cb({
            success: true,
            message: "Đã chuyển phiên sang thiết bị này thành công.",
            roomId: targetRoomId,
            roomCode: targetRoomCode,
          });
        }
        socket.emit("room:switch-device-success", {
          success: true,
          roomId: targetRoomId,
          roomCode: targetRoomCode,
        });
      } catch (err) {
        console.error("[Socket Session] Lỗi room:confirm-switch-device:", err.message);
        if (typeof callback === "function") callback({ success: false, error: err.message });
      }
    };

    /**
     * Sự kiện chủ phòng ép kết thúc cuộc gọi cho mọi người
     */
    const handleTerminateRoom = async (data, callback) => {
      try {
        let roomCode = socket.roomCode;
        let userId = socket.userData?.id || socket.userData?._id || socket.userId;
        const userName = socket.userData?.name || "Chủ phòng";

        if (typeof data === "object" && data !== null) {
          if (data.roomCode) roomCode = data.roomCode;
          else if (data.roomId) roomCode = data.roomId;
        } else if (typeof data === "string") {
          roomCode = data;
        }

        if (!roomCode) return;
        const normalizedCode = roomCode.trim().toUpperCase();

        const roomDoc = await Room.findOne({ roomCode: normalizedCode });
        if (!roomDoc) {
          if (typeof callback === "function") callback({ success: false, message: "Phòng không tồn tại." });
          return;
        }

        const isHost = String(roomDoc.hostId) === String(userId);
        if (!isHost && socket.userData?.role !== "ADMIN") {
          if (typeof callback === "function") {
            callback({ success: false, message: "Chỉ chủ phòng mới có quyền kết thúc phòng cho mọi người." });
          }
          return;
        }

        console.log(`[Socket] Chủ phòng [${userName}] kết thúc phòng ${normalizedCode} cho mọi người.`);
        await destroyAndCleanupRoom(normalizedCode, io, userName, "Chủ phòng đã kết thúc phiên học");
        if (typeof callback === "function") callback({ success: true });
      } catch (err) {
        console.error("[Socket] Lỗi terminate_room:", err.message);
        if (typeof callback === "function") callback({ success: false, error: err.message });
      }
    };

    /**
     * Sự kiện người dùng bấm "Ở lại tiếp tục học" khi chỉ còn 1 người duy nhất
     */
    const handleStayAlone = ({ roomCode } = {}) => {
      const code = (roomCode || socket.roomCode || "").trim().toUpperCase();
      if (!code) return;
      console.log(`[Socket] Học viên trong phòng ${code} bấm 'Ở lại tiếp tục học' -> Reset bộ đếm 10 phút.`);
      if (aloneRoomTimers.has(code)) {
        clearTimeout(aloneRoomTimers.get(code).timer);
        aloneRoomTimers.delete(code);
      }
      startAloneCountdown(code, io);
    };

    socket.on("leave-room", handleLeaveRoom);
    socket.on("leave_room", handleLeaveRoom);
    socket.on("room:leave", handleLeaveRoom);
    socket.on("room:confirm-switch-device", handleConfirmSwitchDevice);
    socket.on("terminate_room", handleTerminateRoom);
    socket.on("room:terminate", handleTerminateRoom);
    socket.on("room:stay-alone", handleStayAlone);
    socket.on("room:reset-alone-timer", handleStayAlone);

    /**
     * Xử lý các sự kiện Phòng Cờ vua 1v1 (Chess Room)
     */
    const handleChessStart = async ({ roomCode } = {}) => {
      try {
        const code = (roomCode || socket.roomCode || "").trim().toUpperCase();
        if (!code) return;
        socket.join(code);
        const state = getOrCreateRoomState(code);
        if (!state.chessTimers) state.chessTimers = { timerId: null, closingTimerId: null, rollTimerId: null };

        // Dọn dẹp timer đang chạy nếu có
        if (state.chessTimers.rollTimerId) {
          clearTimeout(state.chessTimers.rollTimerId);
          state.chessTimers.rollTimerId = null;
        }
        if (state.chessTimers.timerId) {
          clearInterval(state.chessTimers.timerId);
          state.chessTimers.timerId = null;
        }
        if (state.chessTimers.closingTimerId) {
          clearInterval(state.chessTimers.closingTimerId);
          state.chessTimers.closingTimerId = null;
        }

        const roomDoc = await Room.findOne({ roomCode: code })
          .populate("hostId", "name")
          .populate("participants.userId", "name");

        const participants = roomDoc?.participants || [];
        let hostUserId = "";
        let hostName = "Người chơi 1";
        let guestUserId = "";
        let guestName = "Người chơi 2";

        if (participants.length > 0) {
          const hostPart =
            participants.find((p) => {
              const uId = String(p.userId?._id || p.userId || "");
              const hId = String(roomDoc.hostId?._id || roomDoc.hostId || "");
              return uId === hId;
            }) || participants[0];

          const guestPart =
            participants.find((p) => {
              const uId = String(p.userId?._id || p.userId || "");
              const hostUId = String(hostPart.userId?._id || hostPart.userId || "");
              return uId !== hostUId;
            }) || (participants.length > 1 ? participants[1] : null);

          hostUserId = String(hostPart.userId?._id || hostPart.userId || roomDoc.hostId?._id || roomDoc.hostId || "");
          hostName = hostPart.userId?.name || roomDoc.hostId?.name || "Chủ phòng";

          if (guestPart) {
            guestUserId = String(guestPart.userId?._id || guestPart.userId || "");
            guestName = guestPart.userId?.name || "Khách";
          }
        }

        // Nếu thiếu thông tin guest từ participants, đối chiếu với danh sách readyPlayers
        if (!guestUserId && state.chess.readyPlayers && state.chess.readyPlayers.length >= 2) {
          const readyList = state.chess.readyPlayers.map(String);
          const otherId = readyList.find((id) => id !== hostUserId);
          if (otherId) {
            guestUserId = otherId;
          }
        }

        // Bốc thăm ngẫu nhiên 50/50 theo yêu cầu:
        const isHostWhite = Math.random() < 0.5;
        const whiteUserId = isHostWhite ? hostUserId : (guestUserId || hostUserId);
        const blackUserId = isHostWhite ? (guestUserId || hostUserId) : hostUserId;
        const whitePlayerName = isHostWhite ? hostName : (guestName || hostName);
        const blackPlayerName = isHostWhite ? (guestName || hostName) : hostName;

        state.chess.whitePlayerId = whiteUserId;
        state.chess.whitePlayerName = String(whitePlayerName);
        state.chess.blackPlayerId = blackUserId;
        state.chess.blackPlayerName = String(blackPlayerName);
        state.chess.gameStatus = "rolling";
        state.chess.readyPlayers = [];

        // Phát sự kiện bốc thăm ngẫu nhiên quân cờ (chess_roll_start)
        const rollPayload = {
          whiteUserId,
          blackUserId,
          whitePlayerName: state.chess.whitePlayerName,
          blackPlayerName: state.chess.blackPlayerName,
        };
        io.to(code).emit("chess_roll_start", rollPayload);
        io.to(code).emit("chess:roll_start", rollPayload);

        // Đợi 3.5 giây cho hiệu ứng 3D Flip Card ở Client chạy hoàn tất
        state.chessTimers.rollTimerId = setTimeout(() => {
          state.chessTimers.rollTimerId = null;

          state.chess.fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
          state.chess.history = [];
          state.chess.gameStatus = "playing";
          state.chess.winner = null;
          state.chess.reason = null;
          state.chess.readyPlayers = [];
          state.chess.remainingSeconds = 600; // 10 phút
          state.chess.closingSeconds = 60;

          const cleanState = getCleanChessState(state.chess);

          // Broadcast trạng thái trận đấu chính thức dạng pure JSON
          io.to(code).emit("chess:state_update", cleanState);
          io.to(code).emit("chess_state", cleanState);
          io.to(code).emit("game_update", cleanState);
          io.to(code).emit("chess:game_started", cleanState);
          io.to(code).emit("chess_started", cleanState);
          io.to(code).emit("chess_game_started", cleanState);
          io.to(code).emit("chess:ready_update", { readyPlayers: [] });
          io.to(code).emit("chess_ready_update", { readyPlayers: [] });

          state.chessTimers.timerId = setInterval(() => {
            state.chess.remainingSeconds -= 1;
            const currentSeconds = Number(state.chess.remainingSeconds);

            io.to(code).emit("chess:timer_tick", { remainingSeconds: currentSeconds });
            io.to(code).emit("chess_timer_tick", { remainingSeconds: currentSeconds });

            if (state.chess.remainingSeconds <= 0) {
              clearInterval(state.chessTimers.timerId);
              state.chessTimers.timerId = null;
              state.chess.gameStatus = "finished";
              state.chess.winner = "draw";
              state.chess.reason = "timeout";

              const finishedCleanState = getCleanChessState(state.chess);
              const gameOverData = {
                winner: "draw",
                reason: "timeout",
                message: "Hết 10 phút! Ván cờ hòa do hết thời gian.",
                chessState: finishedCleanState,
              };
              io.to(code).emit("chess:game_over", gameOverData);
              io.to(code).emit("chess_game_over", gameOverData);

              startChessClosingCountdown(code, io, state);
            }
          }, 1000);
        }, 3500);
      } catch (err) {
        console.error("[Chess] Lỗi chess:start_game:", err.message);
      }
    };

    const handleChessPlayerReady = async (data = {}) => {
      try {
        const code = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        if (!code) return;
        socket.join(code);
        const state = getOrCreateRoomState(code);
        const userId = String(
          data?.userId ||
          socket.userId ||
          socket.userData?.id ||
          socket.userData?._id ||
          ""
        );
        if (!userId) return;

        if (!Array.isArray(state.chess.readyPlayers)) {
          state.chess.readyPlayers = [];
        }

        if (!state.chess.readyPlayers.includes(userId)) {
          state.chess.readyPlayers.push(userId);
        }

        const readyData = {
          readyPlayers: state.chess.readyPlayers,
          readyUserIds: state.chess.readyPlayers,
          chessState: getCleanChessState(state.chess),
        };

        io.to(code).emit("chess:ready_update", readyData);
        io.to(code).emit("chess_ready_update", readyData);
        io.to(code).emit("chess:state_update", readyData.chessState);
        io.to(code).emit("chess_state", readyData.chessState);

        const uniqueReady = Array.from(new Set(state.chess.readyPlayers));
        if (uniqueReady.length >= 2) {
          state.chess.readyPlayers = [];
          await handleChessStart({ roomCode: code });
        }
      } catch (err) {
        console.error("[Chess] Lỗi chess_player_ready:", err.message);
      }
    };

    const handleChessMove = (data) => {
      try {
        const code = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
        if (!code) return;
        socket.join(code);
        const state = getOrCreateRoomState(code);
        if (!state.chessTimers) state.chessTimers = { timerId: null, closingTimerId: null };

        const cleanMove = data?.move
          ? {
              from: String(data.move.from || ""),
              to: String(data.move.to || ""),
              promotion: String(data.move.promotion || "q"),
              san: String(data.move.san || ""),
            }
          : null;

        const cleanFen = String(data?.fen || "");
        if (cleanFen) {
          state.chess.fen = cleanFen;
        }
        if (cleanMove) {
          state.chess.history.push(cleanMove);
        }

        const movePayload = {
          move: cleanMove,
          fen: cleanFen,
          history: Array.isArray(state.chess.history) ? [...state.chess.history] : [],
        };

        if (state.chess.gameStatus === "waiting") {
          state.chess.gameStatus = "playing";
        }

        if (state.chess.gameStatus === "playing" && !state.chessTimers.timerId) {
          state.chessTimers.timerId = setInterval(() => {
            state.chess.remainingSeconds -= 1;
            const currentSeconds = Number(state.chess.remainingSeconds);

            io.to(code).emit("chess:timer_tick", { remainingSeconds: currentSeconds });
            io.to(code).emit("chess_timer_tick", { remainingSeconds: currentSeconds });

            if (state.chess.remainingSeconds <= 0) {
              clearInterval(state.chessTimers.timerId);
              state.chessTimers.timerId = null;
              state.chess.gameStatus = "finished";
              state.chess.winner = "draw";
              state.chess.reason = "timeout";

              const finishedCleanState = getCleanChessState(state.chess);
              const gameOverData = {
                winner: "draw",
                reason: "timeout",
                message: "Hết 10 phút! Ván cờ hòa do hết thời gian.",
                chessState: finishedCleanState,
              };
              io.to(code).emit("chess:game_over", gameOverData);
              io.to(code).emit("chess_game_over", gameOverData);

              startChessClosingCountdown(code, io, state);
            }
          }, 1000);
        }

        io.to(code).emit("chess_move", movePayload);
        io.to(code).emit("chess:move", movePayload);

        if (data?.isGameOver || data?.result?.type === "checkmate" || data?.result?.type === "draw") {
          if (state.chessTimers.timerId) {
            clearInterval(state.chessTimers.timerId);
            state.chessTimers.timerId = null;
          }
          state.chess.gameStatus = "finished";
          const finalWinner =
            data.winner ||
            data.result?.winner ||
            (data.result?.winnerColor ? (data.result.winnerColor === "w" ? "white" : "black") : "draw");
          const finalReason = data.reason || data.result?.reason || data.result?.type || "checkmate";
          state.chess.winner = finalWinner;
          state.chess.reason = finalReason;

          const defaultMsg =
            finalWinner === "draw"
              ? "Ván đấu kết thúc với kết quả Hòa."
              : `Người chơi ${finalWinner === "w" || finalWinner === "white" ? "Trắng" : "Đen"} đã chiến thắng!`;

          const cleanState = getCleanChessState(state.chess);
          const gameOverData = {
            winner: state.chess.winner,
            reason: state.chess.reason,
            message: String(data.message || data.result?.message || defaultMsg),
            result: data.result || { type: finalReason, winner: finalWinner },
            chessState: cleanState,
          };

          io.to(code).emit("chess:game_over", gameOverData);
          io.to(code).emit("chess_game_over", gameOverData);

          startChessClosingCountdown(code, io, state);
        }
      } catch (err) {
        console.error("[Chess] Lỗi chess_move:", err.message);
      }
    };

    const handleChessGameOver = ({ roomCode, result, winner, reason, message } = {}) => {
      try {
        const code = (roomCode || socket.roomCode || "").trim().toUpperCase();
        if (!code) return;
        socket.join(code);
        const state = getOrCreateRoomState(code);
        if (!state.chessTimers) state.chessTimers = { timerId: null, closingTimerId: null, rollTimerId: null };

        if (state.chessTimers.rollTimerId) {
          clearTimeout(state.chessTimers.rollTimerId);
          state.chessTimers.rollTimerId = null;
        }
        if (state.chessTimers.timerId) {
          clearInterval(state.chessTimers.timerId);
          state.chessTimers.timerId = null;
        }

        state.chess.gameStatus = "finished";
        const finalWinner =
          winner ||
          result?.winner ||
          (result?.winnerColor ? (result.winnerColor === "w" ? "white" : "black") : "draw");
        const finalReason = reason || result?.reason || result?.type || "checkmate";
        state.chess.winner = finalWinner;
        state.chess.reason = finalReason;

        const defaultMsg =
          finalWinner === "draw"
            ? "Ván đấu kết thúc với kết quả Hòa."
            : `Người chơi ${finalWinner === "white" || finalWinner === "w" ? "Trắng" : "Đen"} đã chiến thắng bằng ${finalReason === "checkmate" ? "Chiếu Bí" : finalReason}!`;

        const finalMessage = String(message || result?.message || defaultMsg);

        const cleanState = getCleanChessState(state.chess);
        const gameOverData = {
          winner: finalWinner,
          reason: finalReason,
          message: finalMessage,
          result: result || { type: finalReason, winner: finalWinner, message: finalMessage },
          chessState: cleanState,
        };

        io.to(code).emit("chess:game_over", gameOverData);
        io.to(code).emit("chess_game_over", gameOverData);

        startChessClosingCountdown(code, io, state);
      } catch (err) {
        console.error("[Chess] Lỗi chess_game_over:", err.message);
      }
    };

    const handleChessResign = ({ roomCode } = {}) => {
      try {
        const code = (roomCode || socket.roomCode || "").trim().toUpperCase();
        if (!code) return;
        socket.join(code);
        const state = getOrCreateRoomState(code);
        if (!state.chessTimers) state.chessTimers = { timerId: null, closingTimerId: null, rollTimerId: null };

        if (state.chessTimers.rollTimerId) {
          clearTimeout(state.chessTimers.rollTimerId);
          state.chessTimers.rollTimerId = null;
        }
        if (state.chessTimers.timerId) {
          clearInterval(state.chessTimers.timerId);
          state.chessTimers.timerId = null;
        }
        state.chess.gameStatus = "finished";
        const userId = String(socket.userId || socket.userData?.id || socket.userData?._id || "");
        const isWhite = userId === String(state.chess.whitePlayerId);
        state.chess.winner = isWhite ? "black" : "white";
        state.chess.reason = "resignation";

        const cleanState = getCleanChessState(state.chess);
        const playerName = String(socket.userData?.name || "Người chơi");
        const gameOverData = {
          winner: state.chess.winner,
          reason: "resignation",
          message: `${playerName} đã đầu hàng. ${state.chess.winner === "white" ? "Trắng" : "Đen"} thắng!`,
          chessState: cleanState,
        };

        io.to(code).emit("chess:game_over", gameOverData);
        io.to(code).emit("chess_game_over", gameOverData);

        startChessClosingCountdown(code, io, state);
      } catch (err) {
        console.error("[Chess] Lỗi chess:resign:", err.message);
      }
    };

    const handleChessGetState = ({ roomCode } = {}, callback) => {
      const code = (roomCode || socket.roomCode || "").trim().toUpperCase();
      if (!code) return;
      socket.join(code);
      const state = getOrCreateRoomState(code);
      const cleanState = getCleanChessState(state.chess);
      if (typeof callback === "function") {
        callback({ success: true, chessState: cleanState });
      } else {
        socket.emit("chess:state_update", cleanState);
        socket.emit("chess_state", cleanState);
        socket.emit("game_update", cleanState);
      }
    };

    socket.on("chess_player_ready", handleChessPlayerReady);
    socket.on("chess:player_ready", handleChessPlayerReady);
    socket.on("chess:start_game", handleChessPlayerReady);
    socket.on("chess_start", handleChessPlayerReady);
    socket.on("chess:get_state", handleChessGetState);
    socket.on("chess_state", handleChessGetState);
    socket.on("chess_move", handleChessMove);
    socket.on("chess:move", handleChessMove);
    socket.on("chess_game_over", handleChessGameOver);
    socket.on("chess:game_over", handleChessGameOver);
    socket.on("chess:resign", handleChessResign);
    socket.on("chess_resign", handleChessResign);

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

      // Dọn dẹp phiên học độc quyền khi socket ngắt kết nối
      const effectiveDisconnId = String(userId || socket.authUserId || "");
      if (effectiveDisconnId) {
        const current = activeRoomSessions.get(effectiveDisconnId);
        if (current && current.socketId === socket.id) {
          activeRoomSessions.delete(effectiveDisconnId);
        }
      }

      const lastCheck = socket.lastHeartbeatTime || socket.joinTimestamp;
      if (lastCheck && userId) {
        recordStudyTime(userId, lastCheck, io);
        socket.joinTimestamp = null;
        socket.lastHeartbeatTime = null;
      }

      // Xóa trạng thái ready cờ vua nếu người ngắt kết nối đang ready
      if (roomCode && userId) {
        const state = roomStates.get(roomCode.trim().toUpperCase());
        if (state?.chess?.readyPlayers) {
          state.chess.readyPlayers = state.chess.readyPlayers.filter((id) => String(id) !== String(userId));
          const readyData = {
            readyPlayers: state.chess.readyPlayers,
            readyUserIds: state.chess.readyPlayers,
            chessState: getCleanChessState(state.chess),
          };
          io.to(roomCode.trim().toUpperCase()).emit("chess:ready_update", readyData);
          io.to(roomCode.trim().toUpperCase()).emit("chess_ready_update", readyData);
        }
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

      // Hủy đăng ký listener chép lời nếu socket này đang bật chép lời
      if (roomCode) {
        const normalizedCode = roomCode.trim().toUpperCase();
        const state = roomStates.get(normalizedCode);
        if (state?.transcriptionListeners?.has(socket.id)) {
          state.transcriptionListeners.delete(socket.id);
          const hasActiveListener = state.transcriptionListeners.size > 0;
          io.to(normalizedCode).emit("room:transcription-status-changed", {
            hasActiveListener,
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

        console.log(`[Socket] User [${userName}] (${uIdStr}) tạm thời ngắt kết nối socket ${socket.id}. Bắt đầu ân hạn 15 giây...`);

        // Đặt thời gian ân hạn 15 giây (chống rớt mạng tạm thời, Next.js fast refresh, F5)
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

            // Xử lý bỏ cuộc cờ vua nếu ván đấu đang diễn ra và người ngắt kết nối là 1 trong 2 đấu thủ
            handleChessPlayerAbandonment(normalizedCode, uIdStr, io, userName);

            emitUserLeftSafely(io, normalizedCode, uIdStr, socket.id, userName);

            try {
              const updatedDoc = await Room.findOne({ roomCode: normalizedCode })
                .populate("hostId", "name email avatar isPro title equippedTitle")
                .populate("participants.userId", "name email avatar isPro title equippedTitle");
              if (updatedDoc) {
                // Nếu sau khi ngắt kết nối mà phòng không còn ai => Tự động dọn sạch ngay
                if (!updatedDoc.participants || updatedDoc.participants.length === 0) {
                  console.log(`[Socket] Phòng ${normalizedCode} không còn ai (grace timeout), tự động dọn sạch`);
                  await destroyAndCleanupRoom(normalizedCode, io, "Hệ thống");
                } else {
                  const state = getOrCreateRoomState(normalizedCode);
                  const membersCount = updatedDoc.participants ? updatedDoc.participants.length : 0;
                  io.to(normalizedCode).emit("room:members-sync", {
                    roomCode: normalizedCode,
                    participants: updatedDoc.participants || [],
                    membersCount,
                    hostId: updatedDoc.hostId,
                    titleVisibility: Object.fromEntries(state.titleVisibility),
                    raisedHands: Object.fromEntries(state.raisedHands),
                  });
                  io.emit("room:members-sync", {
                    roomCode: normalizedCode,
                    participants: updatedDoc.participants || [],
                    membersCount,
                  });
                }
              }
            } catch (_) {}
          } catch (timerErr) {
            console.error("[Socket] Lỗi trong timer ân hạn ngắt kết nối:", timerErr.message);
          }
        }, 15000);

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
initSocket.destroyAndCleanupRoom = destroyAndCleanupRoom;
initSocket.emitUserLeftSafely = emitUserLeftSafely;
initSocket.startHostAbsenceTimer = startHostAbsenceTimer;

module.exports = initSocket;
module.exports.destroyAndCleanupRoom = destroyAndCleanupRoom;
module.exports.addRoomNotification = addRoomNotification;
module.exports.emitUserLeftSafely = emitUserLeftSafely;
module.exports.startHostAbsenceTimer = startHostAbsenceTimer;

