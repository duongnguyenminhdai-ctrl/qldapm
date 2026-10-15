"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  Hand,
  Trash2,
  X,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { connectSocket } from "@/lib/socket";
import { ICON_STROKE } from "@/lib/constants";

function formatRelativeTime(dateString) {
  if (!dateString) return "Vừa xong";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (isNaN(diffSec) || diffSec < 45) return "Vừa xong";
  if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RoomNotificationBell({
  roomCode,
  currentUserId,
  isHost,
  onOpenChat,
  onOpenFiles,
  onOpenMembers,
  onOpenApproval,
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadIds, setUnreadIds] = useState(new Set());
  const [isBouncing, setIsBouncing] = useState(false);
  const popoverRef = useRef(null);

  const triggerBounce = useCallback(() => {
    setIsBouncing(true);
    const timer = setTimeout(() => setIsBouncing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const addNotification = useCallback(
    (notif) => {
      if (!notif) return;
      // Không thông báo nếu chính mình thực hiện hành động
      if (notif.senderId && String(notif.senderId) === String(currentUserId)) {
        return;
      }
      // Thông báo chỉ dành cho chủ phòng (như yêu cầu vào phòng)
      if ((notif.hostOnly || notif.type === "JOIN_REQUEST") && !isHost) {
        return;
      }

      triggerBounce();
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
      setUnreadIds((prev) => new Set([...prev, notif.id]));
    },
    [currentUserId, isHost, triggerBounce]
  );

  useEffect(() => {
    const socket = connectSocket();
    if (!socket || !roomCode) return;

    // Lắng nghe đồng bộ thông báo phòng học khi mới vào
    const handleSync = (syncList) => {
      if (Array.isArray(syncList)) {
        setNotifications(
          syncList.filter((n) => !((n.hostOnly || n.type === "JOIN_REQUEST") && !isHost))
        );
      }
    };

    // Lắng nghe thông báo phòng học mới (Tin nhắn, file, giơ tay, yêu cầu vào phòng)
    const handleNewRoomNotif = (notif) => {
      addNotification(notif);
    };

    // Khi phòng đóng hoặc kết thúc -> Xóa sạch toàn bộ thông báo phòng học
    const handleRoomClosed = () => {
      setNotifications([]);
      setUnreadIds(new Set());
      setOpen(false);
    };

    socket.on("room:notifications-sync", handleSync);
    socket.on("room:notification-new", handleNewRoomNotif);
    socket.on("room:host-closed", handleRoomClosed);

    return () => {
      socket.off("room:notifications-sync", handleSync);
      socket.off("room:notification-new", handleNewRoomNotif);
      socket.off("room:host-closed", handleRoomClosed);
    };
  }, [roomCode, isHost, addNotification]);

  // Đóng popover khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Đánh dấu đã đọc tất cả
  const handleMarkAllAsRead = () => {
    setUnreadIds(new Set());
  };

  // Đánh dấu 1 thông báo là đã đọc
  const handleMarkAsRead = (id) => {
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Xóa 1 thông báo
  const handleDeleteNotification = (id, e) => {
    if (e) e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Xóa tất cả thông báo
  const handleClearAll = () => {
    setNotifications([]);
    setUnreadIds(new Set());
  };

  // Xử lý khi click vào 1 thông báo
  const handleItemClick = (notif) => {
    handleMarkAsRead(notif.id);
    setOpen(false);

    if (notif.type === "JOIN_REQUEST") {
      if (onOpenApproval) {
        onOpenApproval();
      } else if (onOpenMembers) {
        onOpenMembers();
      }
    } else if (notif.type === "CHAT_MESSAGE" && onOpenChat) {
      onOpenChat();
    } else if (
      (notif.type === "FILE_SHARED" || notif.type === "IMAGE_SHARED") &&
      onOpenFiles
    ) {
      onOpenFiles();
    } else if (notif.type === "HAND_RAISED" && onOpenMembers) {
      onOpenMembers();
    }
  };

  const unreadCount = unreadIds.size;

  const getNotificationIcon = (type) => {
    switch (type) {
      case "JOIN_REQUEST":
        return <ShieldCheck className="h-4 w-4 text-amber-400" strokeWidth={ICON_STROKE} />;
      case "FILE_SHARED":
        return <FileText className="h-4 w-4 text-sky-400" strokeWidth={ICON_STROKE} />;
      case "IMAGE_SHARED":
        return <ImageIcon className="h-4 w-4 text-emerald-400" strokeWidth={ICON_STROKE} />;
      case "HAND_RAISED":
        return <Hand className="h-4 w-4 text-amber-400" strokeWidth={ICON_STROKE} />;
      case "CHAT_MESSAGE":
      default:
        return <MessageSquare className="h-4 w-4 text-purple-400" strokeWidth={ICON_STROKE} />;
    }
  };

  const getNotificationBadgeStyle = (type) => {
    switch (type) {
      case "JOIN_REQUEST":
        return "border-amber-500/30 bg-amber-500/10 text-amber-400";
      case "FILE_SHARED":
        return "border-sky-500/30 bg-sky-500/10 text-sky-400";
      case "IMAGE_SHARED":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
      case "HAND_RAISED":
        return "border-amber-500/30 bg-amber-500/10 text-amber-400";
      case "CHAT_MESSAGE":
      default:
        return "border-purple-500/30 bg-purple-500/10 text-purple-400";
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Nút Chuông trên Header phòng học */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Thông báo phòng học"
        title="Thông báo hoạt động phòng học"
        className={`relative flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-300 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 ${
          isBouncing ? "animate-bell-bounce text-amber-400 border-amber-500/40" : ""
        }`}
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />

        {/* Badge số lượng thông báo chưa đọc */}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-zinc-950 shadow-sm ring-2 ring-zinc-950 animate-in zoom-in-75">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Thông báo phòng học */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 sm:w-92 rounded-2xl border border-zinc-800/90 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header Popover */}
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5 px-0.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-semibold tracking-tight text-zinc-100">
                Thông báo phòng học
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-bold text-amber-400">
                  {unreadCount} mới
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
                  title="Đánh dấu tất cả là đã đọc"
                >
                  <CheckCheck className="h-3 w-3 text-amber-400" />
                  <span>Đã đọc</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-lg p-1 text-[10px] text-zinc-500 transition hover:bg-zinc-900 hover:text-rose-400"
                  title="Xóa tất cả thông báo trong phòng"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Danh sách thông báo trong phiên phòng học */}
          <div className="mt-2 max-h-[340px] overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-7 text-center">
                <Bell className="mx-auto h-6 w-6 text-zinc-600" strokeWidth={1.5} />
                <p className="mt-2 text-xs text-zinc-500">Chưa có thông báo nào trong phiên học</p>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  Tin nhắn, tài liệu chia sẻ và giơ tay sẽ hiển thị tại đây
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = unreadIds.has(notif.id);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`group relative flex items-start gap-2.5 rounded-xl border p-2.5 transition-all cursor-pointer ${
                      isUnread
                        ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
                        : "border-transparent bg-transparent hover:bg-zinc-900/60"
                    }`}
                  >
                    {/* Icon hoặc avatar */}
                    <div className="shrink-0 mt-0.5">
                      {notif.senderAvatar ? (
                        <div className="relative">
                          <img
                            src={notif.senderAvatar}
                            alt={notif.senderName || "sender"}
                            className="h-7 w-7 rounded-lg object-cover border border-zinc-800"
                          />
                          <span
                            className={`absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-950 ${getNotificationBadgeStyle(
                              notif.type
                            )}`}
                          >
                            {getNotificationIcon(notif.type)}
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border ${getNotificationBadgeStyle(
                            notif.type
                          )}`}
                        >
                          {getNotificationIcon(notif.type)}
                        </div>
                      )}
                    </div>

                    {/* Nội dung */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={`truncate text-xs ${
                            isUnread
                              ? "font-semibold text-zinc-100"
                              : "font-medium text-zinc-300"
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          {formatRelativeTime(notif.createdAt || notif.timestamp)}
                        </span>
                      </div>

                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                        {notif.message || notif.body}
                      </p>

                      {/* Chấm tròn báo chưa đọc */}
                      {isUnread && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-[10px] font-medium text-amber-400">Mới</span>
                        </div>
                      )}
                    </div>

                    {/* Nút xóa nhanh */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      title="Xóa"
                      className="shrink-0 opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-md text-zinc-500 hover:text-rose-400 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer ghi chú phiên học */}
          <div className="mt-2.5 border-t border-zinc-800/60 pt-2 text-center text-[10px] text-zinc-500">
            Thông báo phòng học tự động xóa sạch khi phiên học kết thúc.
          </div>
        </div>
      )}
    </div>
  );
}
