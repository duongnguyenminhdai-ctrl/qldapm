"use client";

import React, { useState, useRef } from "react";
import {
  Sparkles,
  Clock,
  Layers,
  Crown,
  Loader2,
  SquareStack,
  Eye,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { CardDetailModal } from "@/components/cards/CardDetailModal";
import { cn } from "@/lib/utils";

import { SCHOLAR_CARDS } from "@/constants/cardsData";

export { SCHOLAR_CARDS };

/**
 * ChromaCardItem — Thẻ bài với hiệu ứng viền Chroma Grid phản xạ theo tọa độ chuột
 * (https://reactbits.dev/components/chroma-grid)
 */
function ChromaCardItem({ card, count = 0, isOwned = false, onSelect }) {
  const cardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const rarityTagClass = {
    "Cơ bản": "text-amber-800 dark:text-amber-300 border-amber-500/30 bg-amber-500/10",
    "Hiếm": "text-blue-700 dark:text-blue-300 border-blue-500/30 bg-blue-500/10",
    "Sử thi": "text-purple-700 dark:text-purple-300 border-purple-500/30 bg-purple-500/10",
    "Huyền thoại": "text-yellow-800 dark:text-yellow-300 border-yellow-500/40 bg-yellow-500/15",
    "Thần thoại": "text-amber-800 dark:text-amber-200 border-amber-400/50 bg-amber-500/20",
  }[card.rarity] || "text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(card)}
      className={cn(
        "group relative flex flex-col rounded-xl p-2.5 sm:p-3.5 transition-all duration-300 select-none cursor-pointer active:scale-95",
        isOwned
          ? "bg-gradient-to-b from-[#fbf8f2] to-[#f4ebe0] dark:from-[#251e18] dark:to-[#171310] border border-amber-600/35 dark:border-amber-500/30 shadow-[0_4px_20px_rgba(180,120,40,0.1)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)] hover:-translate-y-1.5 hover:shadow-[0_12px_32px_rgba(180,120,40,0.22)] dark:hover:shadow-[0_12px_36px_rgba(217,119,6,0.18)]"
          : "bg-[#f0eae1]/90 dark:bg-[#161311]/90 border border-amber-200/80 dark:border-[#322a22] opacity-65 dark:opacity-55 hover:opacity-90 hover:border-amber-400/60"
      )}
    >
      {/* 1. Chroma Grid Border Glow bám theo vị trí chuột */}
      <div
        className="absolute -inset-[2px] rounded-xl pointer-events-none transition-opacity duration-200 z-[1]"
        style={{
          opacity: isHovered ? (isOwned ? 1 : 0.6) : 0,
          background: `radial-gradient(280px circle at ${mousePos.x}px ${mousePos.y}px, ${card.chromaColor}, transparent 70%)`,
          padding: "2px",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
        }}
      />

      {/* 2. Chroma Surface Light Sweep */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300 z-[2]"
        style={{
          opacity: isHovered ? (isOwned ? 0.12 : 0.06) : 0,
          background: `radial-gradient(320px circle at ${mousePos.x}px ${mousePos.y}px, ${card.chromaColor}, transparent 65%)`,
        }}
      />

      {/* Huy hiệu số lượng sở hữu xN góc trên bên phải */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20">
        <span
          className={cn(
            "inline-flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold shadow-md transition-all",
            isOwned
              ? "bg-amber-500 text-[#141210] ring-1.5 ring-amber-300 scale-100 group-hover:scale-110"
              : "bg-[#e6dec8] dark:bg-[#201b17] text-[#8C7E72] dark:text-[#6d6153] border border-amber-300/80 dark:border-[#3a3128]"
          )}
        >
          x{count}
        </span>
      </div>

      {/* Ảnh Thẻ Bài (Tỷ lệ 2/3 chuẩn co giãn tự động không vỡ layout) */}
      <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#ece5da] dark:bg-[#100d0b] border border-amber-600/25 dark:border-amber-500/20 shadow-inner">
        <img
          src={`/image/card/${card.id}.png`}
          alt={card.name}
          className={cn(
            "object-cover w-full h-full transition-transform duration-500 group-hover:scale-105",
            !isOwned && "grayscale opacity-50"
          )}
          loading="lazy"
        />

        {/* Lớp bóng shimmer khi sở hữu */}
        {isOwned && (
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        )}

        {/* Nhãn "Chưa sở hữu" khi count = 0 */}
        {!isOwned && (
          <div className="absolute inset-0 bg-black/40 dark:bg-black/50 flex items-center justify-center pointer-events-none p-1 text-center">
            <span className="text-[10px] sm:text-xs font-mono font-medium text-[#2D241E] dark:text-[#a89b8d] bg-white/90 dark:bg-black/75 px-2 sm:px-3 py-1 rounded-lg border border-amber-200/80 dark:border-[#3a3128] shadow-sm">
              Chưa sở hữu
            </span>
          </div>
        )}

        {/* Nút xem chi tiết khi hover */}
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-amber-200 bg-black/60 backdrop-blur-xs px-2 sm:px-2.5 py-1 rounded-md border border-amber-400/40">
            <Eye className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            <span>Phóng to</span>
          </span>
        </div>
      </div>

      {/* Thông tin thẻ bài */}
      <div className="mt-2 sm:mt-3 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8C7E72] dark:text-[#a89b8d] mb-1">
            <span className="text-[10px]">#{card.id} {card.tarotNumber ? `• ${card.tarotNumber}` : ""}</span>
            <span className={cn("px-1.5 py-0.5 rounded-md font-semibold border text-[10px]", rarityTagClass)}>
              {card.rarity}
            </span>
          </div>

          <h4
            className={cn(
              "text-xs font-semibold truncate sm:text-sm md:text-base sm:font-bold font-serif transition-colors leading-snug",
              isOwned
                ? "text-[#2D241E] dark:text-[#f5ede3] group-hover:text-amber-700 dark:group-hover:text-amber-300"
                : "text-[#8C7E72] dark:text-[#786c5e]"
            )}
            title={card.name}
          >
            {card.name}
          </h4>

          {(card.titleEn || card.tarotName || card.title) && (
            <p className="text-[9px] sm:text-[10px] font-mono text-amber-800/80 dark:text-amber-400/70 mt-0.5 truncate hidden sm:block">
              {card.titleEn || card.tarotName || card.title}
            </p>
          )}
        </div>

        <p className="hidden sm:block mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-[#6e6358] dark:text-[#a89b8d] italic leading-relaxed sm:line-clamp-none">
          &ldquo;{card.quote}&rdquo;
        </p>
      </div>
    </div>
  );
}

export function CardsTab({
  user,
  cardsData,
  distinctCount = 0,
  totalCardsCount = 0,
  canExchangeVip = false,
  exchangingVip = false,
  handleExchangeVip,
  isExchangeModalOpen = false,
  setIsExchangeModalOpen,
}) {
  const [selectedCard, setSelectedCard] = useState(null);

  // Lấy kho thẻ an toàn
  const inventory = Array.isArray(cardsData?.cardInventory)
    ? cardsData.cardInventory
    : Array.isArray(user?.cardInventory)
    ? user.cardInventory
    : [];

  const inventoryMap = inventory.reduce((acc, item) => {
    if (item && item.cardId) {
      acc[Number(item.cardId)] = Number(item.count) || 0;
    }
    return acc;
  }, {});

  const handleCardClick = (card) => {
    setSelectedCard(card);
  };

  const selectedCardCount = selectedCard ? Number(inventoryMap[selectedCard.id]) || 0 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Banner Thông tin & Thao tác rút thẻ */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-600/30 dark:border-amber-500/30 bg-gradient-to-br from-[#fbf8f2] via-[#f7f1e6] to-[#eee4d2] dark:from-[#241a12] dark:via-[#1c1612] dark:to-[#14100d] p-5 sm:p-6 shadow-xl text-[#2D241E] dark:text-[#f5ede3]">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-600/30 dark:border-amber-500/30 bg-amber-500/15 dark:bg-amber-500/10 px-3 py-1 text-xs font-serif font-semibold text-amber-800 dark:text-amber-300">
              <SquareStack className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 stroke-current" />
              <span>Hệ Thống Thẻ Bài Học Giả</span>
            </div>
            <h2 className="text-lg sm:text-xl font-serif font-bold text-[#2D241E] dark:text-[#f5ede3]">
              Bộ Sưu Tập Thẻ Tri Thức
            </h2>
            <p className="text-xs sm:text-sm text-[#6e6358] dark:text-[#a89b8d] max-w-xl">
              Học đủ 3 giờ (180 phút) mỗi ngày để nhận 1 lượt mở thẻ học giả. Thu thập đủ bộ 7 lá bài độc bản khác nhau để kích hoạt 30 ngày VIP miễn phí!
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-[#4a3f35] dark:text-[#d8c8b4]">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>
                  Thời gian học hôm nay:{" "}
                  <strong className="text-amber-700 dark:text-amber-300">
                    {cardsData?.dailyStudyMinutes || 0}
                  </strong>
                  /180 phút
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>
                  Đã sưu tầm:{" "}
                  <strong className="text-amber-700 dark:text-amber-300">
                    {distinctCount}
                  </strong>
                  /7 loại ({totalCardsCount} lá)
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("vsr:open-card-modal"));
                }
              }}
              className={cn(
                "w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs sm:text-sm font-semibold tracking-wide transition-all shadow-lg",
                (cardsData?.cardDraws || 0) > 0
                  ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-[#141210] hover:scale-105 shadow-amber-500/25 active:scale-95 cursor-pointer"
                  : "border border-amber-300/80 dark:border-[#3a3128] bg-[#ece5da] dark:bg-[#241e19] text-[#2D241E] dark:text-[#d8c8b4] hover:bg-[#e4d8c8] dark:hover:bg-[#2e2620]"
              )}
            >
              <SquareStack className="h-4 w-4 stroke-current" />
              <span>Mở Thẻ Bài</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-mono font-bold",
                  (cardsData?.cardDraws || 0) > 0
                    ? "bg-[#141210] text-amber-300"
                    : "bg-white/60 dark:bg-[#181513] text-[#8C7E72] dark:text-[#786c5e]"
                )}
              >
                {cardsData?.cardDraws || 0} lượt
              </span>
            </button>
          </div>
        </div>

        {/* Thanh tiến độ học 180 phút trong ngày */}
        <div className="mt-5 pt-4 border-t border-amber-200/70 dark:border-[#3a3128]/70">
          <div className="flex items-center justify-between text-xs text-[#6e6358] dark:text-[#a89b8d] mb-1.5 font-mono">
            <span>Tiến trình nhận thẻ hôm nay:</span>
            <span>{Math.min(180, cardsData?.dailyStudyMinutes || 0)}/180 phút</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#ece5da] dark:bg-[#141210] overflow-hidden border border-amber-200/80 dark:border-[#3a3128]">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
              style={{
                width: `${Math.min(100, ((cardsData?.dailyStudyMinutes || 0) / 180) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Khu vực Đổi VIP 1 Tháng */}
      <div className="rounded-2xl border border-amber-600/30 dark:border-amber-500/25 bg-[#fbf9f5] dark:bg-[#1a1512] p-5 sm:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-base font-serif font-bold text-[#2D241E] dark:text-[#f5ede3]">
                Đổi Gói 30 Ngày VIP (Pro)
              </h3>
              {user?.isPro && (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Đang kích hoạt VIP
                </span>
              )}
            </div>
            <p className="text-xs text-[#6e6358] dark:text-[#a89b8d] max-w-lg">
              Sử dụng trọn vẹn 1 bộ gồm 7 loại thẻ khác nhau (mỗi loại tiêu hao 1 thẻ) để nhận ngay 30 ngày VIP.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setIsExchangeModalOpen(true)}
            disabled={!canExchangeVip || exchangingVip}
            className={cn(
              "w-full sm:w-auto h-11 px-6 gap-2 text-xs sm:text-sm font-semibold tracking-wide transition-all shadow-md",
              canExchangeVip
                ? "bg-gradient-to-r from-amber-500 to-amber-400 text-[#141210] hover:scale-105 shadow-amber-500/20 active:scale-95 cursor-pointer"
                : "bg-[#ece5da] dark:bg-[#26201b] text-[#8C7E72] dark:text-[#786c5e] border border-amber-200/80 dark:border-[#3a3128] cursor-not-allowed opacity-60"
            )}
          >
            {exchangingVip ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
            <span>
              {canExchangeVip ? "Kích Hoạt 30 Ngày VIP" : `Cần thêm ${7 - distinctCount} thẻ khác loại`}
            </span>
          </Button>
        </div>

        {/* Progress Bar 7 thẻ */}
        <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-[#2d251f]">
          <div className="flex items-center justify-between text-xs text-[#6e6358] dark:text-[#a89b8d] mb-1.5 font-mono">
            <span>Tiến trình thu thập bộ thẻ:</span>
            <span
              className={
                canExchangeVip
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : "text-amber-700 dark:text-amber-400"
              }
            >
              {distinctCount}/7 loại thẻ {canExchangeVip && "— Đủ điều kiện đổi!"}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#ece5da] dark:bg-[#120f0d] overflow-hidden border border-amber-200/80 dark:border-[#3a3128]">
            <div
              className={cn(
                "h-full transition-all duration-500",
                canExchangeVip
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                  : "bg-gradient-to-r from-amber-600 to-amber-400"
              )}
              style={{ width: `${(distinctCount / 7) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. CHROMA GRID 4 CỘT (KHO THẺ BÀI HỌC GIẢ) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-500/20 pb-3">
          <div>
            <h3 className="text-base font-serif font-bold text-[#2D241E] dark:text-[#f5ede3] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Kho Thẻ Bài Học Giả (Chroma Grid)</span>
            </h3>
            <p className="text-xs text-[#6e6358] dark:text-[#a89b8d]">
              Nhấp vào bất kỳ lá bài nào để phóng to và trải nghiệm phản chiếu 3D Holographic Glare.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-amber-500/15 border border-amber-600/30 text-amber-800 dark:text-amber-300 self-start sm:self-auto">
            {distinctCount}/7 Đã mở khóa
          </span>
        </div>

        {/* Grid: Mobile 2 cột: grid grid-cols-2 gap-3 px-3 py-4, Desktop: 3-4 cột */}
        <div className="grid grid-cols-2 gap-3 px-3 py-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4 md:gap-6 sm:px-0 sm:py-0 max-w-6xl mx-auto pt-2">
          {SCHOLAR_CARDS.map((card) => {
            const count = Number(inventoryMap[card.id]) || 0;
            const isOwned = count > 0;

            return (
              <ChromaCardItem
                key={card.id}
                card={card}
                count={count}
                isOwned={isOwned}
                onSelect={handleCardClick}
              />
            );
          })}
        </div>
      </div>

      {/* Modal chi tiết thẻ bài phóng to với Reflective Card */}
      <CardDetailModal
        isOpen={Boolean(selectedCard)}
        onClose={() => setSelectedCard(null)}
        card={selectedCard}
        count={selectedCardCount}
      />

      {/* Modal xác nhận đổi VIP */}
      <ConfirmModal
        isOpen={isExchangeModalOpen}
        title="Xác nhận đổi 30 ngày VIP"
        message="Bạn có chắc chắn muốn dùng 1 bộ gồm 7 lá bài học giả khác nhau (mỗi lá trừ 1) để đổi lấy 30 ngày VIP không?"
        confirmText={exchangingVip ? "Đang xử lý..." : "Xác nhận đổi VIP"}
        cancelText="Hủy bỏ"
        variant="warning"
        onConfirm={handleExchangeVip}
        onCancel={() => setIsExchangeModalOpen(false)}
      />
    </div>
  );
}

export default CardsTab;
