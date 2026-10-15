"use client";

import { useState } from "react";
import { Check, Sparkles, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const FOCUS_STATUS_PRESETS = [
  { id: "code", icon: "💻", label: "Đang code" },
  { id: "read", icon: "📖", label: "Đang đọc tài liệu" },
  { id: "lecture", icon: "🎧", label: "Đang nghe giảng" },
  { id: "afk", icon: "☕", label: "Tạm vắng (AFK)" },
];

/**
 * Capsule badge nhỏ xinh hiển thị trạng thái tập trung
 */
export function FocusStatusBadge({ status, className }) {
  if (!status || !status.label) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-950/85 px-2 py-0.5 text-[11px] font-medium text-zinc-200 shadow-md backdrop-blur-md transition-all select-none animate-in fade-in zoom-in-95 duration-200",
        className
      )}
    >
      <span className="text-xs leading-none">{status.icon || "🎯"}</span>
      <span className="truncate max-w-[120px]">{status.label}</span>
    </div>
  );
}

/**
 * Popover chọn trạng thái tập trung cá nhân
 */
export function FocusStatusSelector({
  currentStatus,
  onSelectStatus,
  className,
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (preset) => {
    onSelectStatus(preset);
    setOpen(false);
  };

  const handleClear = () => {
    onSelectStatus(null);
    setOpen(false);
  };

  const isPresetActive = (preset) =>
    currentStatus && currentStatus.label === preset.label;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          id="btn-focus-status-trigger"
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 select-none",
            currentStatus
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60 shadow-sm"
              : "border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
            className
          )}
          title="Đặt trạng thái tập trung"
        >
          <span className="text-xs">
            {currentStatus ? currentStatus.icon : "🎯"}
          </span>
          <span className="max-w-[110px] truncate text-[11px]">
            {currentStatus ? currentStatus.label : "Trạng thái"}
          </span>
          <ChevronDown
            className={cn(
              "h-3 w-3 text-zinc-500 transition-transform duration-200 group-hover:text-zinc-300",
              open && "rotate-180"
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-52 p-1.5 bg-zinc-900/95 border-zinc-800 backdrop-blur-md shadow-xl"
      >
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Trạng thái tập trung
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800/80" />

        <div className="space-y-0.5 py-1">
          {FOCUS_STATUS_PRESETS.map((preset) => {
            const active = isPresetActive(preset);
            return (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => handleSelect(preset)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer transition",
                  active
                    ? "bg-zinc-800 text-amber-300 font-medium"
                    : "text-zinc-200 hover:bg-zinc-800/60"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{preset.icon}</span>
                  <span className="truncate">{preset.label}</span>
                </div>
                {active && (
                  <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" strokeWidth={2.2} />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>

        {currentStatus && (
          <>
            <DropdownMenuSeparator className="bg-zinc-800/80" />
            <DropdownMenuItem
              onClick={handleClear}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 cursor-pointer hover:bg-rose-950/30 hover:text-rose-300 transition"
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              <span>Xóa trạng thái</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
