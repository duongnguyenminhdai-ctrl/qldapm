"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Globe, Lock, ShieldCheck, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { roomsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export function CreateRoomModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessType, setAccessType] = useState("OPEN"); // "OPEN" | "APPROVAL_REQUIRED"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên phòng.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const result = await roomsApi.create({
        title: trimmed,
        category,
        isPrivate,
        accessType,
      });
      const roomCode = result?.data?.room?.roomCode;
      if (!roomCode) throw new Error("Không nhận được mã phòng từ server.");

      // Điều hướng trực tiếp chắc chắn vào phòng học
      window.location.assign(`/room/${roomCode}`);
    } catch (err) {
      setError(err.message || "Tạo phòng thất bại. Vui lòng thử lại.");
      setLoading(false);
    }
  };

  const handleOpenChange = (val) => {
    setOpen(val);
    if (!val) {
      setTitle("");
      setIsPrivate(false);
      setAccessType("OPEN");
      setError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full" id="btn-open-create-room">
          <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
          Tạo phòng mới
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tạo phòng học</DialogTitle>
          <DialogDescription>
            Nhập tên phòng để tạo mã mời tự động.
          </DialogDescription>
        </DialogHeader>

        <form id="create-room-form" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-2 py-2">
            <label
              htmlFor="create-room-title"
              className="text-sm font-medium text-zinc-300"
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
              className="h-10 rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="text-sm font-medium text-zinc-300"
            >
              Chủ đề học tập
            </label>
            <select
              id="create-room-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
              className="h-10 rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="general">Chung / Tự học</option>
              <option value="tech">Công nghệ & Lập trình</option>
              <option value="languages">Ngoại ngữ & IELTS</option>
              <option value="math">Toán & Khoa học</option>
              <option value="exam">Luyện thi & Chứng chỉ</option>
              <option value="chill">Góc học tập yên tĩnh</option>
            </select>
          </div>

          {/* Chọn chế độ phòng: Public hoặc Private */}
          <div className="flex flex-col gap-2 py-1">
            <label className="text-sm font-medium text-zinc-300">
              Chế độ phòng
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-room-public"
                onClick={() => setIsPrivate(false)}
                disabled={loading}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                  !isPrivate
                    ? "border-zinc-300 bg-zinc-100 text-zinc-950 shadow-sm"
                    : "border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
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
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                  isPrivate
                    ? "border-zinc-300 bg-zinc-100 text-zinc-950 shadow-sm"
                    : "border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                )}
              >
                <Lock className="h-4 w-4" strokeWidth={1.75} />
                <span>Riêng tư</span>
              </button>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              {!isPrivate
                ? "Hiển thị trên dashboard phòng đang mở để ai cũng có thể vào."
                : "Phòng ẩn khỏi dashboard, chỉ người có mã hoặc link mới vào được."}
            </p>
          </div>

          {/* Quyền truy cập: Tự do vào thẳng vs Cần chủ phòng duyệt */}
          <div className="flex flex-col gap-2 py-1">
            <label className="text-sm font-medium text-zinc-300">
              Quyền truy cập phòng
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                id="btn-access-open"
                onClick={() => setAccessType("OPEN")}
                disabled={loading}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                  accessType === "OPEN"
                    ? "border-emerald-500/50 bg-emerald-950/20 text-zinc-100 ring-1 ring-emerald-500/40"
                    : "border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                  <Users className={cn("h-4 w-4", accessType === "OPEN" ? "text-emerald-400" : "text-zinc-500")} />
                  <span>Mở tự do</span>
                </div>
                <span className="text-[11px] leading-tight text-zinc-500">
                  Bất kỳ ai có link hoặc mã phòng vào thẳng phòng học.
                </span>
              </button>

              <button
                type="button"
                id="btn-access-approval"
                onClick={() => setAccessType("APPROVAL_REQUIRED")}
                disabled={loading}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                  accessType === "APPROVAL_REQUIRED"
                    ? "border-amber-500/50 bg-amber-950/20 text-zinc-100 ring-1 ring-amber-500/40"
                    : "border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
                  <ShieldCheck className={cn("h-4 w-4", accessType === "APPROVAL_REQUIRED" ? "text-amber-400" : "text-zinc-500")} />
                  <span>Cần xét duyệt</span>
                </div>
                <span className="text-[11px] leading-tight text-zinc-500">
                  Phòng chờ: Chủ phòng phải phê duyệt mới được vào.
                </span>
              </button>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="submit"
              form="create-room-form"
              className="w-full"
              disabled={loading}
              id="btn-create-room-submit"
            >
              {loading ? "Đang chuyển vào phòng..." : "Tạo phòng"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
