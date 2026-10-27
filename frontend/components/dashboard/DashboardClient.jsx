"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, LogOut, Search, X, Crown, User, ShieldCheck, Sparkles } from "lucide-react";
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
import VipStatusModal from "@/components/vip/VipStatusModal";
import UserTitleBadge from "@/components/titles/UserTitleBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
  const [myPendingRoom, setMyPendingRoom] = useState(null);
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
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
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

    const handleOpenVipModal = () => setIsVipModalOpen(true);
    const handleOpenPricingModal = () => {
      setIsVipModalOpen(false);
      setIsPricingOpen(true);
    };

    window.addEventListener("vsr:title-updated", handleTitleUpdated);
    window.addEventListener("vsr:user-updated", handleUserUpdated);
    window.addEventListener("vsr:open-chat-conversation", handleOpenChat);
    window.addEventListener("vsr:open-vip-modal", handleOpenVipModal);
    window.addEventListener("vsr:open-pricing-modal", handleOpenPricingModal);

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
      window.removeEventListener("vsr:open-vip-modal", handleOpenVipModal);
      window.removeEventListener("vsr:open-pricing-modal", handleOpenPricingModal);
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
      const roomList = result?.data?.rooms || [];
      setRooms(roomList);
      const pending =
        result?.data?.myPendingRoom ||
        roomList.find((r) => r.isMyPendingRoom) ||
        null;
      setMyPendingRoom(pending);
      const pageMeta = result?.data?.pagination || result?.pagination;
      if (pageMeta) {
        setPagination(pageMeta);
      }
    } catch {
      setRooms([]);
      setMyPendingRoom(null);
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
      if (participants.length === 0) {
        setRooms((prev) =>
          prev.filter(
            (r) =>
              (r.roomCode || r.inviteCode || "").toUpperCase() !==
              syncCode.toUpperCase()
          )
        );
        return;
      }
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

    const onRoomListUpdated = ({ roomCode, action }) => {
      if (!roomCode) {
        fetchRooms();
        return;
      }
      if (action === "deleted" || action === "closed") {
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

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  return (
    <div className="min-h-[100dvh] bg-[#141210] text-[#a89b8d]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#3a3128] bg-[#181513]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link
            href="/?book=rooms"
            className="group flex items-center gap-2.5 font-serif text-base font-semibold tracking-tight text-[#f5ede3] hover:opacity-90 transition"
          >
            <img
              src="/image/logo.png"
              alt="Virtual Study Room Logo"
              className="h-7 w-auto object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
            />
            <span>Virtual Study Room</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
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

                <div className="mx-1 h-4 w-[1px] bg-[#3a3128]" />

                {/* Nút Nâng cấp Pro / Badge VIP */}
                {user.isPro || user.isVip ? (
                  <div className="flex items-center gap-1.5">
                    <VipBadge
                      size="sm"
                      showLabel={true}
                      onClick={() => setIsVipModalOpen(true)}
                      className="cursor-pointer transition-all hover:scale-105 active:scale-95 hover:shadow-md hover:shadow-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setIsPricingOpen(true)}
                      className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-[#e8cca4] border border-[#c3a47b]/40 bg-[#c3a47b]/15 hover:bg-[#c3a47b]/25 hover:border-[#c3a47b] transition-all cursor-pointer shadow-xs"
                      title="Gia hạn thêm thời hạn VIP"
                    >
                      <Sparkles className="h-3 w-3 text-amber-400" />
                      <span>Gia hạn VIP</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsPricingOpen(true)}
                    id="btn-upgrade-pro"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                      text-[#e8cca4] border border-[#c3a47b]/50 bg-[#c3a47b]/20
                      hover:bg-[#c3a47b]/30 hover:border-[#c3a47b] transition-all cursor-pointer"
                    title="Nâng cấp VIP Học Giả"
                  >
                    <Crown className="h-3.5 w-3.5 text-[#e8cca4]" />
                    <span className="hidden sm:inline">Nâng cấp Pro</span>
                  </button>
                )}

                {/* Link sang Profile & Security */}
                <Link
                  href="/profile"
                  id="link-profile"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#d8c8b4] hover:text-[#f5ede3] hover:bg-[#26201c] border border-[#3a3128] bg-[#201b18] transition"
                  title="Tài khoản & Bảo mật"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name || "avatar"}
                      className="h-4 w-4 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-3.5 w-3.5 text-[#a89b8d]" />
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
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#c3a47b]/10 text-[#e8cca4] border border-[#c3a47b]/30 hover:bg-[#c3a47b]/20 transition"
                    title="Cổng Quản trị viên"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-[#c3a47b]" />
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
                  className="gap-1.5 text-[#75695e] hover:text-[#f5ede3] hover:bg-[#26201c]"
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
          <h1 className="font-serif text-3xl font-normal tracking-tight text-[#f5ede3]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#a89b8d]">
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
                  <h2 className="text-sm font-medium text-[#f5ede3]">
                    Phòng đang mở
                  </h2>
                  <p className="text-xs text-[#75695e] mt-0.5">
                    {pagination.totalItems > 0
                      ? `${pagination.totalItems} phòng trực tuyến`
                      : "Khám phá phòng học"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Tìm kiếm */}
                  <div className="relative flex-1 sm:w-48">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#75695e]"
                      strokeWidth={1.5}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm theo tên/mã..."
                      className="h-8 w-full rounded-lg border border-[#3a3128] bg-[#141210] pl-8 pr-7 text-xs text-[#f5ede3] placeholder:text-[#75695e] focus:outline-none focus:ring-1 focus:ring-[#c3a47b] focus:border-[#c3a47b]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#75695e] hover:text-[#f5ede3]"
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
                    className="h-8 rounded-lg border border-[#3a3128] bg-[#141210] px-2 text-xs text-[#d8c8b4] focus:outline-none focus:ring-1 focus:ring-[#c3a47b] cursor-pointer"
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
                      className={`whitespace-nowrap px-3 py-1 text-xs rounded-full transition ${
                        isSelected
                          ? "bg-[#c3a47b] text-[#161311] font-semibold shadow-xs"
                          : "bg-[#201b18] text-[#a89b8d] border border-[#3a3128] hover:bg-[#26201c] hover:text-[#f5ede3]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Danh sách phòng */}
            <div className="mt-3 border-t border-[#3a3128]">
              {loadingRooms ? (
                <div className="space-y-0">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse border-b border-[#3a3128] py-4"
                    >
                      <div className="mb-2 h-4 w-40 rounded bg-[#201b18]" />
                      <div className="h-3 w-64 rounded bg-[#201b18]/60" />
                    </div>
                  ))}
                </div>
              ) : rooms.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-[#a89b8d]">
                    Không tìm thấy phòng phù hợp.
                  </p>
                  <p className="mt-1 text-xs text-[#75695e]">
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
          <aside className="space-y-6">
            <div className="rounded-2xl border border-[#3a3128] bg-[#201b18] p-5 shadow-lg">
              <h2 className="text-sm font-medium text-[#f5ede3]">
                Tham gia bằng mã
              </h2>
              <div className="mt-4">
                <JoinRoomForm />
              </div>
            </div>

            <div className="rounded-2xl border border-[#3a3128] bg-[#201b18] p-5 shadow-lg">
              <h2 className="mb-4 text-sm font-medium text-[#f5ede3]">
                Tạo phòng
              </h2>
              <CreateRoomModal pendingRoom={myPendingRoom} />
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

      {/* Modal chi tiết thời hạn & đặc quyền VIP */}
      <VipStatusModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        user={user}
        onOpenPricing={() => {
          setIsVipModalOpen(false);
          setIsPricingOpen(true);
        }}
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
