"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

// 6 biểu tượng cảm xúc chuẩn phong cách Messenger
export const REACTION_EMOJIS = [
  { emoji: "❤️", label: "Yêu thích" },
  { emoji: "👍", label: "Thích" },
  { emoji: "😆", label: "Haha" },
  { emoji: "😮", label: "Wow" },
  { emoji: "😢", label: "Buồn" },
  { emoji: "😡", label: "Phẫn nộ" },
];

/**
 * MessageReactionTrigger & Bar:
 * Thanh nổi 6 emoji cảm xúc xuất hiện khi hover tin nhắn hoặc click icon cảm xúc.
 */
export function ReactionBar({ onReact, currentReaction, isOpen, onClose, isMine }) {
  const barRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={barRef}
      className={cn(
        "absolute -top-10 z-30 flex items-center gap-1 px-2 py-1 rounded-full bg-[#1b1714]/95 border border-amber-500/30 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-90 duration-150 select-none",
        isMine ? "right-0" : "left-0"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {REACTION_EMOJIS.map(({ emoji, label }) => {
        const isSelected = currentReaction === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onReact(emoji);
              onClose?.();
            }}
            title={label}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-full text-base transition-transform duration-150 hover:scale-135 active:scale-95 cursor-pointer relative",
              isSelected && "bg-amber-500/20 ring-1 ring-amber-400 scale-110"
            )}
          >
            <span>{emoji}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * ReactionBadge:
 * Huy hiệu hiển thị danh sách cảm xúc gom nhóm + tổng số lượng ở góc dưới bong bóng chat.
 */
export function ReactionBadge({ reactions = [], currentUserId, onReact, className }) {
  // Gom nhóm theo emoji (luôn gọi hook vô điều kiện ở đầu component)
  const grouped = useMemo(() => {
    if (!reactions || !Array.isArray(reactions) || reactions.length === 0) return [];
    const map = {};
    reactions.forEach((r) => {
      if (!r || !r.emoji) return;
      if (!map[r.emoji]) {
        map[r.emoji] = {
          emoji: r.emoji,
          count: 0,
          users: [],
          hasMe: false,
        };
      }
      map[r.emoji].count += 1;
      const uId = r.userId?._id || r.userId?.id || r.userId;
      if (String(uId) === String(currentUserId)) {
        map[r.emoji].hasMe = true;
      }
      const uName = r.userId?.name || "Người dùng";
      map[r.emoji].users.push(uName);
    });
    return Object.values(map);
  }, [reactions, currentUserId]);

  if (!reactions || reactions.length === 0 || grouped.length === 0) return null;

  const totalCount = reactions.length;
  const userHasReacted = reactions.some((r) => {
    const uId = r.userId?._id || r.userId?.id || r.userId;
    return String(uId) === String(currentUserId);
  });

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] shadow-sm backdrop-blur-xs transition cursor-pointer select-none",
        userHasReacted
          ? "bg-amber-950/70 border border-amber-500/40 text-amber-200"
          : "bg-stone-900/80 border border-stone-700/50 text-stone-300 hover:border-stone-600",
        className
      )}
      title={grouped.map((g) => `${g.emoji} ${g.users.join(", ")}`).join("\n")}
    >
      <div className="flex items-center -space-x-1">
        {grouped.slice(0, 3).map((g) => (
          <span key={g.emoji} className="text-xs">
            {g.emoji}
          </span>
        ))}
      </div>
      {totalCount > 1 && (
        <span className="font-semibold text-[10px] ml-0.5">{totalCount}</span>
      )}
    </div>
  );
}

/**
 * MessageReactionWrapper:
 * Bọc tin nhắn, cung cấp hover reaction bar và hiển thị ReactionBadge.
 */
export default function MessageReactions({
  message,
  currentUserId,
  onReact,
  isMine = false,
  canReact = true,
}) {
  const [isBarOpen, setIsBarOpen] = useState(false);

  // Tìm emoji hiện tại mà current user đã thả (nếu có)
  const currentReaction = useMemo(() => {
    const reactionsList = message?.reactions || [];
    const myR = reactionsList.find((r) => {
      const uId = r.userId?._id || r.userId?.id || r.userId;
      return String(uId) === String(currentUserId);
    });
    return myR?.emoji || null;
  }, [message?.reactions, currentUserId]);

  if (!canReact) return null;

  return (
    <>
      {/* Floating Reaction Bar */}
      <ReactionBar
        isOpen={isBarOpen}
        onClose={() => setIsBarOpen(false)}
        onReact={(emoji) => {
          onReact(emoji);
          setIsBarOpen(false);
        }}
        currentReaction={currentReaction}
        isMine={isMine}
      />

      {/* Trigger Button (hiện khi hover trên message) */}
      <button
        type="button"
        onClick={() => setIsBarOpen((prev) => !prev)}
        className={cn(
          "p-1 rounded-full text-stone-500 hover:text-amber-400 hover:bg-stone-800/80 transition opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer shrink-0",
          isBarOpen && "opacity-100 text-amber-400 bg-stone-800/80"
        )}
        title="Thả cảm xúc"
        aria-label="Thả cảm xúc"
      >
        <Smile className="w-3.5 h-3.5" />
      </button>
    </>
  );
}
