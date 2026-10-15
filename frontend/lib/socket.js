import { io } from "socket.io-client";
import { getAuthToken } from "./api";

/**
 * Socket.io client — kết nối tới NEXT_PUBLIC_SOCKET_URL.
 * Singleton: tái sử dụng cùng một kết nối trong suốt phiên làm việc trên browser.
 */

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

let socketInstance = null;

/**
 * Lấy (hoặc tạo) instance Socket.io.
 * Chỉ chạy trên client (browser).
 */
export function getSocket() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: (cb) => {
        cb({ token: getAuthToken() });
      },
      transports: ["websocket", "polling"],
    });
  }

  return socketInstance;
}

/**
 * Kết nối socket nếu chưa connected.
 */
export function connectSocket() {
  const socket = getSocket();
  if (socket) {
    const token = getAuthToken();
    if (token) {
      socket.auth = { token };
    }
    if (!socket.connected) {
      socket.connect();
    }
  }
  return socket;
}

/**
 * Ngắt kết nối và dọn instance (ví dụ khi logout).
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export { SOCKET_URL };
