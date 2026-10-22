"use client";

import React, { useEffect, useState, useRef } from "react";
import { Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hiệu ứng âm thanh tổng hợp bằng Web Audio API (không cần tải file ngoài)
 */
function playFlipSound(type = "tick") {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "tick") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } else if (type === "reveal") {
      // Âm thanh kết quả vang nhẹ
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.25); // E5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (_) {}
}

/**
 * ChessFlipCard: Thẻ 3D Flip Card bốc thăm ngẫu nhiên màu quân cờ trước trận đấu
 * - Props:
 *   + isWhite: boolean (true = Trắng / false = Đen)
 *   + onComplete: callback khi kết thúc animation để ẩn thẻ
 */
export function ChessFlipCard({ isWhite = true, onComplete }) {
  const [rotation, setRotation] = useState(0);
  const [isLanded, setIsLanded] = useState(false);
  const [isOutro, setIsOutro] = useState(false);
  const audioIntervalRef = useRef(null);

  useEffect(() => {
    // 1. Mục tiêu góc xoay:
    // Trắng (Front Face): 4 vòng = 1440 độ
    // Đen (Back Face): 4 vòng + 180 độ = 1620 độ
    const targetAngle = isWhite ? 1440 : 1620;

    // Hiệu ứng âm thanh quay thẻ nhanh dần rồi chậm dần trong 3 giây
    let tickCount = 0;
    const maxTicks = 18;
    audioIntervalRef.current = setInterval(() => {
      tickCount++;
      playFlipSound("tick");
      if (tickCount >= maxTicks) {
        clearInterval(audioIntervalRef.current);
      }
    }, 150);

    // Bắt đầu xoay mượt mà sau mount
    const spinTimer = setTimeout(() => {
      setRotation(targetAngle);
    }, 50);

    // Sau 3 giây: thẻ dừng lại tại mặt kết quả
    const landTimer = setTimeout(() => {
      setIsLanded(true);
      playFlipSound("reveal");
    }, 3000);

    // Sau 4 giây (giữ 1 giây xem kết quả): bắt đầu thu nhỏ biến mất
    const outroTimer = setTimeout(() => {
      setIsOutro(true);
    }, 4000);

    // Sau 4.4 giây: gọi onComplete
    const finishTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 4400);

    return () => {
      clearTimeout(spinTimer);
      clearTimeout(landTimer);
      clearTimeout(outroTimer);
      clearTimeout(finishTimer);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [isWhite, onComplete]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto">
      {/* Container có perspective 1000px */}
      <div
        className={cn(
          "relative flex items-center justify-center transition-all duration-400 ease-in-out",
          isOutro ? "scale-0 opacity-0" : "scale-100 opacity-100"
        )}
        style={{ perspective: "1000px" }}
      >
        {/* Glow phát sáng phía sau thẻ khi dừng lại */}
        <div
          className={cn(
            "absolute -inset-4 rounded-3xl blur-2xl transition-opacity duration-700 pointer-events-none",
            isLanded
              ? isWhite
                ? "bg-amber-300/30 opacity-100 animate-pulse"
                : "bg-purple-600/30 opacity-100 animate-pulse"
              : "opacity-0"
          )}
        />

        {/* Thẻ Card 3D Flip */}
        <div
          className="relative h-[330px] w-[230px] select-none rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)]"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${rotation}deg)`,
            transition: "transform 3.0s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* =========================================
              MẶT SÁNG / QUÂN TRẮNG (Front Face)
              ========================================= */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-[#F5EFE6] p-5 text-[#2A231E] shadow-xl"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(0deg)",
            }}
          >
            {/* Họa tiết viền cổ điển Dark Academia */}
            <div className="absolute inset-1.5 rounded-xl border border-amber-700/20 pointer-events-none" />
            <div className="absolute top-2 left-2 text-[10px] text-amber-800/40">✦</div>
            <div className="absolute top-2 right-2 text-[10px] text-amber-800/40">✦</div>
            <div className="absolute bottom-2 left-2 text-[10px] text-amber-800/40">✦</div>
            <div className="absolute bottom-2 right-2 text-[10px] text-amber-800/40">✦</div>

            {/* Header thẻ */}
            <div className="text-center pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-800/80">
                Bốc thăm quân cờ
              </span>
              <h3 className="font-serif text-2xl font-bold tracking-wide text-[#33261D] mt-0.5">
                QUÂN TRẮNG
              </h3>
            </div>

            {/* Minh họa Quân Vua Trắng mạ vàng */}
            <div className="relative my-auto flex flex-col items-center justify-center">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-amber-100 to-amber-200/90 shadow-inner border border-amber-300">
                <Crown className="h-12 w-12 text-amber-600 drop-shadow-[0_2px_8px_rgba(217,119,6,0.5)]" />
                <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-500 animate-spin" style={{ animationDuration: "6s" }} />
              </div>
            </div>

            {/* Footer Badge: BẠN ĐI TRƯỚC */}
            <div className="w-full text-center pb-2">
              <div className="rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 px-3 py-2 text-white shadow-md">
                <p className="text-[11px] font-bold tracking-wide uppercase drop-shadow-sm">
                  Bạn đi trước (Quân Trắng)
                </p>
              </div>
              <p className="mt-1.5 text-[10px] text-amber-900/60 font-medium">
                Ván cờ chuẩn bị bắt đầu
              </p>
            </div>
          </div>

          {/* =========================================
              MẶT TỐI / QUÂN ĐEN (Back Face)
              ========================================= */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-[#1C1612] p-5 text-[#F5EDE3] shadow-xl"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {/* Họa tiết viền huyền bí */}
            <div className="absolute inset-1.5 rounded-xl border border-amber-500/15 pointer-events-none" />
            <div className="absolute top-2 left-2 text-[10px] text-amber-400/30">✦</div>
            <div className="absolute top-2 right-2 text-[10px] text-amber-400/30">✦</div>
            <div className="absolute bottom-2 left-2 text-[10px] text-amber-400/30">✦</div>
            <div className="absolute bottom-2 right-2 text-[10px] text-amber-400/30">✦</div>

            {/* Header thẻ */}
            <div className="text-center pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/70">
                Bốc thăm quân cờ
              </span>
              <h3 className="font-serif text-2xl font-bold tracking-wide text-amber-100 mt-0.5">
                QUÂN ĐEN
              </h3>
            </div>

            {/* Minh họa Quân Vua Đen viền huyền bí */}
            <div className="relative my-auto flex flex-col items-center justify-center">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-[#2A2019] to-[#120E0B] shadow-inner border border-amber-500/30 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                <Crown className="h-12 w-12 text-zinc-300 drop-shadow-[0_2px_12px_rgba(245,158,11,0.4)]" />
                <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
              </div>
            </div>

            {/* Footer Badge: BẠN ĐI SAU */}
            <div className="w-full text-center pb-2">
              <div className="rounded-xl bg-[#29221C] border border-amber-500/30 px-3 py-2 text-amber-200 shadow-md">
                <p className="text-[11px] font-bold tracking-wide uppercase">
                  Bạn đi sau (Quân Đen)
                </p>
              </div>
              <p className="mt-1.5 text-[10px] text-zinc-400 font-medium">
                Ván cờ chuẩn bị bắt đầu
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChessFlipCard;
