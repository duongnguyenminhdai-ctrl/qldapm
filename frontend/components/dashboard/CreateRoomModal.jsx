"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Globe,
  Lock,
  ShieldCheck,
  Users,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
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
import { roomsApi, getStoredUser, getAuthToken } from "@/lib/api";
import { cn } from "@/lib/utils";

export function CreateRoomModal({ pendingRoom = null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingWarningOpen, setPendingWarningOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessType, setAccessType] = useState("OPEN"); // "OPEN" | "APPROVAL_REQUIRED"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Kích hoạt thông báo cảnh báo khi người dùng đang có phòng tạm dừng 10 phút
  const triggerPendingRoomWarning = () => {
    const code = pendingRoom?.roomCode || "";
    const warningMsg = `Bạn đang có một phòng học đang tạm dừng (${code}). Vui lòng quay lại phòng và bấm Kết thúc phiên học trước khi tạo phòng mới!`;

    // Hiển thị dialog cảnh báo
    setPendingWarningOpen(true);

    // Bắn toast thông báo toàn cục
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("vsr:trigger-toast", {
          detail: {
            type: "ROOM_TERMINATED",
            title: "Không thể tạo phòng mới",
            message: warningMsg,
            link: code ? `/room/${code}` : undefined,
          },
        })
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // RÀNG BUỘC FRONTEND: Chặn tạo phòng nếu đang có phòng chờ 10 phút
    if (pendingRoom) {
      triggerPendingRoomWarning();
      setError(
        `Bạn đang có một phòng học đang tạm dừng (${pendingRoom.roomCode}). Vui lòng quay lại phòng và bấm Kết thúc phiên học trước khi tạo phòng mới!`
      );
      return;
    }

    const trimmed = title.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên phòng.");
      return;
    }

    // Kiểm tra đăng nhập trước khi gửi request
    const token = getAuthToken();
    const user = getStoredUser();
    if (!token || !user) {
      setError("Vui lòng đăng nhập để tạo phòng học.");
      setLoading(false);
      setTimeout(() => {
        router.push("/login?callbackUrl=" + encodeURIComponent(window.location.pathname || "/"));
      }, 1000);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const maxMembers = category === "chess" ? 2 : 20;
      const result = await roomsApi.create({
        title: trimmed,
        category,
        isPrivate,
        accessType,
        maxMembers,
        type: category === "chess" ? "chess" : "study",
      });
      const room = result?.data?.room;
      const roomCode = room?.roomCode;
      if (!roomCode) throw new Error("Không nhận được mã phòng từ server.");

      // Lưu trữ ngay vào sessionStorage để trang phòng học load tức thì
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(`vsr_created_room_${roomCode}`, JSON.stringify(room));
        }
      } catch (_) {}

      setIsRedirecting(true);
      router.push(`/room/${roomCode}`);
    } catch (err) {
      const activeCode = err.data?.roomCode || err.roomCode;
      if (activeCode) {
        setError(
          `${err.message || "Bạn đang có phòng học đang hoạt động, không thể tạo thêm phòng mới."} (Mã phòng: ${activeCode})`
        );
      } else {
        setError(err.message || "Tạo phòng thất bại. Vui lòng thử lại.");
      }
      setLoading(false);
      setIsRedirecting(false);
    }
  };

  const handleOpenChange = (val) => {
    if (isRedirecting) return;

    // Nếu người dùng đang có phòng chờ và cố mở dialog tạo phòng:
    if (val && pendingRoom) {
      triggerPendingRoomWarning();
      return;
    }

    setOpen(val);
    if (!val) {
      setTitle("");
      setIsPrivate(false);
      setAccessType("OPEN");
      setError("");
      setLoading(false);
      setIsRedirecting(false);
    } else {
      try {
        router.prefetch("/room/sample");
      } catch (_) {}
    }
  };

  return (
    <>
      {/* DIALOG CẢNH BÁO: KHÓA TẠO PHÒNG MỚI KHI ĐANG GIỮ PHÒNG CHỜ 10 PHÚT */}
      <Dialog open={pendingWarningOpen} onOpenChange={setPendingWarningOpen}>
        <DialogContent className="sm:max-w-md border-amber-500/40 bg-[#1E1915] text-[#F5E6D3] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400 font-serif text-lg">
              <Clock className="h-5 w-5 animate-pulse text-amber-400" />
              Không thể tạo phòng mới
            </DialogTitle>
            <DialogDescription className="text-amber-200/90 pt-3 text-sm leading-relaxed">
              Bạn đang có một phòng học đang tạm dừng (
              <strong className="font-mono text-amber-300">
                {pendingRoom?.roomCode || ""}
              </strong>
              ). Vui lòng quay lại phòng và bấm <strong>Kết thúc phiên học</strong> trước khi tạo phòng mới!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => setPendingWarningOpen(false)}
              className="border-stone-700 bg-stone-900/60 text-stone-300 hover:bg-stone-800"
            >
              Đóng
            </Button>
            {pendingRoom?.roomCode && (
              <Button
                type="button"
                onClick={() => {
                  setPendingWarningOpen(false);
                  router.push(`/room/${pendingRoom.roomCode}`);
                }}
                className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-stone-950 font-bold shadow-md hover:from-amber-300 hover:to-amber-500 transition-all flex items-center gap-1.5"
              >
                <span>Quay lại phòng</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG TẠO PHÒNG HỌC MỚI */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            className={cn(
              "w-full transition-all cursor-pointer",
              pendingRoom &&
                "border border-amber-500/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 hover:text-amber-200"
            )}
            id="btn-open-create-room"
            title={
              pendingRoom
                ? `Bạn đang có phòng học [${pendingRoom.roomCode}] đang tạm dừng.`
                : "Tạo phòng học mới"
            }
          >
            {pendingRoom ? (
              <Clock className="mr-1.5 h-4 w-4 text-amber-400 animate-pulse" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
            )}
            <span>Tạo phòng mới</span>
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tạo phòng học</DialogTitle>
            <DialogDescription>
              {isRedirecting
                ? "Đang khởi tạo không gian học tập..."
                : "Nhập tên phòng để tạo mã mời tự động."}
            </DialogDescription>
          </DialogHeader>

          {isRedirecting ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-[#c3a47b]" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#2D241E] dark:text-[#f5ede3]">
                  Đang mở phòng học...
                </p>
                <p className="text-xs text-[#615247] dark:text-[#a89b8d]">
                  Đang chuẩn bị không gian học tập và kết nối âm thanh, hình ảnh.
                </p>
              </div>
            </div>
          ) : (
            <form id="create-room-form" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-2 py-2">
                <label
                  htmlFor="create-room-title"
                  className="text-sm font-medium text-[#615247] dark:text-[#d8c8b4]"
                >
                  Tên phòng
                </label>
                <input
                  id="create-room-title"
                  name="title"
                  type="text"
                  placeholder="Ôn thi cuối kỳ, DSA..."
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError("");
                  }}
                  maxLength={100}
                  autoFocus
                  autoComplete="off"
                  className="h-10 rounded-lg border border-stone-200 bg-[#ECE5DA]/70 px-3 text-sm text-[#2D241E] placeholder:text-[#8C7E72] focus:outline-none focus:ring-1 focus:ring-[#b3894e] dark:border-[#3a3128] dark:bg-[#141210] dark:text-[#f5ede3] dark:placeholder:text-[#75695e] dark:focus:ring-[#c3a47b] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                />
                {error && (
                  <p className="text-xs text-rose-400" role="alert">
                    {error}
                  </p>
                )}
              </div>

              {/* Chọn chủ đề phòng */}
              <div className="flex flex-col gap-2 py-1">
                <label
                  htmlFor="create-room-category"
                  className="text-sm font-medium text-[#615247] dark:text-[#d8c8b4]"
                >
                  Chủ đề học tập
                </label>
                <select
                  id="create-room-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={loading}
                  className="h-10 rounded-lg border border-stone-200 bg-[#ECE5DA]/70 px-3 text-sm text-[#2D241E] focus:outline-none focus:ring-1 focus:ring-[#b3894e] dark:border-[#3a3128] dark:bg-[#141210] dark:text-[#f5ede3] dark:focus:ring-[#c3a47b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="general">Chung / Tự học</option>
                  <option value="chess">♟️ Cờ vua (1v1)</option>
                  <option value="tech">Công nghệ & Lập trình</option>
                  <option value="languages">Ngoại ngữ & IELTS</option>
                  <option value="math">Toán & Khoa học</option>
                  <option value="exam">Luyện thi & Chứng chỉ</option>
                  <option value="chill">Góc học tập yên tĩnh</option>
                </select>
                {category === "chess" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    ♟️ Chế độ Cờ vua 1v1: Giới hạn tối đa 2 người chơi đấu kháng trực tiếp.
                  </p>
                )}
              </div>

              {/* Chọn chế độ phòng: Public hoặc Private */}
              <div className="flex flex-col gap-2 py-1">
                <label className="text-sm font-medium text-[#615247] dark:text-[#d8c8b4]">
                  Chế độ phòng
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="btn-room-public"
                    onClick={() => setIsPrivate(false)}
                    disabled={loading}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                      !isPrivate
                        ? "border-[#c3a47b] bg-[#c3a47b] text-[#161311] shadow-xs font-semibold"
                        : "border-stone-200 bg-[#ECE5DA]/60 text-[#615247] hover:border-stone-300 hover:text-[#2D241E] dark:border-[#3a3128] dark:bg-[#141210] dark:text-[#a89b8d] dark:hover:border-[#5c4e40] dark:hover:text-[#f5ede3]"
                    )}
                  >
                    <Globe className="h-4 w-4" strokeWidth={1.75} />
                    <span>Công khai</span>
                  </button>

                  <button
                    type="button"
                    id="btn-room-private"
                    onClick={() => setIsPrivate(true)}
                    disabled={loading}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                      isPrivate
                        ? "border-[#c3a47b] bg-[#c3a47b] text-[#161311] shadow-xs font-semibold"
                        : "border-stone-200 bg-[#ECE5DA]/60 text-[#615247] hover:border-stone-300 hover:text-[#2D241E] dark:border-[#3a3128] dark:bg-[#141210] dark:text-[#a89b8d] dark:hover:border-[#5c4e40] dark:hover:text-[#f5ede3]"
                    )}
                  >
                    <Lock className="h-4 w-4" strokeWidth={1.75} />
                    <span>Riêng tư</span>
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-[#8C7E72] dark:text-[#75695e]">
                  {!isPrivate
                    ? "Hiển thị trên dashboard phòng đang mở để ai cũng có thể vào."
                    : "Phòng ẩn khỏi dashboard, chỉ người có mã hoặc link mới vào được."}
                </p>
              </div>

              {/* Quyền truy cập: Tự do vào thẳng vs Cần chủ phòng duyệt */}
              <div className="flex flex-col gap-2 py-1">
                <label className="text-sm font-medium text-[#615247] dark:text-[#d8c8b4]">
                  Quyền truy cập phòng
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    id="btn-access-open"
                    onClick={() => setAccessType("OPEN")}
                    disabled={loading}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer",
                      accessType === "OPEN"
                        ? "border-[#c3a47b] bg-[#ECE5DA] text-[#2D241E] ring-1 ring-[#c3a47b]/40 dark:border-[#c3a47b]/60 dark:bg-[#29231f] dark:text-[#f5ede3]"
                        : "border-stone-200 bg-[#ECE5DA]/40 text-[#8C7E72] hover:border-stone-300 hover:text-[#2D241E] dark:border-[#3a3128] dark:bg-[#141210] dark:text-[#75695e] dark:hover:border-[#5c4e40] dark:hover:text-[#d8c8b4]"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                      <Users
                        className={cn(
                          "h-4 w-4",
                          accessType === "OPEN"
                            ? "text-[#b3894e] dark:text-[#c3a47b]"
                            : "text-[#8C7E72] dark:text-[#75695e]"
                        )}
                      />
                      <span>Mở tự do</span>
                    </div>
                    <span className="text-[11px] leading-tight text-[#8C7E72] dark:text-[#75695e]">
                      Bất kỳ ai có link hoặc mã phòng vào thẳng phòng học.
                    </span>
                  </button>

                  <button
                    type="button"
                    id="btn-access-approval"
                    onClick={() => setAccessType("APPROVAL_REQUIRED")}
                    disabled={loading}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer",
                      accessType === "APPROVAL_REQUIRED"
                        ? "border-[#c3a47b] bg-[#ECE5DA] text-[#2D241E] ring-1 ring-[#c3a47b]/40 dark:border-[#c3a47b]/60 dark:bg-[#29231f] dark:text-[#f5ede3]"
                        : "border-stone-200 bg-[#ECE5DA]/40 text-[#8C7E72] hover:border-stone-300 hover:text-[#2D241E] dark:border-[#3a3128] dark:bg-[#141210] dark:text-[#75695e] dark:hover:border-[#5c4e40] dark:hover:text-[#d8c8b4]"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                      <ShieldCheck
                        className={cn(
                          "h-4 w-4",
                          accessType === "APPROVAL_REQUIRED"
                            ? "text-[#b3894e] dark:text-[#c3a47b]"
                            : "text-[#8C7E72] dark:text-[#75695e]"
                        )}
                      />
                      <span>Cần xét duyệt</span>
                    </div>
                    <span className="text-[11px] leading-tight text-[#8C7E72] dark:text-[#75695e]">
                      Phòng chờ: Chủ phòng phải phê duyệt mới được vào.
                    </span>
                  </button>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="submit"
                  form="create-room-form"
                  className="w-full flex items-center justify-center gap-2"
                  disabled={loading}
                  id="btn-create-room-submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang khởi tạo phòng học...</span>
                    </>
                  ) : (
                    "Tạo phòng"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
