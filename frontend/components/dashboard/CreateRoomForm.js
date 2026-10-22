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
        try {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(`vsr_created_room_${roomCode}`, JSON.stringify(room));
          }
        } catch (_) {}
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
          className="text-sm font-medium text-[#d8c8b4]"
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
          className="h-10 rounded-xl border border-[#3a3128] bg-[#141210] px-3 text-sm text-[#f5ede3] placeholder:text-[#75695e] focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-[#c3a47b] disabled:cursor-not-allowed disabled:opacity-60"
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
          className="text-sm font-medium text-[#d8c8b4]"
        >
          Chủ đề học tập
        </label>
        <select
          id="room-category-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isPending}
          className="h-10 rounded-xl border border-[#3a3128] bg-[#141210] px-3 text-sm text-[#f5ede3] focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-[#c3a47b] disabled:cursor-not-allowed disabled:opacity-60"
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
          <p className="text-xs text-amber-500 font-medium">
            ♟️ Chế độ Cờ vua 1v1: Giới hạn tối đa 2 người chơi đấu kháng trực tiếp.
          </p>
        )}
      </div>

      {/* Chọn chế độ Public / Private */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#d8c8b4]">
          Chế độ phòng
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsPrivate(false)}
            disabled={isPending}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              !isPrivate
                ? "border-[#c3a47b] bg-[#c3a47b] text-[#161311] font-semibold shadow-sm"
                : "border-[#3a3128] bg-[#201b18] text-[#d8c8b4] hover:border-[#5c4e40] hover:text-[#f5ede3]"
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
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              isPrivate
                ? "border-[#c3a47b] bg-[#c3a47b] text-[#161311] font-semibold shadow-sm"
                : "border-[#3a3128] bg-[#201b18] text-[#d8c8b4] hover:border-[#5c4e40] hover:text-[#f5ede3]"
            )}
          >
            <Lock className="h-4 w-4" strokeWidth={1.75} />
            <span>Riêng tư</span>
          </button>
        </div>
        <p className="text-xs text-[#75695e]">
          {!isPrivate
            ? "Hiển thị trên danh sách phòng đang mở để ai cũng có thể vào."
            : "Chỉ người có mã hoặc link mới vào được."}
        </p>
      </div>

      {/* Quyền truy cập phòng */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#d8c8b4]">
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
                ? "border-[#c3a47b]/60 bg-[#29231f] text-[#f5ede3] ring-1 ring-[#c3a47b]/40"
                : "border-[#3a3128] bg-[#201b18] text-[#a89b8d] hover:border-[#5c4e40] hover:text-[#f5ede3]"
            )}
          >
            <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
              <Users className={cn("h-4 w-4", accessType === "OPEN" ? "text-[#c3a47b]" : "text-[#75695e]")} />
              <span>Mở tự do</span>
            </div>
            <span className="text-[11px] leading-tight text-[#75695e]">
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
                ? "border-[#c3a47b]/60 bg-[#29231f] text-[#f5ede3] ring-1 ring-[#c3a47b]/40"
                : "border-[#3a3128] bg-[#201b18] text-[#a89b8d] hover:border-[#5c4e40] hover:text-[#f5ede3]"
            )}
          >
            <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
              <ShieldCheck className={cn("h-4 w-4", accessType === "APPROVAL_REQUIRED" ? "text-[#c3a47b]" : "text-[#75695e]")} />
              <span>Cần xét duyệt</span>
            </div>
            <span className="text-[11px] leading-tight text-[#75695e]">
              Phòng chờ: Chủ phòng phải phê duyệt mới được vào.
            </span>
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full bg-[#c3a47b] text-[#161311] hover:bg-[#d6b88f] font-semibold" disabled={isPending}>
        {isPending ? "Đang tạo..." : "Tạo phòng"}
      </Button>
    </form>
  );
}

