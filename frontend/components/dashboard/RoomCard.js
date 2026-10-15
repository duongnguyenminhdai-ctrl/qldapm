import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ICON_STROKE = 1.75;

function formatParticipantCount(room) {
  // Hỗ trợ cả data model cũ (members) và mới (participants)
  const count =
    room.participantCount ??
    room.participants?.length ??
    room.memberCount ??
    room.members?.length ??
    0;
  const max = room.maxMembers ?? 20;
  return `${count}/${max}`;
}

export function RoomCard({ room }) {
  const roomCode = room.roomCode || room.inviteCode || room._id || room.id;
  const displayName = room.title || room.name || "Phòng học";
  const description = room.description || "";

  return (
    <Link
      href={`/room/${roomCode}`}
      className="block border-b border-zinc-800/60 py-4 transition hover:bg-zinc-900/40 first:pt-0 last:border-b-0"
      id={`room-card-${roomCode}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-zinc-100">
            {displayName}
          </h3>
          {description ? (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {room.category && room.category !== "general" && (
            <span className="rounded border border-zinc-700/50 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
              {room.category === "tech" && "Lập trình"}
              {room.category === "languages" && "Ngoại ngữ"}
              {room.category === "math" && "Toán & KH"}
              {room.category === "exam" && "Luyện thi"}
              {room.category === "chill" && "Yên tĩnh"}
            </span>
          )}
          <Badge variant="outline" className="shrink-0 text-xs">
            {room.isPrivate ? "Riêng tư" : "Công khai"}
          </Badge>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Users className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
          <span>{formatParticipantCount(room)}</span>
        </div>
        {roomCode && typeof roomCode === "string" && roomCode.length === 6 && (
          <span className="font-mono text-xs tracking-widest text-zinc-700">
            {roomCode}
          </span>
        )}
      </div>
    </Link>
  );
}
