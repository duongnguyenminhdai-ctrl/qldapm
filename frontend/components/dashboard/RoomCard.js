"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, Clock, ArrowRight, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ICON_STROKE = 1.75;

function formatParticipantCount(room) {
  const count =
    room.participantCount ??
    room.participants?.length ??
    room.memberCount ??
    room.members?.length ??
    0;
  const max = room.category === "chess" ? 2 : (room.maxMembers ?? 20);
  return `${count}/${max}`;
}

function formatRemainingTime(seconds) {
  if (seconds === null || seconds === undefined || seconds < 0) return "10:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getCategoryLabel(category) {
  switch (category) {
    case "chess":
      return "Cờ vua (1v1)";
    case "tech":
      return "Lập trình";
    case "languages":
      return "Ngoại ngữ";
    case "math":
      return "Toán & KH";
    case "exam":
      return "Luyện thi";
    case "chill":
      return "Yên tĩnh";
    default:
      return "Tổng hợp";
  }
}

export function RoomCard({ room }) {
  const roomCode = room.roomCode || room.inviteCode || room._id || room.id;
  const displayName = room.title || room.name || "Phòng học";
  const description = room.description || "";
  const isPending = Boolean(room.isMyPendingRoom);
  const [copied, setCopied] = useState(false);

  // Bộ đếm đếm ngược realtime MM:SS cho phòng của chính Host đang tạm rời
  const [remainingSec, setRemainingSec] = useState(() => {
    if (room.hostLeftRemainingSeconds !== undefined && room.hostLeftRemainingSeconds !== null) {
      return Number(room.hostLeftRemainingSeconds);
    }
    return 600;
  });

  useEffect(() => {
    if (!isPending) return;
    if (remainingSec <= 0) return;

    const timer = setInterval(() => {
      setRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isPending, remainingSec]);

  const handleCopyCode = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Card phong cách Dark Academia cho phòng Host đang tạm rời
  if (isPending) {
    return (
      <Link
        href={`/room/${roomCode}`}
        className="group relative block p-5 rounded-xl border border-amber-500/30 bg-[#1E1915]/80 backdrop-blur-sm shadow-xl transition-all duration-300 hover:border-amber-500/60 hover:shadow-amber-500/10 my-2"
        id={`room-card-${roomCode}`}
      >
        {/* Glow effect nhẹ ánh kim */}
        <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/10 opacity-70 transition-opacity group-hover:opacity-100" />

        {/* HÀNG TRÊN (HEADER) */}
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 pb-3.5 mb-3.5">
          {/* Bên trái: Badge cảnh báo nhỏ gọn */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-inner">
            <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span>
              Phòng của bạn - Còn lại{" "}
              <strong className="font-mono text-amber-200">
                {formatRemainingTime(remainingSec)}
              </strong>
            </span>
          </div>

          {/* Bên phải: Nút hành động nổi bật */}
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-stone-950 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 shadow-md transition-all duration-200 group-hover:from-amber-300 group-hover:to-amber-500 group-hover:scale-105 active:scale-95">
            Quay lại phòng{" "}
            <ArrowRight className="h-3.5 w-3.5 stroke-[2.5] transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>

        {/* HÀNG DƯỚI (NỘI DUNG CHÍNH) */}
        <div className="space-y-2.5">
          <div>
            <h3 className="font-serif text-lg sm:text-xl font-medium tracking-wide text-[#F5E6D3] drop-shadow-sm truncate">
              {displayName}
            </h3>
            {description ? (
              <p className="mt-1 line-clamp-1 text-xs text-[#a89b8d]">
                {description}
              </p>
            ) : null}
          </div>

          {/* Hàng tag thông tin bên dưới tên phòng */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Badge Chủ đề */}
              <span className="rounded-md border border-amber-500/30 bg-amber-950/40 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                {getCategoryLabel(room.category)}
              </span>

              {/* Badge Chế độ */}
              <span className="rounded-md border border-stone-700/80 bg-stone-900/60 px-2 py-0.5 text-xs text-stone-300">
                {room.isPrivate ? "Riêng tư" : "Công khai"}
              </span>

              {/* Sĩ số người */}
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Users className="h-3.5 w-3.5 text-amber-400/80" strokeWidth={ICON_STROKE} />
                <span>{formatParticipantCount(room)} học viên</span>
              </div>
            </div>

            {/* Mã phòng kèm nút copy nhỏ gọn ở góc phải */}
            {roomCode && (
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-500/25 bg-amber-950/30 hover:bg-amber-900/50 text-xs font-mono text-amber-200/90 hover:text-amber-100 transition-colors cursor-pointer"
                title="Sao chép mã phòng"
              >
                <span>{roomCode}</span>
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3 text-amber-400/70" />
                )}
              </button>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Thẻ phòng bình thường (Không phải pending)
  return (
    <Link
      href={`/room/${roomCode}`}
      className="group block border-b border-stone-200/80 dark:border-[#3a3128] py-4 px-3.5 -mx-3.5 rounded-xl transition-all hover:bg-stone-200/50 dark:hover:bg-[#201b18] first:pt-3 last:border-b-0"
      id={`room-card-${roomCode}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-[#2D241E] dark:text-[#f5ede3] group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
            {displayName}
          </h3>
          {description ? (
            <p className="mt-1 line-clamp-2 text-xs text-[#615247] dark:text-[#a89b8d]">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded border border-stone-200 bg-[#ECE5DA]/80 px-2 py-0.5 text-[10px] font-medium text-[#966f38] dark:border-[#3a3128] dark:bg-[#26201c] dark:text-[#c3a47b]">
            {getCategoryLabel(room.category)}
          </span>
          <Badge variant="outline" className="shrink-0 text-xs border-stone-200 text-[#615247] dark:border-[#3a3128] dark:text-[#d8c8b4]">
            {room.isPrivate ? "Riêng tư" : "Công khai"}
          </Badge>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-[#8C7E72] dark:text-[#75695e]">
          <Users className="h-3.5 w-3.5 text-[#966f38] dark:text-[#c3a47b]" strokeWidth={ICON_STROKE} />
          <span>{formatParticipantCount(room)} học viên</span>
        </div>
        {roomCode && typeof roomCode === "string" && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs tracking-widest text-[#966f38]/90 dark:text-[#c3a47b]/80">
              {roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1 text-stone-400 hover:text-amber-400 transition-colors"
              title="Sao chép mã phòng"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        )}
      </div>
    </Link>
  );
}
