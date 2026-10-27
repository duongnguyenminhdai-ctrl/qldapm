"use client";

import { useEffect, useState, useRef, useCallback, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LogOut, Crown, User, ShieldCheck, Search, X, Users, Plus, Flame, Clock,
  Award, MessageSquare, Send, Paperclip, Loader2, RotateCcw, Minus, UserMinus, Mic, Sparkles,
  SquareStack, Menu, ChevronRight, ChevronLeft, UserPlus, Trash2, AlertCircle, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  roomsApi, friendsApi, getStoredUser, setStoredUser, clearAuthSession,
  authApi, notificationsApi, messagesApi, titlesApi, uploadApi, setAuthSession, paymentApi,
} from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { AddFriendDialog, NotificationBell, UnfriendConfirmModal, DeleteConversationConfirmModal } from "@/components/social";
import {
  VoiceRecorder,
  AudioPlayer,
  EmojiPickerPopover,
  MessageReactions,
  ReactionBadge,
} from "@/components/chat";
import UserTitleBadge from "@/components/titles/UserTitleBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import TitlesModal from "@/components/titles/TitlesModal";
import PricingModal from "@/components/payment/PricingModal";
import VipBadge from "@/components/payment/VipBadge";
import VipStatusModal from "@/components/vip/VipStatusModal";
import { RoomCard } from "@/components/dashboard/RoomCard";
import { CreateRoomModal } from "@/components/dashboard/CreateRoomModal";
import { JoinRoomForm } from "@/components/dashboard/JoinRoomForm";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { TITLE_STYLE_MAP, TITLE_MILESTONES } from "@/lib/titlesConfig";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/context/ConfirmContext";
import FileItemCard, { cleanFileName, formatFileSize } from "@/components/files/FileItemCard";
import FileUploadBar from "@/components/files/FileUploadBar";
import ImageLightboxModal from "@/components/files/ImageLightboxModal";
import "@/components/landing/book-showcase-home.css";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const CATEGORIES = [
  { id: "all", label: "Tất cả" },
  { id: "general", label: "Tự học" },
  { id: "tech", label: "Lập trình" },
  { id: "languages", label: "Ngoại ngữ" },
  { id: "math", label: "Toán & KH" },
  { id: "exam", label: "Luyện thi" },
  { id: "chill", label: "Yên tĩnh" },
];

const SORT_OPTIONS = [
  { id: "latest", label: "Mới nhất" },
  { id: "popular", label: "Đông người nhất" },
  { id: "oldest", label: "Cũ nhất" },
];

const TITLE_FILTER_TABS = [
  { id: "all", label: "✨ Tất cả" },
  { id: "STREAK", label: "🔥 Chuỗi ngày" },
  { id: "HOURS", label: "🕒 Tổng giờ học" },
  { id: "PRO", label: "👑 Gói Pro" },
];

