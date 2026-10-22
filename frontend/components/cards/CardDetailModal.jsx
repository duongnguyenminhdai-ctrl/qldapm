"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Layers, Quote, Award, CheckCircle2, Clock } from "lucide-react";
import { ReflectiveCard } from "./ReflectiveCard";
import { cn } from "@/lib/utils";

export function CardDetailModal({ isOpen, onClose, card, count = 0 }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Đóng modal khi nhấn phím ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen || !card) return null;

  const isOwned = (Number(count) || 0) > 0;

  // Mô tả phẩm cấp
  const rarityDescription = {
    "Cơ bản": "Phẩm cấp khởi nguồn, tượng trưng cho nền tảng của mọi tri thức.",
    "Phổ thông": "Phẩm cấp khởi nguồn, tượng trưng cho nền tảng của mọi tri thức.",
    "Hiếm": "Phẩm cấp hiếm có, đòi hỏi sự kiên định và tư duy học thuật sắc bén.",
    "Sử thi": "Phẩm cấp sử thi, lưu dấu ấn của những giờ khắc tập trung cao độ vượt bậc.",
    "Huyền thoại": "Phẩm cấp huyền thoại, chỉ dành cho những học giả thắp sáng màn đêm.",
    "Thần thoại": "Phẩm cấp tối thượng, biểu trưng của đỉnh cao uyên bác và vĩnh hằng.",
    "Tối thượng": "Phẩm cấp tối thượng, biểu trưng của đỉnh cao uyên bác và vĩnh hằng.",
  }[card.rarity] || "Lá bài độc bản trong kho tàng học viện.";

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div
        className="relative z-10 w-[92vw] max-w-2xl bg-gradient-to-b from-[#fbf8f2] via-[#f7f2e8] to-[#eee5d3] dark:from-[#241c16] dark:via-[#1a1410] dark:to-[#120d0a] border border-amber-600/35 dark:border-amber-500/35 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl shadow-amber-950/20 dark:shadow-black/80 max-h-[88dvh] flex flex-col justify-between overflow-y-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng (X) góc trên - Touch target tối thiểu 40px */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-amber-600/30 dark:border-amber-500/25 bg-[#eee5d3]/90 dark:bg-[#201b18]/80 text-[#6e6358] dark:text-[#a89b8d] hover:text-[#2D241E] dark:hover:text-[#f5ede3] hover:bg-[#e4d8c0] dark:hover:bg-[#2e2621] active:scale-95 transition-all cursor-pointer"
          title="Đóng chi tiết thẻ"
          aria-label="Đóng chi tiết thẻ"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Nội dung chi tiết: Cột trái (Card) + Cột phải (Thông tin) */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-5 sm:gap-8 my-auto py-2">
          {/* Cột trái: Reflective Card lớn với hiệu ứng 3D Tilt & Glare */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="w-48 sm:w-64 md:w-72 aspect-[2/3] max-h-[34dvh] sm:max-h-[380px]">
              <ReflectiveCard
                cardId={card.id}
                name={card.name}
                rarity={card.rarity}
                count={count}
                isOwned={isOwned}
                showCountBadge={isOwned}
                className="w-full h-full shadow-2xl hover:scale-105 transition-transform"
              />
            </div>
            <p className="mt-2.5 text-[11px] text-[#8C7E72] dark:text-[#786c5e] font-mono italic">
              ✨ Rê chuột trên thẻ để thấy hiệu ứng quang học 3D
            </p>
          </div>

          {/* Cột phải: Thông tin học giả & Lore */}
          <div className="flex-1 flex flex-col justify-between space-y-4 text-center md:text-left min-w-0">
            <div>
              {/* Badge Phẩm cấp & Số thứ tự */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-600/30 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-mono font-semibold uppercase tracking-wider">
                  <Layers className="h-3.5 w-3.5 stroke-current" />
                  <span>Lá Bài #{card.id} {card.tarotNumber ? `• ${card.tarotNumber}` : ""}</span>
                </span>
                <span className="px-2.5 py-1 rounded-full bg-stone-200/80 dark:bg-stone-800 border border-stone-300/80 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold">
                  Phẩm cấp: {card.rarity}
                </span>
              </div>

              {/* Tên lá bài */}
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2D241E] dark:text-[#f5ede3] tracking-tight">
                {card.name}
              </h2>
              {(card.titleEn || card.tarotName || card.title) && (
                <p className="text-xs font-mono text-amber-700 dark:text-amber-400 mt-0.5">
                  {card.tarotNumber ? `[${card.tarotNumber}] ` : ""}{card.titleEn || card.tarotName || card.title}
                </p>
              )}
            </div>

            {/* Trích dẫn / Châm ngôn Lore (Hiển thị đầy đủ không bị cắt cụt) */}
            <div className="relative p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-600/20 dark:border-amber-500/25">
              <Quote className="h-5 w-5 text-amber-600/40 dark:text-amber-400/30 mb-1" />
              <p className="text-sm sm:text-base font-serif italic text-[#4a3f35] dark:text-[#d8c8b4] leading-relaxed">
                &ldquo;{card.quote}&rdquo;
              </p>
              <p className="mt-2 text-xs text-[#8C7E72] dark:text-[#a89b8d]">
                {card.description || rarityDescription}
              </p>
            </div>

            {/* Tình trạng sở hữu trong kho */}
            <div className="rounded-xl p-3.5 border bg-[#eee5d3]/70 dark:bg-[#1a1512] border-amber-600/20 dark:border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {isOwned ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <div className="text-left">
                  <span className="block text-xs font-semibold text-[#2D241E] dark:text-[#f5ede3]">
                    {isOwned ? "Đã mở khóa trong kho bài" : "Chưa sở hữu lá bài này"}
                  </span>
                  <span className="block text-[11px] text-[#8C7E72] dark:text-[#a89b8d]">
                    {isOwned
                      ? `Hiện tại bạn đang sở hữu ${count} bản sao của thẻ này.`
                      : "Học đủ 3 giờ mỗi ngày để tích lũy lượt mở bài ngẫu nhiên."}
                  </span>
                </div>
              </div>

              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-mono font-bold shrink-0",
                  isOwned
                    ? "bg-amber-500 text-[#141210] ring-1 ring-amber-300"
                    : "bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
                )}
              >
                {isOwned ? `x${count}` : "x0"}
              </span>
            </div>

            {/* Nút đóng ở đáy */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-6 py-2.5 rounded-xl border border-amber-600/35 dark:border-amber-500/30 bg-[#eee5d3] dark:bg-[#201b18] text-xs sm:text-sm font-semibold text-[#2D241E] dark:text-[#f5ede3] hover:bg-[#e4d7bf] dark:hover:bg-[#2b231d] hover:border-amber-600 dark:hover:border-amber-400 active:scale-95 transition cursor-pointer shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default CardDetailModal;
