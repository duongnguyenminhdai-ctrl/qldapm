"use client";

import { Sparkles, Shield, Flame, Award, Clock, Star } from "lucide-react";
import { TITLE_STYLE_MAP } from "@/lib/titlesConfig";
import { cn } from "@/lib/utils";

export default function UserTitleBadge({
  title = "Nhập môn học giả",
  onClick,
  size = "sm",
  className,
  showIcon = true,
}) {
  const meta = TITLE_STYLE_MAP[title] || {
    name: title,
    tag: "Danh hiệu",
    color: "text-stone-900 dark:text-stone-100 font-semibold",
  };

  const sizeClasses = {
    xs: "text-[10px] px-2 py-0.5 gap-1",
    sm: "text-xs px-2.5 py-0.5 gap-1.5",
    md: "text-xs px-3 py-1 gap-1.5",
  };

  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
  };

  const getIcon = () => {
    if (meta.tag === "Tu tiên") return Sparkles;
    if (meta.tag === "Quân hàm" || meta.tag === "Lục quân") return Shield;
    if (meta.tag === "Hải quân" || meta.tag === "Ngũ sao") return Star;
    if (meta.tag === "Gói Pro" || meta.tag?.includes("Pro")) return Award;
    return Sparkles;
  };

  const IconComponent = getIcon();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? "Nhấn để xem Bộ sưu tập Danh hiệu & Quân hàm" : meta.name}
      className={cn(
        "inline-flex items-center rounded-full border border-amber-900/15 bg-stone-100/90 text-stone-800 dark:bg-[#251D16] dark:border-amber-500/20 dark:text-stone-200 transition-all duration-200 select-none shadow-xs",
        sizeClasses[size] || sizeClasses.sm,
        meta.color,
        onClick
          ? "cursor-pointer hover:border-amber-600/50 hover:scale-[1.02] active:scale-[0.98]"
          : "cursor-default",
        className
      )}
    >
      {showIcon && (
        <IconComponent
          className={cn(iconSizes[size] || iconSizes.sm, "shrink-0 text-[#c3a47b] opacity-90")}
        />
      )}
      <span className="font-medium tracking-tight truncate max-w-[130px] sm:max-w-none">
        {meta.name}
      </span>
    </button>
  );
}