const BOOKS = [
  {
    id: "rooms",
    kicker: "Cuốn I",
    title: "Phòng\nHọc",
    subtitle: "Không gian tập trung",
    coverColor: "#363126",
    coverImage: "https://ublctyddhtbgaersvxxb.supabase.co/storage/v1/object/public/threeui-media/scene-images/embedded/eafc13621b9605d30356b7d4396072b2593a46e0c47c96d17ba60ca03d98f925.jpg",
    coverVideo: "https://ublctyddhtbgaersvxxb.supabase.co/storage/v1/object/public/threeui-media/scene-images/embedded/6b3318cc6a7da610e3a55369131b20a2419cda826d558da09da284f09582956d.mp4",
  },
  {
    id: "progress",
    kicker: "Cuốn II",
    title: "Tiến\nTrình",
    subtitle: "Danh hiệu",
    coverColor: "#945a3e",
    coverImage: "https://ublctyddhtbgaersvxxb.supabase.co/storage/v1/object/public/threeui-media/scene-images/embedded/99df6a45ad1f9dd7e47b65c064df0ae58c7c22069fadd9aa896754c3bad27123.jpg",
    coverVideo: "https://ublctyddhtbgaersvxxb.supabase.co/storage/v1/object/public/threeui-media/scene-images/embedded/76a7b0b20e4992f91bb5febf2fa8edd2d33fd4b7bb0cda5f8ae0fffdff9d5a7e.mp4",
  },
  {
    id: "chat",
    kicker: "Cuốn III",
    title: "Trò\nChuyện",
    subtitle: "Kết nối bạn bè",
    coverColor: "#566044",
    coverImage: "https://ublctyddhtbgaersvxxb.supabase.co/storage/v1/object/public/threeui-media/scene-images/embedded/5f73c2c9094bbeef04fdc241909a4672235142882112ec15c6d130f89bf5fd16.jpg",
    coverVideo: "https://ublctyddhtbgaersvxxb.supabase.co/storage/v1/object/public/threeui-media/scene-images/embedded/aabcdc51e4d9f6c4cbf6656bbd3447d6b50814507395f9e5bd0efecd7c1b22b3.mp4",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   BOOK SHOWCASE HOME PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BookShowcaseHome() {
  const router = useRouter();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const bookQuery = searchParams?.get("book");

  /* ── Auth / user state ─────────────────────────────────────────────────── */
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  /* ── UI state ──────────────────────────────────────────────────────────── */
  const [selectedBook, setSelectedBook] = useState(() => {
    if (bookQuery && ["rooms", "progress", "chat"].includes(bookQuery)) {
      return bookQuery;
    }
    return null;
  }); // "rooms"|"progress"|"chat"|null
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isTitlesModalOpen, setIsTitlesModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (bookQuery && ["rooms", "progress", "chat"].includes(bookQuery)) {
      setSelectedBook(bookQuery);
    }
  }, [bookQuery]);

  /* ── Parallax ref ──────────────────────────────────────────────────────── */
  const stageRef = useRef(null);

  /* ── Dashboard (Rooms) state ───────────────────────────────────────────── */
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 8 });

  /* ── Progress state ────────────────────────────────────────────────────── */
  const [stats, setStats] = useState(null);
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [titleFilter, setTitleFilter] = useState("all");
  const [titlesData, setTitlesData] = useState(null);
  const [equippingId, setEquippingId] = useState(null);

  /* ── Chat state ────────────────────────────────────────────────────────── */
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [unfriendTarget, setUnfriendTarget] = useState(null);
  const [isUnfriending, setIsUnfriending] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatMsgLoading, setChatMsgLoading] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const chatEndRef = useRef(null);
  const chatMessagesContainerRef = useRef(null);
  const storiesScrollRef = useRef(null);
  const storiesDragState = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });

  const [deleteTargetConv, setDeleteTargetConv] = useState(null);
  const [isDeletingConv, setIsDeletingConv] = useState(false);

  const handleConfirmUnfriend = useCallback(async () => {
    const friendId = unfriendTarget?._id || unfriendTarget?.id;
    if (!friendId) return;
    setIsUnfriending(true);
    try {
      await friendsApi.unfriend(friendId);
      window.dispatchEvent(new CustomEvent("friend:removed", { detail: { friendId } }));
      // Dù hủy kết bạn cũng KHÔNG xóa đoạn chat với người dùng đó
      setFriends((prev) => prev.filter((f) => String(f._id || f.id) !== String(friendId)));
      setUnfriendTarget(null);
    } catch (err) {
      console.error("Lỗi khi hủy kết bạn:", err);
    } finally {
      setIsUnfriending(false);
    }
  }, [unfriendTarget]);

  const handleConfirmDeleteConv = useCallback(async () => {
    if (!deleteTargetConv?._id) return;
    setIsDeletingConv(true);
    try {
      await messagesApi.deleteConversation(deleteTargetConv._id);
      setConversations((prev) =>
        prev.filter((c) => String(c._id) !== String(deleteTargetConv._id))
      );
      if (String(activeChat?._id) === String(deleteTargetConv._id)) {
        setActiveChat(null);
        setChatMessages([]);
      }
      setDeleteTargetConv(null);
    } catch (err) {
      console.error("Lỗi xóa cuộc trò chuyện:", err);
    } finally {
      setIsDeletingConv(false);
    }
  }, [deleteTargetConv, activeChat]);

  const scrollChatToBottom = useCallback((smooth = true) => {
    if (chatMessagesContainerRef.current) {
      const el = chatMessagesContainerRef.current;
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, []);

  /* ── Viewport scroll lock to prevent layout shift on input focus ──────── */
  useEffect(() => {
    const origHtmlOverflow = document.documentElement.style.overflow;
    const origBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);

    const preventScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("scroll", preventScroll, { passive: true });
    return () => {
      document.documentElement.style.overflow = origHtmlOverflow;
      document.body.style.overflow = origBodyOverflow;
      window.removeEventListener("scroll", preventScroll);
    };
  }, []);

  const [attachedFile, setAttachedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileData, setUploadedFileData] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [recallTargetMsg, setRecallTargetMsg] = useState(null);
  const [isRecalling, setIsRecalling] = useState(false);
  const fileInputRef = useRef(null);

  /* ═══════════════════════════════════════════════════════════════════════
     EFFECTS — Auth, Socket, Streak
     ═══════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    try {
      const stored = getStoredUser();
      setUser(stored);
      if (stored) {
        const socket = connectSocket();
        if (socket) socket.emit("user:authenticate", { userId: stored.id || stored._id });
        authApi
          .me()
          .then((res) => {
            if (res?.data?.user) {
              setUser(res.data.user);
              setStoredUser(res.data.user);
            }
          })
          .catch((err) => {
            if (err?.status === 401) {
              clearAuthSession();
              router.replace("/login");
            }
          });
        // Check streak once per 24h cycle
        try {
          const now = new Date();
          const cycleStart = new Date(now);
          if (now.getHours() < 6) cycleStart.setDate(cycleStart.getDate() - 1);
          cycleStart.setHours(6, 0, 0, 0);
          const saved = localStorage.getItem("vsr_streak_last_checked");
          if (!saved || Number(saved) < cycleStart.getTime()) {
            localStorage.setItem("vsr_streak_last_checked", String(Date.now()));
            notificationsApi.checkStreak().catch(() => { });
          }
        } catch (_) { notificationsApi.checkStreak().catch(() => { }); }
        // Load titles data
        titlesApi.getTitles().then((res) => {
          if (res?.data) {
            setStats(res.data.stats);
            setTitlesData(res.data);
            if (res.data.equippedTitle) {
              setUser((prev) => prev ? { ...prev, equippedTitle: res.data.equippedTitle } : prev);
            }
          }
        }).catch(() => { });
        // Load friends
        friendsApi.list().then((res) => {
          const list = res?.data?.friends || [];
          setOnlineFriends(list.filter((f) => f.isOnline));
          setFriends(list);
        }).catch(() => { });
      }
    } catch { setUser(null); }
    finally {
      setMounted(true);
      if (typeof window !== "undefined") {
        const p = new URLSearchParams(window.location.search).get("book");
        if (p && ["rooms", "progress", "chat"].includes(p)) {
          setSelectedBook(p);
        }
      }
    }
  }, []);

  /* ── Title & user event listeners ──────────────────────────────────────── */
  useEffect(() => {
    const handleTitleUpdated = (e) => {
      const newTitle = e?.detail?.equippedTitle || e?.detail?.activeTitle || e?.detail?.title;
      if (newTitle) {
        setUser((prev) =>
          prev
            ? { ...prev, equippedTitle: newTitle, activeTitle: newTitle, title: newTitle }
            : prev
        );
        setTitlesData((prev) => {
          if (!prev?.milestones) return prev;
          return {
            ...prev,
            equippedTitle: newTitle,
            milestones: prev.milestones.map((m) => ({
              ...m,
              titles: (m.titles || []).map((t) => ({
                ...t,
                isEquipped: t.name === newTitle || t.id === e?.detail?.titleId,
              })),
            })),
          };
        });
      }
    };
    const handleUserUpdated = (e) => {
      if (e?.detail) setUser((prev) => ({ ...(prev || {}), ...e.detail }));
      else setUser(null);
    };
    window.addEventListener("vsr:title-updated", handleTitleUpdated);
    window.addEventListener("vsr:user-updated", handleUserUpdated);
    const socket = connectSocket();
    const handleSocketTitle = (data) => {
      const stored = getStoredUser();
      const currentId = stored?._id || stored?.id;
      if (data && (!data.userId || data.userId === currentId)) {
        const newTitle = data.equippedTitle || data.activeTitle || data.title;
        if (newTitle) {
          setUser((prev) =>
            prev
              ? { ...prev, equippedTitle: newTitle, activeTitle: newTitle, title: newTitle }
              : prev
          );
          if (stored) {
            setStoredUser({
              ...stored,
              equippedTitle: newTitle,
              activeTitle: newTitle,
              title: newTitle,
            });
          }
          setTitlesData((prev) => {
            if (!prev?.milestones) return prev;
            return {
              ...prev,
              equippedTitle: newTitle,
              milestones: prev.milestones.map((m) => ({
                ...m,
                titles: (m.titles || []).map((t) => ({
                  ...t,
                  isEquipped: t.name === newTitle,
                })),
              })),
            };
          });
        }
      }
    };

    const handleCardUpdated = (data) => {
      if (data?.cardDraws !== undefined) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                cardDraws: data.cardDraws,
                cardInventory: data.cardInventory || prev.cardInventory,
              }
            : prev
        );
      }
    };

    const handleCardDrawnEvent = () => {
      const stored = getStoredUser();
      if (stored) setUser(stored);
    };

    window.addEventListener("vsr:card-drawn", handleCardDrawnEvent);

    if (socket) {
      socket.on("user:title-updated", handleSocketTitle);
      socket.on("card:updated", handleCardUpdated);
      socket.on("card:reward-available", handleCardUpdated);
    }

    return () => {
      window.removeEventListener("vsr:title-updated", handleTitleUpdated);
      window.removeEventListener("vsr:user-updated", handleUserUpdated);
      window.removeEventListener("vsr:card-drawn", handleCardDrawnEvent);
      if (socket) {
        socket.off("user:title-updated", handleSocketTitle);
        socket.off("card:updated", handleCardUpdated);
        socket.off("card:reward-available", handleCardUpdated);
      }
    };
  }, []);

  /* ── Dashboard: Debounce search ────────────────────────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* ── Dashboard: Fetch rooms ────────────────────────────────────────────── */
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const params = { page, limit: 8, search: debouncedSearch, category: category === "all" ? undefined : category, sort: sortBy };
      const result = await roomsApi.list(params);
      setRooms(result?.data?.rooms || []);
      const pageMeta = result?.data?.pagination || result?.pagination;
      if (pageMeta) setPagination(pageMeta);
    } catch { setRooms([]); }
    finally { setLoadingRooms(false); }
  }, [page, debouncedSearch, category, sortBy]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  /* ── Dashboard: Socket listeners for rooms ─────────────────────────────── */
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    const onRoomCreated = ({ room }) => { if (!room || room.isPrivate) return; fetchRooms(); };
    const onRoomDeleted = ({ roomCode }) => {
      if (!roomCode) return;
      setRooms((prev) => prev.filter((r) => (r.roomCode || r.inviteCode || "").toUpperCase() !== roomCode.toUpperCase()));
      setPagination((prev) => ({ ...prev, totalItems: Math.max(0, prev.totalItems - 1) }));
    };
    const onMembersSync = ({ participants, roomCode: syncCode }) => {
      if (!syncCode || !Array.isArray(participants)) return;
      // Nếu số lượng người về 0, loại bỏ card phòng ngay lập tức khỏi sảnh
      if (participants.length === 0) {
        setRooms((prev) => prev.filter((r) => (r.roomCode || r.inviteCode || "").toUpperCase() !== syncCode.toUpperCase()));
        return;
      }
      setRooms((prev) => prev.map((r) => {
        const code = (r.roomCode || r.inviteCode || "").toUpperCase();
        if (code === syncCode.toUpperCase()) return { ...r, participants, participantCount: participants.length };
        return r;
      }));
    };
    const onRoomListUpdated = ({ roomCode, action }) => {
      if (!roomCode) {
        fetchRooms();
        return;
      }
      if (action === "deleted" || action === "closed") {
        setRooms((prev) => prev.filter((r) => (r.roomCode || r.inviteCode || "").toUpperCase() !== roomCode.toUpperCase()));
        setPagination((prev) => ({ ...prev, totalItems: Math.max(0, prev.totalItems - 1) }));
      } else {
        fetchRooms();
      }
    };
    socket.on("dashboard:room-created", onRoomCreated);
    socket.on("dashboard:room-deleted", onRoomDeleted);
    socket.on("room:deleted", onRoomDeleted);
    socket.on("room:closed", onRoomDeleted);
    socket.on("room_list_updated", onRoomListUpdated);
    socket.on("room:members-sync", onMembersSync);
    return () => {
      socket.off("dashboard:room-created", onRoomCreated);
      socket.off("dashboard:room-deleted", onRoomDeleted);
      socket.off("room:deleted", onRoomDeleted);
      socket.off("room:closed", onRoomDeleted);
      socket.off("room_list_updated", onRoomListUpdated);
      socket.off("room:members-sync", onMembersSync);
    };
  }, [fetchRooms]);

  /* ── Chat: Load conversations ──────────────────────────────────────────── */
  const loadChatData = useCallback(async () => {
    if (!user) return;
    setChatLoading(true);
    try {
      const [convRes, friendRes] = await Promise.all([messagesApi.getConversations(), friendsApi.list()]);
      const rawConvs = convRes?.data?.conversations || [];
      const myId = String(user?._id || user?.id);
      const seen = new Set();
      const uniqueConvs = [];
      for (const c of rawConvs) {
        if (c.isGroup) {
          uniqueConvs.push(c);
        } else {
          const partner = c.participants?.find((p) => String(p._id || p.id) !== myId);
          const pKey = partner ? String(partner._id || partner.id) : String(c._id);
          if (!seen.has(pKey)) {
            seen.add(pKey);
            uniqueConvs.push(c);
          }
        }
      }
      setConversations(uniqueConvs);
      setFriends(friendRes?.data?.friends || []);
    } catch { } finally { setChatLoading(false); }
  }, [user]);

  useEffect(() => { if (selectedBook === "chat" && user) loadChatData(); }, [selectedBook, user, loadChatData]);

  /* ── Chat: Socket listeners ────────────────────────────────────────────── */
  useEffect(() => {
    const socket = connectSocket();
    if (!socket || !user) return;
    const handleFriendStatus = ({ userId, isOnline, lastSeen }) => {
      setFriends((prev) => prev.map((f) => String(f._id) === String(userId) ? { ...f, isOnline, lastSeen } : f));
      setConversations((prev) => prev.map((conv) => ({
        ...conv,
        participants: conv.participants.map((p) => String(p._id) === String(userId) ? { ...p, isOnline, lastSeen } : p),
      })));
    };
    const handleConvUpdated = ({ conversationId, lastMessage }) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c._id) === String(conversationId));
        if (idx === -1) { loadChatData(); return prev; }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastMessage, updatedAt: new Date() };
        const [target] = updated.splice(idx, 1);
        return [target, ...updated];
      });
    };
    const handleNewConv = (conv) => {
      setConversations((prev) => {
        const id = conv._id || conv.id;
        if (prev.some((c) => String(c._id || c.id) === String(id))) return prev;
        return [conv, ...prev];
      });
    };
    const handleConvDeleted = ({ conversationId }) => {
      setConversations((prev) => prev.filter((c) => String(c._id) !== String(conversationId)));
      if (String(activeChat?._id) === String(conversationId)) {
        setActiveChat(null);
        setChatMessages([]);
      }
    };
    const handleNewMsg = (msg) => {
      if (String(msg.conversationId) === String(activeChat?._id)) {
        setChatMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
          return [...prev, msg];
        });
        setTimeout(() => scrollChatToBottom(true), 50);
      }
    };
    const handleMsgRecalled = ({ messageId, conversationId }) => {
      if (String(conversationId) === String(activeChat?._id)) {
        setChatMessages((prev) => prev.map((m) => String(m._id) === String(messageId) ? { ...m, isRecalled: true, content: "" } : m));
      }
    };
    const handleReactionUpdated = (payload) => {
      const targetMsgId = payload?.messageId;
      const newReactions = payload?.reactions;
      if (!targetMsgId || !newReactions) return;
      setChatMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(targetMsgId) ? { ...m, reactions: newReactions } : m
        )
      );
    };

    socket.on("friend:status-change", handleFriendStatus);
    socket.on("conversation:updated", handleConvUpdated);
    socket.on("conversation:new", handleNewConv);
    socket.on("chat:conversation-deleted", handleConvDeleted);
    socket.on("conversation:deleted", handleConvDeleted);
    socket.on("message:new", handleNewMsg);
    socket.on("chat:message", handleNewMsg);
    socket.on("new_voice_message", handleNewMsg);
    socket.on("message:recalled", handleMsgRecalled);
    socket.on("message_reaction_updated", handleReactionUpdated);
    socket.on("chat:message-reaction-updated", handleReactionUpdated);
    socket.on("message:reaction", handleReactionUpdated);
    return () => {
      socket.off("friend:status-change", handleFriendStatus);
      socket.off("conversation:updated", handleConvUpdated);
      socket.off("conversation:new", handleNewConv);
      socket.off("chat:conversation-deleted", handleConvDeleted);
      socket.off("conversation:deleted", handleConvDeleted);
      socket.off("message:new", handleNewMsg);
      socket.off("chat:message", handleNewMsg);
      socket.off("new_voice_message", handleNewMsg);
      socket.off("message:recalled", handleMsgRecalled);
      socket.off("message_reaction_updated", handleReactionUpdated);
      socket.off("chat:message-reaction-updated", handleReactionUpdated);
      socket.off("message:reaction", handleReactionUpdated);
    };
  }, [user, activeChat, loadChatData, scrollChatToBottom]);

  /* ── Chat: Load messages for active conversation ───────────────────────── */
  useEffect(() => {
    if (!activeChat?._id) return;
    let sub = true;
    setChatMsgLoading(true);
    messagesApi.getMessages(activeChat._id).then((res) => {
      if (sub) { setChatMessages(res?.data?.messages || []); setTimeout(() => scrollChatToBottom(false), 50); }
    }).catch(() => { }).finally(() => { if (sub) setChatMsgLoading(false); });
    const socket = connectSocket();
    if (socket) {
      socket.emit("user:authenticate", { userId: user?._id || user?.id });
      socket.emit("conversation:join", { conversationId: activeChat._id });
    }
    return () => { sub = false; };
  }, [activeChat?._id, scrollChatToBottom]);

  /* ═══════════════════════════════════════════════════════════════════════
     HANDLERS
     ═══════════════════════════════════════════════════════════════════════ */
  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setIsMobileMenuOpen(false);
    router.replace("/login");
  };

  const handleSelectBook = (bookId) => {
    if (selectedBook === bookId) return;
    setSelectedBook(bookId);
  };
  const handleCloseBook = () => setSelectedBook(null);

  /* ── Chat: Send message ────────────────────────────────────────────────── */
  const handleSendMessage = async () => {
    if ((!chatText.trim() && !uploadedFileData) || !activeChat?._id || uploadingFile) return;
    try {
      const payload = { conversationId: activeChat._id, content: chatText.trim(), text: chatText.trim() };
      if (uploadedFileData) {
        payload.fileUrl = uploadedFileData.fileUrl;
        payload.fileName = cleanFileName(uploadedFileData.fileName);
        payload.fileType = uploadedFileData.fileType;
        payload.fileSize = uploadedFileData.fileSize;
      }
      const res = await messagesApi.sendMessage(payload);
      setChatText("");
      setUploadedFileData(null);
      setAttachedFile(null);
      setUploadError(null);
      if (res?.data?.message) {
        setChatMessages((prev) => {
          const mId = res.data.message._id;
          if (prev.some((m) => String(m._id) === String(mId))) return prev;
          return [...prev, res.data.message];
        });
      }
      setTimeout(() => scrollChatToBottom(true), 50);
    } catch (err) { console.error("Lỗi gửi tin nhắn:", err); }
  };

  /* ── Chat: Send voice message ──────────────────────────────────────────── */
  const handleSendVoiceMessage = async ({ file, duration }) => {
    if (!activeChat?._id || !file) return;
    try {
      const res = await uploadApi.upload(file);
      const audioUrl = res?.data?.url || res?.data?.fileUrl || res?.url;
      if (!audioUrl) throw new Error("Không nhận được đường dẫn sau khi tải lên tệp âm thanh.");

      const payload = {
        conversationId: activeChat._id,
        type: "audio",
        audioUrl,
        duration: Math.round(duration || 1),
        content: "",
        text: "",
      };

      const sendRes = await messagesApi.sendMessage(payload);
      if (sendRes?.data?.message) {
        setChatMessages((prev) => {
          const mId = sendRes.data.message._id;
          if (prev.some((m) => String(m._id) === String(mId))) return prev;
          return [...prev, sendRes.data.message];
        });
        setTimeout(() => scrollChatToBottom(true), 50);
      }
      setIsRecordingVoice(false);
    } catch (err) {
      console.error("Lỗi gửi tin nhắn thoại:", err);
      confirm.alert(err.message || "Gửi tin nhắn thoại thất bại.");
    }
  };

  /* ── Chat: React to message ────────────────────────────────────────────── */
  const handleReactMessage = async (messageId, emoji) => {
    if (!messageId || !emoji) return;
    const currentUserId = String(user?._id || user?.id);

    // Cập nhật giao diện lập tức (Optimistic update)
    setChatMessages((prev) =>
      prev.map((m) => {
        if (String(m._id) !== String(messageId)) return m;
        const reactions = [...(m.reactions || [])];
        const existingIdx = reactions.findIndex(
          (r) => String(r.userId?._id || r.userId?.id || r.userId) === currentUserId
        );

        if (existingIdx > -1) {
          if (reactions[existingIdx].emoji === emoji) {
            reactions.splice(existingIdx, 1);
          } else {
            reactions[existingIdx] = {
              ...reactions[existingIdx],
              emoji,
              userId: user,
              createdAt: new Date(),
            };
          }
        } else {
          reactions.push({
            emoji,
            userId: user,
            createdAt: new Date(),
          });
        }
        return { ...m, reactions };
      })
    );

    try {
      const res = await messagesApi.reactMessage(messageId, emoji);
      if (res?.data?.reactions) {
        setChatMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId) ? { ...m, reactions: res.data.reactions } : m
          )
        );
      }
    } catch (err) {
      console.error("Lỗi thả cảm xúc tin nhắn:", err);
    }
  };

  /* ── Chat: File upload ─────────────────────────────────────────────────── */
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    setUploadingFile(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      const res = await uploadApi.uploadFile(file, (p) => setUploadProgress(p));
      const fileData = res?.fileUrl ? res : res?.data || res;
      setUploadedFileData({
        fileUrl: fileData.fileUrl || fileData.url,
        fileName: cleanFileName(fileData.fileName || file.name),
        fileType: fileData.fileType || file.type,
        fileSize: fileData.fileSize || file.size,
      });
    } catch (err) {
      console.error("Lỗi upload file:", err);
      setUploadError(err.message || "Tải lên tệp tin thất bại. Vui lòng thử lại.");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ── Chat: Recall message ──────────────────────────────────────────────── */
  const handleRecallMessage = async () => {
    if (!recallTargetMsg) return;
    setIsRecalling(true);
    try {
      await messagesApi.recallMessage(recallTargetMsg._id);
      setChatMessages((prev) => prev.map((m) => String(m._id) === String(recallTargetMsg._id) ? { ...m, isRecalled: true, content: "" } : m));
    } catch { } finally { setIsRecalling(false); setRecallTargetMsg(null); }
  };

  /* ── Chat: Open direct chat ────────────────────────────────────────────── */
  const handleOpenDirectChat = async (friend) => {
    try {
      const res = await messagesApi.getOrCreateDirect(friend._id || friend.id);
      if (res?.data?.conversation) setActiveChat(res.data.conversation);
    } catch { }
  };

  /* ── Titles: equip ─────────────────────────────────────────────────────── */
  const handleEquipTitle = async (titleId, titleName) => {
    setEquippingId(titleId);
    try {
      const res = await titlesApi.equip(titleId);
      const newTitle = res?.data?.equippedTitle || titleName;
      setUser((prev) =>
        prev
          ? {
              ...prev,
              equippedTitle: newTitle,
              activeTitle: newTitle,
              title: newTitle,
            }
          : prev
      );
      const stored = getStoredUser();
      if (stored) {
        setStoredUser({
          ...stored,
          equippedTitle: newTitle,
          activeTitle: newTitle,
          title: newTitle,
        });
      }
      setTitlesData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          equippedTitle: newTitle,
          milestones: (prev.milestones || []).map((m) => ({
            ...m,
            titles: (m.titles || []).map((t) => ({
              ...t,
              isEquipped: t.id === titleId || t.name === newTitle,
            })),
          })),
        };
      });
      window.dispatchEvent(
        new CustomEvent("vsr:title-updated", {
          detail: {
            equippedTitle: newTitle,
            activeTitle: newTitle,
            title: newTitle,
            titleId,
          },
        })
      );
      // Refresh titles data in background
      titlesApi.getTitles().then((r) => { if (r?.data) setTitlesData(r.data); }).catch(() => { });
    } catch (err) {
      console.error("[BookShowcaseHome] Equip title failed:", err);
    } finally {
      setEquippingId(null);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     COMPUTED VALUES
     ═══════════════════════════════════════════════════════════════════════ */
  const streakDays = stats?.streak ?? user?.streak ?? (user ? 1 : 0);
  const totalStudySeconds = stats?.totalStudySeconds ?? user?.totalStudySeconds ?? 0;
  const studyHours = user ? (totalStudySeconds > 0 ? (totalStudySeconds / 3600).toFixed(1) : "0.0") : "0.0";
  const equippedTitle = user?.equippedTitle || user?.activeTitle || user?.title || "Nhập môn học giả";

  // Week progress
  const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const currentDay = new Date().getDay();
  const todayIndex = currentDay === 0 ? 6 : currentDay - 1;
  const weekDays = DAY_LABELS.map((label, idx) => {
    if (idx > todayIndex) return { label, active: false, isToday: false };
    const daysAgo = todayIndex - idx;
    return { label, active: Boolean(user && streakDays > 0 && daysAgo < streakDays), isToday: idx === todayIndex };
  });
  const activeDaysCount = weekDays.filter((d) => d.active).length;
  const weekProgressPercent = Math.round((activeDaysCount / 7) * 100);

  // Titles milestones
  const userStreak = stats?.streak ?? user?.streak ?? 1;
  const userStudyHours = totalStudySeconds / 3600;
  const isPro = Boolean(user?.isPro);
  const proMonths = user?.proMonths || (isPro ? 1 : 0);
  const unlockedSet = useMemo(() => {
    return new Set(
      titlesData?.milestones?.flatMap(m => m.titles?.filter(t => t.isUnlocked)?.map(t => t.id)) ||
      user?.unlockedTitleIds || ["nhap-mon-hoc-gia", "thieu-uy"]
    );
  }, [titlesData, user?.unlockedTitleIds]);

  const filteredMilestones = useMemo(() => {
    const rawMilestones = (titlesData?.milestones || TITLE_MILESTONES.map((m) => {
      let currentVal = 0, targetVal = 0, unit = "";
      if (m.category === "STREAK") { currentVal = userStreak; targetVal = m.minStreak; unit = "ngày"; }
      else if (m.category === "HOURS") { currentVal = parseFloat(userStudyHours.toFixed(1)); targetVal = m.minHours; unit = "giờ"; }
      else if (m.category === "PRO") { currentVal = proMonths; targetVal = 1; unit = "tháng"; }
      const percent = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 100;
      return {
        ...m,
        milestoneId: m.milestoneId,
        isUnlocked: m.category === "STREAK" ? userStreak >= targetVal : m.category === "HOURS" ? userStudyHours >= targetVal : isPro,
        progress: { current: currentVal, target: targetVal, unit, percent },
        titles: m.titles.map((t) => ({
          ...t,
          isUnlocked: unlockedSet.has(t.id),
          isEquipped: equippedTitle === t.name || equippedTitle === t.id,
        })),
      };
    })).filter((m) => titleFilter === "all" || m.category === titleFilter);

    return rawMilestones.map((m) => ({
      ...m,
      titles: (m.titles || []).map((t) => ({
        ...t,
        isEquipped: equippedTitle === t.name || equippedTitle === t.id,
      })),
    }));
  }, [titlesData, userStreak, userStudyHours, isPro, proMonths, unlockedSet, equippedTitle, titleFilter]);

  const totalUnlocked = (titlesData?.milestones || []).flatMap(m => m.titles || []).filter(t => t.isUnlocked).length;
  const totalTitles = (titlesData?.milestones || TITLE_MILESTONES).flatMap(m => m.titles || []).length;

  // Chat filtered
  const filteredConversations = conversations.filter((conv) => {
    if (!chatSearch.trim()) return true;
    const q = chatSearch.toLowerCase();
    const partner = conv.participants?.find((p) => String(p._id) !== String(user?._id || user?.id));
    return partner?.name?.toLowerCase().includes(q) || conv.name?.toLowerCase().includes(q);
  });

  const onlineFriendsCount = friends.filter(f => f.isOnline).length;
  const isDetailMode = selectedBook !== null;

  /* ── 3D Parallax / Mouse Tilt xoay sách theo con trỏ chuột (ThreeUI Showcase) ─────── */
  useEffect(() => {
    let frame = 0;
    const stage = stageRef.current;
    if (!stage) return;

    const onPointerMove = (e) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!stage) return;

        if (isDetailMode) {
          const card = stage.querySelector(".bs-book-card.selected");
          if (!card) return;

          const bounds = card.getBoundingClientRect();
          const centerX = bounds.left + bounds.width / 2;
          const centerY = bounds.top + bounds.height / 2;
          const width = window.innerWidth || 1;
          const height = window.innerHeight || 1;

          // 1. Chuẩn hóa tọa độ chuột từ tâm: giá trị từ -1 đến 1
          const normX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (width / 2)));
          const normY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (height / 2)));

          // 2. Cập nhật góc xoay 3D qua requestAnimationFrame: nghiêng tối đa ~22 độ (Y) và ~15 độ (X)
          card.style.setProperty("--detail-yaw", `${normX * 22}deg`);
          card.style.setProperty("--detail-pitch", `${-normY * 15}deg`);

          const book = card.querySelector(".bs-book");
          if (book) {
            book.style.transform = `scale(1.02) rotateY(${normX * 22}deg) rotateX(${-normY * 15}deg)`;
          }
        } else {
          const width = window.innerWidth || 1;
          const height = window.innerHeight || 1;
          const centerX = width / 2;
          const centerY = height / 2;

          const normX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (width / 2)));
          const normY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (height / 2)));

          stage.style.setProperty("--mx", `${normX * 11}px`);
          stage.style.setProperty("--my", `${normY * 8}px`);

          const cards = stage.querySelectorAll(".bs-book-card");
          cards.forEach((c, index) => {
            const depth = index === 1 ? 1 : 0.58;
            c.style.setProperty("--local-x", `${normX * 15 * depth}px`);
            c.style.setProperty("--local-y", `${normY * 9 * depth}px`);
          });
        }
      });
    };

    // 3. Hiệu ứng hồi vị (Mouse Leave): Tự động đưa normX = 0, normY = 0 trở về góc thẳng ban đầu
    const onPointerLeave = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      if (isDetailMode) {
        const card = stage.querySelector(".bs-book-card.selected");
        if (card) {
          card.style.setProperty("--detail-yaw", "0deg");
          card.style.setProperty("--detail-pitch", "0deg");
          const book = card.querySelector(".bs-book");
          if (book) {
            book.style.transform = "scale(1.02) rotateY(0deg) rotateX(0deg)";
          }
        }
      } else {
        stage.style.setProperty("--mx", "0px");
        stage.style.setProperty("--my", "0px");
        const cards = stage.querySelectorAll(".bs-book-card");
        cards.forEach((c) => {
          c.style.setProperty("--local-x", "0px");
          c.style.setProperty("--local-y", "0px");
        });
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      onPointerLeave();
    };
  }, [isDetailMode]);

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div
      className="book-showcase-root fixed inset-0 h-screen h-[100dvh] max-h-[100dvh] w-screen max-w-[100vw] overflow-hidden select-none"
      data-mode={isDetailMode ? "detail" : "gallery"}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="bs-topbar">
        <Link href="/?book=rooms" className="bs-brand" onClick={(e) => { e.preventDefault(); handleCloseBook(); }}>
          <img
            src="/image/logo.png"
            alt="Virtual Study Room Logo"
            className="h-8 w-auto object-contain drop-shadow-sm transition-transform duration-200 hover:scale-105"
          />
          <span className="bs-brand-text">
            <span className="bs-brand-name">
              <span className="hidden sm:inline">Virtual Study Room</span>
              <span className="sm:hidden font-serif italic text-base">VSR</span>
            </span>
            <span className="bs-brand-sub hidden md:block">Không gian tập trung sâu</span>
          </span>
        </Link>

        <div className="bs-nav-actions">
          {!mounted ? (
            <div className="bs-skeleton" style={{ width: 160, height: 32 }} />
          ) : user ? (
            <>
              {/* DESKTOP NAV ACTIONS (>= 768px: Đầy đủ) */}
              <div className="hidden md:flex items-center gap-2">
                <ThemeToggle />
                {/* Nút Mở Card kèm badge số lượt */}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("vsr:open-card-modal"))}
                  className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 cursor-pointer shadow-xs bg-amber-100/90 text-amber-950 border border-amber-400/60 hover:bg-amber-200/90 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/20"
                  title="Mở Thẻ Bài Học Giả"
                >
                  <SquareStack className="w-4 h-4 mr-0.5 stroke-current" />
                  <span>Mở Card</span>
                  {(user.cardDraws || 0) > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center font-mono font-bold text-xs px-1.5 py-0.5 rounded-full bg-amber-700 text-white dark:bg-amber-500 dark:text-stone-950 animate-pulse">
                      {user.cardDraws}
                    </span>
                  )}
                </button>

                <AddFriendDialog />
                <NotificationBell user={user} />
                {user.isPro || user.isVip ? (
                  <VipBadge
                    size="sm"
                    showLabel={true}
                    onClick={() => setIsVipModalOpen(true)}
                    className="cursor-pointer transition-all hover:scale-105 active:scale-95 hover:shadow-md hover:shadow-amber-500/20"
                  />
                ) : (
                  <button onClick={() => setIsVipModalOpen(true)} className="bs-upgrade-btn" title="Xem đặc quyền VIP & Hạn dùng">
                    <Crown className="w-3.5 h-3.5" />
                    <span>Nâng cấp Pro</span>
                  </button>
                )}
                <Link href="/profile" className="bs-profile-link" title="Tài khoản & Bảo mật">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name || "avatar"} className="bs-avatar-img" />
                  ) : (
                    <User className="w-3.5 h-3.5 opacity-60" />
                  )}
                  <span className="truncate max-w-[100px]">{user.name || user.email}</span>
                </Link>
                {user.role === "ADMIN" && (
                  <Link href="/admin" className="bs-admin-link" title="Admin">
                    <ShieldCheck className="w-3.5 h-3.5" /> <span>Admin</span>
                  </Link>
                )}
                <UserTitleBadge title={equippedTitle} onClick={() => setIsTitlesModalOpen(true)} size="xs" />
                <button onClick={handleLogout} className="bs-logout-btn" title="Đăng xuất">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>

              {/* MOBILE NAV ACTIONS (< 768px: CHỈ HIỂN THỊ 3 MỤC: Mở card + Chuông + Hamburger) */}
              <div className="flex md:hidden items-center gap-1.5 sm:gap-2">
                {/* 1. Nút Rút Thẻ mini */}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("vsr:open-card-modal"))}
                  className="relative flex h-10 min-w-[40px] items-center justify-center rounded-xl px-2.5 bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 active:scale-95 transition-transform cursor-pointer"
                  title="Mở Thẻ Bài Học Giả"
                  aria-label="Mở Thẻ Bài Học Giả"
                >
                  <SquareStack className="w-4 h-4 stroke-current" />
                  {(user.cardDraws || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center font-mono font-bold text-[10px] px-1 rounded-full bg-amber-600 text-white dark:bg-amber-400 dark:text-black shadow-sm ring-1 ring-white dark:ring-[#181513]">
                      {user.cardDraws}
                    </span>
                  )}
                </button>

                {/* 2. Chuông thông báo */}
                <NotificationBell user={user} />

                {/* 3. Hamburger Button */}
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-stone-300 dark:border-[#3a3128] bg-stone-100/90 dark:bg-[#201b18]/90 text-[#2D241E] dark:text-[#f5ede3] active:scale-95 transition-transform cursor-pointer"
                  aria-label="Mở menu điều hướng"
                >
                  <Menu className="h-5 w-5 text-[#6e6358] dark:text-[#d8c8b4]" strokeWidth={1.75} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/login" className="bs-auth-link">Đăng nhập</Link>
              <Link href="/register" className="bs-auth-link bs-auth-primary">Bắt đầu ngay</Link>
            </div>
          )}
        </div>
      </header>

      {/* ── STAGE ──────────────────────────────────────────────────────────── */}
      <main className="bs-stage" ref={stageRef}>
        {/* Hero word */}
        <div className={cn("bs-hero-word", isDetailMode && "bs-hero-hidden")}>
          Học Tập
        </div>

        {/* Book cards */}
        <section className="bs-shelf pt-4 md:pt-0">
          {BOOKS.map((book) => {
            const isSelected = selectedBook === book.id;
            return (
              <button
                key={book.id}
                className={cn("bs-book-card scale-[0.8] md:scale-100 transition-transform", isSelected && "selected", isDetailMode && !isSelected && "bs-book-hidden")}
                data-book={book.id}
                onClick={() => handleSelectBook(book.id)}
                style={{
                  "--cover-color": book.coverColor,
                }}
                aria-label={`Mở ${book.title.replace("\n", " ")}`}
              >
                <span className="bs-book" aria-hidden="true">
                  <span className="bs-book-shadow" />
                  <span className="bs-book-back" />
                  <span className="bs-page-block" />
                  <span className="bs-page-fan"><i /><i /><i /><i /></span>
                  <span className="bs-front-cover" style={{ backgroundImage: `url(${book.coverImage})` }}>
                    <video className="bs-cover-motion" autoPlay muted loop playsInline preload="metadata" key={book.coverVideo}>
                      <source src={book.coverVideo} type="video/mp4" />
                    </video>
                    <span className="bs-cover-copy">
                      <span className="bs-cover-kicker">{book.kicker}</span>
                      <span className="bs-cover-title">{book.title}</span>
                      <span className="bs-cover-subtitle">{book.subtitle}</span>
                    </span>
                  </span>
                  <span className="bs-open-badge">Mở</span>
                </span>
              </button>
            );
          })}
        </section>

        {/* ── DETAIL PANEL ─────────────────────────────────────────────────── */}
        <section className={cn("bs-detail-panel", isDetailMode && "bs-detail-visible")}>
          {/* Close button */}
          <button className={cn("bs-close-button", isDetailMode && "bs-close-visible")} onClick={handleCloseBook} aria-label="Đóng">×</button>

          {/* ── ROOMS PANEL ──────────────────────────────────────────────── */}
          {selectedBook === "rooms" && (
            <div className="bs-panel-content">
              <h2 className="bs-panel-title">Phòng Học</h2>
              {/* Fixed top: Join + Create */}
              <div className="bs-rooms-toolbar">
                <div className="bs-rooms-join-create">
                  <JoinRoomForm />
                  <CreateRoomModal />
                </div>
                {/* Search & sort */}
                <div className="bs-rooms-filters">
                  <div className="bs-search-wrap">
                    <Search className="bs-search-icon" strokeWidth={1.5} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (typeof window !== "undefined") {
                          window.scrollTo(0, 0);
                          document.documentElement.scrollTop = 0;
                          document.body.scrollTop = 0;
                        }
                      }}
                      placeholder="Tìm theo tên/mã..."
                      className="bs-search-input"
                    />
                    {searchQuery && <button onClick={() => setSearchQuery("")} className="bs-search-clear"><X className="w-3 h-3" /></button>}
                  </div>
                  <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className="bs-sort-select">
                    {SORT_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>
                {/* Category pills */}
                <div className="bs-category-pills">
                  {CATEGORIES.map((cat) => (
                    <button key={cat.id} onClick={() => { setCategory(cat.id); setPage(1); }}
                      className={cn("bs-pill", category === cat.id && "bs-pill-active")}
                    >{cat.label}</button>
                  ))}
                </div>
              </div>
              {/* Scrollable room list */}
              <div
                className="bs-detail-scroll"
                onWheel={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
              >
                {loadingRooms ? (
                  <div className="bs-loading-rooms">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="bs-room-skeleton"><div className="bs-skel-title" /><div className="bs-skel-desc" /></div>)}
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="bs-empty-state">
                    <p>Không tìm thấy phòng phù hợp.</p>
                    <p className="bs-empty-hint">{searchQuery || category !== "all" ? "Thử xóa bộ lọc hoặc tìm kiếm khác." : "Chưa có phòng nào. Tạo phòng đầu tiên!"}</p>
                  </div>
                ) : (
                  <>
                    {rooms.map((room) => <RoomCard key={room._id || room.id} room={room} />)}
                    <PaginationControl currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} limit={pagination.limit} onPageChange={(p) => setPage(p)} className="mt-3" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── PROGRESS PANEL ───────────────────────────────────────────── */}
          {selectedBook === "progress" && (
            <div className="bs-panel-content">
              <h2 className="bs-panel-title">Tiến Trình</h2>
              {/* Fixed top: Stats */}
              <div className="bs-progress-stats">
                <div className="bs-progress-header">
                  <div className="bs-progress-icon"><Flame className="w-4 h-4 text-amber-500" /></div>
                  <span className="bs-progress-label">Tiến trình học tập</span>
                  <button type="button" onClick={() => setIsTitlesModalOpen(true)} className="bs-equipped-badge" title="Nhấn để đổi danh hiệu">
                    <Award className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[100px]">{equippedTitle}</span>
                  </button>
                </div>
                <div className="bs-stats-grid">
                  <div className="bs-stat-card">
                    <span className="bs-stat-label">Chuỗi ngày học</span>
                    <div className="bs-stat-value">{streakDays} <span className="bs-stat-unit">ngày liên tục</span></div>
                  </div>
                  <div className="bs-stat-card">
                    <span className="bs-stat-label">Tổng thời gian</span>
                    <div className="bs-stat-value">{studyHours} <span className="bs-stat-unit">giờ tích lũy</span></div>
                  </div>
                </div>
                {/* Week progress */}
                <div className="bs-week-progress">
                  <div className="bs-week-header">
                    <span>Mục tiêu tuần ({activeDaysCount}/7 ngày)</span>
                    <span className="bs-week-percent">{weekProgressPercent}%</span>
                  </div>
                  <div className="bs-week-bars">
                    {weekDays.map((day, idx) => (
                      <div key={idx} className="bs-day-col">
                        <div className={cn("bs-day-bar", day.active && "bs-day-active", day.isToday && !day.active && "bs-day-today")} />
                        <span className={cn("bs-day-label", day.isToday && "bs-day-label-today")}>{day.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Online friends */}
                <div className="bs-online-friends">
                  <span className="bs-online-dot" /> Bạn bè đang học ({onlineFriends.length})
                </div>
              </div>
              {/* Scrollable titles list */}
              <div
                className="bs-detail-scroll"
                onWheel={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
              >
                <div className="bs-titles-header">
                  <span>Bộ sưu tập Danh hiệu & Quân hàm ({totalUnlocked}/{totalTitles})</span>
                </div>
                <div className="bs-title-tabs">
                  {TITLE_FILTER_TABS.map((tab) => (
                    <button key={tab.id} onClick={() => setTitleFilter(tab.id)} className={cn("bs-pill", titleFilter === tab.id && "bs-pill-active")}>{tab.label}</button>
                  ))}
                </div>
                <div className="bs-milestones-list">
                  {filteredMilestones.map((milestone, mIdx) => (
                    <div key={milestone.milestoneId || mIdx} className="bs-milestone">
                      <div className="bs-milestone-header">
                        <span className="bs-milestone-desc">{milestone.description}</span>
                        <span className="bs-milestone-progress">{milestone.progress?.current}/{milestone.progress?.target} {milestone.progress?.unit}</span>
                      </div>
                      <div className="bs-milestone-bar-wrap">
                        <div className="bs-milestone-bar" style={{ width: `${milestone.progress?.percent || 0}%` }} />
                      </div>
                      <div className="bs-title-cards">
                        {(milestone.titles || []).map((t) => {
                          const style = TITLE_STYLE_MAP[t.name] || {};
                          return (
                            <div key={t.id} className={cn("bs-title-card", !t.isUnlocked && "bs-title-locked")}>
                              <div className="bs-title-card-info">
                                <span className="bs-title-name">{t.name}</span>
                                <span className="bs-title-tag">{t.tag || style.tag || ""}</span>
                              </div>
                              {t.isUnlocked ? (
                                t.isEquipped ? (
                                  <span className="bs-title-equipped">✓ Đang dùng</span>
                                ) : (
                                  <button onClick={() => handleEquipTitle(t.id, t.name)} disabled={equippingId === t.id} className="bs-title-equip-btn">
                                    {equippingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Trang bị"}
                                  </button>
                                )
                              ) : (
                                <span className="bs-title-lock">🔒</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CHAT PANEL ───────────────────────────────────────────────── */}
          {selectedBook === "chat" && (
            <div className="bs-panel-content bs-chat-layout">
              <h2 className="bs-panel-title">Trò Chuyện</h2>
              <div className={cn("bs-chat-container", activeChat ? "bs-chat-mobile-chat-open" : "bs-chat-mobile-no-chat")}>
                {/* Left column: conversation list */}
                <div className="bs-chat-sidebar">
                  <div className="bs-chat-sidebar-header">
                    <span className="bs-chat-sidebar-title">Đoạn chat</span>
                    <span className="bs-chat-online-count">{onlineFriendsCount} online</span>
                  </div>
                  <div className="bs-chat-search-wrap">
                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 opacity-40" />
                    <input
                      type="text"
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      onFocus={() => {
                        if (typeof window !== "undefined") {
                          window.scrollTo(0, 0);
                          document.documentElement.scrollTop = 0;
                          document.body.scrollTop = 0;
                        }
                      }}
                      placeholder="Tìm kiếm bạn bè, đoạn chat..."
                      className="bs-chat-search"
                    />
                  </div>

                  {/* Messenger-style Active / Online Friends Bar */}
                  {friends.length > 0 && (
                    <div className="bs-chat-stories-bar">
                      <div
                        ref={storiesScrollRef}
                        className="bs-chat-stories-scroll"
                        onMouseDown={(e) => {
                          storiesDragState.current = {
                            isDown: true,
                            startX: e.pageX - e.currentTarget.offsetLeft,
                            scrollLeft: e.currentTarget.scrollLeft,
                            moved: false,
                          };
                        }}
                        onMouseLeave={() => {
                          if (storiesDragState.current.isDown) {
                            storiesDragState.current.isDown = false;
                          }
                        }}
                        onMouseUp={() => {
                          storiesDragState.current.isDown = false;
                        }}
                        onMouseMove={(e) => {
                          if (!storiesDragState.current.isDown) return;
                          e.preventDefault();
                          const x = e.pageX - e.currentTarget.offsetLeft;
                          const walk = (x - storiesDragState.current.startX) * 1.5;
                          if (Math.abs(walk) > 4) {
                            storiesDragState.current.moved = true;
                          }
                          e.currentTarget.scrollLeft = storiesDragState.current.scrollLeft - walk;
                        }}
                        onWheel={(e) => {
                          if (e.deltaY !== 0) {
                            e.stopPropagation();
                            e.currentTarget.scrollLeft += e.deltaY;
                          }
                        }}
                      >
                        {friends.map((f) => {
                          const isOnline = f.isOnline;
                          return (
                            <button
                              key={`story-${f._id || f.id}`}
                              type="button"
                              onClick={() => {
                                if (storiesDragState.current.moved) return;
                                handleOpenDirectChat(f);
                              }}
                              className="bs-chat-story-item"
                              title={`Nhắn tin với ${f.name}`}
                            >
                              <div className="bs-chat-story-avatar-wrap">
                                <div className="bs-chat-story-avatar">
                                  {f.avatar ? (
                                    <img src={f.avatar} alt={f.name} className="w-full h-full object-cover rounded-full" />
                                  ) : (
                                    <span>{f.name?.[0]?.toUpperCase() || "?"}</span>
                                  )}
                                </div>
                                {isOnline && <span className="bs-chat-story-online-dot" />}
                              </div>
                              <span className="bs-chat-story-name">
                                {f.name?.trim().split(" ").slice(-1)[0] || f.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div
                    className="bs-chat-list"
                    onWheel={(e) => e.stopPropagation()}
                    onPointerMove={(e) => e.stopPropagation()}
                  >
                    {chatLoading ? (
                      <div className="bs-chat-loading">Đang tải...</div>
                    ) : filteredConversations.length === 0 && friends.length === 0 ? (
                      <div className="bs-chat-empty">Chưa có cuộc trò chuyện nào.</div>
                    ) : (
                      <>
                        {filteredConversations.map((conv) => {
                          const partner = conv.participants?.find((p) => String(p._id) !== String(user?._id || user?.id));
                          const name = conv.isGroup ? (conv.name || "Nhóm") : (partner?.name || "Bạn bè");
                          const isOnline = !conv.isGroup && partner?.isOnline;
                          const isActive = String(activeChat?._id) === String(conv._id);
                          const lastMsg = conv.lastMessage;
                          return (
                            <div
                              key={conv._id}
                              className={cn(
                                "bs-chat-item group relative flex items-center justify-between",
                                isActive && "bs-chat-item-active"
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => setActiveChat(conv)}
                                className="flex items-center gap-2.5 min-w-0 flex-1 text-left bg-transparent border-none p-0 cursor-pointer"
                              >
                                <div className="bs-chat-avatar-wrap">
                                  <div className="bs-chat-avatar">
                                    {partner?.avatar ? (
                                      <img src={partner.avatar} alt={name} className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                      <span>{name[0]?.toUpperCase() || "?"}</span>
                                    )}
                                  </div>
                                  {isOnline && <span className="bs-chat-online-dot" />}
                                </div>
                                <div className="bs-chat-item-info min-w-0 flex-1">
                                  <span className="bs-chat-item-name truncate">{name}</span>
                                  <span className="bs-chat-item-preview truncate">
                                    {lastMsg?.isRecalled
                                      ? "Tin nhắn đã thu hồi"
                                      : lastMsg?.content?.slice(0, 40) ||
                                        (lastMsg?.fileUrl ? `📎 ${cleanFileName(lastMsg?.fileName || "File")}` : "")}
                                  </span>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTargetConv(conv);
                                }}
                                title="Xóa đoạn chat này"
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-950/40 transition shrink-0 ml-1 cursor-pointer"
                                aria-label="Xóa đoạn chat"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                        {/* Friends not in conversations */}
                        {friends.filter(f => !conversations.some(c => c.participants?.some(p => String(p._id) === String(f._id)))).map((friend) => (
                          <button key={friend._id} onClick={() => handleOpenDirectChat(friend)} className="bs-chat-item">
                            <div className="bs-chat-avatar-wrap">
                              <div className="bs-chat-avatar">{friend.name?.[0]?.toUpperCase() || "?"}</div>
                              {friend.isOnline && <span className="bs-chat-online-dot" />}
                            </div>
                            <div className="bs-chat-item-info">
                              <span className="bs-chat-item-name">{friend.name}</span>
                              <span className="bs-chat-item-preview">Nhắn tin</span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                {/* Right column: chat messages */}
                <div className="bs-chat-main">
                  {!activeChat ? (
                    <div className="bs-chat-placeholder">
                      <MessageSquare className="w-8 h-8 opacity-20" />
                      <p>Chọn một cuộc trò chuyện</p>
                    </div>
                  ) : (
                    <>
                      <div className="bs-chat-main-header flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Nút quay lại trên Mobile tương tự Messenger */}
                          <button
                            type="button"
                            onClick={() => setActiveChat(null)}
                            className="bs-chat-back-btn"
                            title="Quay lại danh sách"
                            aria-label="Quay lại danh sách"
                          >
                            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                          </button>
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-amber-800/40 border border-amber-600/30 flex items-center justify-center font-bold text-xs text-amber-200 overflow-hidden">
                              {(() => {
                                const p = activeChat.participants?.find((p2) => String(p2._id) !== String(user?._id || user?.id));
                                const partnerName = activeChat.isGroup ? (activeChat.name || "Nhóm") : (p?.name || "Bạn bè");
                                if (p?.avatar) {
                                  return <img src={p.avatar} alt={partnerName} className="w-full h-full object-cover" />;
                                }
                                return partnerName[0]?.toUpperCase() || "?";
                              })()}
                            </div>
                            {(() => {
                              const p = activeChat.participants?.find((p2) => String(p2._id) !== String(user?._id || user?.id));
                              return !activeChat.isGroup && p?.isOnline ? <span className="bs-chat-online-dot" /> : null;
                            })()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="bs-chat-partner-name truncate">
                              {activeChat.isGroup ? (activeChat.name || "Nhóm") : activeChat.participants?.find((p) => String(p._id) !== String(user?._id || user?.id))?.name || "Bạn bè"}
                            </span>
                            {(() => {
                              const p = activeChat.participants?.find((p2) => String(p2._id) !== String(user?._id || user?.id));
                              return !activeChat.isGroup && p?.isOnline ? (
                                <span className="bs-chat-status-online text-[10px] leading-tight">Đang hoạt động</span>
                              ) : (
                                <span className="text-[10px] text-stone-400 opacity-70 leading-tight">Ngoại tuyến</span>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            type="button"
                            onClick={() => setDeleteTargetConv(activeChat)}
                            title="Xóa đoạn chat này"
                            className="p-1 rounded text-stone-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            aria-label="Xóa đoạn chat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {!activeChat.isGroup && (
                            <button
                              type="button"
                              onClick={() => {
                                const p = activeChat.participants?.find((p2) => String(p2._id) !== String(user?._id || user?.id));
                                if (p) setUnfriendTarget(p);
                              }}
                              title="Hủy kết bạn"
                              className="p-1 rounded text-stone-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                              aria-label="Hủy kết bạn"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div
                        className="bs-chat-messages"
                        ref={chatMessagesContainerRef}
                        onClick={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                        onPointerMove={(e) => e.stopPropagation()}
                      >
                        {chatMsgLoading ? (
                          <div className="bs-chat-loading">Đang tải tin nhắn...</div>
                        ) : chatMessages.length === 0 ? (
                          <div className="bs-chat-empty-msg">Bắt đầu cuộc trò chuyện!</div>
                        ) : (
                          chatMessages.map((msg) => {
                            const isMine = String(msg.sender?._id || msg.sender) === String(user?._id || user?.id);
                            const isAudio = msg.type === "audio" || Boolean(msg.audioUrl) || msg.fileType?.startsWith("audio/");
                            const textContent = msg.content || msg.text;

                            return (
                              <div
                                key={msg._id}
                                className={cn("bs-msg-row group", isMine ? "bs-msg-row-mine" : "bs-msg-row-other")}
                              >
                                <div className={cn("bs-msg", isMine ? "bs-msg-mine" : "bs-msg-other")}>
                                  {msg.isRecalled ? (
                                    <span className="bs-msg-recalled">Tin nhắn đã thu hồi</span>
                                  ) : (
                                    <>
                                      {isAudio ? (
                                        <AudioPlayer
                                          audioUrl={msg.audioUrl || msg.fileUrl}
                                          duration={msg.duration}
                                          isMine={isMine}
                                        />
                                      ) : (
                                        <>
                                          {msg.fileUrl && (
                                            msg.fileType?.startsWith("image/") ? (
                                              <img
                                                src={msg.fileUrl}
                                                alt={cleanFileName(msg.fileName) || "ảnh"}
                                                className="bs-msg-image cursor-pointer max-h-60 rounded-xl object-cover hover:opacity-95 transition"
                                                onClick={() => setLightboxImage({ src: msg.fileUrl, alt: cleanFileName(msg.fileName) })}
                                              />
                                            ) : (
                                              <div className="my-1 w-full max-w-xs">
                                                <FileItemCard
                                                  file={{
                                                    fileUrl: msg.fileUrl,
                                                    fileName: cleanFileName(msg.fileName),
                                                    fileType: msg.fileType,
                                                    fileSize: msg.fileSize,
                                                  }}
                                                  compact={true}
                                                />
                                              </div>
                                            )
                                          )}
                                          {textContent && <span className="bs-msg-text">{textContent}</span>}
                                        </>
                                      )}

                                      {/* Action buttons (Recall + Reaction trigger) */}
                                      {!msg.isRecalled && (
                                        <div className="flex items-center gap-0.5 shrink-0">
                                          {isMine && (
                                            <button
                                              type="button"
                                              onClick={() => setRecallTargetMsg(msg)}
                                              className="bs-msg-recall-btn"
                                              title="Thu hồi tin nhắn"
                                            >
                                              <RotateCcw className="w-3 h-3" />
                                            </button>
                                          )}
                                          <MessageReactions
                                            message={msg}
                                            currentUserId={user?._id || user?.id}
                                            onReact={(emoji) => handleReactMessage(msg._id, emoji)}
                                            isMine={isMine}
                                            canReact={!msg.isRecalled}
                                          />
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Reaction Badge */}
                                {!msg.isRecalled && msg.reactions && msg.reactions.length > 0 && (
                                  <div className={cn("mt-0.5", isMine ? "mr-1 self-end" : "ml-1 self-start")}>
                                    <ReactionBadge
                                      reactions={msg.reactions}
                                      currentUserId={user?._id || user?.id}
                                      onReact={(emoji) => handleReactMessage(msg._id, emoji)}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      {/* Upload bar */}
                      {(attachedFile || uploadedFileData || uploadingFile || uploadError) && (
                        <div className="bs-chat-upload-bar flex items-center justify-between px-3 py-2 bg-[#2d281f]/80 border-t border-amber-900/30 text-xs">
                          {uploadingFile ? (
                            <div className="flex items-center gap-2 text-stone-300">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                              <span className="truncate max-w-[200px]">
                                Đang tải lên {cleanFileName(attachedFile?.name)} ({uploadProgress}%)...
                              </span>
                            </div>
                          ) : uploadError ? (
                            <div className="flex items-center gap-2 text-rose-400">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[240px]">{uploadError}</span>
                            </div>
                          ) : uploadedFileData ? (
                            <div className="flex items-center gap-2 text-stone-200">
                              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="font-medium text-emerald-400 truncate max-w-[200px]">
                                {cleanFileName(uploadedFileData.fileName)}
                              </span>
                              {uploadedFileData.fileSize > 0 && (
                                <span className="text-[10px] text-stone-400">
                                  ({formatFileSize(uploadedFileData.fileSize)})
                                </span>
                              )}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setAttachedFile(null);
                              setUploadedFileData(null);
                              setUploadError(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="bs-chat-upload-clear p-1 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition shrink-0 ml-2 cursor-pointer"
                            title="Hủy tệp đính kèm"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {/* Input bar */}
                      <div className="bs-chat-input-bar relative">
                        {isRecordingVoice ? (
                          <VoiceRecorder
                            onSend={handleSendVoiceMessage}
                            onCancel={() => setIsRecordingVoice(false)}
                            className="w-full"
                          />
                        ) : (
                          <>
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="bs-chat-attach-btn"
                              title="Đính kèm tệp / ảnh"
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsRecordingVoice(true)}
                              className="bs-chat-attach-btn"
                              title="Ghi âm tin nhắn thoại"
                            >
                              <Mic className="w-4 h-4" />
                            </button>
                            <EmojiPickerPopover
                              onSelect={(emoji) => setChatText((prev) => prev + emoji)}
                              triggerClassName="bs-chat-attach-btn"
                              align="left"
                            />
                            <input
                              type="text"
                              value={chatText}
                              onChange={(e) => setChatText(e.target.value)}
                              onFocus={() => {
                                if (typeof window !== "undefined") {
                                  window.scrollTo(0, 0);
                                  document.documentElement.scrollTop = 0;
                                  document.body.scrollTop = 0;
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage();
                                }
                              }}
                              placeholder="Nhắn tin..."
                              className="bs-chat-text-input"
                            />
                            <button
                              type="button"
                              onClick={handleSendMessage}
                              disabled={!chatText.trim() && !uploadedFileData}
                              className="bs-chat-send-btn"
                              title="Gửi"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Blossom particles */}
        <div className="bs-blossom-field" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="bs-blossom" style={{
              "--bx": `${5 + i * 11}%`,
              "--bs": `${16 + (i % 4) * 5}px`,
              "--br": `${(i * 37) % 90 - 20}deg`,
              "--bd": `${8 + (i % 3) * 2}s`,
              "--bdelay": `${-(i * 1.3)}s`,
            }}><i /><i /><i /><i /><i /></span>
          ))}
        </div>
      </main>

      {/* ── MOBILE DRAWER MENU ────────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {user && (
        <div
          className={cn(
            "fixed top-0 right-0 h-full w-[280px] bg-[#1a1612] border-l border-amber-900/30 p-5 z-50 flex flex-col transition-transform duration-300 ease-in-out md:hidden text-[#f5ede3]",
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng người dùng"
        >
          <div className="flex-1 overflow-y-auto max-h-screen flex flex-col space-y-3 pr-1 pb-28">
            {/* Đầu Drawer: Thông tin người dùng + Nút đóng (X) ở góc phải */}
            <div className="flex items-center justify-between pb-3 border-b border-amber-900/30">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 border-2 border-amber-500/40 ring-1 ring-amber-500/20 shrink-0">
                  <AvatarImage src={user.avatar} alt={user.name || "Avatar"} />
                  <AvatarFallback className="bg-amber-500/20 text-xs font-bold text-amber-200">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <h3 className="text-sm font-bold text-[#f5ede3] truncate">
                    {user.name || "Học Giả"}
                  </h3>
                  <p className="text-[11px] text-[#8C7E72] truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-[#26201c] transition cursor-pointer shrink-0"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 1. Huy hiệu ("Thiếu úy" / Quân hàm) */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#a89b8d]">
                  Quân hàm học giả
                </span>
                <div className="text-xs font-serif font-bold text-amber-300 truncate">
                  {equippedTitle}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsTitlesModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 transition cursor-pointer shrink-0"
              >
                Đổi
              </button>
            </div>

            {/* 2. Nút "Kích hoạt VIP" / Trạng thái VIP */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsVipModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium text-[#f5ede3] bg-[#221c17] hover:bg-[#2c241e] border border-amber-900/30 transition text-left cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Crown className="h-4 w-4 text-amber-400" />
                <span>{Boolean(user?.isVip || user?.isPro) ? "Trạng thái VIP" : "Kích hoạt VIP"}</span>
              </span>
              {Boolean(user?.isVip || user?.isPro) ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Đã kích hoạt
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  Nâng cấp
                </span>
              )}
            </button>

            {/* 3. Nút "Thêm bạn (+)" */}
            <div className="w-full">
              <AddFriendDialog
                trigger={
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium text-[#f5ede3] bg-[#221c17] hover:bg-[#2c241e] border border-amber-900/30 transition text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <UserPlus className="h-4 w-4 text-[#c3a47b]" />
                      <span>Thêm bạn (+)</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-stone-500" />
                  </button>
                }
              />
            </div>

            {/* Các liên kết điều hướng khác: Profile */}
            <div className="space-y-1 pt-1 border-t border-amber-900/20">
              <Link
                href="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl text-sm font-medium text-[#d8c8b4] hover:text-[#f5ede3] hover:bg-[#221c17] transition"
              >
                <span className="flex items-center gap-2.5">
                  <User className="h-4 w-4 text-[#c3a47b]" />
                  <span>Quản lý hồ sơ & Bảo mật</span>
                </span>
                <ChevronRight className="h-4 w-4 text-stone-500" />
              </Link>

              {user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl text-sm font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 transition"
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                    <span>Cổng Admin</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-amber-500" />
                </Link>
              )}
            </div>

            {/* 4. Nút gạt chuyển đổi giao diện Sáng / Tối (Theme toggle) */}
            <div className="pt-2 border-t border-amber-900/20">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#221c17] border border-amber-900/30">
                <span className="text-xs font-medium text-[#d8c8b4]">
                  Giao diện (Sáng / Tối)
                </span>
                <ThemeToggle />
              </div>
            </div>

            {/* 5. NÚT ĐĂNG XUẤT NẰM TRONG LUỒNG CUỘN (KÈM KHOẢNG ĐỆM ĐÁY AN TOÀN) */}
            <div className="mt-4 pb-8">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 font-medium hover:bg-red-950/40 transition-colors cursor-pointer"
              >
                <LogOut className="w-5 h-5"/>
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} user={user} />
      <VipStatusModal isOpen={isVipModalOpen} onClose={() => setIsVipModalOpen(false)} user={user} />
      <TitlesModal isOpen={isTitlesModalOpen} onClose={() => setIsTitlesModalOpen(false)} onEquippedChange={(newTitle) => {
        setUser((prev) => prev ? { ...prev, equippedTitle: newTitle, title: newTitle } : prev);
        titlesApi.getTitles().then((res) => { if (res?.data) setTitlesData(res.data); }).catch(() => { });
      }} />

      {/* Recall confirmation */}
      {recallTargetMsg && (
        <div className="bs-recall-overlay" onClick={() => setRecallTargetMsg(null)}>
          <div className="bs-recall-modal" onClick={(e) => e.stopPropagation()}>
            <p>Thu hồi tin nhắn này?</p>
            <div className="bs-recall-actions">
              <button onClick={() => setRecallTargetMsg(null)} className="bs-recall-cancel">Hủy</button>
              <button onClick={handleRecallMessage} disabled={isRecalling} className="bs-recall-confirm">
                {isRecalling ? "Đang thu hồi..." : "Thu hồi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && <ImageLightboxModal image={lightboxImage} onClose={() => setLightboxImage(null)} />}

      {/* Unfriend Confirm Modal */}
      <UnfriendConfirmModal
        isOpen={Boolean(unfriendTarget)}
        onClose={() => !isUnfriending && setUnfriendTarget(null)}
        onConfirm={handleConfirmUnfriend}
        friendName={unfriendTarget?.name || "người dùng này"}
        isLoading={isUnfriending}
      />

      {/* Delete Conversation Confirm Modal */}
      <DeleteConversationConfirmModal
        isOpen={Boolean(deleteTargetConv)}
        onClose={() => !isDeletingConv && setDeleteTargetConv(null)}
        onConfirm={handleConfirmDeleteConv}
        conversationName={(() => {
          if (!deleteTargetConv) return "cuộc trò chuyện này";
          if (deleteTargetConv.isGroup) return deleteTargetConv.name || "nhóm trò chuyện này";
          const partner = deleteTargetConv.participants?.find(
            (p) => String(p._id || p.id) !== String(user?._id || user?.id)
          );
          return partner?.name ? `cuộc trò chuyện với ${partner.name}` : "cuộc trò chuyện này";
        })()}
        isLoading={isDeletingConv}
      />
    </div>
  );
}
