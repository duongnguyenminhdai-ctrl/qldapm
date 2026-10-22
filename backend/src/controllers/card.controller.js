const User = require("../models/User");
const { createAndSendNotification } = require("../services/notification.service");
const { getIo } = require("../config/socketInstance");
const { SCHOLAR_CARDS_MAP } = require("../constants/cardsData");

/**
 * GET /api/cards/my-cards & GET /api/cards/inventory
 * Lấy thông tin lượt mở thẻ và kho thẻ bài của người dùng hiện tại
 */
exports.getMyCards = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa xác thực người dùng. Vui lòng đăng nhập lại.",
      });
    }

    const user = await User.findById(userId).select(
      "cardDraws dailyStudyMinutes lastCardRewardDate cardInventory isPro proExpiresAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    const cardData = {
      cardDraws: user.cardDraws || 0,
      dailyStudyMinutes: user.dailyStudyMinutes || 0,
      lastCardRewardDate: user.lastCardRewardDate || null,
      cardInventory: user.cardInventory || [],
      isPro: user.isPro || false,
      isVip: user.isPro || false,
      proExpiresAt: user.proExpiresAt || null,
      vipExpiresAt: user.proExpiresAt || null,
    };

    res.json({
      success: true,
      ...cardData,
      data: cardData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/cards/draw
 * Mở 1 lá bài ngẫu nhiên từ 1 đến 7
 * Bảo vệ chống Race Condition bằng truy vấn nguyên tử (Atomic findOneAndUpdate)
 */
exports.drawCard = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa xác thực người dùng. Vui lòng đăng nhập lại.",
      });
    }

    // Atomic update: Chỉ trừ lượt khi cardDraws > 0 (chống spam request đồng thời)
    const user = await User.findOneAndUpdate(
      { _id: userId, cardDraws: { $gt: 0 } },
      { $inc: { cardDraws: -1 } },
      { new: true }
    );

    if (!user) {
      const existingUser = await User.findById(userId);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy người dùng.",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Bạn đã hết lượt mở thẻ bài. Hãy tích lũy 3 giờ học trong ngày để nhận thêm lượt mở!",
      });
    }

    // Thuật toán Random phân phối đều lá bài từ 1 đến 7
    const drawnCardId = Math.floor(Math.random() * 7) + 1;

    // Cập nhật kho thẻ bài (cardInventory) hoàn toàn nguyên tử trên MongoDB (không gọi user.save() tránh Lost Update race condition)
    let updatedUser = await User.findOneAndUpdate(
      { _id: userId, "cardInventory.cardId": drawnCardId },
      { $inc: { "cardInventory.$.count": 1 } },
      { new: true }
    );

    if (!updatedUser) {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { $push: { cardInventory: { cardId: drawnCardId, count: 1 } } },
        { new: true }
      );
    }

    const currentInventory = (updatedUser?.cardInventory || []).sort(
      (a, b) => Number(a.cardId) - Number(b.cardId)
    );
    const finalDraws = typeof updatedUser?.cardDraws === "number" ? updatedUser.cardDraws : user.cardDraws;

    // Phát socket realtime cập nhật kho thẻ và số lượt mở
    const io = getIo();
    if (io) {
      io.to(`user:${userId}`).emit("card:updated", {
        cardDraws: finalDraws,
        cardInventory: currentInventory,
        lastDrawnCardId: drawnCardId,
      });
      io.to(`user:${userId}`).emit("user:updated", {
        cardDraws: finalDraws,
        cardInventory: currentInventory,
      });
    }

    const cardInfo = SCHOLAR_CARDS_MAP[drawnCardId] || null;

    const responsePayload = {
      cardId: drawnCardId,
      card: cardInfo,
      cardDraws: finalDraws,
      cardInventory: currentInventory,
    };

    res.json({
      success: true,
      ...responsePayload,
      data: responsePayload,
      message: cardInfo
        ? `Chúc mừng bạn đã nhận được lá bài ${cardInfo.name}! [${cardInfo.rarity}]`
        : `Chúc mừng bạn đã nhận được Thẻ Bài Học Giả #${drawnCardId}!`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/cards/exchange-vip
 * Đổi trọn bộ 7 lá bài (từ 1 đến 7) lấy 1 tháng (30 ngày) VIP
 * Bảo vệ chống Race Condition bằng Optimistic Concurrency Control (__v)
 */
exports.exchangeVip = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa xác thực người dùng.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    const inventory = Array.isArray(user.cardInventory) ? user.cardInventory : [];
    const missingCards = [];

    // Kiểm tra tính đủ 7 lá khác nhau từ 1 đến 7 với count >= 1
    for (let id = 1; id <= 7; id++) {
      const item = inventory.find((c) => Number(c.cardId) === id);
      if (!item || (Number(item.count) || 0) < 1) {
        missingCards.push(id);
      }
    }

    if (missingCards.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bạn chưa sở hữu đủ cả 7 lá bài khác nhau. Đang thiếu lá: ${missingCards.map((c) => `#${c}`).join(", ")}.`,
        missingCards,
      });
    }

    // Trừ đúng 1 đơn vị của mỗi lá từ 1 đến 7 (không trừ nhầm lá khác hoặc trừ âm)
    const updatedInventory = inventory.map((item) => {
      const cId = Number(item.cardId);
      if (cId >= 1 && cId <= 7) {
        return {
          cardId: cId,
          count: Math.max(0, (Number(item.count) || 0) - 1),
        };
      }
      return item;
    });

    // Tính ngày hết hạn VIP: nếu còn VIP thì cộng nối tiếp 30 ngày, nếu hết/chưa có thì lấy now + 30 ngày
    const now = new Date();
    const baseDate =
      user.isPro && user.proExpiresAt && new Date(user.proExpiresAt) > now
        ? new Date(user.proExpiresAt)
        : now;
    const newProExpiresAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Atomic update với Concurrency Control để chặn request đồng thời
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        __v: user.__v,
      },
      {
        $set: {
          cardInventory: updatedInventory,
          isPro: true,
          proExpiresAt: newProExpiresAt,
        },
        $inc: {
          proMonths: 1,
          __v: 1,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(409).json({
        success: false,
        message: "Yêu cầu đổi VIP đang được xử lý đồng thời. Vui lòng thử lại sau.",
      });
    }

    // Tạo thông báo hệ thống và gửi realtime
    await createAndSendNotification({
      recipientId: updatedUser._id,
      type: "CARD_REWARD",
      title: "Đổi VIP Thành Công!",
      message: "Chúc mừng! Bạn đã đổi trọn bộ 7 Thẻ Bài Học Giả lấy 30 ngày VIP thành công.",
      link: "/profile",
    });

    const io = getIo();
    const vipUpdatePayload = {
      cardDraws: updatedUser.cardDraws,
      cardInventory: updatedUser.cardInventory,
      isPro: updatedUser.isPro,
      isVip: updatedUser.isPro,
      proExpiresAt: updatedUser.proExpiresAt,
      vipExpiresAt: updatedUser.proExpiresAt,
    };

    if (io) {
      io.to(`user:${updatedUser._id}`).emit("card:updated", vipUpdatePayload);
      io.to(`user:${updatedUser._id}`).emit("user:pro-updated", {
        isPro: updatedUser.isPro,
        isVip: updatedUser.isPro,
        proExpiresAt: updatedUser.proExpiresAt,
        vipExpiresAt: updatedUser.proExpiresAt,
      });
      io.to(`user:${updatedUser._id}`).emit("user:updated", vipUpdatePayload);
    }

    res.json({
      success: true,
      message: "Chúc mừng! Bạn đã đổi thành công 7 lá bài lấy 1 tháng VIP.",
      ...vipUpdatePayload,
      data: vipUpdatePayload,
    });
  } catch (error) {
    next(error);
  }
};
