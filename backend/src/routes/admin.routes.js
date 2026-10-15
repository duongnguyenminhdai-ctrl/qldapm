const express = require("express");
const { protect, requireAdmin } = require("../middlewares/authMiddleware");
const {
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
} = require("../controllers/admin.controller");

const router = express.Router();

// Tất cả route admin đều yêu cầu đã đăng nhập (protect) và có role ADMIN (requireAdmin)
router.use(protect, requireAdmin);

// 1. Thống kê tổng quan
router.get("/stats", getDashboardStats);

// 2. Quản lý người dùng
router.get("/users", getUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// 3. Quản lý gói dịch vụ VIP/Pro
router.get("/services", getServicePackages);
router.post("/services", createServicePackage);
router.put("/services/:id", updateServicePackage);
router.delete("/services/:id", deleteServicePackage);

// 4. Quản lý tài khoản Admin
router.get("/admins", getAdmins);
router.post("/admins", createAdmin);
router.put("/admins/:id/password", changeAdminPassword);

module.exports = router;
