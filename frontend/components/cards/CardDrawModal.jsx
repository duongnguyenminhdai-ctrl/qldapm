"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  SquareStack,
  RotateCcw,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  Award,
  Loader2,
} from "lucide-react";
import { cardsApi, getStoredUser, setStoredUser, getAuthToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { ReflectiveCard } from "./ReflectiveCard";
import { SCHOLAR_CARDS_MAP, getCardById } from "@/constants/cardsData";

/**
 * Hiệu ứng âm thanh tổng hợp bằng Web Audio API khi mở thẻ và lật bài
 */
function playSoundEffect(type = "flip") {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "click") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === "flip") {
      // Âm gió lật bài
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === "reveal") {
      // Hợp âm hào quang khi bài hiện mặt trước
      const freqs = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.05, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.65);
      });
    }
  } catch (_) {}
}

export function CardDrawModal({ isOpen, onClose, onDrawSuccess }) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState("SELECT"); // 'SELECT' | 'FLIPPING' | 'SHOWCASE'
  const [selectedCardIdx, setSelectedCardIdx] = useState(3); // 0 đến 6 (chọn giữa 3 mặc định)
  const [drawnCardId, setDrawnCardId] = useState(null);
  const [cardDraws, setCardDraws] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const touchStartXRef = useRef(0);

  // Reflective Card mouse tilt
  const [tiltStyle, setTiltStyle] = useState({
    transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
    glareX: 50,
    glareY: 50,
    glareOpacity: 0,
  });

  const cardRef = useRef(null);

  // Khởi tạo portal và theo dõi kích thước màn hình
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Lắng nghe cập nhật lượt mở thẻ từ API và socket
  const fetchCardStats = useCallback(async () => {
    try {
      const res = await cardsApi.getMyCards();
      const payload = res?.data || res;
      if (payload && payload.cardDraws !== undefined) {
        setCardDraws(payload.cardDraws || 0);
      }
    } catch (_) {
      const user = getStoredUser();
      if (user) {
        setCardDraws(user.cardDraws || 0);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep("SELECT");
      setDrawnCardId(null);
      setErrorMsg("");
      fetchCardStats();
    }
  }, [isOpen, fetchCardStats]);

  // Xử lý rút bài
  const handleStartDraw = async () => {
    if (cardDraws <= 0) {
      setErrorMsg("Bạn đã hết lượt mở thẻ. Tích lũy đủ 180 phút học trong ngày để nhận thêm lượt!");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setErrorMsg("Phiên làm việc hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    setErrorMsg("");
    setLoading(true);
    playSoundEffect("flip");
    setStep("FLIPPING");

    try {
      const res = await cardsApi.draw();
      if (res?.success) {
        const payload = res.data || res;
        const newCardId = payload.cardId;
        const remainingDraws = payload.cardDraws ?? 0;
        const updatedInventory = payload.cardInventory || [];
        setCardDraws(remainingDraws);

        // Cập nhật stored user
        const stored = getStoredUser();
        if (stored) {
          stored.cardDraws = remainingDraws;
          stored.cardInventory = updatedInventory;
          setStoredUser(stored);
        }

        // Chờ 1 giây hiệu ứng xoay lật 3D rồi chuyển sang SHOWCASE
        setTimeout(() => {
          setDrawnCardId(newCardId);
          playSoundEffect("reveal");
          setStep("SHOWCASE");
          setLoading(false);
          if (onDrawSuccess) onDrawSuccess(res);
        }, 1100);
      } else {
        setErrorMsg(res?.message || "Mở thẻ thất bại.");
        setStep("SELECT");
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(err?.data?.message || err?.message || "Có lỗi xảy ra khi mở thẻ.");
      setStep("SELECT");
      setLoading(false);
    }
  };

  // Mở tiếp thẻ khác nếu còn lượt
  const handleDrawAgain = () => {
    if (cardDraws > 0) {
      setStep("SELECT");
      setDrawnCardId(null);
      setErrorMsg("");
    } else {
      onClose();
    }
  };

  // Tính toán Reflective Glare & 3D Tilt khi di chuột trên lá bài trúng thưởng
  const handleCardMouseMove = (e) => {
    if (step !== "SHOWCASE" || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -14;
    const rotateY = ((x - centerX) / centerX) * 14;

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.04, 1.04, 1.04)`,
      glareX,
      glareY,
      glareOpacity: 0.75,
    });
  };

  const handleCardMouseLeave = () => {
    setTiltStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      glareX: 50,
      glareY: 50,
      glareOpacity: 0,
    });
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div
        className="relative z-10 w-[92vw] max-w-xl mx-auto bg-gradient-to-b from-[#fbf8f2] via-[#f7f2e8] to-[#eee5d3] dark:from-[#241c16] dark:via-[#1a1410] dark:to-[#120d0a] border border-amber-600/35 dark:border-amber-500/35 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-amber-950/20 dark:shadow-black/80 max-h-[88dvh] flex flex-col justify-between overflow-y-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng (X) - Đảm bảo kích thước bấm cảm ứng >= 40px */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-amber-600/30 dark:border-amber-500/25 bg-[#eee5d3]/90 dark:bg-[#201b18]/80 text-[#6e6358] dark:text-[#a89b8d] hover:text-[#2D241E] dark:hover:text-[#f5ede3] hover:bg-[#e4d8c0] dark:hover:bg-[#2e2621] active:scale-95 transition-all cursor-pointer"
          title="Đóng modal"
          aria-label="Đóng modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Modal */}
        <div className="text-center space-y-1 mb-2 sm:mb-4 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-600/30 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium uppercase tracking-wider mb-0.5">
            <SquareStack className="h-3.5 w-3.5 stroke-current" />
            <span>Thẻ Bài Học Giả</span>
          </div>
          <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-semibold text-[#2D241E] dark:text-[#f5ede3] tracking-tight">
            {step === "SELECT" && "Chọn Thẻ Bài Của Bạn"}
            {step === "FLIPPING" && "Đang Khai Mở Vận Mệnh..."}
            {step === "SHOWCASE" && "Chúc Mừng Học Giả!"}
          </h2>
          <p className="text-xs sm:text-sm text-[#6e6358] dark:text-[#a89b8d]">
            {step === "SELECT" && "Chọn 1 trong 7 lá bài bí ẩn dưới đây và mở khóa kiến thức"}
            {step === "FLIPPING" && "Tinh hoa tri thức đang tập hợp lại trong lá bài"}
            {step === "SHOWCASE" && (
              <span className="text-amber-800 dark:text-amber-200 font-medium">
                {getCardById(drawnCardId)?.name} — {getCardById(drawnCardId)?.tarotName}
              </span>
            )}
          </p>
        </div>

        {/* Thông báo lỗi nếu có */}
        {errorMsg && (
          <div className="w-full mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {/* =========================================================================
            BƯỚC 1: CIRCULAR GALLERY (7 lá bài xoay vòng 3D, hỗ trợ vuốt chạm Swipe)
           ========================================================================= */}
        {step === "SELECT" && (
          <div className="w-full flex flex-col items-center my-auto py-1 sm:py-2">
            {/* Gallery 3D Carousel kèm touch swipe */}
            <div
              onTouchStart={(e) => {
                if (e.touches && e.touches[0]) {
                  touchStartXRef.current = e.touches[0].clientX;
                }
              }}
              onTouchEnd={(e) => {
                if (e.changedTouches && e.changedTouches[0]) {
                  const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
                  if (deltaX < -35) {
                    playSoundEffect("click");
                    setSelectedCardIdx((prev) => Math.min(6, prev + 1));
                  } else if (deltaX > 35) {
                    playSoundEffect("click");
                    setSelectedCardIdx((prev) => Math.max(0, prev - 1));
                  }
                }
              }}
              className="relative w-full h-56 sm:h-72 flex items-center justify-center overflow-visible perspective-[1000px] touch-pan-y"
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
                  const offset = idx - selectedCardIdx;
                  // Tính khoảng cách góc xoay 3D (co gọn vừa vặn trên màn hình mobile)
                  const stepSpacing = isMobile ? 38 : 70;
                  const rotateY = offset * (isMobile ? 18 : 22);
                  const translateX = offset * stepSpacing;
                  const translateZ = -Math.abs(offset) * (isMobile ? 35 : 45);
                  const scale = isMobile
                    ? (1 - Math.abs(offset) * 0.1) * 0.85
                    : 1 - Math.abs(offset) * 0.08;
                  const opacity = 1 - Math.abs(offset) * 0.18;
                  const isSelected = idx === selectedCardIdx;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        playSoundEffect("click");
                        setSelectedCardIdx(idx);
                      }}
                      className={cn(
                        "absolute w-28 sm:w-36 h-42 sm:h-54 rounded-2xl cursor-pointer transition-all duration-300 ease-out select-none",
                        isSelected
                          ? "ring-3 ring-amber-400 shadow-2xl shadow-amber-500/50 z-20 scale-105"
                          : "hover:scale-98 opacity-80 hover:opacity-100 z-10"
                      )}
                      style={{
                        transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                        opacity: Math.max(0.2, opacity),
                        transformStyle: "preserve-3d",
                      }}
                    >
                      {/* Mặt lưng thẻ bài (8.png) */}
                      <div className="w-full h-full rounded-2xl overflow-hidden border border-amber-500/40 bg-[#16120f] shadow-lg">
                        <img
                          src="/image/card/8.png"
                          alt="Lưng thẻ bài học giả"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </div>

                      {/* Hiệu ứng viền phát sáng khi chọn */}
                      {isSelected && (
                        <div className="absolute -inset-1 rounded-2xl border-2 border-amber-300 pointer-events-none animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mũi tên điều hướng Carousel trái/phải */}
              <button
                type="button"
                onClick={() => {
                  playSoundEffect("click");
                  setSelectedCardIdx((prev) => Math.max(0, prev - 1));
                }}
                disabled={selectedCardIdx === 0}
                className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-[#eee5d3]/95 dark:bg-[#1e1713]/90 border border-amber-600/35 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 hover:bg-[#e4d7bf] dark:hover:bg-[#2b211a] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shadow-md"
                aria-label="Thẻ trước"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  playSoundEffect("click");
                  setSelectedCardIdx((prev) => Math.min(6, prev + 1));
                }}
                disabled={selectedCardIdx === 6}
                className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-[#eee5d3]/95 dark:bg-[#1e1713]/90 border border-amber-600/35 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 hover:bg-[#e4d7bf] dark:hover:bg-[#2b211a] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer shadow-md"
                aria-label="Thẻ kế tiếp"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Thông tin số lượt mở và Nút hành động */}
            <div className="mt-4 sm:mt-5 flex flex-col items-center gap-3 w-full max-w-sm">
              <div className="flex items-center gap-2 text-xs text-[#6e6358] dark:text-[#a89b8d]">
                <span>Lượt mở hiện có:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-600/30 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold font-mono text-sm">
                  {cardDraws}
                </span>
              </div>

              <SpecularButton
                type="button"
                onClick={handleStartDraw}
                disabled={cardDraws <= 0 || loading}
                loading={loading}
                className="w-full py-3.5 sm:py-4 text-sm sm:text-base font-semibold"
              >
                {cardDraws > 0 ? "Mở Thẻ Này" : "Hết Lượt Mở Thẻ"}
              </SpecularButton>
            </div>
          </div>
        )}

        {/* =========================================================================
            BƯỚC 2: FLIP CARD (Lá bài xoay lật 180 độ ở giữa màn hình)
           ========================================================================= */}
        {step === "FLIPPING" && (
          <div className="w-full h-80 sm:h-96 flex flex-col items-center justify-center perspective-[1200px]">
            <div
              className="relative w-48 sm:w-56 h-72 sm:h-84 transition-transform duration-1000 ease-out"
              style={{
                transformStyle: "preserve-3d",
                transform: "rotateY(180deg) scale(1.08)",
              }}
            >
              {/* Mặt sau (Lúc chuẩn bị lật) */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-[#16120f] shadow-2xl"
                style={{ backfaceVisibility: "hidden" }}
              >
                <img
                  src="/image/card/8.png"
                  alt="Mặt lưng"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Mặt trước (Lật ra) */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-amber-400 bg-[#16120f] shadow-2xl shadow-amber-500/50"
                style={{
                  transform: "rotateY(180deg)",
                  backfaceVisibility: "hidden",
                }}
              >
                {drawnCardId ? (
                  <img
                    src={`/image/card/${drawnCardId}.png`}
                    alt={`Thẻ bài ${drawnCardId}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600/30 to-amber-950/60">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
                  </div>
                )}
              </div>
            </div>

            <p className="mt-6 text-sm font-serif text-amber-200 animate-pulse">
              Đang giải mã phong ấn tri thức...
            </p>
          </div>
        )}

        {/* =========================================================================
            BƯỚC 3: REFLECTIVE CARD (Trưng bày nghiêng 3D & Holographic Glare)
           ========================================================================= */}
        {step === "SHOWCASE" && drawnCardId && (() => {
          const currentCard = getCardById(drawnCardId);
          return (
            <div className="w-full flex flex-col items-center justify-between flex-1 min-h-0 py-1">
              {/* Vùng tương tác Reflective Card */}
              <div className="w-48 sm:w-64 aspect-[2/3] max-h-[32dvh] sm:max-h-[360px] mx-auto shrink-0">
                <ReflectiveCard
                  cardId={drawnCardId}
                  name={currentCard.name}
                  rarity={currentCard.rarity}
                  isOwned={true}
                  className="w-full h-full shadow-2xl"
                />
              </div>

              {/* Thông tin lá bài */}
              <div className="mt-2 text-center shrink-0">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono uppercase tracking-widest font-semibold">
                    Lá #{drawnCardId} • {currentCard.tarotNumber} - {currentCard.tarotName}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-600/30 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                    {currentCard.rarity}
                  </span>
                </div>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#2D241E] dark:text-[#f5ede3] leading-tight">
                  {currentCard.name}
                </h3>
                <p className="mt-1 text-xs text-[#6e6358] dark:text-[#a89b8d] italic max-w-sm mx-auto line-clamp-2">
                  {currentCard.quote}
                </p>
              </div>

            {/* Cụm nút bấm đáy (2 nút: "Rút tiếp" và "Cất vào bộ sưu tập") */}
            <div className="mt-4 pt-2 pb-2 flex items-center justify-center gap-3 relative z-20 shrink-0 w-full max-w-sm mx-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl border border-amber-600/35 dark:border-amber-500/30 bg-[#eee5d3] dark:bg-[#201b18] text-xs font-semibold text-[#2D241E] dark:text-[#f5ede3] hover:bg-[#e4d7bf] dark:hover:bg-[#2b231d] hover:border-amber-600 dark:hover:border-amber-400 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <PackageCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Cất vào bộ sưu tập</span>
              </button>

              {cardDraws > 0 ? (
                <SpecularButton
                  type="button"
                  onClick={handleDrawAgain}
                  radius={12}
                  className="flex-1 py-3 text-xs"
                >
                  <span className="flex items-center gap-1.5 justify-center">
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Rút tiếp ({cardDraws})</span>
                  </span>
                </SpecularButton>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl border border-amber-300/80 dark:border-stone-700 bg-[#ece5da] dark:bg-stone-900/60 text-xs font-medium text-[#6e6358] dark:text-stone-400 hover:text-[#2D241E] dark:hover:text-stone-300 transition cursor-pointer"
                >
                  Hoàn tất
                </button>
              )}
            </div>
          </div>
          );
        })()}
      </div>
    </div>,
    document.body
  );
}

export default CardDrawModal;
