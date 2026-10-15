"use client";

import { Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact Pomodoro display for side panel.
 * Hierarchy: time > label > meta > controls.
 */
export function PomodoroWidget({
  minutes = 25,
  seconds = 0,
  progress = 0,
  label = "Tập trung",
  running = false,
  onToggle,
  onReset,
  className,
}) {
  const size = 68;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 100);
  const offset = circumference - (clamped / 100) * circumference;
  const timeLabel = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/50 px-4 py-3.5",
        className
      )}
    >
      <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center">
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-zinc-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-emerald-400 transition-[stroke-dashoffset] duration-taste ease-taste"
          />
        </svg>
        <span className="absolute font-mono text-sm font-semibold tabular-nums tracking-tight text-zinc-100">
          {timeLabel}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-100">{label}</p>
          <span className="font-mono text-xs text-zinc-500 tabular-nums">
            {Math.round(clamped)}%
          </span>
        </div>
        <p className="type-meta mt-0.5">
          {running ? "Đang đếm ngược" : "Đang tạm dừng"}
        </p>

        <div className="mt-2.5 flex items-center gap-3">
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition active:scale-95",
                running
                  ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
              )}
            >
              {running ? (
                <>
                  <Pause className="h-3 w-3" />
                  Tạm dừng
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Bắt đầu
                </>
              )}
            </button>
          )}

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Đặt lại thời gian"
              className="inline-flex items-center gap-1 text-xs text-zinc-400 transition hover:text-zinc-200 active:scale-95"
            >
              <RotateCcw className="h-3 w-3" />
              Đặt lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

