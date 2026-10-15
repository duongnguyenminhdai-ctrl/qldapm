"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Compass, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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

export function HomeHeader() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);
  const [isTitlesModalOpen, setIsTitlesModalOpen] = useState(false);

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
          if (stored) {
            setStoredUser({ ...stored, equippedTitle: newTitle, title: newTitle });
          }
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

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setActiveConversation(null);
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-stone-50/80 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950/80 transition-colors duration-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo & Tên nền tảng */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-900 shadow-sm transition-transform duration-taste ease-taste group-hover:scale-105 dark:border-zinc-800/80 dark:bg-zinc-900 dark:text-zinc-100">
              <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold leading-none tracking-tight">
                Virtual Study Room
              </span>
              <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                Không gian tập trung sâu
              </span>
            </span>
          </Link>

          {/* Công cụ bên phải */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* ThemeToggle chuyển đổi giao diện Dark/Light */}
            <ThemeToggle />

            <div className="mx-1 h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800" />

            {!mounted ? (
              <div className="flex items-center gap-1.5">
                <div className="h-8 w-16 animate-pulse rounded-lg bg-zinc-200/50 dark:bg-zinc-800/40" />
                <div className="h-8 w-20 animate-pulse rounded-lg bg-zinc-200/50 dark:bg-zinc-800/40" />
              </div>
            ) : user ? (
              <>
                {/* Nút Kết bạn */}
                <AddFriendDialog />

                {/* Chuông thông báo lời mời kết bạn */}
                <NotificationBell user={user} />

                {/* Hộp tin nhắn Popover kiểu Messenger */}
                <MessagesPopover
                  user={user}
                  onSelectConversation={(conv) => setActiveConversation(conv)}
                />

                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link
                    href="/dashboard"
                    className="gap-1.5 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                  >
                    <Compass className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Dashboard</span>
                  </Link>
                </Button>

                {user.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition"
                    title="Cổng Quản trị viên"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                )}

                <Link
                  href="/profile"
                  className="hidden max-w-[120px] truncate text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 md:inline-block transition"
                  title="Quản lý hồ sơ & Bảo mật"
                >
                  {user.name || user.email}
                </Link>

                {/* Danh hiệu / Quân hàm */}
                <UserTitleBadge
                  title={user.equippedTitle || user.title || "Nhập môn học giả"}
                  onClick={() => setIsTitlesModalOpen(true)}
                  size="xs"
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  id="btn-logout"
                  className="gap-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  title="Đăng xuất"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="hidden md:inline">Đăng xuất</span>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Bắt đầu ngay</Link>
                </Button>
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
    </>
  );
}
