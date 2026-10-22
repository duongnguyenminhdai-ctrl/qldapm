"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Lock,
  Trash2,
  Info,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Custom Confirmation Modal phong cách Dark Academia
 * Render trực tiếp qua React Portal vào document.body với z-[99999] để không bao giờ bị đè pointer-events.
 */
export default function ConfirmModal({
  isOpen,
  title = "Xác nhận hành động",
  message = "",
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  variant = "warning", // 'warning' | 'danger' | 'info' | 'success'
  icon = null,
  isAlert = false,
  onConfirm,
  onCancel,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Bắt phím Escape để đóng modal, Enter để xác nhận
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onCancel?.();
      } else if (e.key === "Enter" && !e.shiftKey) {
        onConfirm?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!mounted || !isOpen) return null;

  // Lựa chọn Icon phù hợp theo variant hoặc icon truyền vào
  const renderIcon = () => {
    if (React.isValidElement(icon)) return icon;

    const lowerTitle = (title || "").toLowerCase();
    const isLock = icon === "lock" || lowerTitle.includes("khóa");
    const isTrash = icon === "trash" || lowerTitle.includes("xóa") || lowerTitle.includes("xoá");

    if (isLock) {
      return <Lock className="h-6 w-6 text-amber-400" />;
    }
    if (isTrash || variant === "danger") {
      return isTrash ? (
        <Trash2 className="h-6 w-6 text-rose-400" />
      ) : (
        <AlertTriangle className="h-6 w-6 text-rose-400" />
      );
    }
    if (variant === "info") {
      return <Info className="h-6 w-6 text-sky-400" />;
    }
    if (variant === "success") {
      return <CheckCircle2 className="h-6 w-6 text-emerald-400" />;
    }
    return <AlertTriangle className="h-6 w-6 text-amber-400" />;
  };

  const getIconWrapperClass = () => {
    if (variant === "danger") {
      return "bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 shadow-rose-500/10";
    }
    if (variant === "info") {
      return "bg-sky-100 dark:bg-sky-950/50 border-sky-300 dark:border-sky-800/60 text-sky-600 dark:text-sky-400 shadow-sky-500/10";
    }
    if (variant === "success") {
      return "bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/10";
    }
    return "bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 shadow-amber-500/10";
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none"
    >
      {/* Lớp nền tối (Backdrop): nằm dưới, click vào để đóng */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity cursor-pointer animate-in fade-in duration-200"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Khung nội dung Modal: BẮT BUỘC có relative, z-10, pointer-events-auto */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl transition-all pointer-events-auto",
          "bg-[#fbf9f5] dark:bg-[#1C1612] border border-amber-600/30 dark:border-amber-500/30 text-[#2D241E] dark:text-stone-200",
          "animate-in zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút X đóng góc trên */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Đóng"
          className="absolute top-4 right-4 rounded-lg p-1 text-[#8C7E72] dark:text-stone-400 hover:text-[#2D241E] dark:hover:text-stone-100 hover:bg-black/5 dark:hover:bg-stone-800/60 transition cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Cụm Icon & Tiêu đề */}
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-inner mt-0.5",
              getIconWrapperClass()
            )}
          >
            {renderIcon()}
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400 font-serif leading-snug">
              {title}
            </h3>
            {message && (
              <p className="text-sm text-[#5A4D41] dark:text-stone-300/80 my-3 leading-relaxed whitespace-pre-line">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* Cụm nút bấm căn phải */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-2 border-t border-amber-200/60 dark:border-stone-800/80">
          {!isAlert && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-amber-300/80 dark:border-stone-600/50 bg-[#ece5da] dark:bg-stone-800 text-[#3E3228] dark:text-stone-300 hover:bg-[#e2d6c6] dark:hover:bg-stone-700 text-sm font-medium transition-colors cursor-pointer active:scale-95"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={cn(
              "font-medium text-sm px-5 py-2 rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5",
              variant === "danger"
                ? "bg-rose-700 hover:bg-rose-600 text-white shadow-rose-950/40"
                : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
