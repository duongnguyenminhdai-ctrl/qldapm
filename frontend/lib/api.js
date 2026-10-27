/**
 * API client gọi REST backend (Express).
 * Base URL lấy từ NEXT_PUBLIC_API_URL (ví dụ http://localhost:5000/api).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

if (
  typeof window !== "undefined" &&
  window.location.hostname.endsWith(".vercel.app") &&
  API_URL.includes("localhost")
) {
  console.warn(
    "[VSR API Warning] Ứng dụng đang chạy trên Vercel nhưng NEXT_PUBLIC_API_URL chưa được cấu hình (đang trỏ về localhost). Vui lòng thêm NEXT_PUBLIC_API_URL trên Vercel Project Settings."
  );
}

const TOKEN_KEY = "vsr_token";
const USER_KEY = "vsr_user";

export function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (token) return token;
  if (typeof document !== "undefined" && document.cookie) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_KEY}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export function setAuthSession({ token, user }) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    try {
      window.dispatchEvent(new CustomEvent("vsr:user-updated", { detail: user }));
      if (user.equippedTitle || user.title || user.activeTitle) {
        const titleValue = user.equippedTitle || user.activeTitle || user.title;
        window.dispatchEvent(
          new CustomEvent("vsr:title-updated", {
            detail: {
              equippedTitle: titleValue,
              activeTitle: titleValue,
              title: titleValue,
              user,
            },
          })
        );
      }
    } catch (_) {}
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  try {
    window.dispatchEvent(new CustomEvent("vsr:user-updated", { detail: null }));
  } catch (_) {}
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (typeof window === "undefined" || !user) return;
  const prev = getStoredUser() || {};
  const merged = { ...prev, ...user };
  if (merged.isPro !== undefined && merged.isVip === undefined) {
    merged.isVip = Boolean(merged.isPro);
  }
  if (merged.proExpiresAt && !merged.vipExpiresAt) {
    merged.vipExpiresAt = merged.proExpiresAt;
  }
  if (merged.vipExpiresAt && !merged.proExpiresAt) {
    merged.proExpiresAt = merged.vipExpiresAt;
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(merged));
  try {
    window.dispatchEvent(new CustomEvent("vsr:user-updated", { detail: merged }));
    if (merged.equippedTitle || merged.title || merged.activeTitle) {
      const titleValue = merged.equippedTitle || merged.activeTitle || merged.title;
      window.dispatchEvent(
        new CustomEvent("vsr:title-updated", {
          detail: {
            equippedTitle: titleValue,
            activeTitle: titleValue,
            title: titleValue,
            user: merged,
          },
        })
      );
    }
  } catch (_) {}
}

// Bảng theo dõi các request GET đang bay (in-flight request deduplication) để tránh gọi trùng lặp
const inFlightGetRequests = new Map();

/**
 * Gửi request JSON tới backend.
 * @param {string} path - Đường dẫn tương đối, ví dụ "/auth/login"
 * @param {object} options - method, body, token, headers
 */
