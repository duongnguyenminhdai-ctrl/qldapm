/**
 * Helper tính toán và chuẩn hóa chuỗi ngày học (Streak) theo chuẩn múi giờ Việt Nam (GMT+7).
 */

/**
 * Lấy chuỗi ngày định dạng YYYY-MM-DD theo giờ Việt Nam (GMT+7).
 * @param {Date|number|string} [date=new Date()]
 * @returns {string} Ví dụ: "2026-10-17"
 */
function getVietnamDateString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  // GMT+7 tương ứng với offset +420 phút
  const tzOffsetMinutes = 7 * 60;
  const vnTime = new Date(d.getTime() + (tzOffsetMinutes + d.getTimezoneOffset()) * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  const year = vnTime.getFullYear();
  const month = pad(vnTime.getMonth() + 1);
  const day = pad(vnTime.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Tính số ngày chênh lệch giữa 2 chuỗi ngày YYYY-MM-DD: dateStr1 - dateStr2.
 * @param {string} dateStr1
 * @param {string} dateStr2
 * @returns {number|null}
 */
function getDaysDiff(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return null;
  const [y1, m1, d1] = dateStr1.split("-").map(Number);
  const [y2, m2, d2] = dateStr2.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null;

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24));
}

/**
 * Tính toán trạng thái streak mới cho user.
 * @param {object} user - Đối tượng user hoặc { streak, lastActiveDate }
 * @returns {{ shouldUpdate: boolean, streak: number, lastActiveDate: string }}
 */
function calculateStreakUpdate(user = {}) {
  const today = getVietnamDateString();
  const currentStreak = typeof user.streak === "number" && !isNaN(user.streak) ? user.streak : 1;
  const lastActiveDate = user.lastActiveDate;

  // Trường hợp 1: Tài khoản mới hoặc chưa từng ghi nhận ngày hoạt động
  if (!lastActiveDate) {
    return {
      shouldUpdate: true,
      streak: Math.max(1, currentStreak),
      lastActiveDate: today,
    };
  }

  const diff = getDaysDiff(today, lastActiveDate);

  // Trường hợp 2: Đã ghi nhận hôm nay rồi -> giữ nguyên
  if (diff === 0) {
    return {
      shouldUpdate: false,
      streak: currentStreak,
      lastActiveDate,
    };
  }

  // Trường hợp 3: Hôm nay là ngày tiếp theo liên tiếp (diff === 1) -> tăng streak thêm 1
  if (diff === 1) {
    return {
      shouldUpdate: true,
      streak: currentStreak + 1,
      lastActiveDate: today,
    };
  }

  // Trường hợp 4: Đã bỏ lỡ >= 1 ngày (diff > 1) -> reset streak về 1
  if (diff > 1) {
    return {
      shouldUpdate: true,
      streak: 1,
      lastActiveDate: today,
    };
  }

  // Trường hợp đặc biệt (diff < 0, ví dụ do chỉnh sửa giờ hệ thống): giữ nguyên
  return {
    shouldUpdate: false,
    streak: currentStreak,
    lastActiveDate,
  };
}

/**
 * Áp dụng cập nhật streak vào Mongoose Document User hoặc cập nhật trực tiếp qua Model
 * @param {import('mongoose').Document|object} userDoc
 * @returns {Promise<{ updated: boolean, streak: number, lastActiveDate: string }>}
 */
async function applyStreakUpdate(userDoc) {
  if (!userDoc) return { updated: false, streak: 1, lastActiveDate: getVietnamDateString() };

  const { shouldUpdate, streak, lastActiveDate } = calculateStreakUpdate(userDoc);
  if (shouldUpdate) {
    userDoc.streak = streak;
    userDoc.lastActiveDate = lastActiveDate;
    if (userDoc._id && userDoc.constructor && typeof userDoc.constructor.updateOne === "function") {
      await userDoc.constructor.updateOne(
        { _id: userDoc._id },
        { $set: { streak, lastActiveDate } }
      );
    } else if (typeof userDoc.save === "function") {
      await userDoc.save();
    }
    return { updated: true, streak, lastActiveDate };
  }

  return { updated: false, streak, lastActiveDate };
}

module.exports = {
  getVietnamDateString,
  getDaysDiff,
  calculateStreakUpdate,
  applyStreakUpdate,
};
