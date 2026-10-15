const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { getIo } = require("../config/socketInstance");

/**
 * Hàm helper cốt lõi: Tạo thông báo, lưu MongoDB và bắn socket realtime
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.recipientId - ID người nhận
 * @param {string|mongoose.Types.ObjectId|null} [params.senderId=null] - ID người gửi (null nếu là hệ thống)
 * @param {'FILE_SHARED'|'ROOM_INVITE'|'STREAK_ALERT'|'SYSTEM'} [params.type='SYSTEM']
 * @param {string} params.title - Tiêu đề thông báo
 * @param {string} params.message - Nội dung thông báo
 * @param {string} [params.link=''] - URL chuyển hướng
 */
async function createAndSendNotification({
  recipientId,
  senderId = null,
  type = "SYSTEM",
  title,
  message,
  link = "",
}) {
  try {
    if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
      console.warn("[NotificationService] recipientId không hợp lệ:", recipientId);
      return null;
    }

    let validSenderId = null;
    if (senderId && mongoose.Types.ObjectId.isValid(senderId)) {
      validSenderId = senderId;
    }

    let doc;
    if (type === "MESSAGE" && validSenderId) {
      // Gộp thông báo tin nhắn từ cùng 1 người gửi để chống spam
      const existing = await Notification.findOne({
        recipient: recipientId,
        sender: validSenderId,
        type: "MESSAGE",
      }).sort({ createdAt: -1 });

      if (existing) {
        const nextCount = existing.isRead ? 1 : (existing.unreadMessageCount || 1) + 1;
        existing.title = title || "Tin nhắn mới";
        existing.message = message || "";
        existing.link = link || "";
        existing.isRead = false;
        existing.unreadMessageCount = nextCount;
        existing.createdAt = new Date();
        doc = await existing.save();

        // Xóa mọi bản ghi MESSAGE trùng lặp khác từ sender này nếu có
        await Notification.deleteMany({
          _id: { $ne: existing._id },
          recipient: recipientId,
          sender: validSenderId,
          type: "MESSAGE",
        });
      } else {
        doc = await Notification.create({
          recipient: recipientId,
          sender: validSenderId,
          type: "MESSAGE",
          title: title || "Tin nhắn mới",
          message: message || "",
          link: link || "",
          isRead: false,
          unreadMessageCount: 1,
        });
      }
    } else {
      doc = await Notification.create({
        recipient: recipientId,
        sender: validSenderId,
        type: type || "SYSTEM",
        title: title || "Thông báo mới",
        message: message || "",
        link: link || "",
        isRead: false,
        unreadMessageCount: 1,
      });
    }

    const populated = await Notification.findById(doc._id).populate(
      "sender",
      "name email avatar"
    );

    const io = getIo();
    if (io) {
      io.to(`user:${recipientId}`).emit("notification:new", populated);
    }

    return populated;
  } catch (err) {
    console.error("[NotificationService] Lỗi tạo và gửi thông báo:", err.message);
    return null;
  }
}

/**
 * Gửi thông báo đến nhiều người cùng lúc (ví dụ: các thành viên trong phòng học)
 */
async function sendNotificationToMultiple({
  recipientIds = [],
  senderId = null,
  type = "SYSTEM",
  title,
  message,
  link = "",
}) {
  const promises = recipientIds
    .filter((id) => id && String(id) !== String(senderId))
    .map((recipientId) =>
      createAndSendNotification({
        recipientId,
        senderId,
        type,
        title,
        message,
        link,
      })
    );

  return Promise.allSettled(promises);
}

const streakCheckingLocks = new Set();

/**
 * Tính thời điểm bắt đầu của chu kỳ 24h hiện tại (lấy mốc 6:00 sáng)
 * Chu kỳ từ 06:00:00 hôm nay đến 05:59:59 sáng mai.
 * Nếu hiện tại trước 06:00:00 sáng thì chu kỳ bắt đầu từ 06:00:00 sáng hôm qua.
 */
function getCurrentStreakCycleStart() {
  const now = new Date();
  const cycleStart = new Date(now);
  if (now.getHours() < 6) {
    cycleStart.setDate(cycleStart.getDate() - 1);
  }
  cycleStart.setHours(6, 0, 0, 0);
  return cycleStart;
}

/**
 * Kiểm tra và tạo cảnh báo Streak (STREAK_ALERT) nếu người dùng chưa học hôm nay.
 * Quy định nghiêm ngặt: 24h chỉ gửi tối đa 1 lần, chu kỳ tính từ mốc 6:00 sáng.
 */
async function checkAndSendStreakAlert(userId) {
  const uidStr = String(userId || "");
  if (!uidStr) return null;

  if (streakCheckingLocks.has(uidStr)) {
    return null;
  }
  streakCheckingLocks.add(uidStr);

  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const cycleStart = getCurrentStreakCycleStart();

    // 1. Kiểm tra mốc đã gửi ghi nhận trên User (chống gửi lại kể cả khi user đã xóa thông báo)
    if (user.lastStreakAlertSentAt && new Date(user.lastStreakAlertSentAt) >= cycleStart) {
      return null;
    }

    // 2. Kiểm tra nếu trong chu kỳ này (từ 6h sáng) người dùng đã có phiên học
    if (user.lastStudyDate && new Date(user.lastStudyDate) >= cycleStart) {
      return null;
    }

    // 3. Kiểm tra xem trong DB đã có thông báo STREAK_ALERT được tạo trong chu kỳ này chưa
    const recentAlert = await Notification.findOne({
      recipient: userId,
      type: "STREAK_ALERT",
      createdAt: { $gte: cycleStart },
    });

    if (recentAlert) {
      // Cập nhật lại mốc trên User để đồng bộ
      await User.updateOne(
        { _id: userId },
        { $set: { lastStreakAlertSentAt: recentAlert.createdAt } }
      );
      return null;
    }

    // 4. Nếu đủ điều kiện, tạo thông báo cảnh báo chuỗi streak
    const currentStreak = user.streak || 1;
    const notif = await createAndSendNotification({
      recipientId: userId,
      senderId: null,
      type: "STREAK_ALERT",
      title: `🔥 Giữ vững chuỗi streak ${currentStreak} ngày!`,
      message: `Hôm nay bạn chưa có phiên học nào. Hãy vào ngay một phòng học để tiếp tục duy trì ngọn lửa học tập nhé!`,
      link: "/dashboard",
    });

    // 5. Cập nhật mốc thời gian đã gửi vào User để khóa không gửi lại trong 24h của chu kỳ này
    await User.updateOne(
      { _id: userId },
      { $set: { lastStreakAlertSentAt: new Date() } }
    );

    return notif;
  } catch (err) {
    console.error("[NotificationService] Lỗi kiểm tra streak alert:", err.message);
    return null;
  } finally {
    // Giải phóng lock sau 5 giây
    setTimeout(() => {
      streakCheckingLocks.delete(uidStr);
    }, 5000);
  }
}

module.exports = {
  createAndSendNotification,
  sendNotificationToMultiple,
  checkAndSendStreakAlert,
};
