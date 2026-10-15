"use client";

import { Mic, MicOff, VideoOff, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserTitleBadge from "@/components/titles/UserTitleBadge";

import { VideoTrack } from "@livekit/components-react";
import { FocusStatusBadge } from "@/components/room/FocusStatusWidget";

function initialsFrom(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Video tile - calm frame, thin speaking indicator.
 * Supports LiveKit real-time video track or quiet avatar fallback.
 * Hỗ trợ hiển thị danh hiệu, trạng thái giơ tay phát biểu (Raise Hand) và Trạng thái tập trung (Focus Status).
 */
export function VideoTile({
  member,
  isSpeaking = false,
  className,
}) {
  const hasLiveTrack =
    member?.trackRef &&
    member?.trackRef?.publication &&
    !member?.trackRef?.publication?.isMuted;

  const isHandRaised = Boolean(member?.isHandRaised);
  const focusStatus = member?.focusStatus;

  return (
    <div
      className={cn(
        "video-frame group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900 transition duration-200",
        isSpeaking && "border-zinc-500/80 ring-1 ring-zinc-500/30",
        isHandRaised && "border-amber-500/80 ring-2 ring-amber-400/50 hand-raised-glow",
        className
      )}
    >
      {/* Badge Giơ tay phát biểu nổi bật góc trên bên phải */}
      {isHandRaised && (
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-full border border-amber-500/60 bg-amber-500/25 px-2.5 py-1 text-xs font-semibold text-amber-300 shadow-lg shadow-amber-500/20 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <Hand className="h-3.5 w-3.5 text-amber-400 animate-pulse" strokeWidth={2.2} />
          <span className="text-[11px] font-medium tracking-tight">Giơ tay</span>
        </div>
      )}

      {/* Badge Trạng thái tập trung khi camera bật (góc trên bên trái) */}
      {member.cameraOn && hasLiveTrack && focusStatus && (
        <div className="absolute top-2.5 left-2.5 z-20">
          <FocusStatusBadge status={focusStatus} />
        </div>
      )}

      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 h-0.5 bg-zinc-200 transition-opacity duration-taste ease-taste",
          isSpeaking ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      />

      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
        {member.cameraOn && hasLiveTrack ? (
          <VideoTrack
            trackRef={member.trackRef}
            className={cn(
              "h-full w-full object-cover",
              member.isYou && "-scale-x-100"
            )}
            style={member.isYou ? { transform: "scaleX(-1)" } : undefined}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <div className="relative">
              <Avatar className="h-14 w-14 sm:h-16 sm:w-16">
                <AvatarImage src={member.avatar} alt="" />
                <AvatarFallback className="bg-zinc-800 text-sm font-medium text-zinc-300">
                  {initialsFrom(member.name)}
                </AvatarFallback>
              </Avatar>
              {focusStatus && (
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
                  <FocusStatusBadge status={focusStatus} />
                </div>
              )}
            </div>
            {!member.cameraOn && (
              <span className={cn("text-[11px] text-zinc-500", focusStatus && "mt-1.5")}>
                Camera tắt
              </span>
            )}
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/80 to-transparent px-3 pb-3 pt-8">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {/* Hiển thị danh hiệu nếu chính thành viên đó đang bật */}
            {member.isTitleVisible !== false && (
              <div className="mb-1 flex items-center animate-in fade-in slide-in-from-bottom-1 duration-200">
                <UserTitleBadge
                  title={member.equippedTitle || "Nhập môn học giả"}
                  size="xs"
                  showIcon={true}
                  className="shadow-sm max-w-[200px] truncate"
                />
              </div>
            )}
            <p className="truncate text-sm font-medium text-zinc-100">
              {member.name}
              {member.isYou ? " (Bạn)" : ""}
            </p>
            {member.isHost ? <p className="type-meta">Host</p> : null}
          </div>
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-950/50 text-zinc-400",
              !member.micOn && "text-zinc-600"
            )}
            aria-label={member.micOn ? "Mic bật" : "Mic tắt"}
          >
            {member.micOn ? (
              <Mic className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
            ) : (
              <MicOff className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
