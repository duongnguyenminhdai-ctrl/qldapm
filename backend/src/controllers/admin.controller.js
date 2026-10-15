const User = require("../models/User");
const Room = require("../models/Room");
const Transaction = require("../models/Transaction");
const ServicePackage = require("../models/ServicePackage");
const bcrypt = require("bcryptjs");

/* ==========================================================================
 * 1. TỔNG QUAN & BÁO CÁO THỐNG KÊ (Overview & Analytics)
 * GET /api/admin/stats
 * ========================================================================== */
const getDashboardStats = async (req, res, next) => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisWeek,
      proUsersCount,
      activeRooms,
      revenueResult,
      successTxCount,
      recentTransactions,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
      User.countDocuments({ isPro: true }),
      Room.countDocuments({ isActive: true }),
      Transaction.aggregate([
        { $match: { status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.countDocuments({ status: "SUCCESS" }),
      Transaction.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("userId", "name email avatar"),
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        newUsersThisWeek,
        proUsersCount,
        activeRooms,
        totalRevenue,
        successTransactions: successTxCount,
        recentTransactions,
      },
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
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

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
    user.status = user.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    await user.save();

    return res.status(200).json({
      success: true,
      message:
        user.status === "BLOCKED"
          ? "Đã khóa tài khoản thành công."
          : "Đã mở khóa tài khoản thành công.",
      data: {
        status: user.status,
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
 * 4. QUẢN LÝ TÀI KHOẢN ADMIN (Admin Team Management)
 * ========================================================================== */

/**
 * GET /api/admin/admins
 */
const getAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: "ADMIN" })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        admins,
      },
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

module.exports = {
  getDashboardStats,
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
};
