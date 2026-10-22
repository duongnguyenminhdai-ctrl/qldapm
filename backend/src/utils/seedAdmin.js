const User = require("../models/User");
const ServicePackage = require("../models/ServicePackage");

/**
 * Khởi tạo tài khoản Super Admin và các Gói dịch vụ mặc định nếu chưa tồn tại trong cơ sở dữ liệu.
 */
async function seedSuperAdmin() {
  try {
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@studyroom.vn";
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123";

    if (!process.env.DEFAULT_ADMIN_PASSWORD) {
      console.warn(
        "⚠️ [CẢNH BÁO BẢO MẬT] DEFAULT_ADMIN_PASSWORD chưa được cấu hình trong .env! Đang sử dụng mật khẩu mặc định (Admin@123). Hãy đổi ngay trên môi trường Production!"
      );
    }

    // 1. Kiểm tra tài khoản Admin
    const existingAdmin = await User.findOne({
      $or: [{ email: adminEmail.toLowerCase() }, { role: "ADMIN" }],
    });

    if (!existingAdmin) {
      await User.create({
        name: "Quản trị viên Hệ thống",
        email: adminEmail.toLowerCase(),
        password: adminPassword,
        role: "ADMIN",
        status: "ACTIVE",
        title: "Đại tướng",
        equippedTitle: "Đại tướng",
        isPro: true,
        streak: 1,
        unlockedTitleIds: ["nhap-mon-hoc-gia", "thieu-uy", "dai-tuong"],
      });
      console.log(`[Seed] Đã tạo tài khoản Super Admin mặc định: ${adminEmail}`);
    } else {
      // Đảm bảo admin hiện có có role là ADMIN và status ACTIVE, xóa bỏ streak 99 gán cứng cũ
      let changed = false;
      if (existingAdmin.role !== "ADMIN" || existingAdmin.status !== "ACTIVE") {
        existingAdmin.role = "ADMIN";
        existingAdmin.status = "ACTIVE";
        changed = true;
      }
      if (existingAdmin.streak === 99) {
        existingAdmin.streak = 1;
        changed = true;
      }
      if (changed) {
        await existingAdmin.save();
      }
    }

    // 2. Khởi tạo các gói dịch vụ Pro/VIP mặc định nếu chưa có
    const packageCount = await ServicePackage.countDocuments();
    if (packageCount === 0) {
      const defaultPackages = [
        {
          name: "Gói Pro 1 Tháng",
          code: "PRO_1M",
          description: "Mở khóa trọn bộ tính năng VIP trong 30 ngày.",
          amount: 99000,
          days: 30,
          features: [
            "Chép lời cuộc họp (Live Transcription)",
            "Huy hiệu VIP trong phòng học",
            "Mở khóa danh hiệu VIP trên hồ sơ",
            "Không giới hạn kết nối LiveKit",
          ],
          isActive: true,
          isPopular: false,
          order: 1,
        },
        {
          name: "Gói Pro 3 Tháng (Tiết kiệm 15%)",
          code: "PRO_3M",
          description: "Gói phổ biến nhất dành cho học kỳ ôn thi.",
          amount: 249000,
          days: 90,
          features: [
            "Tất cả quyền lợi của gói Pro 1 Tháng",
            "Tiết kiệm 15% so với mua từng tháng",
            "Ưu tiên kết nối máy chủ đường truyền cao",
            "Hỗ trợ kỹ thuật 24/7",
          ],
          isActive: true,
          isPopular: true,
          order: 2,
        },
        {
          name: "Gói Pro 1 Năm (Siêu ưu đãi)",
          code: "PRO_1Y",
          description: "Đồng hành học tập cả năm không gián đoạn.",
          amount: 899000,
          days: 365,
          features: [
            "Tất cả quyền lợi của gói Pro 3 Tháng",
            "Tiết kiệm hơn 25% chi phí",
            "Bộ sưu tập danh hiệu học giả đặc quyền",
            "Huy hiệu Vương miện vàng VIP",
          ],
          isActive: true,
          isPopular: false,
          order: 3,
        },
      ];

      await ServicePackage.insertMany(defaultPackages);
      console.log("[Seed] Đã tạo các Gói dịch vụ VIP/Pro mặc định.");
    }
  } catch (error) {
    console.error("[Seed] Lỗi khởi tạo Super Admin:", error.message);
  }
}

module.exports = seedSuperAdmin;
