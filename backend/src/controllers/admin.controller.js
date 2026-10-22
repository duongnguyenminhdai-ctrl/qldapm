const User = require("../models/User");
const Room = require("../models/Room");
const Transaction = require("../models/Transaction");
const ServicePackage = require("../models/ServicePackage");
const bcrypt = require("bcryptjs");
const { getIo } = require("../config/socketInstance");
const { invalidateUserStatusCache } = require("../middlewares/authMiddleware");

/**
 * Tự động xóa vĩnh viễn khỏi MongoDB các đơn hết hạn:
 * - Các đơn 'PENDING'/'pending' quá 15 phút không thanh toán
 * - Các đơn có trạng thái 'EXPIRED'/'expired'
 */
async function cleanupExpiredPendingTransactions() {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const result = await Transaction.deleteMany({
      $or: [
        {
          status: { $in: ["EXPIRED", "expired", "PENDING", "pending"] },
          createdAt: { $lt: fifteenMinutesAgo },
        },
        {
          status: { $in: ["EXPIRED", "expired"] },
        },
      ],
    });
    if (result.deletedCount > 0) {
      console.log(
        `[Admin] Đã tự động xóa vĩnh viễn ${result.deletedCount} đơn VNPay hết hạn khỏi DB.`
      );
    }
  } catch (err) {
    console.warn("[Admin] Lỗi xóa dọn dẹp đơn hàng hết hạn:", err.message);
  }
}

/**
 * Tính toán mốc thời gian bắt đầu tuần, tháng, năm theo múi giờ Việt Nam (GMT+7)
 */
function getVietnamDateBounds() {
  const now = new Date();
  const vnOffset = 7 * 60; // phút (+7)
  const vnNow = new Date(now.getTime() + (vnOffset + now.getTimezoneOffset()) * 60000);

  const year = vnNow.getFullYear();
  const month = vnNow.getMonth(); // 0-11
  const date = vnNow.getDate();
  const day = vnNow.getDay(); // 0 (Sun) - 6 (Sat)

  // 1. Year start (01/01 00:00:00 VN)
  const yearStart = new Date(Date.UTC(year, 0, 1) - 7 * 3600 * 1000);

  // 2. Month start (Ngày 1 của tháng 00:00:00 VN)
  const monthStart = new Date(Date.UTC(year, month, 1) - 7 * 3600 * 1000);

  // 3. Week start (Thứ Hai 00:00:00 VN của tuần hiện tại)
  const daysToMonday = (day + 6) % 7;
  const mondayDate = date - daysToMonday;
  const weekStart = new Date(Date.UTC(year, month, mondayDate) - 7 * 3600 * 1000);

  return { weekStart, monthStart, yearStart };
}

/* ==========================================================================
 * 1. TỔNG QUAN & BÁO CÁO THỐNG KÊ (Overview & Analytics)
 * GET /api/admin/stats
 * ========================================================================== */
