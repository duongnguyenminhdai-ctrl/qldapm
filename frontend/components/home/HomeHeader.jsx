"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Compass,
  Sparkles,
  ShieldCheck,
  SquareStack,
  Crown,
  Menu,
  User,
  UserPlus,
  Award,
  ChevronRight,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  getStoredUser,
  setStoredUser,
  clearAuthSession,
  authApi,
  notificationsApi,
  messagesApi,
} from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import {
  AddFriendDialog,
  NotificationBell,
  MessagesPopover,
  MiniChatBox,
} from "@/components/social";
import UserTitleBadge from "@/components/titles/UserTitleBadge";
import TitlesModal from "@/components/titles/TitlesModal";
import VipBadge from "@/components/payment/VipBadge";
import VipStatusModal from "@/components/vip/VipStatusModal";

export function HomeHeader() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);
  const [isTitlesModalOpen, setIsTitlesModalOpen] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = getStoredUser();
      setUser(stored);
      if (stored) {
        const socket = connectSocket();
        if (socket) {
          socket.emit("user:authenticate", { userId: stored.id || stored._id });
        }
        // Đồng bộ dữ liệu mới nhất từ server
        authApi
          .me()
          .then((res) => {
            if (res?.data?.user) {
              setUser(res.data.user);
              setStoredUser(res.data.user);
            }
          })
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
    } catch {
      setUser(null);
    } finally {
      setMounted(true);
    }
  }, []);

  // Lắng nghe sự kiện cập nhật danh hiệu & user toàn cục và qua socket
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
      } else {
        setUser(null);
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
        } catch (_) {}
      }
      if (friend?._id || friend?.id) {
        try {
          const res = await messagesApi.getOrCreateDirect(friend._id || friend.id);
          if (res?.data?.conversation) {
            setActiveConversation(res.data.conversation);
          }
        } catch (_) {}
      }
    };

    const handleCardDrawn = (e) => {
      const draws = e?.detail?.cardDraws;
      if (draws !== undefined) {
        setUser((prev) => (prev ? { ...prev, cardDraws: draws } : prev));
      }
    };

    const handleOpenVipModal = () => setIsVipModalOpen(true);

    window.addEventListener("vsr:title-updated", handleTitleUpdated);
    window.addEventListener("vsr:user-updated", handleUserUpdated);
    window.addEventListener("vsr:open-chat-conversation", handleOpenChat);
    window.addEventListener("vsr:card-drawn", handleCardDrawn);
    window.addEventListener("vsr:open-vip-modal", handleOpenVipModal);

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
          if (stored) {
            setStoredUser({ ...stored, equippedTitle: newTitle, title: newTitle });
          }
        }
      }
    };

    const handleSocketCard = (data) => {
      if (data?.cardDraws !== undefined) {
        setUser((prev) => (prev ? { ...prev, cardDraws: data.cardDraws } : prev));
      }
    };

    const handleSocketProUpdated = (data) => {
      if (data) {
        setUser((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            isPro: data.isPro !== undefined ? Boolean(data.isPro) : prev.isPro,
            isVip: data.isVip !== undefined ? Boolean(data.isVip) : (data.isPro !== undefined ? Boolean(data.isPro) : prev.isVip),
            proExpiresAt: data.proExpiresAt || prev.proExpiresAt,
            vipExpiresAt: data.vipExpiresAt || data.proExpiresAt || prev.vipExpiresAt,
          };
          setStoredUser(updated);
          return updated;
        });
      }
    };

    if (socket) {
      socket.on("user:title-updated", handleSocketTitle);
      socket.on("card:updated", handleSocketCard);
      socket.on("user:pro-updated", handleSocketProUpdated);
      socket.on("user:updated", handleSocketProUpdated);
    }

    return () => {
      window.removeEventListener("vsr:title-updated", handleTitleUpdated);
      window.removeEventListener("vsr:user-updated", handleUserUpdated);
      window.removeEventListener("vsr:open-chat-conversation", handleOpenChat);
      window.removeEventListener("vsr:card-drawn", handleCardDrawn);
      window.removeEventListener("vsr:open-vip-modal", handleOpenVipModal);
      if (socket) {
        socket.off("user:title-updated", handleSocketTitle);
        socket.off("card:updated", handleSocketCard);
        socket.off("user:pro-updated", handleSocketProUpdated);
        socket.off("user:updated", handleSocketProUpdated);
      }
    };
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setActiveConversation(null);
    setIsMenuOpen(false);
    router.replace("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#3a3128] bg-[#181513]/90 backdrop-blur-sm transition-colors duration-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo & Tên nền tảng */}
          <Link
            href="/?book=rooms"
            className="group flex items-center gap-2 text-sm tracking-tight text-[#f5ede3] shrink-0"
          >
            <img
              src="/image/logo.png"
              alt="Virtual Study Room Logo"
              className="h-8 w-auto object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
            />
            <span className="flex flex-col">
              <span className="font-serif text-base font-semibold leading-none tracking-tight text-[#f5ede3]">
                <span className="hidden sm:inline">Virtual Study Room</span>
                <span className="sm:hidden font-serif italic text-base">VSR</span>
              </span>
              <span className="text-[10px] font-normal text-[#75695e] hidden md:block">
                Không gian tập trung sâu
              </span>
            </span>
          </Link>

          {/* Công cụ bên phải (Desktop: Đầy đủ, Mobile: Tối ưu với Hamburger Drawer) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!mounted ? (
              <div className="flex items-center gap-1.5">
                <div className="h-8 w-16 animate-pulse rounded-lg bg-[#201b18]" />
                <div className="h-8 w-20 animate-pulse rounded-lg bg-[#201b18]" />
              </div>
            ) : user ? (
              <>
                {/* ========================================================
                    DESKTOP NAVIGATION (Hiển thị đầy đủ trên màn hình >= 768px)
                    ======================================================== */}
                <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
                  <div className="hidden md:flex items-center">
                    <ThemeToggle />
                  </div>
                  <div className="hidden md:block mx-0.5 h-4 w-[1px] bg-[#3a3128]" />

                  {/* Nút Kết bạn */}
                  <div className="hidden md:flex items-center">
                    <AddFriendDialog />
                  </div>

                  {/* Chuông thông báo */}
                  <NotificationBell user={user} />

                  {/* Hộp tin nhắn Popover */}
                  <div className="hidden md:flex items-center">
                    <MessagesPopover
                      user={user}
                      onSelectConversation={(conv) => setActiveConversation(conv)}
                    />
                  </div>

                  <Button asChild variant="ghost" size="sm" className="hidden md:flex border border-[#3a3128] hover:bg-[#26201c] text-[#d8c8b4] hover:text-[#f5ede3]">
                    <Link href="/dashboard" className="gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-[#c3a47b]" strokeWidth={1.5} />
                      <span>Dashboard</span>
                    </Link>
                  </Button>

                  {user.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-[#c3a47b]/10 text-[#e8cca4] border border-[#c3a47b]/30 hover:bg-[#c3a47b]/20 transition"
                      title="Cổng Quản trị viên"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-[#c3a47b]" />
                      <span>Admin</span>
                    </Link>
                  )}

                  <Link
                    href="/profile"
                    className="hidden md:block max-w-[120px] truncate text-xs font-medium text-[#a89b8d] hover:text-[#f5ede3] transition"
                    title="Quản lý hồ sơ & Bảo mật"
                  >
                    {user.name || user.email}
                  </Link>

                  {/* Nút Mở Card kèm badge số lượt */}
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("vsr:open-card-modal"));
                      }
                    }}
                    className="hidden md:inline-flex relative items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 cursor-pointer shadow-xs bg-amber-100/90 text-amber-950 border border-amber-400/60 hover:bg-amber-200/90 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/20"
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

                  {/* Huy hiệu VIP */}
                  {Boolean(user?.isVip || user?.isPro) ? (
                    <div className="hidden md:flex items-center">
                      <VipBadge
                        size="sm"
                        showLabel={true}
                        onClick={() => setIsVipModalOpen(true)}
                        className="cursor-pointer transition-all hover:scale-105 active:scale-95 hover:shadow-md hover:shadow-amber-500/20"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsVipModalOpen(true)}
                      className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-serif font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
                      title="Nhấn để xem đặc quyền VIP & cách nhận 30 ngày miễn phí"
                    >
                      <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span>VIP</span>
                    </button>
                  )}

                  {/* Danh hiệu / Quân hàm */}
                  <div className="hidden md:flex items-center">
                    <UserTitleBadge
                      title={user.equippedTitle || user.title || "Nhập môn học giả"}
                      onClick={() => setIsTitlesModalOpen(true)}
                      size="xs"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    id="btn-logout"
                    className="hidden md:flex gap-1.5 text-[#75695e] hover:text-[#f5ede3] hover:bg-[#26201c]"
                    title="Đăng xuất"
                  >
                    <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Đăng xuất</span>
                  </Button>
                </div>

                {/* ========================================================
                    MOBILE NAVBAR (Màn hình < 768px: Tối giản & Trực quan)
                    Thanh Header CHỈ GIỮ LẠI 4 MỤC DUY NHẤT:
                    1. Logo kèm tên ngắn gọn (bên trái).
                    2. Nút Rút Thẻ: Thu nhỏ thành badge gọn gàng [Icon Thẻ | Số lượt], có khoảng đệm riêng, không đè lên logo.
                    3. Icon Chuông thông báo (kèm chấm đỏ số thông báo).
                    4. Avatar người dùng / Nút menu 3 gạch.
                    ======================================================== */}
                <div className="flex md:hidden items-center gap-2">
                  {/* 2. Nút Rút Thẻ: Thu nhỏ thành badge gọn gàng [Icon Thẻ | Số lượt] */}
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("vsr:open-card-modal"));
                      }
                    }}
                    className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 active:scale-95 transition-transform cursor-pointer shrink-0 font-medium text-xs ml-auto"
                    title="Rút Thẻ Bài Học Giả"
                    aria-label="Rút Thẻ Bài Học Giả"
                  >
                    <SquareStack className="w-4 h-4 stroke-current shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="font-mono font-bold text-xs">
                      {user.cardDraws || 0}
                    </span>
                  </button>

                  {/* 3. Icon Chuông thông báo */}
                  <NotificationBell user={user} />

                  {/* 4. Avatar người dùng / Nút menu 3 gạch (☰) */}
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(true)}
                    className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-stone-300 dark:border-[#3a3128] bg-stone-100 dark:bg-[#201b18] text-[#2D241E] dark:text-[#f5ede3] active:scale-95 transition-transform cursor-pointer overflow-hidden p-0.5 shrink-0"
                    aria-label="Mở menu điều hướng"
                    id="btn-mobile-menu-trigger"
                  >
                    <Menu className="h-5 w-5 text-[#6e6358] dark:text-[#d8c8b4]" strokeWidth={1.75} />
                  </button>
                </div>

                {/* Backdrop phủ mờ */}
                {isMenuOpen && (
                  <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden transition-opacity duration-300"
                    onClick={() => setIsMenuOpen(false)}
                    aria-hidden="true"
                  />
                )}

                {/* Khung Drawer trượt từ cạnh phải */}
                <div
                  className={cn(
                    "fixed top-0 right-0 h-full w-[280px] bg-[#1a1612] border-l border-amber-900/30 p-5 z-50 flex flex-col justify-between transition-transform duration-300 ease-in-out md:hidden text-[#f5ede3]",
                    isMenuOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
                  )}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu điều hướng người dùng"
                >
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
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
                        onClick={() => setIsMenuOpen(false)}
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
                          {user.equippedTitle || user.title || "Nhập môn học giả"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
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
                        setIsMenuOpen(false);
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

                    {/* Các liên kết điều hướng khác: Dashboard, Profile */}
                    <div className="space-y-1 pt-1 border-t border-amber-900/20">
                      <Link
                        href="/dashboard"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl text-sm font-medium text-[#d8c8b4] hover:text-[#f5ede3] hover:bg-[#221c17] transition"
                      >
                        <span className="flex items-center gap-2.5">
                          <Compass className="h-4 w-4 text-[#c3a47b]" />
                          <span>Bảng điều khiển (Dashboard)</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-stone-500" />
                      </Link>

                      <Link
                        href="/profile"
                        onClick={() => setIsMenuOpen(false)}
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
                          onClick={() => setIsMenuOpen(false)}
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
                  </div>

                  {/* BỔ SUNG KHỐI ĐĂNG XUẤT Ở ĐÁY DRAWER */}
                  <div className="pt-4 mt-auto border-t border-amber-900/30">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 font-medium hover:bg-red-950/40 transition-colors"
                    >
                      <LogOut className="w-5 h-5"/>
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button asChild variant="ghost" size="sm" className="h-10 px-3">
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button asChild size="sm" className="h-10 px-3">
                  <Link href="/register">Bắt đầu ngay</Link>
                </Button>
                <div className="ml-1 hidden md:flex items-center">
                  <ThemeToggle />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Cửa sổ chat mini ở góc dưới bên phải màn hình */}
      {user && activeConversation && (
        <MiniChatBox
          conversation={activeConversation}
          currentUser={user}
          onClose={() => setActiveConversation(null)}
        />
      )}

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

      {/* Modal chi tiết thời hạn & đặc quyền VIP */}
      <VipStatusModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        user={user}
      />
    </>
  );
}