export async function apiClient(path, options = {}) {
  const {
    method = "GET",
    body,
    token,
    headers: customHeaders = {},
  } = options;

  const headers = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  const authToken = token ?? getAuthToken();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const url = `${API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  // Nếu là request GET và đang có 1 request giống hệt đang xử lý dở -> dùng chung promise
  const isGet = method.toUpperCase() === "GET";
  const dedupeKey = isGet ? `${url}?auth=${authToken || ""}` : null;
  if (isGet && inFlightGetRequests.has(dedupeKey)) {
    return inFlightGetRequests.get(dedupeKey);
  }

  const executeRequest = async () => {
    let response;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 35000) : null;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller ? controller.signal : undefined,
      });
      if (timeoutId) clearTimeout(timeoutId);
    } catch (fetchErr) {
      if (timeoutId) clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        const err = new Error(
          "Máy chủ phản hồi quá lâu (quá 35s). Nếu máy chủ vừa thức dậy từ chế độ ngủ (Render Free Tier), vui lòng thử lại sau giây lát."
        );
        err.status = 504;
        err.originalError = fetchErr;
        throw err;
      }
      const err = new Error(
        `Không thể kết nối tới server backend (${API_URL}). Vui lòng đảm bảo backend đang hoạt động.`
      );
      err.status = 503;
      err.originalError = fetchErr;
      throw err;
    }

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    }

    // Tự động cập nhật token mới nếu server đã làm mới phiên
    const refreshedToken = response.headers.get("x-refreshed-token");
    if (refreshedToken && typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_KEY, refreshedToken);
    }

    if (!response.ok) {
      // Bắt lỗi tài khoản bị khóa (403 Forbidden hoặc 401 có thông tin bị khóa)
      const isAccountBanned =
        (response.status === 403 || response.status === 401) &&
        (data?.code === "ACCOUNT_BANNED" ||
          data?.isBanned ||
          data?.message?.toLowerCase().includes("bị khóa") ||
          data?.message?.toLowerCase().includes("banned"));

      if (isAccountBanned && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("account_banned", {
            detail: {
              reason:
                data?.message ||
                "Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng hoặc theo quyết định của Quản trị viên.",
            },
          })
        );
      }

      // Xử lý 401 Unauthorized (Người dùng không tồn tại, token hết hạn, hoặc bị thu hồi)
      if (response.status === 401 && typeof window !== "undefined") {
        clearAuthSession();
        const currentPath = window.location.pathname;
        const isProtectedPage =
          currentPath.startsWith("/dashboard") ||
          currentPath.startsWith("/profile") ||
          currentPath.startsWith("/admin") ||
          currentPath.startsWith("/room");

        if (isProtectedPage && !window.__isRedirectingToLogin) {
          window.__isRedirectingToLogin = true;
          window.location.href = "/login?session_expired=true";
        }
      }

      const error = new Error(
        data?.message || `Request failed with status ${response.status}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  };

  const promise = executeRequest();

  if (isGet && dedupeKey) {
    inFlightGetRequests.set(dedupeKey, promise);
    promise.finally(() => {
      inFlightGetRequests.delete(dedupeKey);
    });
  }

  return promise;
}

export const authApi = {
  register: (payload) =>
    apiClient("/auth/register", { method: "POST", body: payload }),
  login: (payload) =>
    apiClient("/auth/login", { method: "POST", body: payload }),
  me: () => apiClient("/auth/me"),
  updateProfile: (payload) =>
    apiClient("/auth/profile", { method: "PUT", body: payload }),
  changePassword: (payload) =>
    apiClient("/auth/change-password", { method: "PUT", body: payload }),
  // OTP Xác thực Đăng ký
  registerRequestOtp: (payload) =>
    apiClient("/auth/register-request-otp", { method: "POST", body: payload }),
  registerVerifyOtp: (payload) =>
    apiClient("/auth/register-verify-otp", { method: "POST", body: payload }),
  // Quên mật khẩu & Đặt lại mật khẩu
  forgotPasswordRequestOtp: (payload) =>
    apiClient("/auth/forgot-password-request-otp", { method: "POST", body: payload }),
  forgotPasswordVerifyOtp: (payload) =>
    apiClient("/auth/forgot-password-verify-otp", { method: "POST", body: payload }),
  resetPassword: (payload) =>
    apiClient("/auth/reset-password", { method: "POST", body: payload }),
  // Gửi lại mã OTP
  resendOtp: (payload) =>
    apiClient("/auth/resend-otp", { method: "POST", body: payload }),
  // Google OAuth2
  googleLogin: (payload) =>
    apiClient("/auth/google", { method: "POST", body: payload }),
  // Trang bị danh hiệu
  equipTitle: (payloadOrId) => titlesApi.equip(payloadOrId),
};

export const roomsApi = {
  /** Lấy danh sách phòng công khai đang mở (hỗ trợ search, category, sort, pagination) */
  list: (params = {}) => {
    let query = "";
    if (typeof params === "string") {
      query = params ? `?search=${encodeURIComponent(params)}` : "";
    } else if (typeof params === "object" && params !== null) {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.set("search", params.search);
      if (params.category && params.category !== "all")
        searchParams.set("category", params.category);
      if (params.sort) searchParams.set("sort", params.sort);
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));
      const str = searchParams.toString();
      query = str ? `?${str}` : "";
    }
    return apiClient(`/rooms${query}`);
  },
  /** Tạo phòng mới */
  create: (payload) =>
    apiClient("/rooms/create", { method: "POST", body: payload }),
  /** Tham gia phòng bằng mã */
  join: (payload) =>
    apiClient("/rooms/join", { method: "POST", body: payload }),
  /** Rời phòng học */
  leave: (payload) =>
    apiClient("/rooms/leave", { method: "POST", body: payload }),
  /** Lấy thông tin phòng theo roomCode hoặc ID */
  getByCode: (roomCode) => apiClient(`/rooms/${roomCode}`),
  /** Alias tương thích */
  getById: (id) => apiClient(`/rooms/${id}`),
  /** Cập nhật cài đặt phòng học (sức chứa maxMembers lên đến 60 người cho VIP, quyền truy cập) */
  updateSettings: (roomCode, payload) =>
    apiClient(`/rooms/${roomCode}/settings`, { method: "PATCH", body: payload }),
};

