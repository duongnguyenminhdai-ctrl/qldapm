const RoomFile = require("../models/RoomFile");
const Room = require("../models/Room");
const cloudinary = require("../config/cloudinary");

/**
 * Trích xuất publicId và resourceType từ URL Cloudinary
 */
function extractCloudinaryInfo(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/\/(image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/i);
  if (!match) return null;

  const resourceType = match[1].toLowerCase();
  let publicId = match[2];
  if (resourceType === "image") {
    publicId = publicId.replace(/\.[^/.]+$/, "");
  }
  publicId = decodeURIComponent(publicId);
  return { resourceType, publicId };
}

/**
 * Dọn dẹp toàn bộ tài liệu đã chia sẻ của một phòng học khi phòng đóng
 * Xóa cả trên Cloudinary và trong MongoDB RoomFile collection
 * @param {string} roomCode - Mã phòng học
 */
async function cleanupRoomFiles(roomCode) {
  if (!roomCode) return;
  const normalizedCode = roomCode.trim().toUpperCase();

  try {
    const files = await RoomFile.find({ roomCode: normalizedCode });
    if (!files || files.length === 0) {
      console.log(`[RoomCleanup] Không có tài liệu nào cần dọn cho phòng ${normalizedCode}`);
      return;
    }

    console.log(`[RoomCleanup] Bắt đầu dọn ${files.length} tài liệu của phòng ${normalizedCode}...`);

    for (const file of files) {
      try {
        let publicId = file.publicId;
        let resourceType = file.resourceType;

        if (!publicId && file.fileUrl) {
          const parsed = extractCloudinaryInfo(file.fileUrl);
          if (parsed) {
            publicId = parsed.publicId;
            resourceType = parsed.resourceType;
          }
        }

        if (publicId && cloudinary?.uploader) {
          const resType = resourceType || (file.fileType === "image" ? "image" : "raw");
          await cloudinary.uploader.destroy(publicId, { resource_type: resType });
          console.log(`[RoomCleanup] Đã xóa Cloudinary: ${publicId} (${resType})`);
        }
      } catch (cloudErr) {
        console.warn(`[RoomCleanup] Bỏ qua lỗi xóa Cloudinary cho file ${file.fileName}:`, cloudErr.message);
      }
    }

    // Xóa toàn bộ bản ghi RoomFile trong database của phòng này
    const result = await RoomFile.deleteMany({ roomCode: normalizedCode });
    console.log(`[RoomCleanup] Đã xóa ${result.deletedCount} bản ghi tài liệu cho phòng ${normalizedCode}`);
  } catch (error) {
    console.error(`[RoomCleanup] Lỗi dọn tài liệu phòng ${normalizedCode}:`, error.message);
  }
}

/**
 * Dọn dẹp tài liệu mồ côi (các phòng đã đóng trước đó nhưng tài liệu còn sót)
 */
async function cleanupOrphanedRoomFiles() {
  try {
    const activeRooms = await Room.find({}, "roomCode");
    const activeCodes = new Set(activeRooms.map((r) => (r.roomCode || "").toUpperCase()));

    const allRoomFiles = await RoomFile.find({}, "roomCode");
    const orphanedCodes = [
      ...new Set(
        allRoomFiles
          .map((f) => (f.roomCode || "").toUpperCase())
          .filter((code) => code && !activeCodes.has(code))
      ),
    ];

    if (orphanedCodes.length > 0) {
      console.log(`[RoomCleanup] Phát hiện ${orphanedCodes.length} phòng cũ còn sót tài liệu:`, orphanedCodes);
      for (const code of orphanedCodes) {
        await cleanupRoomFiles(code);
      }
    }
  } catch (err) {
    console.warn("[RoomCleanup] Lỗi dọn tài liệu mồ côi:", err.message);
  }
}

/**
 * Quét và dọn sạch toàn bộ các phòng tồn đọng / mồ côi khi server khởi động (Server Startup Cleanup):
 * - Những phòng có participants rỗng ([] hoặc null hoặc size 0)
 * - Những phòng có status: 'closed' hoặc isActive: false
 * Giúp server không bao giờ bị dính phòng "ma" sau khi crash hoặc restart dev server.
 */
async function cleanupStaleRoomsOnStartup() {
  try {
    const staleFilter = {
      $or: [
        { "participants.0": { $exists: false } },
        { participants: { $size: 0 } },
        { participants: null },
        { status: "closed" },
        { isActive: false },
      ],
    };

    const staleRooms = await Room.find(staleFilter).select("roomCode title");
    const staleCodes = staleRooms.map((r) => (r.roomCode || "").toUpperCase()).filter(Boolean);

    if (staleCodes.length > 0) {
      console.log(
        `[StartupCleanup] 🧹 Phát hiện ${staleCodes.length} phòng mồ côi/0 người tồn đọng từ phiên trước:`,
        staleCodes
      );

      for (const code of staleCodes) {
        await cleanupRoomFiles(code).catch(() => {});
      }

      const deleteResult = await Room.deleteMany(staleFilter);
      console.log(
        `[StartupCleanup] ✅ Đã xóa vĩnh viễn ${deleteResult.deletedCount} phòng tồn đọng khỏi MongoDB.`
      );
    } else {
      console.log(`[StartupCleanup] ✅ Không có phòng mồ côi tồn đọng từ phiên trước.`);
    }

    // Tiếp tục dọn dẹp các tệp tin mồ côi còn sót
    await cleanupOrphanedRoomFiles();
  } catch (err) {
    console.error("[StartupCleanup] ❌ Lỗi dọn phòng khi server khởi động:", err.message);
  }
}

module.exports = {
  cleanupRoomFiles,
  cleanupOrphanedRoomFiles,
  cleanupStaleRoomsOnStartup,
  extractCloudinaryInfo,
};