const getDashboardStats = async (req, res, next) => {
  try {
    // 1. Quét và dọn các đơn PENDING quá hạn 15 phút
    await cleanupExpiredPendingTransactions();

    const { revenueRange = "all" } = req.query; // 'week' | 'month' | 'year' | 'all'
    const { weekStart, monthStart, yearStart } = getVietnamDateBounds();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisWeek,
      proUsersCount,
      activeRooms,
      revAllRes,
      revYearRes,
      revMonthRes,
      revWeekRes,
      recentTransactions,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
      User.countDocuments({ isPro: true }),
      Room.countDocuments({ isActive: true }),
      Transaction.aggregate([
        { $match: { status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { status: "SUCCESS", createdAt: { $gte: yearStart } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { status: "SUCCESS", createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { status: "SUCCESS", createdAt: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transaction.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("userId", "name email avatar"),
    ]);

    const revenueByRange = {
      all: { total: revAllRes[0]?.total || 0, count: revAllRes[0]?.count || 0 },
      year: { total: revYearRes[0]?.total || 0, count: revYearRes[0]?.count || 0 },
      month: { total: revMonthRes[0]?.total || 0, count: revMonthRes[0]?.count || 0 },
      week: { total: revWeekRes[0]?.total || 0, count: revWeekRes[0]?.count || 0 },
    };

    const selectedRangeData = revenueByRange[revenueRange] || revenueByRange.all;

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        newUsersThisWeek,
        proUsersCount,
        activeRooms,
        totalRevenue: selectedRangeData.total,
        successTransactions: selectedRangeData.count,
        revenueRange,
        revenueByRange,
        recentTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================================================================
 * 1.1 QUẢN LÝ GIAO DỊCH VNPAY (VNPay Transactions Management)
 * GET /api/admin/transactions
 * Hỗ trợ phân trang (?page&limit), tìm kiếm (mã đơn/tên/email), lọc trạng thái, sắp xếp.
 * ========================================================================== */
const getTransactions = async (req, res, next) => {
  try {
    // 1. Quét dọn các đơn PENDING quá hạn 15 phút
    await cleanupExpiredPendingTransactions();

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { search, status, sort } = req.query;
    const filter = {};

    // Tìm kiếm theo Mã đơn hàng, Tên hoặc Email người dùng
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchedUsers = await User.find({
        $or: [
          { name: { $regex: escaped, $options: "i" } },
          { email: { $regex: escaped, $options: "i" } },
        ],
      }).select("_id");
      const matchedUserIds = matchedUsers.map((u) => u._id);

      filter.$or = [
        { orderId: { $regex: escaped, $options: "i" } },
        { userId: { $in: matchedUserIds } },
      ];
    }

    // Lọc theo Trạng thái giao dịch (bảng chỉ hiển thị đơn hợp lệ: thành công hoặc chờ thanh toán còn hạn)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (status && status !== "ALL") {
      const upper = status.toUpperCase();
      if (upper === "PENDING") {
        filter.status = "PENDING";
        filter.createdAt = { $gte: fifteenMinutesAgo };
      } else if (["SUCCESS", "FAILED", "CANCELLED"].includes(upper)) {
        filter.status = upper;
      } else if (upper === "EXPIRED") {
        filter.status = "__NONE__";
      }
    } else {
      filter.status = { $nin: ["EXPIRED", "expired"] };
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { status: { $ne: "PENDING" } },
          { status: "PENDING", createdAt: { $gte: fifteenMinutesAgo } },
        ],
      });
    }

    // Sắp xếp
    let sortObj = { createdAt: -1 };
    if (sort === "oldest") {
      sortObj = { createdAt: 1 };
    } else if (sort === "amount_desc") {
      sortObj = { amount: -1, createdAt: -1 };
    } else if (sort === "amount_asc") {
      sortObj = { amount: 1, createdAt: -1 };
    } else {
      sortObj = { createdAt: -1 };
    }

    const [totalItems, transactions] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email avatar"),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    const paginationMeta = {
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: paginationMeta,
      },
      pagination: paginationMeta,
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================================================================
 * 2. QUẢN LÝ NGƯỜI DÙNG (User Management)
 * ========================================================================== */

/**
 * GET /api/admin/users
 * Hỗ trợ phân trang (?page&limit), tìm kiếm (tên/email), lọc (role/status/isPro), sắp xếp.
 */
const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { search, role, status, isPro, sort } = req.query;
    const filter = {};

    // Tìm kiếm theo tên hoặc email
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }

    // Lọc theo Role (hỗ trợ cả các tài khoản cũ chưa gán trường role mặc định)
    if (role && role !== "ALL" && ["USER", "ADMIN"].includes(role.toUpperCase())) {
      const targetRole = role.toUpperCase();
      if (targetRole === "USER") {
        filter.role = { $in: ["USER", null, ""] };
      } else {
        filter.role = targetRole;
      }
    }

    // Lọc theo Status (hỗ trợ cả các tài khoản cũ chưa gán trường status mặc định)
    if (status && status !== "ALL" && ["ACTIVE", "BLOCKED"].includes(status.toUpperCase())) {
      const targetStatus = status.toUpperCase();
      if (targetStatus === "ACTIVE") {
        filter.status = { $in: ["ACTIVE", null, ""] };
      } else {
        filter.status = targetStatus;
      }
    }

    // Lọc theo gói Pro
    if (isPro !== undefined && isPro !== "ALL") {
      filter.isPro = isPro === "true" || isPro === true;
    }

    // Sắp xếp
    let sortObj = { createdAt: -1 };
    if (sort === "createdAt_asc") sortObj = { createdAt: 1 };
    else if (sort === "name_asc") sortObj = { name: 1 };
    else if (sort === "streak_desc") sortObj = { streak: -1 };

    const [totalItems, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("-password")
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    const paginationMeta = {
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: paginationMeta,
      },
      pagination: paginationMeta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xử lý nghiệp vụ khi Admin Khóa tài khoản người dùng:
 * 1. Xóa cache trạng thái user
 * 2. Bắn sự kiện socket real-time 'account_banned' & 'account:banned' đến các phòng của user
 * 3. Nếu user đang trong phòng học (Room), phát thông báo bị kick và gỡ khỏi danh sách participants
 * 4. Báo trạng thái offline tới bạn bè
 * 5. Ngắt toàn bộ kết nối socket của user sau 1.5s
 */
const handleAccountBannedRealtime = async (user, reason) => {
  try {
    invalidateUserStatusCache(user._id);

    const io = getIo();
    if (!io) return;

    const defaultReason =
      "Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng hoặc theo quyết định của Quản trị viên.";
    const finalReason =
      (reason && String(reason).trim()) || user.banReason || defaultReason;

    const banPayload = {
      userId: String(user._id),
      name: user.name,
      email: user.email,
      reason: finalReason,
      bannedAt: new Date().toISOString(),
    };

    // 1. Gửi sự kiện account_banned và account:banned tới mọi room socket cá nhân của user
    io.to(`user:${user._id}`).emit("account_banned", banPayload);
    io.to(`user:${user._id}`).emit("account:banned", banPayload);
    io.to(`user_${user._id}`).emit("account_banned", banPayload);
    io.to(String(user._id)).emit("account_banned", banPayload);

    // 2. Báo bạn bè trạng thái offline
    io.emit("friend:status-change", {
      userId: String(user._id),
      isOnline: false,
      lastSeen: new Date(),
    });

    // 3. Nếu đang trong phòng học -> đuổi khỏi phòng học
    try {
      const activeRooms = await Room.find({
        "participants.userId": user._id,
        isActive: true,
      });
      for (const r of activeRooms) {
        io.to(r.roomCode).emit("room:user-kicked", {
          roomCode: r.roomCode,
          targetUserId: String(user._id),
          targetName: user.name,
          reason: "Tài khoản của bạn đã bị khóa bởi Quản trị viên.",
          hostName: "Hệ thống",
        });
        await Room.updateOne(
          { _id: r._id },
          { $pull: { participants: { userId: user._id } } }
        );
        const updatedRoom = await Room.findById(r._id).populate(
          "participants.userId",
          "name avatar"
        );
        if (updatedRoom) {
          io.to(r.roomCode).emit("room:participants-updated", {
            roomCode: r.roomCode,
            participants: updatedRoom.participants,
          });
        }
      }
    } catch (roomErr) {
      console.warn("[Admin] Lỗi đuổi người dùng bị khóa khỏi phòng:", roomErr.message);
    }

    // 4. Ngắt kết nối socket của user sau 1.5 giây để client kịp nhận event
    setTimeout(() => {
      try {
        const userRoom = io.sockets.adapter.rooms.get(`user:${user._id}`);
        if (userRoom) {
          for (const socketId of userRoom) {
            const s = io.sockets.sockets.get(socketId);
            if (s) {
              s.disconnect(true);
            }
          }
        }
      } catch (e) {
        console.warn("[Admin] Lỗi ngắt kết nối socket của tài khoản bị khóa:", e.message);
      }
    }, 1500);
  } catch (err) {
    console.error("[Admin] Lỗi xử lý socket account_banned:", err.message);
  }
};

/**
 * PUT /api/admin/users/:id
 * Cập nhật thông tin, thay đổi role, đổi trạng thái ACTIVE/BLOCKED.
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    // Không cho phép tự khóa hoặc tự giáng cấp tài khoản Super Admin đang thao tác nếu chỉ còn 1 admin
    const currentAdminId = req.user.id;
    if (String(currentAdminId) === String(user._id)) {
      if (req.body.status === "BLOCKED") {
        return res.status(400).json({
          success: false,
          message: "Bạn không thể tự khóa tài khoản quản trị của chính mình.",
        });
      }
      if (req.body.role === "USER") {
        return res.status(400).json({
          success: false,
          message: "Bạn không thể tự giáng quyền tài khoản quản trị của chính mình.",
        });
      }
    }

    const isNowBlocked = req.body.status === "BLOCKED";

    const updatableFields = [
      "name",
      "role",
      "status",
      "isPro",
      "proExpiresAt",
      "title",
      "equippedTitle",
      "birthYear",
      "phone",
      "school",
      "bio",
      "streak",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "streak") {
          user.streak = Math.max(0, parseInt(req.body.streak, 10) || 0);
        } else {
          user[field] = req.body[field];
        }
      }
    });

    if (isNowBlocked) {
      user.isBanned = true;
      if (req.body.reason) {
        user.banReason = req.body.reason;
      }
    } else if (req.body.status === "ACTIVE") {
      user.isBanned = false;
      user.banReason = "";
    }

    await user.save();

    invalidateUserStatusCache(user._id);

    if (isNowBlocked) {
      await handleAccountBannedRealtime(user, req.body.reason);
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin người dùng thành công.",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/users/:id
 * Khóa tài khoản (soft delete: set status = 'BLOCKED').
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    if (String(req.user.id) === String(user._id)) {
      return res.status(400).json({
        success: false,
        message: "Bạn không thể tự khóa tài khoản của chính mình.",
      });
    }

    // Toggle hoặc gán BLOCKED
    const isLocking = user.status !== "BLOCKED";
    user.status = isLocking ? "BLOCKED" : "ACTIVE";
    user.isBanned = isLocking;
    if (isLocking) {
      user.banReason =
        req.body?.reason ||
        req.query?.reason ||
        "Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng hoặc theo quyết định của Quản trị viên.";
    } else {
      user.banReason = "";
    }
    await user.save();

    invalidateUserStatusCache(user._id);

    if (isLocking) {
      await handleAccountBannedRealtime(user, user.banReason);
    }

    return res.status(200).json({
      success: true,
      message:
        user.status === "BLOCKED"
          ? "Đã khóa tài khoản thành công."
          : "Đã mở khóa tài khoản thành công.",
      data: {
        status: user.status,
        isBanned: user.isBanned,
        banReason: user.banReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================================================================
 * 3. QUẢN LÝ GÓI DỊCH VỤ VIP/PRO (Service Packages)
 * ========================================================================== */

/**
 * GET /api/admin/services
 */
const getServicePackages = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;
    const filter = {};

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { code: { $regex: escaped, $options: "i" } },
      ];
    }

    if (isActive !== undefined && isActive !== "ALL") {
      filter.isActive = isActive === "true" || isActive === true;
    }

    const packages = await ServicePackage.find(filter).sort({ order: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        packages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/services
 */
const createServicePackage = async (req, res, next) => {
  try {
    const { name, code, description, amount, days, features, isActive, isPopular, order } =
      req.body;

    if (!name || !code || amount === undefined || days === undefined) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ tên gói, mã gói, giá tiền và thời hạn ngày.",
      });
    }

    const formattedCode = code.trim().toUpperCase();
    const existing = await ServicePackage.findOne({ code: formattedCode });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Mã gói dịch vụ này đã tồn tại.",
      });
    }

    const newPackage = await ServicePackage.create({
      name: name.trim(),
      code: formattedCode,
      description: description ? description.trim() : "",
      amount: Number(amount),
      days: Number(days),
      features: Array.isArray(features) ? features : [],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      isPopular: Boolean(isPopular),
      order: order !== undefined ? Number(order) : 0,
    });

    return res.status(201).json({
      success: true,
      message: "Thêm mới gói dịch vụ thành công.",
      data: {
        package: newPackage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/services/:id
 */
const updateServicePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pkg = await ServicePackage.findById(id);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gói dịch vụ.",
      });
    }

    const { name, code, description, amount, days, features, isActive, isPopular, order } =
      req.body;

    if (code && code.trim().toUpperCase() !== pkg.code) {
      const formattedCode = code.trim().toUpperCase();
      const existing = await ServicePackage.findOne({
        code: formattedCode,
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Mã gói dịch vụ này đã trùng với gói khác.",
        });
      }
      pkg.code = formattedCode;
    }

    if (name !== undefined) pkg.name = name.trim();
    if (description !== undefined) pkg.description = description.trim();
    if (amount !== undefined) pkg.amount = Number(amount);
    if (days !== undefined) pkg.days = Number(days);
    if (features !== undefined) pkg.features = Array.isArray(features) ? features : [];
    if (isActive !== undefined) pkg.isActive = Boolean(isActive);
    if (isPopular !== undefined) pkg.isPopular = Boolean(isPopular);
    if (order !== undefined) pkg.order = Number(order);

    await pkg.save();

    return res.status(200).json({
      success: true,
      message: "Cập nhật gói dịch vụ thành công.",
      data: {
        package: pkg,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/services/:id
 */
const deleteServicePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pkg = await ServicePackage.findById(id);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy gói dịch vụ.",
      });
    }

    await ServicePackage.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Đã xóa gói dịch vụ thành công.",
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================================================================
 * 2.1 QUẢN LÝ PHÒNG HỌC (Admin Rooms Management)
 * GET /api/admin/rooms
 * ========================================================================== */