export const livekitApi = {
  /** Lấy token kết nối LiveKit Cloud */
  getToken: (roomCode, username) =>
    apiClient(
      `/livekit/token?room=${encodeURIComponent(roomCode)}${
        username ? `&username=${encodeURIComponent(username)}` : ""
      }`
    ),
};

export const friendsApi = {
  /** Gửi lời mời kết bạn qua email hoặc userId/recipientId */
  sendRequest: (emailOrPayload) => {
    const body = typeof emailOrPayload === "object" ? emailOrPayload : { email: emailOrPayload };
    return apiClient("/friends/request", { method: "POST", body });
  },
  /** Lấy danh sách lời mời đang chờ */
  getRequests: () => apiClient("/friends/requests"),
  /** Chấp nhận kết bạn */
  acceptRequest: (fromUserIdOrPayload) => {
    const fromUserId =
      typeof fromUserIdOrPayload === "object"
        ? fromUserIdOrPayload?.fromUserId || fromUserIdOrPayload?.senderId
        : fromUserIdOrPayload;
    return apiClient("/friends/accept", {
      method: "POST",
      body: { fromUserId, senderId: fromUserId },
    });
  },
  /** Từ chối kết bạn */
  rejectRequest: (fromUserIdOrPayload) => {
    const fromUserId =
      typeof fromUserIdOrPayload === "object"
        ? fromUserIdOrPayload?.fromUserId || fromUserIdOrPayload?.senderId
        : fromUserIdOrPayload;
    return apiClient("/friends/reject", {
      method: "POST",
      body: { fromUserId, senderId: fromUserId },
    });
  },
  /** Lấy danh sách bạn bè */
  list: () => apiClient("/friends/list"),
  /** Hủy kết bạn */
  unfriend: (friendId) =>
    apiClient("/friends/unfriend", { method: "POST", body: { friendId } }),
};

export const messagesApi = {
  /** Lấy danh sách cuộc hội thoại */
  getConversations: () => apiClient("/messages/conversations"),
  /** Tạo nhóm chat */
  createGroup: (name, participantIds) =>
    apiClient("/messages/create-group", {
      method: "POST",
      body: { name, participantIds },
    }),
  /** Lấy hoặc tạo hội thoại trực tiếp 1-1 */
  getOrCreateDirect: (friendId) =>
    apiClient("/messages/direct", { method: "POST", body: { friendId } }),
  /** Lấy tin nhắn chi tiết */
  getMessages: (conversationId) => apiClient(`/messages/${conversationId}`),
  /** Gửi tin nhắn mới (hỗ trợ text, voice message, image và file) */
  sendMessage: (conversationId, textOrPayload, image) => {
    let body = {};
    if (typeof conversationId === "object" && conversationId !== null) {
      body = { ...conversationId };
    } else if (typeof textOrPayload === "object" && textOrPayload !== null) {
      body = { conversationId, ...textOrPayload };
    } else {
      body = { conversationId, text: textOrPayload, image };
    }
    return apiClient("/messages/send", {
      method: "POST",
      body,
    });
  },
  /** Thả hoặc đổi/hủy cảm xúc Emoji trên tin nhắn */
  reactMessage: (messageId, emoji) =>
    apiClient(`/messages/${messageId}/react`, {
      method: "POST",
      body: { emoji },
    }),
  /** Thu hồi tin nhắn tương tự Messenger */
  revokeMessage: (messageId) =>
    apiClient(`/messages/${messageId}/revoke`, {
      method: "PATCH",
    }),
  recallMessage: (messageId) =>
    apiClient(`/messages/${messageId}/recall`, {
      method: "PATCH",
    }),
  /** Xóa toàn bộ cuộc trò chuyện tương tự Messenger */
  deleteConversation: (conversationId) =>
    apiClient(`/messages/conversations/${conversationId}`, {
      method: "DELETE",
    }),
};

