"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, LogOut, Search, X, Crown, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoomCard } from "@/components/dashboard/RoomCard";
import { CreateRoomModal } from "@/components/dashboard/CreateRoomModal";
import { JoinRoomForm } from "@/components/dashboard/JoinRoomForm";
import {
  roomsApi,
  getStoredUser,
  clearAuthSession,
  notificationsApi,
  messagesApi,
} from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import PricingModal from "@/components/payment/PricingModal";
import VipBadge from "@/components/payment/VipBadge";
import UserTitleBadge from "@/components/titles/UserTitleBadge";
import TitlesModal from "@/components/titles/TitlesModal";
import { PaginationControl } from "@/components/ui/PaginationControl";
import {
  AddFriendDialog,
  NotificationBell,
  MessagesPopover,
  MiniChatBox,
} from "@/components/social";

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

export function DashboardClient() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 8,
  });
  const [activeConversation, setActiveConversation] = useState(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isTitlesModalOpen, setIsTitlesModalOpen] = useState(false);

  // Debounce tìm kiếm 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Lấy thông tin user đã đăng nhập và authenticate socket
  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);

    if (stored) {
      const socket = connectSocket();
      if (socket) {
        socket.emit("user:authenticate", { userId: stored.id || stored._id });
      }

      // Chỉ kiểm tra streak tối đa 1 lần mỗi chu kỳ 24h (mốc 6h sáng)
      try {
        const now = new Date();
        const cycleStart = new Date(now);
        if (now.getHours() < 6) cycleStart.setDate(cycleStart.getDate() - 1);
        cycleStart.setHours(6, 0, 0, 0);

        const saved = localStorage.getItem("vsr_streak_last_checked");
        if (!saved || Number(saved) < cycleStart.getTime()) {
          localStorage.setItem("vsr_streak_last_checked", String(Date.now()));
          notificationsApi.checkStreak().catch(() => {});
        }
      } catch (_) {
        notificationsApi.checkStreak().catch(() => {});
      }
    }
  }, []);

  // Lắng nghe cập nhật danh hiệu & user tức thì
  useEffect(() => {
    const handleTitleUpdated = (e) => {
      const newTitle = e?.detail?.equippedTitle || e?.detail?.title;
      if (newTitle) {
        setUser((prev) =>
          prev ? { ...prev, equippedTitle: newTitle, title: newTitle } : prev
        );
      }
    };

    const handleUserUpdated = (e) => {
      if (e?.detail) {
        setUser((prev) => ({ ...(prev || {}), ...e.detail }));
      }
    };

    const handleOpenChat = async (e) => {
      const { conversationId, friend } = e?.detail || {};

      // Mở ngay tức thì cửa sổ chat với đối phương (0ms delay)
      if (friend?._id || friend?.id) {
        const stored = getStoredUser();
        setActiveConversation({
          _id: conversationId,
          isGroup: false,
          participants: [friend, stored || user].filter(Boolean),
        });
      }

      if (conversationId) {
        try {
          const res = await messagesApi.getConversations();
          const found = res?.data?.conversations?.find(
            (c) => String(c._id) === String(conversationId)
          );
          if (found) {
            setActiveConversation(found);
            return;
          }
        } catch (_) { }
      }
      if (friend?._id || friend?.id) {
        try {
          const res = await messagesApi.getOrCreateDirect(friend._id || friend.id);
          if (res?.data?.conversation) {
            setActiveConversation(res.data.conversation);
          }
        } catch (_) { }
      }
    };

    window.addEventListener("vsr:title-updated", handleTitleUpdated);
    window.addEventListener("vsr:user-updated", handleUserUpdated);
    window.addEventListener("vsr:open-chat-conversation", handleOpenChat);

    const socket = connectSocket();
    const handleSocketTitle = (data) => {
      const stored = getStoredUser();
      const currentId = stored?._id || stored?.id;
      if (data && (!data.userId || data.userId === currentId)) {
        const newTitle = data.equippedTitle || data.title;
        if (newTitle) {
          setUser((prev) =>
            prev ? { ...prev, equippedTitle: newTitle, title: newTitle } : prev
          );
        }
      }
    };

    if (socket) {
      socket.on("user:title-updated", handleSocketTitle);
    }

    return () => {
      window.removeEventListener("vsr:title-updated", handleTitleUpdated);
      window.removeEventListener("vsr:user-updated", handleUserUpdated);
      window.removeEventListener("vsr:open-chat-conversation", handleOpenChat);
      if (socket) {
        socket.off("user:title-updated", handleSocketTitle);
      }
    };
  }, []);

  // Lấy danh sách phòng từ API theo params (Server-side search, filter, sort, pagination)
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const params = {
        page,
        limit: 8,
        search: debouncedSearch,
        category: category === "all" ? undefined : category,
        sort: sortBy,
      };
      const result = await roomsApi.list(params);
      setRooms(result?.data?.rooms || []);
      const pageMeta = result?.data?.pagination || result?.pagination;
      if (pageMeta) {
        setPagination(pageMeta);
      }
    } catch {
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, [page, debouncedSearch, category, sortBy]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Lắng nghe Socket.io để cập nhật danh sách phòng realtime
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onRoomCreated = ({ room }) => {
      if (!room || room.isPrivate) return;
      // Refresh current page data to maintain sorting and counts
      fetchRooms();
    };

    const onRoomDeleted = ({ roomCode }) => {
      if (!roomCode) return;
      setRooms((prev) =>
        prev.filter(
          (r) =>
            (r.roomCode || r.inviteCode || "").toUpperCase() !==
            roomCode.toUpperCase()
        )
      );
      setPagination((prev) => ({
        ...prev,
        totalItems: Math.max(0, prev.totalItems - 1),
      }));
    };

    const onMembersSync = ({ participants, roomCode: syncCode }) => {
      if (!syncCode || !Array.isArray(participants)) return;
      setRooms((prev) =>
        prev.map((r) => {
          const code = (r.roomCode || r.inviteCode || "").toUpperCase();
          if (code === syncCode.toUpperCase()) {
            return { ...r, participants, participantCount: participants.length };
          }
          return r;
        })
      );
    };

    socket.on("dashboard:room-created", onRoomCreated);
    socket.on("dashboard:room-deleted", onRoomDeleted);
    socket.on("room:members-sync", onMembersSync);

    return () => {
      socket.off("dashboard:room-created", onRoomCreated);
      socket.off("dashboard:room-deleted", onRoomDeleted);
      socket.off("room:members-sync", onMembersSync);
    };
  }, [fetchRooms]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  return (
    <div className="min-h-[100dvh]">
      {/* Header */}
      <header className="border-b border-zinc-800/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-zinc-50"
          >
            Virtual Study Room
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Nút Tìm & Kết bạn */}
                <AddFriendDialog />

                {/* Chuông thông báo lời mời kết bạn */}
                <NotificationBell user={user} />

                {/* Hộp tin nhắn Messages kiểu Messenger */}
                <MessagesPopover
                  user={user}
                  onSelectConversation={(conv) => setActiveConversation(conv)}
                />

                <div className="mx-1 h-4 w-[1px] bg-zinc-800" />

                {/* Nút Nâng cấp Pro / Badge VIP */}
                {user.isPro ? (
                  <VipBadge size="sm" showLabel={true} />
                ) : (
                  <button
                    onClick={() => setIsPricingOpen(true)}
                    id="btn-upgrade-pro"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                      text-amber-400 border border-amber-400/30 bg-amber-400/5
                      hover:bg-amber-400/10 hover:border-amber-400/50 transition-all"
                    title="Nâng cấp lên Pro"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Nâng cấp Pro</span>
                  </button>
                )}

                {/* Link sang Profile & Security */}
                <Link
                  href="/profile"
                  id="link-profile"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 border border-zinc-800 transition"
                  title="Tài khoản & Bảo mật"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name || "avatar"}
                      className="h-4 w-4 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-3.5 w-3.5 text-zinc-400" />
                  )}
                  <span className="hidden md:inline max-w-[120px] truncate">
                    {user.name || user.email}
                  </span>
                </Link>

                {/* Link sang Admin Portal nếu user có quyền ADMIN */}
                {user.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    id="link-admin-portal"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition"
                    title="Cổng Quản trị viên"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                )}

                {/* Danh hiệu / Quân hàm */}
                <UserTitleBadge
                  title={user.equippedTitle || user.title || "Nhập môn học giả"}
                  onClick={() => setIsTitlesModalOpen(true)}
                  size="sm"
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  id="btn-logout"
                  className="gap-1.5 text-zinc-400 hover:text-zinc-100"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Đăng ký</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-10 max-w-lg">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tạo phòng học mới hoặc tham gia bằng mã mời.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
          {/* Danh sách phòng */}
          <section>
            <div className="flex flex-col gap-3">
              {/* Toolbar: Tiêu đề, Tìm kiếm & Sắp xếp */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-zinc-200">
                    Phòng đang mở
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {pagination.totalItems > 0
                      ? `${pagination.totalItems} phòng trực tuyến`
                      : "Khám phá phòng học"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Tìm kiếm */}
                  <div className="relative flex-1 sm:w-48">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                      strokeWidth={1.5}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm theo tên/mã..."
                      className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-8 pr-7 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>

                  {/* Sắp xếp */}
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
                    title="Sắp xếp danh sách"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bộ lọc phân loại (Categories) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategory(cat.id);
                        setPage(1);
                      }}
                      className={`whitespace-nowrap px-2.5 py-1 text-xs rounded-full transition ${isSelected
                          ? "bg-zinc-100 text-zinc-950 font-medium shadow-xs"
                          : "bg-zinc-900/60 text-zinc-400 border border-zinc-800/80 hover:bg-zinc-800 hover:text-zinc-200"
                        }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Danh sách phòng */}
            <div className="mt-3 border-t border-zinc-800/60">
              {loadingRooms ? (
                <div className="space-y-0">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse border-b border-zinc-800/60 py-4"
                    >
                      <div className="mb-2 h-4 w-40 rounded bg-zinc-800/60" />
                      <div className="h-3 w-64 rounded bg-zinc-800/40" />
                    </div>
                  ))}
                </div>
              ) : rooms.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-zinc-400">
                    Không tìm thấy phòng phù hợp.
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {searchQuery || category !== "all"
                      ? "Thử xóa bộ lọc hoặc tìm kiếm với từ khóa khác."
                      : "Chưa có phòng nào đang mở. Tạo phòng học đầu tiên để bắt đầu."}
                  </p>
                </div>
              ) : (
                rooms.map((room) => (
                  <RoomCard key={room._id || room.id} room={room} />
                ))
              )}
            </div>

            {/* Phân trang */}
            <PaginationControl
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              limit={pagination.limit}
              onPageChange={(p) => setPage(p)}
              className="mt-4"
            />
          </section>

          {/* Sidebar: Tham gia & Tạo phòng */}
          <aside className="space-y-8">
            <div>
              <h2 className="text-sm font-medium text-zinc-300">
                Tham gia bằng mã
              </h2>
              <div className="mt-4">
                <JoinRoomForm />
              </div>
            </div>

            <div className="border-t border-zinc-800/60 pt-8">
              <h2 className="mb-4 text-sm font-medium text-zinc-300">
                Tạo phòng
              </h2>
              <CreateRoomModal />
            </div>
          </aside>
        </div>
      </main>

      {/* Mini chat drawer ở góc phải màn hình */}
      {user && activeConversation && (
        <MiniChatBox
          conversation={activeConversation}
          currentUser={user}
          onClose={() => setActiveConversation(null)}
        />
      )}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        user={user}
      />

      {/* Bộ sưu tập Danh hiệu & Quân hàm Modal */}
      <TitlesModal
        isOpen={isTitlesModalOpen}
        onClose={() => setIsTitlesModalOpen(false)}
        onEquippedChange={(newTitle) => {
          setUser((prev) =>
            prev ? { ...prev, equippedTitle: newTitle, title: newTitle } : prev
          );
        }}
      />
    </div>
  );
}
