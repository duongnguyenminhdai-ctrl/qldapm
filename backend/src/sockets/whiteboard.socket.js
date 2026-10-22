/**
 * Quản lý trạng thái bảng vẽ chung theo từng phòng học
 * Bộ nhớ đệm in-memory cache lưu danh sách nét vẽ và danh sách ảnh dán
 */
const roomDrawings = new Map();
const roomImages = new Map();

// Giới hạn số lượng nét vẽ và ảnh tối đa lưu trong RAM cho mỗi phòng (tránh phình bộ nhớ)
const MAX_DRAWINGS_PER_ROOM = 5000;
const MAX_IMAGES_PER_ROOM = 50;

function getRoomDrawings(roomCode) {
  const code = (roomCode || "").trim().toUpperCase();
  if (!roomDrawings.has(code)) {
    roomDrawings.set(code, []);
  }
  return roomDrawings.get(code);
}

function clearRoomDrawings(roomCode) {
  const code = (roomCode || "").trim().toUpperCase();
  roomDrawings.set(code, []);
}

function getRoomImages(roomCode) {
  const code = (roomCode || "").trim().toUpperCase();
  if (!roomImages.has(code)) {
    roomImages.set(code, []);
  }
  return roomImages.get(code);
}

function clearRoomImages(roomCode) {
  const code = (roomCode || "").trim().toUpperCase();
  roomImages.set(code, []);
}

function deleteRoom(roomCode) {
  const code = (roomCode || "").trim().toUpperCase();
  roomDrawings.delete(code);
  roomImages.delete(code);
}

/**
 * Đăng ký các sự kiện socket cho tính năng Whiteboard
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
function registerWhiteboardHandlers(io, socket) {
  // BẢO MẬT: Kiểm tra xem socket đã thực sự tham gia vào phòng học này hay chưa
  const isAuthorizedForRoom = (roomCode) => {
    if (!roomCode) return false;
    const normalized = (roomCode || "").trim().toUpperCase();
    return socket.rooms?.has(normalized) || socket.roomCode === normalized;
  };

  /**
   * Sự kiện vẽ nét: draw-line
   * Nhận dữ liệu { prevPoint, currentPoint, color, width, isEraser, roomCode }
   */
  socket.on("draw-line", (data) => {
    const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
    if (!roomCode || !data || !isAuthorizedForRoom(roomCode)) return;

    const drawings = getRoomDrawings(roomCode);
    drawings.push(data);
    if (drawings.length > MAX_DRAWINGS_PER_ROOM) {
      drawings.shift();
    }

    // Phát lại cho các thành viên khác trong phòng
    socket.to(roomCode).emit("draw-line", data);
  });

  /**
   * Sự kiện thêm ảnh vào bảng vẽ: board:add-image
   * Payload: { id, x, y, width, height, dataUrl, roomCode }
   */
  socket.on("board:add-image", (data) => {
    const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
    if (!roomCode || !data || !data.id || !data.dataUrl || !isAuthorizedForRoom(roomCode)) return;

    // Giới hạn độ dài dataUrl tối đa ~3.5MB để chống tấn công làm tràn bộ nhớ Node.js (OOM)
    if (typeof data.dataUrl !== "string" || data.dataUrl.length > 3500000) {
      console.warn(`[Whiteboard Security] Từ chối ảnh vượt quá giới hạn kích thước (phòng ${roomCode})`);
      return;
    }

    const images = getRoomImages(roomCode);
    // Tránh trùng lặp id
    const existingIndex = images.findIndex((img) => img.id === data.id);
    if (existingIndex >= 0) {
      images[existingIndex] = data;
    } else {
      images.push(data);
      if (images.length > MAX_IMAGES_PER_ROOM) {
        images.shift();
      }
    }

    // Phát lại cho các thành viên khác trong phòng
    socket.to(roomCode).emit("board:add-image", data);
  });

  /**
   * Sự kiện di chuyển hoặc thay đổi kích thước ảnh: board:update-image
   * Payload: { id, x, y, width, height, roomCode }
   */
  socket.on("board:update-image", (data) => {
    const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
    if (!roomCode || !data || !data.id || !isAuthorizedForRoom(roomCode)) return;

    const images = getRoomImages(roomCode);
    const target = images.find((img) => img.id === data.id);
    if (target) {
      if (typeof data.x === "number") target.x = data.x;
      if (typeof data.y === "number") target.y = data.y;
      if (typeof data.width === "number") target.width = data.width;
      if (typeof data.height === "number") target.height = data.height;
    }

    // Phát lại vị trí mới cho các thành viên khác
    socket.to(roomCode).emit("board:update-image", data);
  });

  /**
   * Sự kiện xóa một ảnh: board:delete-image
   * Payload: { id, roomCode }
   */
  socket.on("board:delete-image", (data) => {
    const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
    if (!roomCode || !data?.id || !isAuthorizedForRoom(roomCode)) return;

    const images = getRoomImages(roomCode);
    const filtered = images.filter((img) => img.id !== data.id);
    roomImages.set(roomCode, filtered);

    // Phát thông báo xóa ảnh cho các thành viên khác
    socket.to(roomCode).emit("board:delete-image", { id: data.id });
  });

  /**
   * Sự kiện xóa toàn bộ bảng: clear-board
   * Xóa sạch cả nét vẽ và hình ảnh
   */
  socket.on("clear-board", (data) => {
    const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
    if (!roomCode || !isAuthorizedForRoom(roomCode)) return;

    clearRoomDrawings(roomCode);
    clearRoomImages(roomCode);

    // Phát thông báo xóa bảng đến các thành viên khác
    socket.to(roomCode).emit("clear-board");
  });

  /**
   * Lấy toàn bộ lịch sử nét vẽ và hình ảnh hiện tại của phòng
   */
  socket.on("whiteboard:get-state", (data, callback) => {
    const roomCode = (data?.roomCode || socket.roomCode || "").trim().toUpperCase();
    if (!roomCode || !isAuthorizedForRoom(roomCode)) {
      if (typeof callback === "function") callback({ drawings: [], images: [] });
      return;
    }
    const drawings = getRoomDrawings(roomCode);
    const images = getRoomImages(roomCode);

    if (typeof callback === "function") {
      callback({ drawings, images });
    } else {
      socket.emit("whiteboard:sync", { drawings, images });
      socket.emit("board:sync-images", images);
    }
  });
}

module.exports = {
  getRoomDrawings,
  clearRoomDrawings,
  getRoomImages,
  clearRoomImages,
  deleteRoom,
  registerWhiteboardHandlers,
};