export const paymentApi = {
  /** Tạo URL thanh toán VNPay Sandbox */
  createPaymentUrl: (packageCode) =>
    apiClient("/payment/create-payment-url", {
      method: "POST",
      body: packageCode ? { packageCode } : {},
    }),
  /** Kiểm tra trạng thái Pro của user hiện tại */
  getProStatus: () => apiClient("/payment/pro-status"),
  /** Lấy danh sách gói dịch vụ đang mở bán */
  getPackages: () => apiClient("/payment/packages"),
};

export const adminApi = {
  /** Lấy thống kê tổng quan (hỗ trợ revenueRange: 'week' | 'month' | 'year' | 'all') */
  getStats: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params?.revenueRange) searchParams.set("revenueRange", params.revenueRange);
    const str = searchParams.toString();
    return apiClient(`/admin/stats${str ? `?${str}` : ""}`);
  },

  /** Lấy danh sách giao dịch VNPay với bộ lọc, tìm kiếm và phân trang server-side */
  getTransactions: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.search) searchParams.set("search", params.search);
    if (params.status && params.status !== "ALL") searchParams.set("status", params.status);
    if (params.sort) searchParams.set("sort", params.sort);
    const str = searchParams.toString();
    return apiClient(`/admin/transactions${str ? `?${str}` : ""}`);
  },

  /** Lấy danh sách phòng học (cả công khai và riêng tư) dành cho Quản trị viên (hỗ trợ phân trang) */
  getRooms: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.search) searchParams.set("search", params.search);
    if (params.category && params.category !== "all")
      searchParams.set("category", params.category);
    const str = searchParams.toString();
    return apiClient(`/admin/rooms${str ? `?${str}` : ""}`);
  },

  /** Lấy danh sách người dùng với bộ lọc và phân trang */
  getUsers: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.search) searchParams.set("search", params.search);
    if (params.role && params.role !== "ALL") searchParams.set("role", params.role);
    if (params.status && params.status !== "ALL") searchParams.set("status", params.status);
    if (params.isPro !== undefined && params.isPro !== "ALL")
      searchParams.set("isPro", String(params.isPro));
    if (params.sort) searchParams.set("sort", params.sort);
    const str = searchParams.toString();
    return apiClient(`/admin/users${str ? `?${str}` : ""}`);
  },

  /** Cập nhật thông tin người dùng */
  updateUser: (id, data) =>
    apiClient(`/admin/users/${id}`, {
      method: "PUT",
      body: data,
    }),

  /** Khóa / mở khóa tài khoản người dùng */
  deleteUser: (id, body) =>
    apiClient(`/admin/users/${id}`, {
      method: "DELETE",
      body,
    }),

  /** Lấy danh sách gói dịch vụ */
  getServices: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set("search", params.search);
    if (params.isActive !== undefined && params.isActive !== "ALL")
      searchParams.set("isActive", String(params.isActive));
    const str = searchParams.toString();
    return apiClient(`/admin/services${str ? `?${str}` : ""}`);
  },

  /** Thêm mới gói dịch vụ */
  createService: (data) =>
    apiClient("/admin/services", {
      method: "POST",
      body: data,
    }),

  /** Cập nhật gói dịch vụ */
  updateService: (id, data) =>
    apiClient(`/admin/services/${id}`, {
      method: "PUT",
      body: data,
    }),

  /** Xóa gói dịch vụ */
  deleteService: (id) =>
    apiClient(`/admin/services/${id}`, {
      method: "DELETE",
    }),

  /** Lấy danh sách quản trị viên (hỗ trợ phân trang) */
  getAdmins: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    const str = searchParams.toString();
    return apiClient(`/admin/admins${str ? `?${str}` : ""}`);
  },

  /** Tạo tài khoản quản trị viên mới */
  createAdmin: (data) =>
    apiClient("/admin/admins", {
      method: "POST",
      body: data,
    }),

  /** Đổi mật khẩu cho quản trị viên */
  changeAdminPassword: (id, newPassword) =>
    apiClient(`/admin/admins/${id}/password`, {
      method: "PUT",
      body: { newPassword },
    }),

  /** Quản trị viên tặng lượt mở thẻ hoặc tặng thẻ bài cho người dùng */
  giftCards: ({ userId, draws, cardId, count, fullSet }) =>
    apiClient("/admin/gift-cards", {
      method: "POST",
      body: { userId, draws, cardId, count, fullSet },
    }),
};

