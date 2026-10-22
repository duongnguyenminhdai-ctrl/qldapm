"use client";

import React from "react";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * VipBadge - Hiển thị huy hiệu VIP hoàng kim với tương tác mở VipStatusModal
 * @param {string} size - "xs" | "sm" | "md" | "lg"
 * @param {boolean} showLabel - Có hiển thị chữ "VIP" không
 * @param {function} onClick - Hàm xử lý khi click vào badge
 * @param {boolean} interactive - Cho phép tương tác hover & click (mặc định true)
 */
export default function VipBadge({
  size = "sm",
  showLabel = true,
  className = "",
  onClick,
  title,
  interactive = true,
}) {
  const sizes = {
    xs: { icon: "w-2.5 h-2.5", text: "text-[9px]", padding: "px-1.5 py-0.5", gap: "gap-1" },
    sm: { icon: "w-3 h-3", text: "text-[10px]", padding: "px-2 py-0.5", gap: "gap-1" },
    md: { icon: "w-4 h-4", text: "text-xs", padding: "px-2.5 py-1", gap: "gap-1.5" },
    lg: { icon: "w-5 h-5", text: "text-sm", padding: "px-3.5 py-1.5", gap: "gap-2" },
  };

  const s = sizes[size] || sizes.sm;

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (interactive && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vsr:open-vip-modal"));
    }
  };

  const badgeTitle = title || (interactive ? "Nhấn để xem thời hạn VIP" : "Thành viên VIP");

  return (
    <span
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick(e);
        }
      }}
      className={cn(
        "inline-flex items-center rounded-full font-serif font-bold uppercase tracking-wider select-none",
        s.gap,
        s.padding,
        s.text,
        "bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-yellow-500/20",
        "border border-amber-400/60 dark:border-amber-400/50",
        "text-amber-900 dark:text-amber-200",
        interactive &&
          "cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md hover:shadow-amber-500/25 hover:border-amber-500 hover:text-amber-950 dark:hover:text-amber-100",
        className
      )}
      title={badgeTitle}
    >
      <Crown
        className={cn(
          s.icon,
          "text-amber-600 dark:text-amber-300 flex-shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
        )}
      />
      {showLabel && <span>VIP</span>}
    </span>
  );
}
