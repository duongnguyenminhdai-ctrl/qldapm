"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  FileText,
  DoorOpen,
  Flame,
  Sparkles,
  MessageSquare,
  UserCheck,
  X,
  Loader2,
  ExternalLink,
  ChevronDown,
  Download,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notificationsApi, friendsApi, getAuthToken } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { ICON_STROKE } from "@/lib/constants";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (isNaN(diffSec) || diffSec < 45) return "Vừa xong";
  if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 172800) return "Hôm qua";
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} ngày trước`;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function NotificationBell({ user }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'unread' | 'friends'
  const [isBouncing, setIsBouncing] = useState(false);

  // Danh sách thông báo in-app
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Danh sách lời mời kết bạn (Friend requests)
  const [friendRequests, setFriendRequests] = useState([]);
  const [actionLoading, setActionLoading] = useState({});

  const popoverRef = useRef(null);

  // Lấy danh sách thông báo in-app từ server
  const fetchNotifications = useCallback(
    async (targetPage = 1, append = false) => {
      if (!user) return;
      try {
        if (targetPage === 1) setLoading(true);
        else setLoadingMore(true);

        const res = await notificationsApi.list({ page: targetPage, limit: 10 });
        const list = res?.data?.notifications || res?.notifications || [];
        const count =
          res?.data?.unreadCount !== undefined
            ? res.data.unreadCount
            : res?.unreadCount || 0;
        const pageMeta = res?.data?.pagination;

        setUnreadCount(count);
        setHasMore(pageMeta ? pageMeta.hasNextPage : list.length === 10);
        setPage(targetPage);

        setNotifications((prev) => (append ? [...prev, ...list] : list));
      } catch (err) {
        console.warn("[NotificationBell] Lỗi lấy thông báo:", err?.message || err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user]
  );

  // Lấy danh sách lời mời kết bạn
  const fetchFriendRequests = useCallback(async () => {
    if (!user) return;
    try {
      const res = await friendsApi.getRequests();
      setFriendRequests(res?.data?.requests || []);
    } catch (err) {
      console.warn("[NotificationBell] Lỗi lấy friend requests:", err?.message || err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications(1, false);
      fetchFriendRequests();
    }
  }, [user, fetchNotifications, fetchFriendRequests]);

  // Kích hoạt hiệu ứng rung nhẹ (gentle bounce)
  const triggerBounce = useCallback(() => {
    setIsBouncing(true);
    const timer = setTimeout(() => setIsBouncing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Lắng nghe socket realtime
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    if (user?.id || user?._id) {
      socket.emit("user:authenticate", { userId: user.id || user._id });
    }

    // Nhận thông báo in-app mới (gộp tin nhắn theo người gửi tránh spam)
    const handleNewNotification = (notif) => {
      if (!notif) return;
      if (notif.type === "FILE_SHARED" || notif.type === "IMAGE_SHARED") return;
      triggerBounce();

      if (notif.type === "MESSAGE") {
        const incomingSenderId = String(
          notif.sender?._id || notif.sender?.id || notif.sender || ""
        );

        setNotifications((prev) => {
          const existingIndex = prev.findIndex(
            (n) =>
              n.type === "MESSAGE" &&
              String(n.sender?._id || n.sender?.id || n.sender || "") === incomingSenderId
          );

          if (existingIndex !== -1) {
            const existing = prev[existingIndex];
            const updatedItem = {
              ...existing,
              ...notif,
              _id: notif._id || existing._id,
              isRead: false,
              unreadMessageCount:
                notif.unreadMessageCount || (existing.unreadMessageCount || 1) + 1,
              createdAt: notif.createdAt || new Date().toISOString(),
            };
            const withoutExisting = prev.filter((_, idx) => idx !== existingIndex);
            return [updatedItem, ...withoutExisting];
          }

          return [
            {
              ...notif,
              unreadMessageCount: notif.unreadMessageCount || 1,
            },
            ...prev,
          ];
        });

        setUnreadCount((prev) => prev + 1);
        return;
      }

      setNotifications((prev) => {
        const notifId = notif._id || notif.id;
        const senderId = String(
          notif.senderId ||
          notif.sender?._id ||
          notif.sender?.id ||
          notif.from?._id ||
          ""
        );
        const dedupKey = notif.dedupKey || (notifId ? String(notifId) : `${notif.type}_${senderId}`);

        const exists = prev.some((n) => {
          if (notifId && (n._id === notifId || n.id === notifId)) return true;
          if (dedupKey && (n.dedupKey === dedupKey || n._id === dedupKey || n.id === dedupKey)) return true;
          return false;
        });
        if (exists) return prev;

        const nextList = [
          { ...notif, _id: notifId, id: notifId, dedupKey, isRead: false },
          ...prev,
        ];
        // Cập nhật badge unreadCount dựa trên số lượng item có isRead === false thực tế trong mảng
        const actualUnread = nextList.filter((n) => !n.isRead).length;
        setUnreadCount(actualUnread);
        return nextList;
      });
    };

    // Nhận lời mời kết bạn mới
    const handleNewFriendRequest = (data) => {
      if (!data) return;
      const senderId = String(data.senderId || data.from?._id || data.from?.id || "");
      if (senderId && senderId === String(user?.id || user?._id)) return;

      triggerBounce();
      setFriendRequests((prev) => {
        const exists = prev.some((r) => {
          const rId = String(r.senderId || r.from?._id || r.from?.id || r._id || r.id || "");
          return rId && rId === senderId;
        });
        if (exists) return prev;
        return [data, ...prev];
      });
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("receive_friend_request", handleNewFriendRequest);
    socket.on("friend:request-received", handleNewFriendRequest);

    // Lắng nghe sự kiện đánh dấu đã đọc từ Toast
    const handleExternalRead = (e) => {
      const readId = e?.detail?.id;
      if (readId) {
        setNotifications((prev) => {
          const nextList = prev.map((n) => (n._id === readId || n.id === readId ? { ...n, isRead: true } : n));
          const actualUnread = nextList.filter((n) => !n.isRead).length;
          setUnreadCount(actualUnread);
          return nextList;
        });
      }
    };
    window.addEventListener("vsr:notification-read", handleExternalRead);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("receive_friend_request", handleNewFriendRequest);
      socket.off("friend:request-received", handleNewFriendRequest);
      window.removeEventListener("vsr:notification-read", handleExternalRead);
    };
  }, [user, triggerBounce]);

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

  // Đánh dấu 1 thông báo là đã đọc
  const handleMarkAsRead = async (notificationId, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationsApi.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[NotificationBell] Lỗi đánh dấu đọc:", err);
    }
  };

  // Đánh dấu toàn bộ là đã đọc
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("[NotificationBell] Lỗi đánh dấu đọc tất cả:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Xóa 1 thông báo hoặc toàn bộ thông báo tin nhắn từ người này
  const handleDeleteNotification = async (notif, e) => {
    if (e) e.stopPropagation();
    const isMessage = notif?.type === "MESSAGE";
    const senderId = notif?.sender?._id || notif?.sender?.id || notif?.sender;
    const notificationId = notif?._id;
    const wasUnread = !notif?.isRead;

    try {
      if (isMessage && senderId) {
        setNotifications((prev) =>
          prev.filter(
            (n) =>
              !(
                n.type === "MESSAGE" &&
                String(n.sender?._id || n.sender?.id || n.sender) === String(senderId)
              )
          )
        );
        if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
        await notificationsApi.deleteBySender(senderId);
      } else if (notificationId) {
        await notificationsApi.delete(notificationId);
        setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("[NotificationBell] Lỗi xóa thông báo:", err);
    }
  };

  // Tải trực tiếp file .txt bản chép lời từ thông báo
  const handleDownloadTranscript = (notif, e) => {
    if (e) e.stopPropagation();
    const fileName = notif?.metadata?.transcriptFileName;
    if (!fileName) return;

    const token = getAuthToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    const downloadUrl = `${apiUrl}/notifications/download-transcript/${encodeURIComponent(fileName)}?token=${encodeURIComponent(token || "")}`;

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (!notif.isRead && notif._id) {
      handleMarkAsRead(notif._id);
    }
  };

  // Bấm vào 1 thông báo: nếu là tin nhắn thì xóa sạch và mở chat, ngược lại đánh dấu đã đọc và mở link
  const handleItemClick = async (notif) => {
    setOpen(false);

    if (
      notif.type === "CARD_REWARD" ||
      notif.message?.includes("nhận card") ||
      notif.link?.includes("openCardModal")
    ) {
      if (!notif.isRead) {
        handleMarkAsRead(notif._id);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("vsr:open-card-modal"));
      }
      return;
    }

    if (notif.type === "TRANSCRIPT") {
      handleDownloadTranscript(notif);
      return;
    }

    if (notif.type === "MESSAGE") {
      const senderId = notif.sender?._id || notif.sender?.id || notif.sender;
      const convIdMatch = notif.link?.match(/chat=([^&]+)/);
      const conversationId = convIdMatch ? convIdMatch[1] : null;

      // 1. Mở đoạn chat với đối phương NGAY LẬP TỨC (0ms)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("vsr:open-chat-conversation", {
            detail: {
              conversationId,
              friend: notif.sender,
            },
          })
        );
      }

      // 2. Tự động xóa sạch toàn bộ thông báo về tin nhắn từ người này ở cả UI và Server
      if (senderId) {
        setNotifications((prev) =>
          prev.filter(
            (n) =>
              !(
                n.type === "MESSAGE" &&
                String(n.sender?._id || n.sender?.id || n.sender) === String(senderId)
              )
          )
        );
        if (!notif.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        // Gọi API xóa triệt để trên database ở nền
        notificationsApi.deleteBySender(senderId).catch((err) => {
          console.error("[NotificationBell] Lỗi xóa thông báo tin nhắn theo sender:", err);
        });
      } else if (notif._id) {
        notificationsApi.delete(notif._id).catch(() => {});
        setNotifications((prev) => prev.filter((n) => n._id !== notif._id));
        if (!notif.isRead) setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      return;
    }

    if (!notif.isRead) {
      handleMarkAsRead(notif._id);
    }

    if (notif.link) {
      router.push(notif.link);
    }
  };

  // Xử lý Friend Request: Chấp nhận
  const handleAcceptFriend = async (fromUserId) => {
    setActionLoading((prev) => ({ ...prev, [fromUserId]: "accept" }));
    try {
      const res = await friendsApi.acceptRequest(fromUserId);
      setFriendRequests((prev) =>
        prev.filter((r) => String(r.from?._id || r.from?.id || r.from) !== String(fromUserId))
      );
      const newFriend = res?.data?.friend;
      if (newFriend && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("vsr:friend-accepted", { detail: { friend: newFriend } })
        );
      }
    } catch (err) {
      console.warn("[NotificationBell] Kết quả chấp nhận kết bạn:", err?.message || err);
      // Nếu đã được xử lý hoặc có lỗi, vẫn loại bỏ lời mời khỏi danh sách để tránh stuck
      setFriendRequests((prev) =>
        prev.filter((r) => String(r.from?._id || r.from?.id || r.from) !== String(fromUserId))
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [fromUserId]: null }));
    }
  };

  // Xử lý Friend Request: Từ chối
  const handleRejectFriend = async (fromUserId) => {
    setActionLoading((prev) => ({ ...prev, [fromUserId]: "reject" }));
    try {
      await friendsApi.rejectRequest(fromUserId);
      setFriendRequests((prev) =>
        prev.filter((r) => String(r.from?._id || r.from?.id || r.from) !== String(fromUserId))
      );
    } catch (err) {
      console.warn("[NotificationBell] Kết quả từ chối kết bạn:", err?.message || err);
      setFriendRequests((prev) =>
        prev.filter((r) => String(r.from?._id || r.from?.id || r.from) !== String(fromUserId))
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [fromUserId]: null }));
    }
  };

  // Lọc thông báo hiển thị theo tab và loại trừ các thông báo chỉ dành cho phòng học (FILE_SHARED)
  const nonRoomNotifications = notifications.filter(
    (n) => n.type !== "FILE_SHARED" && n.type !== "IMAGE_SHARED"
  );

  // Lọc trùng STREAK_ALERT trên cùng một ngày và gộp tin nhắn MESSAGE theo người gửi
  const seenStreakDays = new Set();
  const messageMap = new Map();
  const cleanNotifications = [];

  for (const n of nonRoomNotifications) {
    if (n.type === "STREAK_ALERT") {
      const dayKey = new Date(n.createdAt).toDateString();
      if (seenStreakDays.has(dayKey)) continue;
      seenStreakDays.add(dayKey);
      cleanNotifications.push(n);
    } else if (n.type === "MESSAGE") {
      const senderKey = String(n.sender?._id || n.sender?.id || n.sender || "unknown");
      if (messageMap.has(senderKey)) {
        const existing = messageMap.get(senderKey);
        if (!n.isRead) {
          existing.unreadMessageCount = (existing.unreadMessageCount || 1) + 1;
        }
        continue;
      }
      const item = {
        ...n,
        unreadMessageCount: n.unreadMessageCount || 1,
      };
      messageMap.set(senderKey, item);
      cleanNotifications.push(item);
    } else {
      cleanNotifications.push(n);
    }
  }

  const displayedNotifications =
    activeTab === "unread"
      ? cleanNotifications.filter((n) => !n.isRead)
      : cleanNotifications;

  // Tổng số lượng huy hiệu chưa đọc (chỉ tính nonRoomNotifications chưa đọc sau khi đã gộp)
  const activeUnreadCount = cleanNotifications.filter((n) => !n.isRead).length;
  const totalBadgeCount = activeUnreadCount + friendRequests.length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case "MESSAGE":
        return <MessageSquare className="h-4 w-4 text-purple-500" strokeWidth={ICON_STROKE} />;
      case "FILE_SHARED":
        return <FileText className="h-4 w-4 text-sky-500" strokeWidth={ICON_STROKE} />;
      case "ROOM_INVITE":
        return <DoorOpen className="h-4 w-4 text-emerald-500" strokeWidth={ICON_STROKE} />;
      case "STREAK_ALERT":
        return <Flame className="h-4 w-4 text-amber-500" strokeWidth={ICON_STROKE} />;
      case "TRANSCRIPT":
        return <FileText className="h-4 w-4 text-emerald-500" strokeWidth={ICON_STROKE} />;
      case "CARD_REWARD":
        return <Gift className="h-4 w-4 text-amber-400" strokeWidth={ICON_STROKE} />;
      case "SYSTEM":
      default:
        return <Sparkles className="h-4 w-4 text-purple-500" strokeWidth={ICON_STROKE} />;
    }
  };

  const getNotificationBadgeStyle = (type) => {
    switch (type) {
      case "MESSAGE":
        return "border-purple-500/20 bg-purple-500/10 text-purple-500";
      case "FILE_SHARED":
        return "border-sky-500/20 bg-sky-500/10 text-sky-500";
      case "ROOM_INVITE":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-500";
      case "STREAK_ALERT":
        return "border-amber-500/20 bg-amber-500/10 text-amber-500";
      case "TRANSCRIPT":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-500";
      case "CARD_REWARD":
        return "border-amber-500/20 bg-amber-500/10 text-amber-400";
      case "SYSTEM":
      default:
        return "border-purple-500/20 bg-purple-500/10 text-purple-500";
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Nút Chuông trên Navbar */}
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) {
            fetchNotifications(1, false);
            fetchFriendRequests();
          }
        }}
        aria-label="Thông báo"
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200/80 dark:border-[#3a3128] bg-white dark:bg-[#201b18] text-[#2D241E] dark:text-[#d8c8b4] shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-[#f7f2e8] dark:hover:bg-[#26201c] hover:text-[#2D241E] dark:hover:text-[#f5ede3] active:scale-95 ${
          isBouncing ? "animate-bell-bounce text-amber-600 dark:text-[#c3a47b]" : ""
        }`}
      >
        <Bell className="h-4 w-4 text-[#6e6358] dark:text-[#d8c8b4]" strokeWidth={ICON_STROKE} />

        {/* Badge số lượng thông báo chưa đọc */}
        {totalBadgeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-600 dark:bg-[#c3a47b] px-1 text-[10px] font-bold text-white dark:text-[#161311] shadow-sm ring-2 ring-white dark:ring-[#181513] animate-in zoom-in-75">
            {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Thông báo */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-84 sm:w-96 rounded-2xl border border-amber-200/80 dark:border-[#3a3128] bg-[#fbf9f5] dark:bg-[#1c1815] p-3.5 shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150 text-[#2D241E] dark:text-[#f5ede3]">
          {/* Header Popover */}
          <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-[#2d2620] pb-2.5 px-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3]">
                Thông báo
              </h3>
              {activeUnreadCount > 0 && (
                <span className="flex items-center rounded-full bg-amber-500/15 dark:bg-[#c3a47b]/20 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-[#e8cca4]">
                  {activeUnreadCount} chưa đọc
                </span>
              )}
            </div>

            {/* Nút Đánh dấu đã đọc tất cả */}
            {activeUnreadCount > 0 && activeTab !== "friends" && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#6e6358] dark:text-[#a89b8d] transition hover:bg-amber-100/60 dark:hover:bg-[#26201c] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
                title="Đánh dấu đã đọc tất cả"
              >
                {markingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin text-amber-600 dark:text-[#c3a47b]" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5 text-amber-600 dark:text-[#c3a47b]" strokeWidth={1.75} />
                )}
                <span>Đã đọc hết</span>
              </button>
            )}
          </div>

          {/* Tab Filter */}
          <div className="mt-2.5 flex items-center gap-1 rounded-xl bg-[#eee5da] dark:bg-[#141210] p-1 border border-amber-200/60 dark:border-[#2d2620]">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 rounded-lg py-1 text-center text-xs font-medium transition ${
                activeTab === "all"
                  ? "bg-white dark:bg-[#29231f] text-[#2D241E] dark:text-[#f5ede3] shadow-xs border border-amber-300 dark:border-[#c3a47b]/40"
                  : "text-[#6e6358] dark:text-[#75695e] hover:text-[#2D241E] dark:hover:text-[#d8c8b4]"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setActiveTab("unread")}
              className={`relative flex-1 rounded-lg py-1 text-center text-xs font-medium transition ${
                activeTab === "unread"
                  ? "bg-white dark:bg-[#29231f] text-[#2D241E] dark:text-[#f5ede3] shadow-xs border border-amber-300 dark:border-[#c3a47b]/40"
                  : "text-[#6e6358] dark:text-[#75695e] hover:text-[#2D241E] dark:hover:text-[#d8c8b4]"
              }`}
            >
              Chưa đọc
              {activeUnreadCount > 0 && (
                <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-[#c3a47b]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("friends")}
              className={`relative flex-1 rounded-lg py-1 text-center text-xs font-medium transition ${
                activeTab === "friends"
                  ? "bg-white dark:bg-[#29231f] text-[#2D241E] dark:text-[#f5ede3] shadow-xs border border-amber-300 dark:border-[#c3a47b]/40"
                  : "text-[#6e6358] dark:text-[#75695e] hover:text-[#2D241E] dark:hover:text-[#d8c8b4]"
              }`}
            >
              Kết bạn
              {friendRequests.length > 0 && (
                <span className="ml-1.5 rounded-full bg-rose-600 px-1 py-0.2 text-[9px] font-bold text-white">
                  {friendRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Danh sách thông báo */}
          <div className="mt-2 max-h-[380px] overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
            {activeTab === "friends" ? (
              // TAB LỜI MỜI KẾT BẠN
              friendRequests.length === 0 ? (
                <div className="py-8 text-center">
                  <UserCheck
                    className="mx-auto h-7 w-7 text-[#8C7E72] dark:text-zinc-600"
                    strokeWidth={1.5}
                  />
                  <p className="mt-2 text-xs text-[#6e6358] dark:text-zinc-500">
                    Không có lời mời kết bạn nào
                  </p>
                </div>
              ) : (
                friendRequests.map((item) => {
                  const sender = item.from;
                  if (!sender) return null;
                  const isLoading = !!actionLoading[sender._id];

                  return (
                    <div
                      key={sender._id}
                      className="flex flex-col gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 p-2.5 transition hover:bg-amber-100/40 dark:border-[#3a3128] dark:bg-[#181513]/60 dark:hover:bg-[#1f1b17]"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 border border-amber-200/80 dark:border-zinc-800">
                          <AvatarImage src={sender.avatar} />
                          <AvatarFallback className="text-[10px] bg-[#eee5da] dark:bg-zinc-800 text-[#2D241E] dark:text-zinc-200">
                            {sender.name?.slice(0, 2).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[#2D241E] dark:text-zinc-200">
                            {sender.name}
                          </p>
                          <p className="truncate text-[11px] text-[#6e6358] dark:text-zinc-500">
                            {sender.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-amber-200/50 dark:border-zinc-800/40">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isLoading}
                          onClick={() => handleRejectFriend(sender._id)}
                          className="h-7 px-2.5 text-[11px] text-[#6e6358] hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/30"
                        >
                          <X className="mr-1 h-3 w-3" strokeWidth={ICON_STROKE} />
                          Từ chối
                        </Button>
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleAcceptFriend(sender._id)}
                          className="h-7 px-2.5 text-[11px] bg-amber-600 dark:bg-[#c3a47b] text-white dark:text-[#161311] hover:brightness-105"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-1 h-3 w-3" strokeWidth={ICON_STROKE} />
                              Chấp nhận
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )
            ) : // TAB THÔNG BÁO HOẠT ĐỘNG IN-APP (TẤT CẢ HOẶC CHƯA ĐỌC)
            loading ? (
              <div className="py-8 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-amber-600 dark:text-[#c3a47b]" />
                <p className="mt-2 text-xs text-[#6e6358] dark:text-[#a89b8d]">Đang tải thông báo...</p>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell
                  className="mx-auto h-7 w-7 text-[#8C7E72] dark:text-zinc-600"
                  strokeWidth={1.5}
                />
                <p className="mt-2 text-xs text-[#6e6358] dark:text-[#a89b8d]">
                  {activeTab === "unread"
                    ? "Không có thông báo chưa đọc"
                    : "Không có thông báo nào"}
                </p>
              </div>
            ) : (
              <>
                {displayedNotifications.map((notif) => {
                  const isUnread = !notif.isRead;

                  return (
                    <div
                      key={notif._id}
                      onClick={() => handleItemClick(notif)}
                      className={`group relative flex items-start gap-2.5 rounded-xl border p-2.5 transition-all cursor-pointer ${
                        isUnread
                          ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 dark:border-amber-500/20 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
                          : "border-transparent bg-transparent hover:bg-amber-100/50 dark:hover:bg-[#26201c]/60"
                      }`}
                    >
                      {/* Avatar người gửi hoặc icon phân loại */}
                      <div className="shrink-0 mt-0.5">
                        {notif.sender?.avatar ? (
                          <div className="relative">
                            <img
                              src={notif.sender.avatar}
                              alt={notif.sender.name || "sender"}
                              className="h-8 w-8 rounded-xl object-cover border border-amber-200/80 dark:border-zinc-800"
                            />
                            <span
                              className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white dark:border-zinc-950 ${getNotificationBadgeStyle(
                                notif.type
                              )}`}
                            >
                              {getNotificationIcon(notif.type)}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl border ${getNotificationBadgeStyle(
                              notif.type
                            )}`}
                          >
                            {getNotificationIcon(notif.type)}
                          </div>
                        )}
                      </div>

                      {/* Nội dung thông báo */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            className={`truncate text-xs leading-tight ${
                              isUnread
                                ? "font-semibold text-[#2D241E] dark:text-[#f5ede3]"
                                : "font-medium text-[#4a3f35] dark:text-[#d8c8b4]"
                            }`}
                          >
                            {notif.title}
                          </h4>
                          <span className="shrink-0 text-[10px] text-[#8C7E72] dark:text-[#75695e]">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>

                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6e6358] dark:text-[#a89b8d]">
                          {notif.message}
                        </p>

                        {/* Nút tải nhanh file .txt nếu là thông báo TRANSCRIPT */}
                        {notif.type === "TRANSCRIPT" && notif.metadata?.transcriptFileName && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleDownloadTranscript(notif, e)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 shadow-xs"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Tải file .txt</span>
                            </button>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                              {notif.metadata.fileSize
                                ? `${Math.max(1, Math.round(notif.metadata.fileSize / 1024))} KB`
                                : ".txt"}
                            </span>
                          </div>
                        )}

                        {/* Chấm tròn xanh báo chưa đọc */}
                        {isUnread && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                              {notif.type === "MESSAGE"
                                ? `${
                                    notif.unreadMessageCount && notif.unreadMessageCount > 1
                                      ? notif.unreadMessageCount
                                      : 1
                                  } tin chưa đọc`
                                : "Chưa đọc"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Nút hành động nhanh bên phải (Đánh dấu đã đọc / Xóa) */}
                      <div className="shrink-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isUnread && (
                          <button
                            onClick={(e) => handleMarkAsRead(notif._id, e)}
                            title="Đánh dấu đã đọc"
                            className="flex h-5 w-5 items-center justify-center rounded-md text-[#8C7E72] hover:bg-amber-100/60 hover:text-amber-700 dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3] transition"
                          >
                            <Check className="h-3 w-3" strokeWidth={1.75} />
                          </button>
                        )}
                        <button
                          onClick={(e) =>
                            handleDeleteNotification(notif, e)
                          }
                          title="Xóa thông báo"
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[#8C7E72] hover:bg-rose-100/60 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Nút Xem thêm phân trang cuộn */}
                {hasMore && (
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => fetchNotifications(page + 1, true)}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6e6358] hover:text-[#2D241E] dark:text-[#a89b8d] dark:hover:text-[#f5ede3] transition"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-amber-600 dark:text-[#c3a47b]" />
                          <span>Đang tải thêm...</span>
                        </>
                      ) : (
                        <>
                          <span>Xem thêm thông báo</span>
                          <ChevronDown className="h-3 w-3" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