export const titlesApi = {
  /** Lấy danh sách milestones, titles và trạng thái mở khóa */
  getTitles: () => apiClient("/titles"),
  /** Trang bị danh hiệu theo ID hoặc payload */
  equip: (payloadOrId) => {
    const body =
      typeof payloadOrId === "object" && payloadOrId !== null
        ? payloadOrId
        : { titleId: payloadOrId };
    return apiClient("/titles/equip", { method: "POST", body });
  },
  /** Alias cho equip (hỗ trợ gọi titlesApi.equipTitle) */
  equipTitle: (payloadOrId) => {
    const body =
      typeof payloadOrId === "object" && payloadOrId !== null
        ? payloadOrId
        : { titleId: payloadOrId };
    return apiClient("/titles/equip", { method: "POST", body });
  },
};

export const uploadApi = {
  /** Upload file lên Cloudinary thông qua backend có hỗ trợ tiến trình upload */
  uploadFile: async (file, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);

    const token = getAuthToken();

    if (onProgress && typeof XMLHttpRequest !== "undefined") {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL.replace(/\/$/, "")}/upload`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data.success) {
              resolve(data.data);
            } else {
              reject(new Error(data.message || `Upload failed with status ${xhr.status}`));
            }
          } catch (err) {
            reject(new Error("Lỗi xử lý phản hồi từ server."));
          }
        };

        xhr.onerror = () => reject(new Error("Lỗi mạng khi tải file lên."));
        xhr.send(formData);
      });
    }

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL.replace(/\/$/, "")}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Không thể tải file lên.");
    }
    return data.data;
  },

  /** Alias cho uploadFile */
  upload: (file, onProgress) => uploadApi.uploadFile(file, onProgress),

  /** Lấy danh sách tài liệu phòng học (hỗ trợ search, fileType, sort, pagination) */
  getRoomFiles: (roomCode, params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.search) searchParams.set("search", params.search);
    if (params.fileType && params.fileType !== "all")
      searchParams.set("fileType", params.fileType);
    if (params.sort) searchParams.set("sort", params.sort);
    const str = searchParams.toString();
    return apiClient(`/upload/rooms/${roomCode}/files${str ? `?${str}` : ""}`);
  },

  /** Lưu tài liệu chia sẻ trong phòng */
  saveRoomFile: (roomCode, fileData) =>
    apiClient(`/upload/rooms/${roomCode}/files`, {
      method: "POST",
      body: fileData,
    }),
};

export const notificationsApi = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    const str = searchParams.toString();
    return apiClient(`/notifications${str ? `?${str}` : ""}`);
  },
  markAsRead: (id) =>
    apiClient(`/notifications/${id}/read`, {
      method: "PATCH",
    }),
  markAllAsRead: () =>
    apiClient("/notifications/read-all", {
      method: "PATCH",
    }),
  delete: (id) =>
    apiClient(`/notifications/${id}`, {
      method: "DELETE",
    }),
  deleteBySender: (senderId) =>
    apiClient(`/notifications/sender/${senderId}`, {
      method: "DELETE",
    }),
  checkStreak: () =>
    apiClient("/notifications/streak-check", {
      method: "POST",
    }),
  inviteToRoom: ({ friendId, roomCode, roomName }) =>
    apiClient("/notifications/room-invite", {
      method: "POST",
      body: { friendId, roomCode, roomName },
    }),
};

export const aiApi = {
  askTutor: ({ message, history = [], contextType = "GENERAL_QA", roomSubject = "" }) =>
    apiClient("/ai/tutor", {
      method: "POST",
      body: { message, history, contextType, roomSubject },
    }),
  transcribeAudio: ({ audioBase64, mimeType = "audio/webm", roomSubject = "" }) =>
    apiClient("/ai/transcribe-audio", {
      method: "POST",
      body: { audioBase64, mimeType, roomSubject },
    }),
  summarizeTranscript: ({ transcriptText, roomSubject = "" }) =>
    apiClient("/ai/summarize-transcript", {
      method: "POST",
      body: { transcriptText, roomSubject },
    }),
};

export const cardsApi = {
  /** Lấy thông tin lượt mở thẻ và kho thẻ bài */
  getMyCards: () => {
    const token = getAuthToken();
    return apiClient("/cards/my-cards", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  /** Rút 1 lá bài ngẫu nhiên (1-7) */
  draw: () => {
    const token = getAuthToken();
    return apiClient("/cards/draw", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  /** Đổi trọn bộ 7 lá bài (1-7) lấy 1 tháng VIP */
  exchangeVip: () => {
    const token = getAuthToken();
    return apiClient("/cards/exchange-vip", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
};

export { API_URL, TOKEN_KEY, USER_KEY };


