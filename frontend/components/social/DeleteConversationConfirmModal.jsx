"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DeleteConversationConfirmModal: Modal xác nhận xóa đoạn chat (Messenger style)
 * Render qua React Portal vào document.body với z-[99999] để đảm bảo không bị đè pointer-events.
 */
export function DeleteConversationConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  conversationName = "cuộc trò chuyện này",
  isLoading = false,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Bắt phím Escape để đóng modal khi không đang xử lý
  useEffect(() => {
    if (!isOpen || isLoading) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity cursor-pointer animate-in fade-in duration-200"
        onClick={() => {
          if (!isLoading) onClose?.();
        }}
        aria-hidden="true"
      />

      {/* Modal Box */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#161311] p-6 shadow-2xl text-[#f5ede3] pointer-events-auto",
          "animate-in zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút X đóng góc trên */}
        <button
          type="button"
          disabled={isLoading}
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-4 right-4 rounded-lg p-1 text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 transition cursor-pointer disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Nội dung xác nhận */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-950/60 border border-rose-700/60 text-rose-400 shadow-inner">
            <Trash2 className="h-6 w-6" />
          </div>

          <h3 className="font-serif text-lg font-bold text-amber-100">
            Xóa cuộc trò chuyện?
          </h3>

          <p className="text-xs text-stone-400 max-w-sm text-center leading-relaxed">
            Bạn có chắc chắn muốn xóa toàn bộ đoạn chat với{" "}
            <span className="font-semibold text-amber-200">[{conversationName}]</span> không? Toàn
            bộ tin nhắn và tệp tin trong cuộc trò chuyện sẽ bị xóa vĩnh viễn và không thể khôi phục.
          </p>
        </div>

        {/* Cụm nút bấm căn phải */}
        <div className="mt-6 flex sm:flex-row flex-col-reverse gap-2 sm:justify-end border-t border-stone-800/80 pt-4">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-300 hover:text-white rounded-xl border border-stone-700/60 bg-stone-900/80 hover:bg-stone-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold text-rose-100 rounded-xl border border-rose-700/60 bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 hover:from-rose-800 hover:to-rose-700 shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isLoading ? "Đang xóa..." : "Xóa đoạn chat"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default DeleteConversationConfirmModal;
