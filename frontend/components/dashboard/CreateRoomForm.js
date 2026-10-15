"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Lock, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roomsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export function CreateRoomForm({ onSuccess }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessType, setAccessType] = useState("OPEN"); // "OPEN" | "APPROVAL_REQUIRED"
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên phòng.");
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        const result = await roomsApi.create({
          title: trimmed,
          category,
          isPrivate,
          accessType,
        });
        const roomCode = result?.data?.room?.roomCode;
        if (!roomCode) throw new Error("Không nhận được mã phòng từ server.");
        if (onSuccess) onSuccess(roomCode);
        router.push(`/room/${roomCode}`);
      } catch (err) {
        setError(err.message || "Tạo phòng thất bại. Vui lòng thử lại.");
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="room-title-input"
          className="text-sm font-medium text-zinc-300"
        >
          Tên phòng
        </label>
        <input
          id="room-title-input"
          name="title"
          type="text"
          placeholder="Ôn thi cuối kỳ, DSA..."
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError("");
          }}
          maxLength={100}
          autoComplete="off"
          className="h-10 rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
        />
        {error && (
          <p className="text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Chọn chủ đề phòng */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="room-category-select"
          className="text-sm font-medium text-zinc-300"
        >
          Chủ đề học tập
        </label>
        <select
          id="room-category-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isPending}
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

      {/* Chọn chế độ Public / Private */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-300">
          Chế độ phòng
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsPrivate(false)}
            disabled={isPending}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
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
            onClick={() => setIsPrivate(true)}
            disabled={isPending}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              isPrivate
                ? "border-zinc-300 bg-zinc-100 text-zinc-950 shadow-sm"
                : "border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            )}
          >
            <Lock className="h-4 w-4" strokeWidth={1.75} />
            <span>Riêng tư</span>
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          {!isPrivate
            ? "Hiển thị trên danh sách phòng đang mở để ai cũng có thể vào."
            : "Chỉ người có mã hoặc link mới vào được."}
        </p>
      </div>

      {/* Quyền truy cập phòng */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-300">
          Quyền truy cập phòng
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setAccessType("OPEN")}
            disabled={isPending}
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
            onClick={() => setAccessType("APPROVAL_REQUIRED")}
            disabled={isPending}
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

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Đang tạo..." : "Tạo phòng"}
      </Button>
    </form>
  );
}

