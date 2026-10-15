"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Flame,
  Clock,
  Award,
  Users,
  Video,
  Plus,
  ArrowRight,
  Sparkles,
  Lock,
  Globe,
  Radio,
  BookOpen,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  roomsApi,
  friendsApi,
  getStoredUser,
  authApi,
  titlesApi,
  setAuthSession,
} from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { ICON_STROKE } from "@/lib/constants";
import TitlesModal from "@/components/titles/TitlesModal";

export function HomeBentoGrid() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Trạng thái Tạo phòng
  const [createOpen, setCreateOpen] = useState(false);
  const [roomTitle, setRoomTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [isPrivate, setIsPrivate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreating, startCreateTransition] = useTransition();

  // Trạng thái Tham gia bằng mã
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, startJoinTransition] = useTransition();

  // Dữ liệu cá nhân & phòng học
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTitlesModalOpen, setIsTitlesModalOpen] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setMounted(true);

    // Lấy dữ liệu user thực tế từ server nếu đã đăng nhập
    if (stored) {
      // 1. Đồng bộ thông tin profile mới nhất
      authApi
        .me()
        .then((res) => {
          if (res?.data?.user) {
            setUser(res.data.user);
            setAuthSession({ user: res.data.user });
          }
        })
        .catch(() => {});

      // 2. Lấy dữ liệu danh hiệu, streak và giờ học chính xác từ /api/titles
      titlesApi
        .getTitles()
        .then((res) => {
          if (res?.data) {
            setStats(res.data.stats);
            if (res.data.equippedTitle) {
              setUser((prev) =>
                prev ? { ...prev, equippedTitle: res.data.equippedTitle } : prev
              );
            }
          }
        })
        .catch(() => {});

      // 3. Lấy danh sách bạn bè online
      friendsApi
        .list()
        .then((res) => {
          const list = res?.data?.friends || [];
          setOnlineFriends(list.filter((f) => f.isOnline));
        })
        .catch(() => setOnlineFriends([]));
    } else {
      setOnlineFriends([]);
    }

    // Lấy danh sách phòng công khai
    roomsApi
      .list()
      .then((res) => {
        setPublicRooms(res?.data?.rooms || []);
      })
      .catch(() => setPublicRooms([]))
      .finally(() => setLoadingRooms(false));
  }, []);

  // Lắng nghe socket cập nhật danh sách phòng & trạng thái bạn bè realtime
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onRoomCreated = ({ room }) => {
      if (!room || room.isPrivate) return;
      setPublicRooms((prev) => {
        if (prev.some((r) => (r._id || r.id) === (room._id || room.id))) return prev;
        return [room, ...prev];
      });
    };

    const onRoomDeleted = ({ roomCode }) => {
      if (!roomCode) return;
      setPublicRooms((prev) =>
        prev.filter(
          (r) =>
            (r.roomCode || r.inviteCode || "").toUpperCase() !== roomCode.toUpperCase()
        )
      );
    };

    const onMembersSync = ({ participants, roomCode: syncCode }) => {
      if (!syncCode || !Array.isArray(participants)) return;
      setPublicRooms((prev) =>
        prev.map((r) => {
          const code = (r.roomCode || r.inviteCode || "").toUpperCase();
          if (code === syncCode.toUpperCase()) {
            return { ...r, participants };
          }
          return r;
        })
      );
    };

    const onFriendStatus = ({ userId, isOnline }) => {
      setOnlineFriends((prev) => {
        if (isOnline) {
          // Cập nhật trạng thái bạn bè online
          return prev;
        } else {
          return prev.filter((f) => (f._id || f.id) !== userId);
        }
      });
    };

    const onTitleUpdated = ({ userId, equippedTitle, title }) => {
      const stored = getStoredUser();
      const currentId = stored?._id || stored?.id;
      if (!userId || userId === currentId) {
        const newTitle = equippedTitle || title;
        if (newTitle) {
          setUser((prev) =>
            prev ? { ...prev, equippedTitle: newTitle, title: newTitle } : prev
          );
        }
      }
    };

    socket.on("dashboard:room-created", onRoomCreated);
    socket.on("dashboard:room-deleted", onRoomDeleted);
    socket.on("room:members-sync", onMembersSync);
    socket.on("friend:status-change", onFriendStatus);
    socket.on("user:title-updated", onTitleUpdated);

    return () => {
      socket.off("dashboard:room-created", onRoomCreated);
      socket.off("dashboard:room-deleted", onRoomDeleted);
      socket.off("room:members-sync", onMembersSync);
      socket.off("friend:status-change", onFriendStatus);
      socket.off("user:title-updated", onTitleUpdated);
    };
  }, []);

  // Đồng bộ danh hiệu & user tức thì khi trang bị từ bất kỳ đâu mà không cần F5
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

    window.addEventListener("vsr:title-updated", handleTitleUpdated);
    window.addEventListener("vsr:user-updated", handleUserUpdated);

    return () => {
      window.removeEventListener("vsr:title-updated", handleTitleUpdated);
      window.removeEventListener("vsr:user-updated", handleUserUpdated);
    };
  }, []);

  // Xử lý tạo phòng
  const handleCreateRoom = (e) => {
    e.preventDefault();
    const trimmed = roomTitle.trim();
    if (!trimmed) {
      setCreateError("Vui lòng nhập tên phòng học.");
      return;
    }

    setCreateError("");
    startCreateTransition(async () => {
      try {
        const result = await roomsApi.create({
          title: trimmed,
          category,
          isPrivate,
        });
        const code = result?.data?.room?.roomCode;
        if (!code) throw new Error("Không nhận được mã phòng.");
        window.location.assign(`/room/${code}`);
      } catch (err) {
        setCreateError(err.message || "Tạo phòng thất bại. Vui lòng thử lại.");
      }
    });
  };

  // Xử lý tham gia bằng mã
  const handleJoinByCode = (e) => {
    e.preventDefault();
    const trimmed = joinCode.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setJoinError("Mã phòng cần đúng 6 ký tự.");
      return;
    }

    setJoinError("");
    startJoinTransition(async () => {
      try {
        const result = await roomsApi.join({ roomCode: trimmed });
        const code = result?.data?.room?.roomCode;
        if (!code) throw new Error("Không tìm thấy thông tin phòng.");
        router.push(`/room/${code}`);
      } catch (err) {
        setJoinError(err.message || "Mã phòng không tồn tại hoặc đã đóng.");
      }
    });
  };

  // Thống kê chuỗi ngày và giờ học thực tế
  const streakDays = stats?.streak ?? user?.streak ?? (user ? 1 : 0);
  const totalStudySeconds =
    stats?.totalStudySeconds ?? user?.totalStudySeconds ?? 0;
  const studyHours = user
    ? totalStudySeconds > 0
      ? (totalStudySeconds / 3600).toFixed(1)
      : "0.0"
    : "0.0";
  const equippedTitle =
    user?.equippedTitle || user?.title || "Nhập môn học giả";

  // Tính toán tiến trình mục tiêu tuần theo thứ thực tế trong tuần (T2 - CN)
  const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const currentDay = new Date().getDay();
  // JS getDay(): 0 là CN, 1 là T2, 2 là T3, 3 là T4, 4 là T5, 5 là T6, 6 là T7
  const todayIndex = currentDay === 0 ? 6 : currentDay - 1;

  const weekDays = DAY_LABELS.map((label, idx) => {
    // Ngày trong tương lai của tuần này chưa đến
    if (idx > todayIndex) {
      return { label, active: false, isToday: false };
    }
    // Ngày từ hôm nay lùi về quá khứ trong tuần thuộc chuỗi streak
    const daysAgo = todayIndex - idx;
    const isActive = Boolean(user && streakDays > 0 && daysAgo < streakDays);
    return {
      label,
      active: isActive,
      isToday: idx === todayIndex,
    };
  });

  const activeDaysCount = weekDays.filter((d) => d.active).length;
  const weekProgressPercent = Math.round((activeDaysCount / 7) * 100);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      {/* Bento Grid Container */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* KHỐI 1: CHÀO MỪNG / HERO SECTION (Span 7 trên Desktop) */}
        <section className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/50 sm:p-8 lg:col-span-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100/80 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.75} />
              <span>Không gian học tập nhóm trực tuyến</span>
            </div>

            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Học tập tĩnh lặng, tập trung sâu cùng bạn bè
            </h1>

            <p className="mt-3 max-w-[55ch] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
              Webcam độ trễ thấp, đồng hồ Pomodoro đồng bộ và trò chuyện trong một phòng học tối giản.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
            <Button asChild size="default" className="gap-2">
              <Link href="/room/demo">
                <span>Vào phòng trải nghiệm</span>
                <ArrowRight className="h-4 w-4" strokeWidth={ICON_STROKE} />
              </Link>
            </Button>

            <Button asChild variant="outline" size="default">
              <Link href="/dashboard">Xem Dashboard</Link>
            </Button>
          </div>
        </section>

        {/* KHỐI 2: PERSONAL STUDY WIDGET (Span 5 trên Desktop) */}
        <aside className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/50 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
                  <Flame className="h-4 w-4" strokeWidth={2} />
                </div>
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Tiến trình học tập
                </h3>
              </div>
              {user ? (
                <button
                  type="button"
                  onClick={() => setIsTitlesModalOpen(true)}
                  id="home-btn-equipped-title"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 transition hover:bg-amber-500/20 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400 cursor-pointer"
                  title="Nhấn để xem & thay đổi Danh hiệu"
                >
                  <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" strokeWidth={1.5} />
                  <span className="truncate max-w-[130px]">{equippedTitle}</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400">
                  <Award className="h-3 w-3 text-zinc-400" strokeWidth={1.5} />
                  Khách
                </span>
              )}
            </div>

            {/* Streak & Số giờ học */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-200/60 bg-zinc-50/70 p-3.5 dark:border-zinc-800/50 dark:bg-zinc-950/40">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Chuỗi ngày học
                </p>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {streakDays}
                  </span>
                  <span className="text-xs text-zinc-500">ngày liên tục</span>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200/60 bg-zinc-50/70 p-3.5 dark:border-zinc-800/50 dark:bg-zinc-950/40">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Tổng thời gian
                </p>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {studyHours}
                  </span>
                  <span className="text-xs text-zinc-500">giờ tích lũy</span>
                </div>
              </div>
            </div>

            {/* Thanh tiến trình ngày trong tuần */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>Mục tiêu tuần ({activeDaysCount}/7 ngày)</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {weekProgressPercent}%
                </span>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {weekDays.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <div
                      className={`h-2 w-full rounded-full transition-colors ${
                        day.active
                          ? "bg-amber-500 dark:bg-amber-400"
                          : day.isToday
                          ? "bg-zinc-300 dark:bg-zinc-700 ring-1 ring-amber-500/40"
                          : "bg-zinc-200 dark:bg-zinc-800"
                      }`}
                      title={`${day.label}: ${
                        day.active
                          ? "Đã học"
                          : day.isToday
                          ? "Hôm nay"
                          : "Chưa học"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-medium ${
                        day.isToday
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bạn bè đang Online mini widget */}
          <div className="mt-5 border-t border-zinc-100 pt-3 dark:border-zinc-800/50">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Bạn bè đang học ({onlineFriends.length})
              </span>
              {user && (
                <Link
                  href="/dashboard"
                  className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                >
                  Xem tất cả
                </Link>
              )}
            </div>

            <div className="mt-2.5">
              {!mounted ? (
                <div className="h-8 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
              ) : !user ? (
                <p className="text-xs text-zinc-500">
                  <Link href="/login" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
                    Đăng nhập
                  </Link>{" "}
                  để xem bạn bè cùng học.
                </p>
              ) : onlineFriends.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Chưa có bạn bè nào online lúc này.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {onlineFriends.slice(0, 4).map((friend) => (
                    <div
                      key={friend._id || friend.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-950/60 dark:text-zinc-200"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      <span className="max-w-[80px] truncate">{friend.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* KHỐI 3: CARD HÀNH ĐỘNG 1 - TẠO PHÒNG HỌC MỚI (Span 6 trên Desktop) */}
        <section className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/50 sm:p-7 lg:col-span-6">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100">
              <Video className="h-5 w-5" strokeWidth={1.5} />
            </div>

            <h2 className="mt-4 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Tạo phòng học mới
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Thiết lập phòng riêng hoặc công khai, mời bạn bè cùng bật webcam và chạy phiên đếm ngược Pomodoro.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
            <Dialog
              open={createOpen}
              onOpenChange={(val) => {
                setCreateOpen(val);
                if (!val) {
                  setRoomTitle("");
                  setCategory("general");
                  setIsPrivate(false);
                  setCreateError("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="w-full gap-2" id="home-btn-create-room">
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  <span>Tạo phòng ngay</span>
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Tạo phòng học mới</DialogTitle>
                  <DialogDescription>
                    Đặt tên phòng và chọn chủ đề để bắt đầu phiên học tập trung cùng đồng đội.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateRoom} className="space-y-4 py-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="modal-room-title" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Tên phòng học
                    </label>
                    <input
                      id="modal-room-title"
                      type="text"
                      placeholder="Ôn thi Giải tích, Lập trình Web..."
                      value={roomTitle}
                      onChange={(e) => {
                        setRoomTitle(e.target.value);
                        if (createError) setCreateError("");
                      }}
                      maxLength={80}
                      autoFocus
                      disabled={isCreating}
                      className="h-10 rounded-lg border border-zinc-200/90 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                    />
                    {createError && (
                      <p className="text-xs text-rose-500 dark:text-rose-400" role="alert">
                        {createError}
                      </p>
                    )}
                  </div>

                  {/* Chọn chủ đề học tập */}
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="modal-room-category"
                      className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Chủ đề học tập
                    </label>
                    <select
                      id="modal-room-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={isCreating}
                      className="h-10 rounded-lg border border-zinc-200/90 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      <option value="general">Chung / Tự học</option>
                      <option value="tech">Công nghệ & Lập trình</option>
                      <option value="languages">Ngoại ngữ & IELTS</option>
                      <option value="math">Toán & Khoa học</option>
                      <option value="exam">Luyện thi & Chứng chỉ</option>
                      <option value="chill">Góc học tập yên tĩnh</option>
                    </select>
                  </div>

                  {/* Chế độ phòng: Công khai / Riêng tư */}
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Chế độ phòng
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPrivate(false)}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition ${
                          !isPrivate
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 shadow-sm"
                            : "border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        }`}
                      >
                        <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span>Công khai</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPrivate(true)}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition ${
                          isPrivate
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 shadow-sm"
                            : "border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        }`}
                      >
                        <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span>Riêng tư</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {!isPrivate
                        ? "Phòng công khai hiển thị trên trang chủ để bạn bè cùng tham gia."
                        : "Phòng riêng tư chỉ vào được khi chia sẻ mã mời."}
                    </p>
                  </div>

                  <DialogFooter className="mt-4">
                    <Button type="submit" className="w-full" disabled={isCreating}>
                      {isCreating ? "Đang tạo phòng..." : "Xác nhận tạo phòng"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* KHỐI 4: CARD HÀNH ĐỘNG 2 - THAM GIA BẰNG MÃ (Span 6 trên Desktop) */}
        <section className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/50 sm:p-7 lg:col-span-6">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100">
              <BookOpen className="h-5 w-5" strokeWidth={1.5} />
            </div>

            <h2 className="mt-4 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Tham gia bằng mã
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Nhập mã phòng 6 ký tự để tham gia phiên học đang diễn ra cùng bạn bè.
            </p>
          </div>

          <form onSubmit={handleJoinByCode} className="mt-6 space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                id="home-join-room-code"
                value={joinCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
                  setJoinCode(val);
                  if (joinError) setJoinError("");
                }}
                placeholder="MÃ PHÒNG (VD: ABC123)"
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                disabled={isJoining}
                className="h-11 w-full rounded-xl border border-zinc-200/90 bg-white px-3 text-center font-mono text-base tracking-[0.25em] text-zinc-900 placeholder:font-mono placeholder:tracking-normal placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
              {joinError && (
                <p className="text-xs text-rose-500 dark:text-rose-400" role="alert">
                  {joinError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={isJoining || joinCode.length !== 6}
              id="home-btn-join-room"
            >
              {isJoining ? "Đang kết nối..." : "Vào phòng"}
            </Button>
          </form>
        </section>

        {/* KHỐI 5: PHÒNG HỌC ĐANG MỞ (Span 12 trên Desktop) */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/50 sm:p-7 lg:col-span-12">
          <div className="flex flex-col gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800/60 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                <Radio className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Phòng học đang mở
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Các phòng học công khai đang diễn ra, bạn có thể tìm kiếm theo chủ đề và tham gia ngay
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-56">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  id="home-search-rooms"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên phòng..."
                  className="h-8 w-full rounded-lg border border-zinc-200/90 bg-white pl-8 pr-7 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Xóa tìm kiếm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
              <span className="text-xs font-medium text-zinc-500 whitespace-nowrap">
                {searchQuery
                  ? `${
                      publicRooms.filter((r) =>
                        (r.title || "").toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                        (r.roomCode || r.inviteCode || "").toLowerCase().includes(searchQuery.trim().toLowerCase())
                      ).length
                    }/${publicRooms.length} phòng`
                  : `${publicRooms.length} phòng`}
              </span>
            </div>
          </div>

          <div className="mt-5">
            {loadingRooms ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl border border-zinc-200/60 bg-zinc-100/60 dark:border-zinc-800/40 dark:bg-zinc-950/40"
                  />
                ))}
              </div>
            ) : publicRooms.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-600" strokeWidth={1.5} />
                <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Chưa có phòng học công khai nào
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Hãy nhấn nút Tạo phòng mới ở trên để mở phòng học đầu tiên.
                </p>
              </div>
            ) : (() => {
              const query = searchQuery.trim().toLowerCase();
              const filtered = publicRooms.filter((r) =>
                (r.title || "").toLowerCase().includes(query) ||
                (r.roomCode || r.inviteCode || "").toLowerCase().includes(query)
              );

              if (filtered.length === 0) {
                return (
                  <div className="py-10 text-center">
                    <Search className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-600" strokeWidth={1.5} />
                    <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Không tìm thấy phòng học phù hợp
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Không có phòng công khai nào khớp với &ldquo;{searchQuery}&rdquo;.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((room) => {
                    const code = room.roomCode || room.inviteCode;
                    const count = room.participants?.length || 0;
                    return (
                      <div
                        key={room._id || room.id}
                        className="group flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 transition duration-taste ease-taste hover:border-zinc-300 hover:bg-white dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-400">
                              #{code}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {count > 0 ? `${count} người đang học` : "Đang chờ"}
                            </span>
                          </div>
                          <h3 className="mt-2 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {room.title || "Phòng học tập trung"}
                          </h3>
                          {room.category && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="rounded border border-zinc-200/80 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300">
                                {room.category === "tech" && "Lập trình"}
                                {room.category === "languages" && "Ngoại ngữ"}
                                {room.category === "math" && "Toán & KH"}
                                {room.category === "exam" && "Luyện thi"}
                                {room.category === "chill" && "Yên tĩnh"}
                                {(!room.category || room.category === "general") && "Tự học"}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-zinc-200/60 pt-3 dark:border-zinc-800/40">
                          <span className="text-[11px] text-zinc-500">
                            Chế độ công khai
                          </span>
                          <Button asChild size="sm" variant="default" className="h-8 px-3 text-xs">
                            <Link href={`/room/${code}`}>
                              Vào học
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </section>
      </div>

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
