"use client";

import React, { useState, useRef, useEffect } from "react";
import { Smile, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = [
  {
    id: "smileys",
    name: "Mặt cười & Cảm xúc",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥹", "😊",
      "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜",
      "🤪", "🤔", "🤫", "🤭", "🫡", "🥱", "😴", "🤤", "😵", "🥳",
      "😎", "🥺", "😭", "😤", "😡", "🤯", "🫠", "🤩", "🤗", "🧐"
    ],
  },
  {
    id: "gestures",
    name: "Cử chỉ & Bàn tay",
    emojis: [
      "👍", "👎", "👏", "🙌", "🫶", "🤝", "🙏", "✌️", "🤞", "🫰",
      "🤙", "✍️", "💪", "👊", "✊", "🖐️", "👋", "👌", "🤌", "👈",
      "👉", "👆", "👇", "☝️", "💅", "🤳"
    ],
  },
  {
    id: "hearts",
    name: "Trái tim",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❤️‍🔥", "💖", "💗", "💓", "💞", "💕", "💌", "💘", "💝", "💟"
    ],
  },
  {
    id: "study",
    name: "Học tập & Học viện",
    emojis: [
      "📚", "📖", "📕", "📗", "📘", "📙", "📝", "✏️", "✒️", "🎓",
      "💡", "🕯️", "☕", "🍵", "⏳", "⌛", "🏆", "🎯", "⭐", "✨",
      "🔥", "📌", "📎", "💻", "🧠", "📜", "🎒", "🔭", "🔬", "🪐"
    ],
  },
];

export default function EmojiPickerPopover({
  onSelect,
  align = "left",
  disabled = false,
  className,
  triggerClassName,
  popoverClassName,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("smileys");
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  // Click outside & Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (emoji) => {
    if (onSelect) {
      onSelect(emoji);
    }
    // Không đóng popover ngay để người dùng có thể bấm chọn liên tiếp nhiều emoji
  };

  // Vị trí neo popup:
  // - "left" (mặc định): căn mép trái của nút/cụm icon (left-0), mở rộng sang phải,
  //   tuyệt đối không bị cột "Đoạn chat" bên trái che khuất.
  // - "right": neo theo góc phải (right-0).
  // - "input-right": căn theo góc phải cách mép phải một khoảng (left-auto right-12).
  const alignmentClasses =
    align === "right"
      ? "right-0 left-auto"
      : align === "input-right"
      ? "left-auto right-12"
      : "left-0 right-auto";

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full text-stone-400 hover:text-amber-400 hover:bg-stone-800/60 transition cursor-pointer disabled:opacity-50",
          isOpen && "text-amber-400 bg-stone-800/80",
          triggerClassName
        )}
        title="Chọn biểu tượng cảm xúc (Emoji)"
        aria-label="Chọn Emoji"
      >
        <Smile className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute bottom-full mb-3 z-50 w-[280px] sm:w-[320px] max-h-[350px] rounded-xl sm:rounded-2xl border border-amber-900/40 bg-[#1a1613]/95 shadow-2xl backdrop-blur-md p-3 text-stone-200 animate-in fade-in zoom-in-95 duration-150 select-none flex flex-col",
            alignmentClasses,
            popoverClassName
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & Tabs */}
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-2 mb-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveTab(cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap",
                    activeTab === cat.id
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                      : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/40"
                  )}
                >
                  {cat.id === "smileys" && "😃 Cảm xúc"}
                  {cat.id === "gestures" && "👍 Cử chỉ"}
                  {cat.id === "hearts" && "❤️ Trái tim"}
                  {cat.id === "study" && "📚 Học tập"}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji Grid */}
          <div className="flex-1 max-h-[210px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {EMOJI_CATEGORIES.filter((c) => c.id === activeTab).map((category) => (
              <div key={category.id}>
                <div className="text-[11px] font-medium text-stone-400 mb-1.5 px-1">
                  {category.name}
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                  {category.emojis.map((emoji, idx) => (
                    <button
                      key={`${emoji}-${idx}`}
                      type="button"
                      onClick={() => handleSelect(emoji)}
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-lg hover:bg-amber-500/20 hover:scale-125 transition-transform duration-100 active:scale-95 cursor-pointer"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Helper Tip */}
          <div className="mt-2 pt-1.5 border-t border-stone-800/60 text-[10px] text-stone-500 text-center shrink-0">
            Nhấp biểu tượng để thêm vào tin nhắn
          </div>
        </div>
      )}
    </div>
  );
}
