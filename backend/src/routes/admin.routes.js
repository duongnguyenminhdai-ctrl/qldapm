const express = require("express");
const { protect, requireAdmin } = require("../middlewares/authMiddleware");
const {
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
} = require("../controllers/admin.controller");

const router = express.Router();

// Tất cả route admin đều yêu cầu đã đăng nhập (protect) và có role ADMIN (requireAdmin)
router.use(protect, requireAdmin);

// 1. Thống kê tổng quan & Giao dịch
router.get("/stats", getDashboardStats);
router.get("/transactions", getTransactions);

// 1.1 Quản lý phòng học
router.get("/rooms", getAdminRooms);

// 2. Quản lý người dùng
router.get("/users", getUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.post("/gift-cards", giftCards);

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
