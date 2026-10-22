"use client";

import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * ReflectiveCard Component — Chuẩn mẫu React Bits
 * (https://reactbits.dev/components/reflective-card)
 *
 * Tính năng:
 * - 3D Tilt xoay theo tọa độ con trỏ chuột (perspective 1000px)
 * - Lớp Holographic Glare đa sắc với mix-blend-mode: color-dodge bám theo tọa độ chuột
 * - Viền phản quang Specular Highlight chạy theo góc quay
 * - Huy hiệu phẩm cấp độ hiếm (Cơ bản, Hiếm, Sử thi, Huyền thoại, Thần thoại)
 */
export function ReflectiveCard({
  cardId = 1,
  name = "Thẻ Bài Học Giả",
  rarity = "Cơ bản",
  rarityColor = "amber",
  count = 0,
  isOwned = true,
  className = "",
  interactive = true,
  showBadge = true,
  showCountBadge = false,
  imageClassName = "",
  onClick,
}) {
  const cardRef = useRef(null);
  const [tiltStyle, setTiltStyle] = useState({
    transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
    glareX: 50,
    glareY: 50,
    glareOpacity: 0,
  });

  const handleMouseMove = useCallback(
    (e) => {
      if (!interactive) return;
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Xoay tối đa 14 độ
      const rotateX = ((y - centerY) / centerY) * -14;
      const rotateY = ((x - centerX) / centerX) * 14;
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;

      setTiltStyle({
        transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.03, 1.03, 1.03)`,
        glareX: Math.round(glareX),
        glareY: Math.round(glareY),
        glareOpacity: 0.85,
      });
    },
    [interactive]
  );

  const handleMouseLeave = useCallback(() => {
    if (!interactive) return;
    setTiltStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      glareX: 50,
      glareY: 50,
      glareOpacity: 0,
    });
  }, [interactive]);

  // Màu sắc theo phẩm cấp độ hiếm
  const rarityBorderClasses = {
    "Cơ bản": "border-amber-400/80 shadow-amber-950/60",
    "Phổ thông": "border-amber-400/80 shadow-amber-950/60",
    "Hiếm": "border-blue-400/80 shadow-blue-950/60",
    "Sử thi": "border-purple-400/80 shadow-purple-950/60",
    "Huyền thoại": "border-yellow-300 shadow-yellow-950/70",
    "Thần thoại": "border-amber-300 shadow-amber-900/80",
    "Tối thượng": "border-rose-300 shadow-rose-950/80",
  }[rarity] || "border-amber-400/80 shadow-amber-950/60";

  const rarityBadgeClasses = {
    "Cơ bản": "bg-amber-900/80 border-amber-400/60 text-amber-200",
    "Phổ thông": "bg-amber-900/80 border-amber-400/60 text-amber-200",
    "Hiếm": "bg-blue-900/80 border-blue-400/60 text-blue-200",
    "Sử thi": "bg-purple-900/80 border-purple-400/60 text-purple-200",
    "Huyền thoại": "bg-yellow-950/85 border-yellow-400/70 text-yellow-200",
    "Thần thoại": "bg-amber-950/90 border-amber-300/80 text-amber-100",
    "Tối thượng": "bg-rose-950/85 border-rose-400/70 text-rose-200",
  }[rarity] || "bg-black/70 border-amber-400/50 text-amber-200";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={cn(
        "relative rounded-2xl select-none transition-transform duration-150 ease-out",
        interactive && "cursor-pointer",
        className
      )}
      style={{
        transform: interactive ? tiltStyle.transform : "none",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Khung thẻ và hình ảnh */}
      <div
        className={cn(
          "relative w-full h-full rounded-2xl overflow-hidden border-2 shadow-2xl bg-[#16120f] flex items-center justify-center",
          rarityBorderClasses
        )}
      >
        <img
          src={`/image/card/${cardId}.png`}
          alt={name}
          className={cn(
            "w-full h-full object-cover pointer-events-none transition-all duration-300",
            !isOwned && "grayscale opacity-50",
            imageClassName
          )}
          loading="lazy"
        />

        {/* Lớp phản chiếu ánh sáng mặt gương (Reflective Holographic Glare) */}
        {interactive && isOwned && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-200 z-10"
            style={{
              opacity: tiltStyle.glareOpacity,
              background: `radial-gradient(circle 240px at ${tiltStyle.glareX}% ${tiltStyle.glareY}%, rgba(255, 255, 255, 0.75) 0%, rgba(255, 230, 150, 0.4) 40%, rgba(180, 140, 255, 0.25) 70%, transparent 100%)`,
              mixBlendMode: "color-dodge",
            }}
          />
        )}

        {/* Đường vát sáng viền sắc sảo */}
        {interactive && isOwned && (
          <div
            className="absolute inset-0 border border-white/20 rounded-2xl pointer-events-none z-10"
            style={{
              background: `linear-gradient(${tiltStyle.glareX * 3.6}deg, rgba(255,255,255,0.25), transparent 60%)`,
            }}
          />
        )}

        {/* Overlay mờ khi chưa sở hữu */}
        {!isOwned && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-10">
            <span className="text-xs font-mono font-medium text-stone-200 bg-black/75 px-3 py-1.5 rounded-lg border border-stone-600 shadow-md">
              Chưa mở khóa
            </span>
          </div>
        )}
      </div>

      {/* Huy hiệu độ hiếm góc trên bên phải */}
      {showBadge && (
        <div
          className={cn(
            "absolute top-3 right-3 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-widest backdrop-blur-md border shadow-lg z-20 pointer-events-none",
            rarityBadgeClasses
          )}
        >
          {rarity}
        </div>
      )}

      {/* Huy hiệu số lượng sở hữu */}
      {showCountBadge && (
        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <span
            className={cn(
              "inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shadow-lg",
              isOwned
                ? "bg-amber-500 text-[#141210] ring-2 ring-amber-300"
                : "bg-stone-800 text-stone-400 border border-stone-600"
            )}
          >
            x{count}
          </span>
        </div>
      )}
    </div>
  );
}

export default ReflectiveCard;
