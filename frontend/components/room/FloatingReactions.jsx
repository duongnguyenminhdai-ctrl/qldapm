"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * Danh sách emoji phản ứng nhanh cho phòng học
 */
export const REACTION_EMOJIS = ["❤️", "👏", "🔥", "🎉", "💡", "☕"];

/**
 * Component hiển thị các emoji phản ứng bay lượn trên màn hình
 * Hiệu ứng CSS keyframes mượt mà trên GPU (translate3d + opacity), không gây lag hay giật layout.
 */
export function FloatingReactions({ reactions: externalReactions }) {
  const [internalReactions, setInternalReactions] = useState([]);

  useEffect(() => {
    const handleEvent = (e) => {
      const { emoji, senderName } = e.detail || {};
      if (!emoji) return;

      const left = 20 + Math.random() * 60;
      const driftX = (Math.random() - 0.5) * 90;
      const driftRot = (Math.random() - 0.5) * 30;
      const id = `rx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      setInternalReactions((prev) => [
        ...prev.slice(-24),
        { id, emoji, senderName, left, driftX, driftRot },
      ]);

      setTimeout(() => {
        setInternalReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3300);
    };

    window.addEventListener("vsr:trigger-reaction", handleEvent);
    return () => window.removeEventListener("vsr:trigger-reaction", handleEvent);
  }, []);

  const reactions = externalReactions && externalReactions.length > 0 ? externalReactions : internalReactions;
  if (!reactions || reactions.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[50] overflow-hidden select-none"
    >
      {reactions.map((rx) => (
        <div
          key={rx.id}
          className="absolute bottom-16 sm:bottom-20 flex flex-col items-center animate-float-reaction"
          style={{
            left: `${rx.left}%`,
            "--drift-x": `${rx.driftX}px`,
            "--drift-rot": `${rx.driftRot}deg`,
          }}
        >
          {/* Biểu tượng Emoji lớn nổi bật */}
          <span className="text-3xl sm:text-4xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transform-gpu hover:scale-110 transition-transform">
            {rx.emoji}
          </span>

          {/* Nhãn tên người gửi nhỏ tinh tế */}
          {rx.senderName && (
            <span className="mt-1 max-w-[110px] truncate rounded-full border border-zinc-800/80 bg-zinc-950/85 px-2 py-0.5 text-[10px] font-medium text-zinc-300 shadow-md backdrop-blur-sm">
              {rx.senderName}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Hook phát floating reaction mà không làm re-render component cha (Zero-Cost Re-render)
 */
export function useFloatingReactions() {
  const triggerReaction = useCallback(({ emoji, senderName }) => {
    if (typeof window !== "undefined" && emoji) {
      window.dispatchEvent(
        new CustomEvent("vsr:trigger-reaction", {
          detail: { emoji, senderName },
        })
      );
    }
  }, []);

  return { reactions: [], triggerReaction };
}
