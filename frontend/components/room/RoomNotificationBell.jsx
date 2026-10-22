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
  ShieldCheck,
  UserPlus,
  UserCheck,
  UserX,
  Loader2,
  Gift,
} from "lucide-react";
import { connectSocket } from "@/lib/socket";
import { friendsApi } from "@/lib/api";
import { ICON_STROKE } from "@/lib/constants";

/**
 * Âm thanh thông báo nhẹ hai âm sắc (Web Audio API synth) khi có thông báo mới / lời mời kết bạn
 */
function playNotificationChime() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.0, now + 0.12); // A5

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch (_) {}
}

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

function getDedupKey(n) {
  if (!n) return "";
  if (n.dedupKey) return n.dedupKey;
  if (n._id) return String(n._id);
  if (n.id) return String(n.id);
  const type = n.type || "NOTIF";
  const senderId = String(n.senderId || n.from?._id || n.from?.id || "");
  return `${type}_${senderId}`;
}

export function RoomNotificationBell({
  roomCode,
  currentUserId,
  isHost,
  onAddToast,
  onOpenChat,
  onOpenFiles,
  onOpenMembers,
  onOpenApproval,
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadIds, setUnreadIds] = useState(new Set());
  const [isBouncing, setIsBouncing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const popoverRef = useRef(null);

  // Bộ đệm chống lặp toast/chime trong vòng 4 giây
  const recentToastsRef = useRef(new Set());
  const safeTriggerToast = useCallback((key, toastFn) => {
    if (key && recentToastsRef.current.has(key)) return false;
    if (key) {
      recentToastsRef.current.add(key);
      setTimeout(() => recentToastsRef.current.delete(key), 4000);
    }
    if (typeof toastFn === "function") {
      toastFn();
    }
    return true;
  }, []);

  const triggerBounce = useCallback(() => {
    setIsBouncing(true);
    const timer = setTimeout(() => setIsBouncing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const addNotification = useCallback(
    (notif) => {
      if (!notif) return;
      const sId = String(notif.senderId || notif.from?._id || notif.from?.id || "");
      // Không thông báo nếu chính mình thực hiện hành động
      if (sId && sId === String(currentUserId)) {
        return;
      }
      // Thông báo chỉ dành cho chủ phòng (như yêu cầu vào phòng)
      if ((notif.hostOnly || notif.type === "JOIN_REQUEST") && !isHost) {
        return;
      }

      const notifId = notif._id || notif.id;
      const key = getDedupKey(notif);

      setNotifications((prev) => {
        // Kiểm tra trùng lặp theo ID hoặc dedupKey
        const exists = prev.some((item) => {
          if (notifId && (item._id === notifId || item.id === notifId)) return true;
          if (key && (getDedupKey(item) === key || item._id === key || item.id === key)) return true;
          return false;
        });
        if (exists) return prev;
        return [notif, ...prev];
      });

      setUnreadIds((prev) => {
        const id = notif.id || notif._id || key;
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      triggerBounce();
    },
    [currentUserId, isHost, triggerBounce]
  );

  // Tải danh sách lời mời kết bạn đang chờ ban đầu khi mở phòng
  useEffect(() => {
    let isMounted = true;
    const fetchInitialFriendRequests = async () => {
      if (!currentUserId) return;
      try {
        const res = await friendsApi.getRequests();
        const reqList = res?.data?.requests || [];
        if (!isMounted || !Array.isArray(reqList) || reqList.length === 0) return;

        const formatted = reqList.map((item) => {
          const sender = item.from || {};
          const sId = String(sender._id || sender.id || "");
          const fId = `freq_${item._id || sId}`;
          return {
            _id: fId,
            id: fId,
            dedupKey: `FRIEND_REQUEST_${sId}`,
            type: "FRIEND_REQUEST",
            senderId: sId,
            senderName: sender.name || "Một học viên",
            senderAvatar: sender.avatar || "",
            senderEmail: sender.email || "",
            title: "Lời mời kết bạn",
            message: `${sender.name || "Một học viên"} đã gửi lời mời kết bạn cho bạn.`,
            createdAt: item.createdAt || new Date().toISOString(),
            status: "pending",
          };
        });

        setNotifications((prev) => {
          const existingKeys = new Set(
            prev.map((n) => n._id || n.id || getDedupKey(n))
          );
          const newItems = formatted.filter(
            (f) => !existingKeys.has(f.id) && !existingKeys.has(f.dedupKey)
          );
          return [...newItems, ...prev];
        });
        setUnreadIds((prev) => {
          const next = new Set(prev);
          formatted.forEach((f) => next.add(f.id));
          return next;
        });
      } catch (err) {
        console.warn("[RoomNotificationBell] Lỗi lấy lời mời kết bạn:", err?.message || err);
      }
    };

    fetchInitialFriendRequests();
    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  // Lắng nghe socket realtime
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    if (currentUserId) {
      socket.emit("user:authenticate", { userId: currentUserId });
    }

    // Lắng nghe đồng bộ thông báo phòng học khi mới vào
    const handleSync = (syncList) => {
      if (Array.isArray(syncList)) {
        setNotifications((prev) => {
          // Giữ lại các thông báo FRIEND_REQUEST / FRIEND_ACCEPTED hiện tại
          const friendNotifs = prev.filter(
            (n) => n.type === "FRIEND_REQUEST" || n.type === "FRIEND_ACCEPTED"
          );
          const filteredSync = syncList.filter(
            (n) => !((n.hostOnly || n.type === "JOIN_REQUEST") && !isHost)
          );
          const existingIds = new Set(friendNotifs.map((n) => n.id || n._id));
          const combined = [...friendNotifs];
          filteredSync.forEach((n) => {
            const nId = n.id || n._id;
            if (!existingIds.has(nId)) {
              combined.push(n);
              existingIds.add(nId);
            }
          });
          return combined;
        });
      }
    };

    // Lắng nghe thông báo phòng học mới
    const handleNewRoomNotif = (notif) => {
      if (!notif) return;
      if (notif.type === "FRIEND_REQUEST") {
        handleReceiveFriendRequest(notif);
        return;
      }
      if (notif.type === "FRIEND_ACCEPTED") {
        handleFriendAccepted(notif);
        return;
      }
      addNotification(notif);
    };

    // Lắng nghe realtime lời mời kết bạn từ socket
    const handleReceiveFriendRequest = (data) => {
      if (!data) return;
      const sId = String(data.senderId || data.from?._id || data.from?.id || "");
      if (sId && sId === String(currentUserId)) return;

      const notifItem = {
        _id: data._id || data.id || `rn_freq_${Date.now()}_${sId}`,
        id: data.id || data._id || `rn_freq_${Date.now()}_${sId}`,
        dedupKey: data.dedupKey || `FRIEND_REQUEST_${sId}`,
        type: "FRIEND_REQUEST",
        senderId: sId,
        senderName: data.senderName || data.from?.name || "Một học viên",
        senderAvatar: data.senderAvatar || data.from?.avatar || "",
        senderEmail: data.senderEmail || data.from?.email || "",
        title: "Lời mời kết bạn",
        message:
          data.message ||
          `${data.senderName || data.from?.name || "Một học viên"} đã gửi lời mời kết bạn cho bạn.`,
        status: "pending",
        createdAt: data.createdAt || new Date().toISOString(),
      };

      const key = notifItem.dedupKey;
      safeTriggerToast(key, () => {
        playNotificationChime();
        if (onAddToast) {
          onAddToast({
            title: "Lời mời kết bạn",
            body: `${notifItem.senderName} đã gửi cho bạn lời mời kết bạn!`,
          });
        }
      });

      addNotification(notifItem);
    };

    // Lắng nghe sự kiện đối phương chấp nhận kết bạn
    const handleFriendAccepted = (data) => {
      if (!data) return;
      const friendObj = data.friend || {};
      const fId = String(data.friendId || friendObj._id || friendObj.id || data.senderId || "");
      if (!fId || fId === String(currentUserId)) return;

      const fName = friendObj.name || data.senderName || "Học viên";
      const notifItem = {
        _id: data._id || data.id || `rn_facc_${Date.now()}_${fId}`,
        id: data.id || data._id || `rn_facc_${Date.now()}_${fId}`,
        dedupKey: data.dedupKey || `FRIEND_ACCEPTED_${fId}`,
        type: "FRIEND_ACCEPTED",
        senderId: fId,
        senderName: fName,
        senderAvatar: friendObj.avatar || data.senderAvatar || "",
        title: "Kết bạn thành công",
        message: `${fName} đã chấp nhận lời mời kết bạn của bạn!`,
        createdAt: data.createdAt || new Date().toISOString(),
      };

      const key = notifItem.dedupKey;
      safeTriggerToast(key, () => {
        playNotificationChime();
        if (onAddToast) {
          onAddToast({
            title: "Kết bạn thành công",
            body: `${fName} đã chấp nhận lời mời kết bạn của bạn!`,
          });
        }
      });

      addNotification(notifItem);
    };

    // Khi phòng đóng hoặc kết thúc -> Xóa sạch toàn bộ thông báo phiên phòng học (giữ friend requests)
    const handleRoomClosed = () => {
      setNotifications((prev) =>
        prev.filter((n) => n.type === "FRIEND_REQUEST" || n.type === "FRIEND_ACCEPTED")
      );
      setOpen(false);
    };

    const handleCardRewardAvailable = (data) => {
      const notifItem = {
        _id: `card_${Date.now()}`,
        id: `card_${Date.now()}`,
        dedupKey: `CARD_REWARD_${new Date().toDateString()}`,
        type: "CARD_REWARD",
        title: "Thưởng Thẻ Bài Học Giả",
        message:
          data?.message ||
          "Chúc mừng! Bạn đã tích lũy đủ 3 giờ học hôm nay và nhận được 1 lượt mở Thẻ Bài Học Giả!",
        createdAt: new Date().toISOString(),
      };
      safeTriggerToast(notifItem.dedupKey, () => {
        playNotificationChime();
        if (onAddToast) {
          onAddToast({
            title: "Thưởng Thẻ Bài Học Giả!",
            body: notifItem.message,
          });
        }
      });
      addNotification(notifItem);
    };

    socket.on("room:notifications-sync", handleSync);
    socket.on("room:notification-new", handleNewRoomNotif);
    socket.on("receive_friend_request", handleReceiveFriendRequest);
    socket.on("friend:accepted", handleFriendAccepted);
    socket.on("room:host-closed", handleRoomClosed);
    socket.on("card:reward-available", handleCardRewardAvailable);

    return () => {
      socket.off("room:notifications-sync", handleSync);
      socket.off("room:notification-new", handleNewRoomNotif);
      socket.off("receive_friend_request", handleReceiveFriendRequest);
      socket.off("friend:accepted", handleFriendAccepted);
      socket.off("room:host-closed", handleRoomClosed);
      socket.off("card:reward-available", handleCardRewardAvailable);
    };
  }, [roomCode, currentUserId, isHost, addNotification, onAddToast, safeTriggerToast]);

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
    setNotifications((prev) => prev.filter((n) => n.id !== id && n._id !== id));
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

  // Xử lý Chấp nhận kết bạn (Chỉ gọi API duy nhất, không gọi song song socket để triệt tiêu emit kép)
  const handleAcceptFriend = async (notif) => {
    const senderId = String(notif.senderId || notif.from?._id || notif.from?.id || "");
    if (!senderId) return;

    setActionLoading((prev) => ({ ...prev, [notif.id]: "accept" }));
    try {
      await friendsApi.acceptRequest(senderId);

      // Cập nhật trạng thái item thông báo sang 'accepted' và ẩn các nút hành động
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id || n._id === notif._id
            ? {
                ...n,
                status: "accepted",
                message: "Đã trở thành bạn bè",
              }
            : n
        )
      );

      // Giảm unread badge count
      setUnreadIds((prev) => {
        const next = new Set(prev);
        if (notif.id) next.delete(notif.id);
        if (notif._id) next.delete(notif._id);
        return next;
      });

      // Bắn CustomEvent để đồng bộ RoomSidePanel (tab Thành viên) ngay lập tức mà không cần reload
      if (typeof window !== "undefined") {
        const detail = {
          friendId: senderId,
          friend: {
            _id: senderId,
            id: senderId,
            name: notif.senderName,
            avatar: notif.senderAvatar,
          },
        };
        window.dispatchEvent(new CustomEvent("friend:accepted", { detail }));
        window.dispatchEvent(new CustomEvent("vsr:friend-accepted", { detail }));
      }

      // Thông báo toast duy nhất cho người bấm (có dedup lock)
      safeTriggerToast(`FRIEND_ACCEPTED_${senderId}`, () => {
        if (onAddToast) {
          onAddToast({
            title: "Kết bạn thành công",
            body: `Bạn và ${notif.senderName || "học viên"} đã trở thành bạn bè!`,
          });
        }
      });
    } catch (err) {
      console.error("[RoomNotificationBell] Lỗi chấp nhận kết bạn:", err);
      if (onAddToast) {
        onAddToast({
          title: "Lỗi",
          body: err?.message || "Không thể chấp nhận lời mời kết bạn.",
        });
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [notif.id]: null }));
    }
  };

  // Xử lý Từ chối kết bạn
  const handleRejectFriend = async (notif) => {
    const senderId = String(notif.senderId || notif.from?._id || notif.from?.id || "");
    if (!senderId) return;

    setActionLoading((prev) => ({ ...prev, [notif.id]: "reject" }));
    try {
      await friendsApi.rejectRequest(senderId);

      // Cập nhật trạng thái item thông báo sang 'rejected' và ẩn các nút hành động
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id || n._id === notif._id
            ? {
                ...n,
                status: "rejected",
                message: "Đã từ chối lời mời",
              }
            : n
        )
      );

      // Giảm unread badge count
      setUnreadIds((prev) => {
        const next = new Set(prev);
        if (notif.id) next.delete(notif.id);
        if (notif._id) next.delete(notif._id);
        return next;
      });

      if (onAddToast) {
        onAddToast({
          title: "Đã từ chối",
          body: `Đã từ chối lời mời kết bạn từ ${notif.senderName || "học viên"}.`,
        });
      }
    } catch (err) {
      console.error("[RoomNotificationBell] Lỗi từ chối kết bạn:", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [notif.id]: null }));
    }
  };

  // Xử lý khi click vào 1 thông báo
  const handleItemClick = (notif) => {
    handleMarkAsRead(notif.id || notif._id);

    if (notif.type === "FRIEND_REQUEST") {
      // Giữ mở để người dùng bấm nút Chấp nhận/Từ chối nếu chưa xử lý
      return;
    }

    setOpen(false);

    if (
      notif.type === "CARD_REWARD" ||
      notif.message?.includes("nhận card") ||
      notif.message?.includes("Thẻ Bài")
    ) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("vsr:open-card-modal"));
      }
      return;
    }

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
    } else if (
      (notif.type === "HAND_RAISED" || notif.type === "FRIEND_ACCEPTED") &&
      onOpenMembers
    ) {
      onOpenMembers();
    }
  };

  // Cập nhật badge unreadCount dựa trên số lượng item có isRead/chưa đọc thực tế trong mảng
  const unreadCount = notifications.filter(
    (n) => unreadIds.has(n.id) || unreadIds.has(n._id)
  ).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case "CARD_REWARD":
        return <Gift className="h-4 w-4 text-amber-400" strokeWidth={ICON_STROKE} />;
      case "FRIEND_REQUEST":
        return <UserPlus className="h-4 w-4 text-amber-400" strokeWidth={ICON_STROKE} />;
      case "FRIEND_ACCEPTED":
        return <UserCheck className="h-4 w-4 text-emerald-400" strokeWidth={ICON_STROKE} />;
      case "JOIN_REQUEST":
        return <ShieldCheck className="h-4 w-4 text-[#c3a47b]" strokeWidth={ICON_STROKE} />;
      case "FILE_SHARED":
        return <FileText className="h-4 w-4 text-[#d8c8b4]" strokeWidth={ICON_STROKE} />;
      case "IMAGE_SHARED":
        return <ImageIcon className="h-4 w-4 text-[#c3a47b]" strokeWidth={ICON_STROKE} />;
      case "HAND_RAISED":
        return <Hand className="h-4 w-4 text-[#e8cca4]" strokeWidth={ICON_STROKE} />;
      case "CHAT_MESSAGE":
      default:
        return <MessageSquare className="h-4 w-4 text-[#c3a47b]" strokeWidth={ICON_STROKE} />;
    }
  };

  const getNotificationBadgeStyle = (type) => {
    switch (type) {
      case "FRIEND_REQUEST":
        return "border-amber-500/40 bg-amber-500/20 text-amber-300";
      case "FRIEND_ACCEPTED":
        return "border-emerald-500/40 bg-emerald-500/20 text-emerald-300";
      case "JOIN_REQUEST":
        return "border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#e8cca4]";
      case "FILE_SHARED":
        return "border-[#3a3128] bg-[#201b18] text-[#d8c8b4]";
      case "IMAGE_SHARED":
        return "border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#c3a47b]";
      case "HAND_RAISED":
        return "border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#e8cca4]";
      case "CHAT_MESSAGE":
      default:
        return "border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#c3a47b]";
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
        className={`relative flex h-8 w-8 items-center justify-center rounded-xl border border-[#3a3128] bg-[#201b18] text-[#d8c8b4] shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-[#26201c] hover:text-[#f5ede3] active:scale-95 ${
          isBouncing
            ? "animate-bell-bounce animate-wiggle text-[#c3a47b] border-[#c3a47b]/50 shadow-[0_0_12px_rgba(195,164,123,0.35)]"
            : ""
        }`}
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />

        {/* Badge số lượng thông báo chưa đọc */}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#c3a47b] px-1 text-[10px] font-bold text-[#161311] shadow-sm ring-2 ring-[#181513] animate-in zoom-in-75">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Thông báo phòng học */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 sm:w-92 rounded-2xl border border-[#3a3128] bg-[#1c1815] p-3 shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150">
          {/* Header Popover */}
          <div className="flex items-center justify-between border-b border-[#2d2620] pb-2.5 px-0.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[#c3a47b] animate-pulse" />
              <h3 className="font-serif text-xs font-semibold tracking-tight text-[#f5ede3]">
                Thông báo phòng học
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#c3a47b]/20 px-1.5 py-0.2 text-[9px] font-bold text-[#e8cca4]">
                  {unreadCount} mới
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-medium text-[#a89b8d] transition hover:bg-[#201b18] hover:text-[#f5ede3]"
                  title="Đánh dấu tất cả là đã đọc"
                >
                  <CheckCheck className="h-3 w-3 text-[#c3a47b]" />
                  <span>Đã đọc</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-lg p-1 text-[10px] text-[#75695e] transition hover:bg-[#201b18] hover:text-rose-400"
                  title="Xóa tất cả thông báo trong phòng"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Danh sách thông báo trong phiên phòng học */}
          <div className="mt-2 max-h-[360px] overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-7 text-center">
                <Bell className="mx-auto h-6 w-6 text-zinc-600" strokeWidth={1.5} />
                <p className="mt-2 text-xs text-zinc-500">Chưa có thông báo nào trong phiên học</p>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  Lời mời kết bạn, tin nhắn, tài liệu chia sẻ và giơ tay sẽ hiển thị tại đây
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const notifId = notif.id || notif._id;
                const isUnread = unreadIds.has(notifId) || unreadIds.has(notif.id) || unreadIds.has(notif._id);
                const isFriendRequest = notif.type === "FRIEND_REQUEST";

                return (
                  <div
                    key={notifId}
                    onClick={() => handleItemClick(notif)}
                    className={`group relative flex flex-col gap-1.5 rounded-xl border p-2.5 transition-all cursor-pointer ${
                      isUnread
                        ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
                        : "border-transparent bg-transparent hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Icon hoặc avatar */}
                      <div className="shrink-0 mt-0.5">
                        {notif.senderAvatar ? (
                          <div className="relative">
                            <img
                              src={notif.senderAvatar}
                              alt={notif.senderName || "sender"}
                              className="h-8 w-8 rounded-lg object-cover border border-zinc-800"
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
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${getNotificationBadgeStyle(
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
                            {isFriendRequest
                              ? `${notif.senderName} đã gửi lời mời kết bạn`
                              : notif.title}
                          </h4>
                          <span className="shrink-0 text-[10px] text-zinc-500">
                            {formatRelativeTime(notif.createdAt || notif.timestamp)}
                          </span>
                        </div>

                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                          {isFriendRequest && notif.status === "accepted"
                            ? "Đã trở thành bạn bè"
                            : isFriendRequest && notif.status === "rejected"
                            ? "Đã từ chối lời mời"
                            : notif.message || notif.body}
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
                        onClick={(e) => handleDeleteNotification(notifId, e)}
                        title="Xóa"
                        className="shrink-0 opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-md text-zinc-500 hover:text-rose-400 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Vùng hành động Chấp nhận / Từ chối riêng cho Lời mời kết bạn */}
                    {isFriendRequest && (
                      <div className="mt-1 border-t border-[#2d2620] pt-2">
                        {notif.status === "accepted" ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Đã trở thành bạn bè</span>
                          </div>
                        ) : notif.status === "rejected" ? (
                          <div className="flex items-center gap-1.5 text-xs text-stone-400">
                            <UserX className="h-3.5 w-3.5" />
                            <span>Đã từ chối</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={Boolean(actionLoading[notifId])}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRejectFriend(notif);
                              }}
                              className="border border-stone-600 hover:bg-stone-800 text-stone-300 text-xs px-2 py-1 rounded-md transition disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(actionLoading[notifId])}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptFriend(notif);
                              }}
                              className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white text-xs px-2.5 py-1 rounded-md transition shadow-sm disabled:opacity-50"
                            >
                              {actionLoading[notifId] === "accept" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <UserCheck className="h-3 w-3" />
                                  <span>Chấp nhận</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer ghi chú phiên học */}
          <div className="mt-2.5 border-t border-[#2d2620] pt-2 text-center text-[10px] text-[#75695e]">
            Thông báo phòng học tự động cập nhật theo thời gian thực.
          </div>
        </div>
      )}
    </div>
  );
}
