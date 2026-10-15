"use client";

import { cn } from "@/lib/utils";
import { VideoTile } from "@/components/room/VideoTile";

/**
 * Video grid fills parent height so the fixed dock stays on-screen.
 */
export function VideoGrid({
  members = [],
  speakingId = null,
  className,
}) {
  const count = Math.min(Math.max(members.length, 1), 6);
  const visible = members.slice(0, 6);

  const gridClass =
    count === 1
      ? "mx-auto max-w-3xl grid-cols-1 grid-rows-1"
      : count === 2
        ? "mx-auto max-w-5xl grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1"
        : count <= 4
          ? "grid-cols-1 grid-rows-4 sm:grid-cols-2 sm:grid-rows-2"
          : "grid-cols-1 grid-rows-6 sm:grid-cols-2 sm:grid-rows-3 lg:grid-cols-3 lg:grid-rows-2";

  return (
    <div
      className={cn(
        "grid h-full min-h-0 w-full gap-3",
        gridClass,
        className
      )}
    >
      {visible.map((member) => (
        <VideoTile
          key={member.id}
          member={member}
          isSpeaking={speakingId === member.id}
          className="min-h-0"
        />
      ))}
    </div>
  );
}
