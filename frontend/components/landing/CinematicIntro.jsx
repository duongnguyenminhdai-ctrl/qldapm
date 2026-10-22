"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowDown } from "lucide-react";

export function CinematicIntro({
  videoUrl = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260922_195107_ed3f055a-3a13-4a71-b743-e10310454246.mp4",
  tagline = "Virtual Study Room",
  title = "Không Gian Học Tập Tập Trung Sâu",
  description = "A cinematic gateway into our platform. Cuộn chuột hoặc bấm nút để bắt đầu trải nghiệm.",
  buttonText = "Vào Hệ Thống",
  onComplete,
}) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRef = useRef(null);

  // Kích hoạt chuyển cảnh sang Login hoặc Dashboard
  const handleProceed = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    // Thời gian chờ khớp với thời lượng animation CSS (1000ms)
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 1000);
  }, [isTransitioning, onComplete]);

  // Bắt sự kiện cuộn chuột (Wheel) hoặc vuốt trên điện thoại (Touch)
  useEffect(() => {
    let touchStartY = 0;

    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > 15) {
        handleProceed();
      }
    };

    const onTouchStart = (e) => {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        const deltaY = e.touches[0].clientY - touchStartY;
        if (Math.abs(deltaY) > 20) {
          handleProceed();
        }
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [handleProceed]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-12 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] select-none ${
        isTransitioning
          ? "opacity-0 scale-105 pointer-events-none filter blur-sm"
          : "opacity-100 scale-100 pointer-events-auto"
      }`}
    >
      {/* 1. Video nền Cinematic */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
        {/* Lớp phủ gradient và vignette quang học */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.75)_100%)]" />
      </div>

      {/* 2. Thanh Brand trên cùng */}
      <div className="w-full flex justify-between items-center z-10">
        <div className="font-serif text-2xl tracking-tight text-white drop-shadow-md">
          Virtual<span className="font-light text-amber-400 opacity-90">Study</span>
        </div>
        <button
          onClick={handleProceed}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/20 bg-black/40 hover:bg-white/20 backdrop-blur-md text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-all cursor-pointer shadow-lg hover:scale-105"
        >
          <span>Bỏ qua</span>
          <span className="text-sm">→</span>
        </button>
      </div>

      {/* 3. Tiêu đề trung tâm & Nút hành động */}
      <div className="my-auto text-center max-w-3xl px-4 z-10 flex flex-col items-center">
        <span className="text-xs tracking-[0.32em] uppercase text-neutral-300 mb-3 block font-mono">
          {tagline}
        </span>
        <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal text-white tracking-tight leading-[1.06] mb-4 drop-shadow-[0_4px_35px_rgba(0,0,0,0.9)]">
          {title}
        </h1>
        <p className="text-sm sm:text-base text-neutral-300/90 font-light max-w-lg mb-8 leading-relaxed drop-shadow-md">
          {description}
        </p>

        {/* Nút bấm chuyển vào Login */}
        <button
          onClick={handleProceed}
          className="group relative flex items-center gap-3 px-8 sm:px-10 py-3.5 sm:py-4 rounded-full bg-white text-black hover:bg-neutral-100 transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_45px_rgba(255,255,255,0.4)] cursor-pointer"
        >
          <span className="font-serif text-base sm:text-lg font-medium tracking-wide">
            {buttonText}
          </span>
          <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-y-1 transition-transform" />
        </button>
      </div>

      {/* 4. Gợi ý cuộn chuột ở đáy màn hình */}
      <div className="w-full flex flex-col items-center gap-2.5 z-10 text-[10px] sm:text-[11px] tracking-[0.24em] uppercase text-neutral-300/90 drop-shadow">
        <div className="w-5 h-8 rounded-full border border-white/40 flex items-start justify-center p-1.5 backdrop-blur-sm">
          <div className="w-1 h-2 bg-white rounded-full animate-bounce" />
        </div>
        <span>Cuộn chuột hoặc bấm nút để tiếp tục</span>
      </div>
    </div>
  );
}

export default CinematicIntro;
