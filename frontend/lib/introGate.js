// Trạng thái trong bộ nhớ RAM của phiên JS runtime:
// - Luôn khởi tạo là false khi nhập URL trực tiếp, mở tab mới hoặc tải lại trang (F5).
// - Chỉ chuyển sang true khi người dùng bấm nút trên màn hình Intro.
let introPassedInSession = false;

export function hasPassedIntroGate() {
  return introPassedInSession;
}

export function markIntroGatePassed() {
  introPassedInSession = true;
}

export function resetIntroGate() {
  introPassedInSession = false;
}

