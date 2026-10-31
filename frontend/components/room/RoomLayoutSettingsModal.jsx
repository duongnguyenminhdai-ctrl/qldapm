"use client";

import { useEffect, useState, useId } from "react";
import { X, LayoutGrid, Grid2X2, Grid3X3, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const TILE_STEPS = [6, 9, 16, 30, 42, 49];

export const LAYOUT_MODES = [
  {
    id: "auto",
    title: "Tự động (linh động)",
    hasSparkle: true,
    description: "Tối ưu hóa bố cục linh hoạt theo số người và nội dung chia sẻ",
  },
  {
    id: "grid",
    title: "Ô (cũ)",
    hasSparkle: false,
    description: "Hiển thị tất cả thành viên theo dạng lưới ô đều nhau",
  },
  {
    id: "spotlight",
    title: "Tiêu điểm",
    hasSparkle: false,
    description: "Chỉ hiển thị 1 ô lớn toàn màn hình cho người nói hoặc màn hình chia sẻ",
  },
  {
    id: "sidebar",
    title: "Thanh bên",
    hasSparkle: false,
    description: "Người nói hoặc màn hình chia sẻ ở khung chính, thành viên khác ở cột bên phải",
  },
];

/**
 * Modal Điều chỉnh chế độ xem (Google Meet Change Layout)
 * Lưu trạng thái vào localStorage:
 * - vsr_meet_layout_mode: "auto" | "grid" | "spotlight" | "sidebar"
 * - vsr_meet_max_tiles: 6 | 9 | 16 | 30 | 42 | 49
 * - vsr_meet_hide_non_video: boolean
 */
export function RoomLayoutSettingsModal({
  isOpen,
  onClose,
  layoutMode = "auto",
  onLayoutModeChange,
  maxTiles = 16,
  onMaxTilesChange,
  hideNonVideo = false,
  onHideNonVideoChange,
}) {
  const currentStepIndex = Math.max(
    0,
    TILE_STEPS.indexOf(maxTiles) !== -1 ? TILE_STEPS.indexOf(maxTiles) : 2 // default index 2 (16)
  );

  const handleStepChange = (e) => {
    const idx = parseInt(e.target.value, 10);
    const val = TILE_STEPS[idx] || 16;
    if (onMaxTilesChange) {
      onMaxTilesChange(val);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[460px] rounded-2xl bg-white dark:bg-[#202124] text-stone-900 dark:text-[#e3e3e3] shadow-2xl border border-stone-200 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="layout-modal-title"
      >
        {/* Top Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div>
            <h2 id="layout-modal-title" className="text-lg font-medium text-stone-900 dark:text-stone-100">
              Điều chỉnh chế độ xem
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Đã lưu lựa chọn cho các cuộc họp về sau
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-full text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/10 transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Layout Modes Selection */}
        <div className="px-3 py-1 space-y-1">
          {LAYOUT_MODES.map((mode) => {
            const isSelected = layoutMode === mode.id;

            return (
              <label
                key={mode.id}
                onClick={() => onLayoutModeChange?.(mode.id)}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors select-none",
                  isSelected
                    ? "bg-blue-50/70 dark:bg-[#1a73e8]/15"
                    : "hover:bg-stone-100/80 dark:hover:bg-white/5"
                )}
              >
                {/* Radio + Title */}
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isSelected
                        ? "border-[#1a73e8] dark:border-[#8ab4f8]"
                        : "border-stone-400 dark:border-stone-500"
                    )}
                  >
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1a73e8] dark:bg-[#8ab4f8]" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                      {mode.title}
                    </span>
                    {mode.hasSparkle && (
                      <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 fill-current" />
                    )}
                  </div>
                </div>

                {/* Visual Layout Thumbnail Diagram */}
                <div className="shrink-0 pl-3">
                  {mode.id === "auto" && (
                    <div className="w-14 h-9 rounded-md border border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800 p-1 flex gap-0.5 items-stretch shadow-inner">
                      <div className="flex-1 rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                      <div className="flex-1 rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                      <div className="flex-1 rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                      <div className="flex-1 rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                    </div>
                  )}

                  {mode.id === "grid" && (
                    <div className="w-14 h-9 rounded-md border border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800 p-1 grid grid-cols-4 grid-rows-2 gap-0.5 shadow-inner">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                      ))}
                    </div>
                  )}

                  {mode.id === "spotlight" && (
                    <div className="w-14 h-9 rounded-md border border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800 p-1 flex items-stretch shadow-inner">
                      <div className="w-full h-full rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                    </div>
                  )}

                  {mode.id === "sidebar" && (
                    <div className="w-14 h-9 rounded-md border border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800 p-1 flex gap-1 items-stretch shadow-inner">
                      <div className="flex-[3] rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                      <div className="flex-[1] flex flex-col gap-0.5">
                        <div className="flex-1 rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                        <div className="flex-1 rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                        <div className="flex-1 rounded-sm bg-stone-300 dark:bg-stone-500/60" />
                      </div>
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200 dark:bg-white/10 mx-6 my-2" />

        {/* Section: Số ô (Max Tiles Slider) */}
        <div className="px-6 py-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-stone-800 dark:text-stone-200">
                Số ô
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Số ô tối đa được hiển thị, tùy vào kích thước cửa sổ.
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-blue-600 dark:text-[#8ab4f8] border border-stone-200 dark:border-white/10">
              {maxTiles} ô
            </span>
          </div>

          {/* Slider with Icons and Tick Marks */}
          <div className="mt-3 flex items-center gap-3">
            <Grid2X2 className="w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0" />
            
            <div className="relative flex-1 flex items-center py-2">
              <input
                type="range"
                min="0"
                max={TILE_STEPS.length - 1}
                step="1"
                value={currentStepIndex}
                onChange={handleStepChange}
                className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-[#1a73e8] dark:accent-[#8ab4f8]"
                aria-label="Số ô tối đa"
              />
              {/* Visual Step Dots */}
              <div className="absolute inset-x-0 flex justify-between pointer-events-none px-1">
                {TILE_STEPS.map((step, idx) => (
                  <span
                    key={step}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      idx <= currentStepIndex
                        ? "bg-[#1a73e8] dark:bg-[#8ab4f8]"
                        : "bg-stone-400 dark:bg-stone-600"
                    )}
                  />
                ))}
              </div>
            </div>

            <Grid3X3 className="w-5 h-5 text-stone-500 dark:text-stone-400 shrink-0" />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200 dark:bg-white/10 mx-6 my-2" />

        {/* Section: Ẩn ô không có video (Hide Non-Video Toggle) */}
        <div className="px-6 pt-2 pb-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-stone-800 dark:text-stone-200">
              Ẩn ô không có video
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Chỉ hiển thị người đang mở camera hoặc đang phát biểu
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={hideNonVideo}
            onClick={() => onHideNonVideoChange?.(!hideNonVideo)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner",
              hideNonVideo
                ? "bg-[#1a73e8] dark:bg-[#8ab4f8]"
                : "bg-stone-300 dark:bg-stone-700"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                hideNonVideo ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