const getAdminRooms = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { search, category } = req.query;

    // Điều kiện query: Trả về đúng các phòng có status 'active' và có người tham gia (participants.length > 0)
    const baseActiveFilter = {
      status: "active",
      isActive: true,
      "participants.0": { $exists: true },
    };

    const filter = { ...baseActiveFilter };

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchedHosts = await User.find({
        $or: [
          { name: { $regex: escaped, $options: "i" } },
          { email: { $regex: escaped, $options: "i" } },
        ],
      }).select("_id");
      const matchedHostIds = matchedHosts.map((h) => h._id);

      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { roomCode: { $regex: `^${escaped}`, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { hostId: { $in: matchedHostIds } },
      ];
    }

    if (category && category !== "all") {
      filter.category = category.trim().toLowerCase();
    }

    // Thống kê toàn hệ thống đồng bộ vào 3 card:
    // 1. Phòng đang mở (totalActiveRooms)
    // 2. Học viên trong phòng (totalMembersOnline)
    // 3. Phòng công khai (publicRoomsCount)
    const allActiveRooms = await Room.find(baseActiveFilter).select("participants isPrivate");
    const totalActiveRooms = allActiveRooms.length;
    const totalMembersOnline = allActiveRooms.reduce(
      (sum, r) => sum + (Array.isArray(r.participants) ? r.participants.length : 0),
      0
    );
    const publicRoomsCount = allActiveRooms.filter((r) => !r.isPrivate).length;

    const [totalItems, rawRooms] = await Promise.all([
      Room.countDocuments(filter),
      Room.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("hostId", "name email avatar isPro title equippedTitle")
        .populate("participants.userId", "name email avatar isPro title equippedTitle"),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    const paginationMeta = {
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    // Chuẩn hóa danh sách phòng
    const rooms = rawRooms.map((r) => {
      const rObj = r.toObject ? r.toObject() : { ...r };
      rObj.participantCount = Array.isArray(rObj.participants) ? rObj.participants.length : 0;
      return rObj;
    });

    return res.status(200).json({
      success: true,
      data: {
        rooms,
        stats: {
          totalActiveRooms,
          totalMembersOnline,
          publicRoomsCount,
        },
        pagination: paginationMeta,
      },
      pagination: paginationMeta,
    });
  } catch (error) {
    next(error);
  }
};

/* ==========================================================================
 * 4. QUẢN LÝ TÀI KHOẢN ADMIN (Admin Team Management)
 * ========================================================================== */

/**
 * GET /api/admin/admins
 * Hỗ trợ phân trang 10 item/trang đồng bộ
 */
const getAdmins = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { role: "ADMIN" };
    const [totalItems, admins] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    const paginationMeta = {
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return res.status(200).json({
      success: true,
      data: {
        admins,
        pagination: paginationMeta,
      },
      pagination: paginationMeta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/admins
 */
const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu khởi tạo.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự.",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email này đã được sử dụng bởi một tài khoản khác.",
      });
    }

    const newAdmin = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: "ADMIN",
      status: "ACTIVE",
      title: "Đại tướng",
      equippedTitle: "Đại tướng",
      isPro: true,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo tài khoản Quản trị viên mới thành công.",
      data: {
        admin: {
          id: newAdmin._id,
          name: newAdmin.name,
          email: newAdmin.email,
          role: newAdmin.role,
          status: newAdmin.status,
          createdAt: newAdmin.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/admins/:id/password
 */
const changeAdminPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có tối thiểu 6 ký tự.",
      });
    }

    const adminUser = await User.findOne({ _id: id, role: "ADMIN" }).select("+password");

    if (!adminUser) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản quản trị viên.",
      });
    }

    adminUser.password = newPassword;
    await adminUser.save();

    return res.status(200).json({
      success: true,
      message: `Đã đổi mật khẩu cho quản trị viên ${adminUser.name} thành công.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/gift-cards
 * Quản trị viên tặng lượt mở thẻ hoặc tặng thẻ bài cho người dùng
 */
const giftCards = async (req, res, next) => {
  try {
    const { userId, draws, cardId, count, fullSet } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu userId của người nhận.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    if (!Array.isArray(user.cardInventory)) {
      user.cardInventory = [];
    }

    const summaryMsg = [];

    // 1. Tặng lượt mở thẻ (cardDraws)
    if (draws !== undefined && draws !== null && !isNaN(draws) && Number(draws) > 0) {
      const addedDraws = Number(draws);
      user.cardDraws = (user.cardDraws || 0) + addedDraws;
      summaryMsg.push(`+${addedDraws} lượt mở thẻ`);
    }

    // 2. Tặng trọn bộ 7 lá bài (mỗi lá +count hoặc +1)
    if (fullSet) {
      const addCount = Number(count) > 0 ? Number(count) : 1;
      for (let id = 1; id <= 7; id++) {
        const item = user.cardInventory.find((c) => Number(c.cardId) === id);
        if (item) {
          item.count = (Number(item.count) || 0) + addCount;
        } else {
          user.cardInventory.push({ cardId: id, count: addCount });
        }
      }
      summaryMsg.push(`+${addCount} trọn bộ 7 lá bài (1-7)`);
    } else if (cardId && Number(cardId) >= 1 && Number(cardId) <= 7) {
      // 3. Tặng 1 lá cụ thể
      const targetId = Number(cardId);
      const addCount = Number(count) > 0 ? Number(count) : 1;
      const item = user.cardInventory.find((c) => Number(c.cardId) === targetId);
      if (item) {
        item.count = (Number(item.count) || 0) + addCount;
      } else {
        user.cardInventory.push({ cardId: targetId, count: addCount });
      }
      summaryMsg.push(`+${addCount} lá bài #${targetId}`);
    }

    user.cardInventory.sort((a, b) => Number(a.cardId) - Number(b.cardId));
    user.markModified("cardInventory");
    await user.save();

    const finalMsg = summaryMsg.length > 0 ? summaryMsg.join(", ") : "Cập nhật thành công";

    // Gửi thông báo đến user
    const { createAndSendNotification } = require("../services/notification.service");
    await createAndSendNotification({
      recipientId: user._id,
      type: "CARD_REWARD",
      title: "Quà Tặng Thẻ Bài Từ Quản Trị Viên",
      message: `Bạn đã nhận được quà tặng từ Admin: ${finalMsg}! Mở ngay để trải nghiệm.`,
      link: "/?openCardModal=true",
    });

    const { getIo } = require("../config/socketInstance");
    const io = getIo();
    if (io) {
      io.to(`user:${user._id}`).emit("card:updated", {
        cardDraws: user.cardDraws,
        cardInventory: user.cardInventory,
      });
      io.to(`user:${user._id}`).emit("card:reward-available", {
        cardDraws: user.cardDraws,
        message: "Bạn có thể nhận card!",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Đã tặng quà cho ${user.name}: ${finalMsg}`,
      data: {
        userId: user._id,
        cardDraws: user.cardDraws,
        cardInventory: user.cardInventory,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getTransactions,
  getUsers,
  updateUser,
  deleteUser,
  getServicePackages,
  createServicePackage,
  updateServicePackage,
  deleteServicePackage,
  getAdmins,
  createAdmin,
  changeAdminPassword,
  getAdminRooms,
  giftCards,
};
