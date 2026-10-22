"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  DoorOpen,
  Flame,
  Sparkles,
  MessageSquare,
  X,
  ExternalLink,
  Bell,
} from "lucide-react";
import { getSocket, connectSocket } from "@/lib/socket";
import { getStoredUser, notificationsApi } from "@/lib/api";

export function GlobalNotificationToast() {
  const router = useRouter();
  const [toasts, setToasts] = useState([]);

  const recentToastsRef = useRef(new Set());

  const addToast = useCallback((notification) => {
    if (!notification) return;
    const notifId = notification._id || notification.id;
    const senderId = String(
      notification.senderId ||
      notification.sender?._id ||
      notification.sender?.id ||
      notification.sender ||
      notification.from?._id ||
      ""
    );
    const dedupKey =
      notification.dedupKey ||
      (notifId ? String(notifId) : `${notification.type}_${senderId}`);

    // Chống trùng lặp tuyệt đối trong vòng 4 giây
    if (dedupKey && recentToastsRef.current.has(dedupKey)) {
      return;
    }
    if (dedupKey) {
      recentToastsRef.current.add(dedupKey);
      setTimeout(() => {
        recentToastsRef.current.delete(dedupKey);
      }, 4000);
    }

    setToasts((prev) => {
      // Tránh trùng lặp toast cùng ID hoặc dedupKey
      const exists = prev.some((t) => {
        if (notifId && (t._id === notifId || t.id === notifId)) return true;
        if (dedupKey && (t.dedupKey === dedupKey || t._id === dedupKey || t.id === dedupKey)) return true;
        return false;
      });
      if (exists) return prev;
      return [
        {
          ...notification,
          _id: notifId,
          id: notifId,
          dedupKey,
          toastId: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
        ...prev.slice(0, 2), // Tối đa 3 toast nổi cùng lúc
      ];
    });

    // Phát sự kiện nội bộ để chuông rung và tăng số đếm
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("vsr:new-notification", { detail: notification })
      );
    }
  }, []);

  const removeToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }, []);

  const handleClickToast = async (toast) => {
    removeToast(toast.toastId);

    // Đánh dấu đã đọc qua API nếu chưa đọc
    if (!toast.isRead && toast._id) {
      try {
        await notificationsApi.markAsRead(toast._id);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("vsr:notification-read", { detail: { id: toast._id } })
          );
        }
      } catch (_) {}
    }

    if (toast.type === "MESSAGE") {
      const convIdMatch = toast.link?.match(/chat=([^&]+)/);
      const conversationId = convIdMatch ? convIdMatch[1] : null;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("vsr:open-chat-conversation", {
            detail: {
              conversationId,
              friend: toast.sender,
            },
          })
        );
      }
      return;
    }

    if (toast.link) {
      router.push(toast.link);
    }
  };

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const user = getStoredUser();
    if (user?.id || user?._id) {
      socket.emit("user:authenticate", { userId: user.id || user._id });
    }

    const handleNewNotification = (notification) => {
      if (
        !notification ||
        notification.type === "FILE_SHARED" ||
        notification.type === "IMAGE_SHARED" ||
        notification.type === "MESSAGE"
      ) {
        return;
      }

      // Không hiển thị toast nếu thông báo do chính mình tạo ra
      const currentU = getStoredUser();
      const currentUId = String(currentU?._id || currentU?.id || "");
      const senderId = String(
        notification.senderId ||
        notification.sender?._id ||
        notification.sender?.id ||
        notification.from?._id ||
        ""
      );
      if (currentUId && senderId && currentUId === senderId) {
        return;
      }

      addToast(notification);
    };

    socket.on("notification:new", handleNewNotification);

    const handleCustomToast = (e) => {
      if (e?.detail) {
        if (e.detail.type === "MESSAGE") return;
        addToast(e.detail);
      }
    };
    window.addEventListener("vsr:trigger-toast", handleCustomToast);

    return () => {
      socket.off("notification:new", handleNewNotification);
      window.removeEventListener("vsr:trigger-toast", handleCustomToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Thông báo thời gian thực"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.toastId}
          toast={toast}
          onClose={() => removeToast(toast.toastId)}
          onClick={() => handleClickToast(toast)}
        />
      ))}
    </aside>
  );
}

function ToastItem({ toast, onClose, onClick }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 6000); // Tự biến mất sau 6 giây
    return () => clearTimeout(timer);
  }, [onClose]);

  const getTypeIcon = (type) => {
    switch (type) {
      case "MESSAGE":
        return <MessageSquare className="h-4 w-4 text-[#c3a47b]" strokeWidth={1.75} />;
      case "FILE_SHARED":
        return <FileText className="h-4 w-4 text-[#e8cca4]" strokeWidth={1.75} />;
      case "ROOM_INVITE":
        return <DoorOpen className="h-4 w-4 text-[#c3a47b]" strokeWidth={1.75} />;
      case "STREAK_ALERT":
        return <Flame className="h-4 w-4 text-[#c3a47b]" strokeWidth={1.75} />;
      case "SYSTEM":
      default:
        return <Sparkles className="h-4 w-4 text-[#e8cca4]" strokeWidth={1.75} />;
    }
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case "MESSAGE":
        return "border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#c3a47b]";
      case "FILE_SHARED":
        return "border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#e8cca4]";
      case "ROOM_INVITE":
        return "border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#c3a47b]";
      case "STREAK_ALERT":
        return "border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#c3a47b]";
      case "SYSTEM":
      default:
        return "border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#e8cca4]";
    }
  };

  return (
    <div
      role="alert"
      className="pointer-events-auto group relative flex items-start gap-3 rounded-2xl border border-[#3a3128] bg-[#1c1815]/95 p-3.5 shadow-2xl backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4"
    >
      {/* Icon hoặc Avatar */}
      <div className="shrink-0 mt-0.5">
        {toast.sender?.avatar ? (
          <div className="relative">
            <img
              src={toast.sender.avatar}
              alt={toast.sender.name || "sender"}
              className="h-9 w-9 rounded-xl object-cover border border-[#3a3128]"
            />
            <span
              className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-[#1c1815] ${getTypeStyle(
                toast.type
              )}`}
            >
              {getTypeIcon(toast.type)}
            </span>
          </div>
        ) : (
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${getTypeStyle(
              toast.type
            )}`}
          >
            {getTypeIcon(toast.type)}
          </div>
        )}
      </div>

      {/* Nội dung */}
      <div
        onClick={onClick}
        className="flex-1 min-w-0 cursor-pointer pr-5"
      >
        <div className="flex items-center gap-1.5">
          <h5 className="truncate text-xs font-serif font-semibold text-[#f5ede3]">
            {toast.title || "Thông báo mới"}
          </h5>
          <span className="shrink-0 rounded-full bg-[#c3a47b]/20 px-1.5 py-0.2 text-[9px] font-medium text-[#e8cca4]">
            Mới
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#a89b8d]">
          {toast.message}
        </p>

        {toast.link && (
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#c3a47b] group-hover:underline">
            <span>Mở liên kết</span>
            <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Nút đóng */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Đóng thông báo"
        className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-lg text-[#75695e] transition hover:bg-[#26201c] hover:text-[#f5ede3]"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>

      {/* Thanh tiến trình thời gian tự tắt */}
      <div className="absolute bottom-0 left-3 right-3 h-[2px] overflow-hidden rounded-full bg-[#201b18]">
        <div className="h-full bg-[#c3a47b]/60 animate-[shrinkProgress_6s_linear_forwards]" />
      </div>
    </div>
  );
}
