const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const dns = require("dns");
const Room = require("../models/Room");
const { cleanupRoomFiles, cleanupOrphanedRoomFiles } = require("./roomCleanup");

// Đảm bảo DNS lookup hoạt động tin cậy trên môi trường Node.js Windows với MongoDB Atlas SRV
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (e) {
  console.warn("[CleanTestRooms] Không thể đặt DNS servers:", e.message);
}

/**
 * Script quét sạch các phòng học thử nghiệm (Test Rooms) và phòng "ma" (ghost rooms)
 * Các tiêu chí phòng rác cần dọn:
 * 1. Tiêu đề chứa "test", "cc", "1", ký tự ngẫu nhiên hoặc rỗng
 * 2. Phòng không có thành viên tham gia (participants: 0)
 * 3. Phòng cũ không còn hoạt động hoặc bị bỏ quên
 */
async function cleanTestRooms() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("[CleanTestRooms] LỖI: MONGO_URI không được cấu hình trong file .env");
    process.exit(1);
  }

  console.log("[CleanTestRooms] Đang kết nối tới MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("[CleanTestRooms] Kết nối MongoDB thành công.");

  try {
    // Tìm tất cả các phòng hiện có trong hệ thống
    const allRooms = await Room.find({});
    console.log(`[CleanTestRooms] Tổng số phòng hiện có trong database: ${allRooms.length}`);

    if (allRooms.length === 0) {
      console.log("[CleanTestRooms] Database hiện tại không có phòng học nào. Hoàn tất!");
      return;
    }

    const testPatterns = [/test/i, /^cc$/i, /^1$/i, /^sample/i, /^demo/i, /^abc/i];

    const roomsToDelete = allRooms.filter((r) => {
      const title = (r.title || "").trim();
      const pCount = Array.isArray(r.participants) ? r.participants.length : 0;
      const isTestTitle = testPatterns.some((pattern) => pattern.test(title)) || title.length <= 2;
      const isGhostRoom = pCount === 0;

      // Xóa nếu là tên test/rác hoặc phòng không có ai tham gia
      return isTestTitle || isGhostRoom;
    });

    console.log(`[CleanTestRooms] Tìm thấy ${roomsToDelete.length} phòng thử nghiệm / phòng rác cần xóa:`);
    for (const room of roomsToDelete) {
      const pCount = Array.isArray(room.participants) ? room.participants.length : 0;
      console.log(
        ` - Mã phòng: [${room.roomCode}] | Tiêu đề: "${room.title}" | Số người: ${pCount} | Ngày tạo: ${room.createdAt}`
      );
    }

    if (roomsToDelete.length === 0) {
      console.log("[CleanTestRooms] Không có phòng rác nào cần xóa.");
    } else {
      console.log("[CleanTestRooms] Bắt đầu dọn dẹp tài liệu Cloudinary và xóa phòng...");
      for (const room of roomsToDelete) {
        try {
          await cleanupRoomFiles(room.roomCode);
        } catch (fileErr) {
          console.warn(`[CleanTestRooms] Lỗi dọn files phòng ${room.roomCode}:`, fileErr.message);
        }

        const delRes = await Room.deleteOne({ _id: room._id });
        console.log(`[CleanTestRooms] Đã xóa phòng [${room.roomCode}] khỏi DB (deletedCount: ${delRes.deletedCount})`);
      }
    }

    // Quét sạch tài liệu mồ côi nếu còn sót
    console.log("[CleanTestRooms] Đang kiểm tra và dọn dẹp tài liệu mồ côi (orphaned files)...");
    await cleanupOrphanedRoomFiles();

    // Kiểm tra lại danh sách phòng sau khi dọn
    const remainingRooms = await Room.find({});
    console.log(`[CleanTestRooms] Hoàn tất! Số phòng học còn lại trong hệ thống: ${remainingRooms.length}`);
  } catch (error) {
    console.error("[CleanTestRooms] Đã xảy ra lỗi trong quá trình dọn dẹp:", error);
  } finally {
    await mongoose.disconnect();
    console.log("[CleanTestRooms] Đã đóng kết nối MongoDB.");
  }
}

cleanTestRooms().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
