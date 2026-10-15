"use client";

import { Crown } from "lucide-react";

/**
 * VipBadge - Hiển thị huy hiệu VIP nhỏ gọn
 * @param {string} size - "sm" | "md" | "lg"
 * @param {boolean} showLabel - Có hiển thị chữ "VIP" không
 */
export default function VipBadge({ size = "sm", showLabel = true, className = "" }) {
  const sizes = {
    sm: { icon: "w-3 h-3", text: "text-[10px]", padding: "px-1.5 py-0.5", gap: "gap-1" },
    md: { icon: "w-4 h-4", text: "text-xs", padding: "px-2 py-1", gap: "gap-1" },
    lg: { icon: "w-5 h-5", text: "text-sm", padding: "px-3 py-1.5", gap: "gap-1.5" },
  };

  const s = sizes[size] || sizes.sm;

  return (
    <span
      className={`
        inline-flex items-center ${s.gap} ${s.padding}
        rounded-full
        bg-gradient-to-r from-amber-500/20 to-amber-400/10
        border border-amber-400/30
        text-amber-400 font-semibold
        ${s.text}
        ${className}
      `}
      title="Thành viên VIP"
    >
      <Crown className={`${s.icon} flex-shrink-0`} />
      {showLabel && <span>VIP</span>}
    </span>
  );
}
