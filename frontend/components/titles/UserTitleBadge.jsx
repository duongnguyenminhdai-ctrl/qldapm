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
    color: "text-zinc-300 border-zinc-700/80 bg-zinc-800/40",
  };

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-1.5",
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
        "inline-flex items-center rounded-full border transition-all duration-200 select-none",
        sizeClasses[size] || sizeClasses.sm,
        meta.color,
        onClick
          ? "cursor-pointer hover:brightness-125 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
          : "cursor-default",
        className
      )}
    >
      {showIcon && (
        <IconComponent
          className={cn(iconSizes[size] || iconSizes.sm, "shrink-0 opacity-80")}
        />
      )}
      <span className="font-medium tracking-tight truncate max-w-[130px] sm:max-w-none">
        {meta.name}
      </span>
    </button>
  );
}
