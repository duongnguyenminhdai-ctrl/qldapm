"use client";

import React, { useRef, useEffect, useCallback, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SpecularButton Component — Chuẩn mẫu React Bits
 * (https://reactbits.dev/components/specular-button)
 *
 * Tính năng:
 * - Vệt sáng phản quang (Specular Highlight Edge) chạy theo góc chuột xung quanh viền nút
 * - Tính toán góc góc quay (--shine-angle) và khoảng cách proximity (200px)
 * - Tỏa sáng mặt kính (Inner Glass Glow) bám theo tọa độ chuột (--mouse-x, --mouse-y)
 * - Cấu trúc phân tầng Dark Academia sang trọng, viền hổ phách, hiệu ứng xúc giác active:scale-[0.98]
 */
export const SpecularButton = forwardRef(function SpecularButton(
  {
    children,
    onClick,
    type = "button",
    disabled = false,
    className = "",
    loading = false,
    radius = 16,
    intensity = 1,
    proximity = 200,
    style = {},
    ...props
  },
  forwardedRef
) {
  const localRef = useRef(null);

  // Đồng bộ cả localRef và forwardedRef
  const setRef = useCallback(
    (node) => {
      localRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  // Cập nhật vị trí ánh sáng và góc quay theo con trỏ chuột
  const updateLight = useCallback(
    (clientX, clientY) => {
      const el = localRef.current;
      if (!el || disabled || loading) return;

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Khoảng cách ngắn nhất từ vị trí chuột tới hộp chữ nhật của nút
      const clampedX = Math.max(rect.left, Math.min(clientX, rect.right));
      const clampedY = Math.max(rect.top, Math.min(clientY, rect.bottom));
      const edgeDist = Math.hypot(clientX - clampedX, clientY - clampedY);

      // Tính góc quay từ tâm nút tới vị trí chuột (0deg tại 12h theo chiều kim đồng hồ)
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const rad = Math.atan2(dy, dx);
      const deg = (rad * (180 / Math.PI) + 90 + 360) % 360;

      // Tính toán độ sáng theo khoảng cách proximity
      let currentOpacity = 0.7; // Mức sáng êm dịu khi nghỉ chân (resting glow)
      if (edgeDist === 0) {
        // Chuột nằm trong nút -> sáng rõ nét cực đại
        currentOpacity = Math.min(1, 1 * intensity);
      } else if (edgeDist <= proximity) {
        const ratio = 1 - edgeDist / proximity;
        currentOpacity = Math.max(0.35, (0.35 + 0.65 * ratio) * intensity);
      } else {
        currentOpacity = 0.45 * intensity; // Sáng viền nghỉ chân khi chuột ở xa
      }

      const mouseX = Math.round(clientX - rect.left);
      const mouseY = Math.round(clientY - rect.top);

      el.style.setProperty("--shine-angle", `${deg.toFixed(1)}deg`);
      el.style.setProperty("--shine-opacity", currentOpacity.toFixed(2));
      el.style.setProperty("--mouse-x", `${mouseX}px`);
      el.style.setProperty("--mouse-y", `${mouseY}px`);
    },
    [disabled, loading, intensity, proximity]
  );

  // Lắng nghe di chuyển chuột toàn cục để bắt góc khi con trỏ lại gần
  useEffect(() => {
    const handlePointerMove = (e) => {
      updateLight(e.clientX, e.clientY);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [updateLight]);

  const isDisabled = disabled || loading;

  return (
    <button
      ref={setRef}
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      onMouseMove={(e) => updateLight(e.clientX, e.clientY)}
      onMouseEnter={(e) => updateLight(e.clientX, e.clientY)}
      style={{
        borderRadius: `${radius}px`,
        "--shine-angle": "45deg",
        "--shine-opacity": "0.7",
        "--mouse-x": "50%",
        "--mouse-y": "50%",
        ...style,
      }}
      className={cn(
        "group relative inline-flex items-center justify-center overflow-hidden rounded-2xl px-6 py-3.5 font-medium transition-transform duration-150 active:scale-[0.98] w-full cursor-pointer select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100",
        className
      )}
      {...props}
    >
      {/* 1. Lớp viền cơ bản (Idle border) */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[inherit] border border-amber-500/25 pointer-events-none z-[1]"
      />

      {/* 2a. Lớp hào quang viền phát sáng mềm (Specular Glow Halo) */}
      <span
        aria-hidden="true"
        className="absolute -inset-[2px] pointer-events-none transition-opacity duration-300 blur-[4px] z-[1]"
        style={{
          borderRadius: `${radius}px`,
          padding: "3.5px",
          background: `conic-gradient(from calc(var(--shine-angle, 0deg) - 50deg) at 50% 50%, transparent 0deg, rgba(245, 208, 97, 0.25) 20deg, rgba(255, 235, 160, 0.85) 40deg, rgba(255, 255, 255, 0.95) 50deg, rgba(255, 235, 160, 0.85) 60deg, rgba(245, 208, 97, 0.25) 80deg, transparent 100deg)`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          opacity: "calc(var(--shine-opacity, 0.6) * 0.85)",
        }}
      />

      {/* 2b. Lớp vệt sáng phản quang sắc nét (Specular Highlight Edge) 2.5px chạy theo góc chuột */}
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none transition-opacity duration-200 z-[2]"
        style={{
          borderRadius: `${radius}px`,
          padding: "2.5px",
          background: `conic-gradient(from calc(var(--shine-angle, 0deg) - 50deg) at 50% 50%, transparent 0deg, rgba(245, 208, 97, 0.2) 20deg, rgba(255, 235, 160, 0.95) 40deg, rgba(255, 255, 255, 1) 50deg, rgba(255, 235, 160, 0.95) 60deg, rgba(245, 208, 97, 0.2) 80deg, transparent 100deg)`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          opacity: "var(--shine-opacity, 0.6)",
        }}
      />

      {/* 3. Lớp ánh sáng tỏa nhẹ mặt kính bên trong (Inner Glass Glow) */}
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[3]"
        style={{
          borderRadius: `${radius}px`,
          background: `radial-gradient(circle 140px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 235, 160, 0.15) 0%, rgba(245, 208, 97, 0.05) 50%, transparent 80%)`,
        }}
      />

      {/* 4. Vệt vát cạnh trên (Top Bevel Reflection) */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-200/40 to-transparent pointer-events-none z-[4]"
      />

      {/* 5. Nền nút (Dark Obsidian Gold) */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#241c16] via-[#1a1410] to-[#120d0a] shadow-xl shadow-black/60 group-hover:from-[#2e231c] group-hover:via-[#1e1713] group-hover:to-[#150f0c] transition-colors duration-300 z-0"
      />

      {/* 6. Nội dung chữ bên trong */}
      <span className="relative z-10 flex items-center justify-center gap-2 text-amber-200 group-hover:text-amber-100 font-serif font-semibold text-sm tracking-wider uppercase transition-colors duration-200">
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-amber-200 shrink-0" />
        )}
        <span>{children}</span>
      </span>
    </button>
  );
});

export default SpecularButton;
