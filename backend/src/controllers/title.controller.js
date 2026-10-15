const User = require("../models/User");
const { TITLE_MILESTONES, ALL_TITLES } = require("../constants/titles");
const { getIo } = require("../config/socketInstance");

/**
 * Helper: Tự động kiểm tra và mở khóa các danh hiệu theo thành tích của User
 * @param {Object} user - Mongoose User document
 * @returns {Boolean} hasChanges - true nếu có danh hiệu mới được mở khóa
 */
async function autoUnlockTitles(user) {
  if (!user) return false;

  const currentUnlocked = new Set(user.unlockedTitleIds || []);
  // Luôn đảm bảo mốc tân thủ ban đầu được mở
  currentUnlocked.add("nhap-mon-hoc-gia");
  currentUnlocked.add("thieu-uy");

  const userStreak = user.streak || 1;
  const studyHours = (user.totalStudySeconds || 0) / 3600;
  const isPro = Boolean(user.isPro);
  const proMonths = user.proMonths || (isPro ? 1 : 0);

  let newlyUnlockedCount = 0;

  for (const milestone of TITLE_MILESTONES) {
    let milestoneQualified = false;

    if (milestone.category === "STREAK") {
      if (userStreak >= (milestone.minStreak || 1)) {
        milestoneQualified = true;
      }
    } else if (milestone.category === "HOURS") {
      if (studyHours >= (milestone.minHours || 0)) {
        milestoneQualified = true;
      }
    } else if (milestone.category === "PRO") {
      // Đối với mốc PRO, kiểm tra theo từng title
      for (const title of milestone.titles) {
        const requiredMonths = title.minProMonths || 1;
        if (isPro && proMonths >= requiredMonths) {
          if (!currentUnlocked.has(title.id)) {
            currentUnlocked.add(title.id);
            newlyUnlockedCount++;
          }
        }
      }
      continue;
    }

    if (milestoneQualified) {
      for (const title of milestone.titles) {
        if (!currentUnlocked.has(title.id)) {
          currentUnlocked.add(title.id);
          newlyUnlockedCount++;
        }
      }
    }
  }

  const updatedList = Array.from(currentUnlocked);
  const hasChanges =
    newlyUnlockedCount > 0 ||
    updatedList.length !== (user.unlockedTitleIds || []).length;

  if (hasChanges) {
    user.unlockedTitleIds = updatedList;
    if (!user.equippedTitle) {
      user.equippedTitle = "Nhập môn học giả";
    }
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          unlockedTitleIds: updatedList,
          equippedTitle: user.equippedTitle || "Nhập môn học giả",
        },
      }
    );
  }

  return hasChanges;
}

/**
 * GET /api/titles
 * Lấy danh sách toàn bộ milestone, titles con, trạng thái mở khóa, tiến độ và title đang trang bị
 */
const getTitles = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    // Tự động quét và mở khóa trước khi trả về dữ liệu (chỉ update nếu có thay đổi)
    await autoUnlockTitles(user);

    const userStreak = user.streak || 1;
    const studyHours = (user.totalStudySeconds || 0) / 3600;
    const isPro = Boolean(user.isPro);
    const proMonths = user.proMonths || (isPro ? 1 : 0);
    const equippedTitle = user.equippedTitle || "Nhập môn học giả";
    const unlockedSet = new Set(user.unlockedTitleIds || []);

    const milestonesData = TITLE_MILESTONES.map((m) => {
      let currentVal = 0;
      let targetVal = 0;
      let unit = "";
      let isMilestoneUnlocked = false;

      if (m.category === "STREAK") {
        currentVal = userStreak;
        targetVal = m.minStreak;
        unit = "ngày";
        isMilestoneUnlocked = userStreak >= targetVal;
      } else if (m.category === "HOURS") {
        currentVal = parseFloat(studyHours.toFixed(1));
        targetVal = m.minHours;
        unit = "giờ";
        isMilestoneUnlocked = studyHours >= targetVal;
      } else if (m.category === "PRO") {
        currentVal = proMonths;
        targetVal = 1;
        unit = "tháng";
        isMilestoneUnlocked = isPro;
      }

      const percent = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 100;

      const titles = m.titles.map((t) => {
        let isTitleUnlocked = unlockedSet.has(t.id);
        if (m.category === "PRO") {
          isTitleUnlocked = isPro && proMonths >= (t.minProMonths || 1);
        }
        return {
          id: t.id,
          name: t.name,
          tag: t.tag,
          color: t.color,
          minProMonths: t.minProMonths,
          isUnlocked: isTitleUnlocked,
          isEquipped: equippedTitle === t.name,
        };
      });

      return {
        milestoneId: m.milestoneId,
        category: m.category,
        minStreak: m.minStreak,
        minHours: m.minHours,
        description: m.description,
        isUnlocked: isMilestoneUnlocked,
        progress: {
          current: currentVal,
          target: targetVal,
          unit,
          percent,
        },
        titles,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        equippedTitle,
        unlockedTitleIds: Array.from(unlockedSet),
        stats: {
          streak: userStreak,
          totalStudySeconds: user.totalStudySeconds || 0,
          studyHours: parseFloat(studyHours.toFixed(1)),
          isPro,
          proMonths,
        },
        milestones: milestonesData,
      },
    });
  } catch (error) {
    console.error("[Title] getTitles error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi tải danh sách danh hiệu.",
    });
  }
};

/**
 * POST /api/titles/equip
 * Trang bị một danh hiệu đã mở khóa
 * Body: { titleId }
 */
const equipTitle = async (req, res) => {
  try {
    const { titleId } = req.body;
    if (!titleId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp titleId cần trang bị.",
      });
    }

    const titleMeta = ALL_TITLES[titleId];
    if (!titleMeta) {
      return res.status(404).json({
        success: false,
        message: "Danh hiệu không tồn tại trong hệ thống.",
      });
    }

    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    // Đảm bảo mở khóa tự động
    await autoUnlockTitles(user);

    const unlockedSet = new Set(user.unlockedTitleIds || []);
    if (!unlockedSet.has(titleId)) {
      return res.status(403).json({
        success: false,
        message: `Bạn chưa mở khóa danh hiệu "${titleMeta.name}".`,
      });
    }

    user.equippedTitle = titleMeta.name;
    user.title = titleMeta.name; // đồng bộ với title ngắn
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          equippedTitle: titleMeta.name,
          title: titleMeta.name,
        },
      }
    );

    // Phát socket realtime cập nhật danh hiệu nếu socket đang chạy
    try {
      const io = getIo();
      if (io) {
        io.emit("user:title-updated", {
          userId: String(user._id),
          equippedTitle: user.equippedTitle,
          title: user.title,
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Đã trang bị danh hiệu "${titleMeta.name}" thành công!`,
      data: {
        equippedTitle: user.equippedTitle,
        titleId,
      },
    });
  } catch (error) {
    console.error("[Title] equipTitle error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi trang bị danh hiệu.",
    });
  }
};

module.exports = {
  getTitles,
  equipTitle,
  autoUnlockTitles,
};
