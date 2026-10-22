"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Trophy,
  Scale,
  ShieldAlert,
  Sparkles,
  AlertCircle,
  Clock,
  RotateCcw,
  LogOut,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * GameOverModal: Modal kết quả ván cờ (Thắng / Hòa / Thua)
 * Render qua React Portal vào document.body với z-[99999] để đảm bảo tương tác 100% không bị đè pointer-events.
 */
export default function GameOverModal({
  isOpen,
  gameOverResult,
  winner,
  reason,
  isWhitePlayer,
  closingCountdown,
  isMeReady,
  isOpponentReady,
  onPlayerReady,
  onLeaveRoom,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !isOpen) return null;

  const currentResult = gameOverResult || {};
  const currentWinner =
    winner ||
    currentResult.winner ||
    (currentResult.winnerColor
      ? currentResult.winnerColor === "w"
        ? "white"
        : "black"
      : null);
  const currentReason =
    reason || currentResult.reason || currentResult.type;
  const isDraw =
    currentWinner === "draw" ||
    currentReason === "draw" ||
    currentReason === "stalemate" ||
    currentResult.type === "draw";
  const userWon =
    !isDraw &&
    ((currentWinner === "white" || currentWinner === "w")
      ? isWhitePlayer
      : (currentWinner === "black" || currentWinner === "b")
      ? !isWhitePlayer
      : false);

  const closingSec = closingCountdown !== null ? closingCountdown : 60;
  const mm = Math.floor(closingSec / 60).toString().padStart(2, "0");
  const ss = (closingSec % 60).toString().padStart(2, "0");

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none"
    >
      {/* Lớp nền tối (Backdrop): nằm dưới */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity cursor-default animate-in fade-in duration-300"
        aria-hidden="true"
      />

      {/* Khung nội dung Modal: BẮT BUỘC có relative, z-10, pointer-events-auto */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-3xl border border-amber-500/40 bg-[#161311] p-6 sm:p-8 text-center shadow-2xl text-stone-200 pointer-events-auto",
          "animate-in zoom-in-95 duration-300"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. KẾT QUẢ: THẮNG / THUA / HÒA */}
        {userWon ? (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Aura phát sáng vàng kim */}
            <div className="relative mb-3 flex items-center justify-center">
              <div className="absolute h-24 w-24 rounded-full bg-amber-500/30 blur-xl animate-pulse" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-400 bg-gradient-to-b from-amber-500/20 to-amber-950/80 shadow-[0_0_30px_rgba(251,191,36,0.6)]">
                <Trophy className="h-9 w-9 text-amber-300 animate-bounce" />
              </div>
              <Sparkles
                className="absolute -top-1 -right-1 h-5 w-5 text-amber-300 animate-spin"
                style={{ animationDuration: "6s" }}
              />
            </div>

            {/* Banner Vàng kim rực rỡ */}
            <div className="px-5 py-1.5 rounded-full border border-amber-400/80 bg-gradient-to-r from-amber-600/40 via-amber-500/50 to-amber-600/40 shadow-[0_0_20px_rgba(245,158,11,0.5)] mb-2">
              <h4 className="font-serif text-xl sm:text-2xl font-bold tracking-wider uppercase text-[#FFFBEB] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                CHIẾN THẮNG VẺ VANG!
              </h4>
            </div>

            <p className="mt-1 text-sm font-medium text-amber-200/90 max-w-sm leading-relaxed">
              {currentReason === "checkmate"
                ? "Tuyệt vời! Bạn đã xuất sắc chiếu bí đối thủ và giành chiến thắng ván cờ!"
                : currentReason === "resignation"
                ? "Đối thủ đã đầu hàng. Bạn giành chiến thắng thuyết phục!"
                : currentReason === "timeout"
                ? "Đối thủ đã hết thời gian thi đấu. Bạn giành chiến thắng!"
                : "Chúc mừng bạn đã giành chiến thắng trong ván đấu!"}
            </p>
          </div>
        ) : isDraw ? (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-600/60 bg-amber-950/60 shadow-lg">
                <Scale className="h-8 w-8 text-amber-400" />
              </div>
            </div>

            {/* Banner Hòa */}
            <div className="px-5 py-1.5 rounded-full border border-amber-500/40 bg-gradient-to-r from-stone-800 via-amber-950/60 to-stone-800 shadow-md mb-2">
              <h4 className="font-serif text-xl sm:text-2xl font-bold tracking-wider uppercase text-amber-200 drop-shadow">
                TRẬN ĐẤU HÒA!
              </h4>
            </div>

            <p className="mt-1 text-sm font-medium text-amber-200/80 max-w-sm leading-relaxed">
              {currentReason === "stalemate"
                ? "Hết nước đi hợp lệ (Stalemate). Ván cờ khép lại với kết quả Hòa!"
                : currentReason === "timeout"
                ? "Hết 10 phút thi đấu. Hai bên bất phân thắng bại!"
                : "Ván đấu kết thúc với kết quả Hòa (Bất phân thắng bại)!"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-stone-600 bg-stone-900/90 shadow-inner">
                <ShieldAlert className="h-8 w-8 text-stone-400" />
              </div>
            </div>

            {/* Banner Trầm Thất bại */}
            <div className="px-5 py-1.5 rounded-full border border-stone-600/80 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 shadow-inner mb-2">
              <h4 className="font-serif text-lg sm:text-xl font-bold tracking-wider uppercase text-stone-300">
                {currentReason === "checkmate"
                  ? "THẤT BẠI - BẠN ĐÃ BỊ CHIẾU BÍ!"
                  : currentReason === "timeout"
                  ? "THẤT BẠI - BẠN ĐÃ HẾT GIỜ!"
                  : "THẤT BẠI - BẠN ĐÃ ĐẦU HÀNG!"}
              </h4>
            </div>

            <p className="mt-1 text-sm font-medium text-stone-400 max-w-sm leading-relaxed">
              {currentReason === "checkmate"
                ? "Vua của bạn đã bị chiếu bí không còn nước thoái lui. Hãy chuẩn bị cho ván phục thù!"
                : "Hãy đúc rút kinh nghiệm và phục thù ở ván đấu tiếp theo!"}
            </p>
          </div>
        )}

        {/* 2. BỘ ĐẾM NGƯỢC 60 GIÂY ĐÓNG PHÒNG */}
        <div className="mt-4 flex items-center justify-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/60 px-4 py-1.5 text-xs font-semibold text-amber-200 shadow-md">
          <AlertCircle className="h-3.5 w-3.5 text-amber-400 animate-pulse shrink-0" />
          <span>
            Phòng sẽ tự động đóng sau {closingSec} giây:{" "}
            <strong className="font-mono text-white text-xs bg-black/40 px-2 py-0.5 rounded border border-amber-500/30">
              [{mm}:{ss}]
            </strong>
          </span>
        </div>

        {/* 3. CÁC NÚT HÀNH ĐỘNG: VÁN MỚI & RỜI PHÒNG NGAY */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          {/* Nút Ván mới (Cơ chế cả 2 cùng bấm sẵn sàng) */}
          {isMeReady ? (
            <button
              type="button"
              disabled
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/60 px-5 py-2.5 text-xs font-medium text-amber-300 cursor-not-allowed opacity-90 shadow-md"
            >
              <Clock className="h-3.5 w-3.5 animate-spin text-amber-400" />
              <span>Chờ đối thủ đồng ý...</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onPlayerReady}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-amber-400/80 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{isOpponentReady ? "Đồng ý Ván mới!" : "Ván mới"}</span>
            </button>
          )}

          {/* Nút Rời phòng ngay */}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-stone-600 bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white px-4 py-2.5 text-xs font-medium transition-all active:scale-95 cursor-pointer shadow"
          >
            <LogOut className="h-3.5 w-3.5 text-stone-400" />
            <span>Rời phòng ngay</span>
          </button>
        </div>

        {isOpponentReady && !isMeReady && (
          <span className="mt-3 text-[11px] font-medium text-emerald-400 animate-pulse flex items-center justify-center gap-1">
            <Check className="h-3 w-3" /> Đối thủ đã bấm Ván mới!
          </span>
        )}
      </div>
    </div>,
    document.body
  );
}
