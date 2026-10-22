"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * BaseModal: Modal chuẩn hóa render qua React Portal vào document.body
 * Giải quyết dứt điểm các lỗi bị đè pointer-events / z-index từ các container cha có transform, overflow-hidden hoặc isolation.
 */
export default function BaseModal({
  isOpen,
  onClose,
  children,
  className,
  maxWidth = "max-w-md",
  showBackdrop = true,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none">
      {/* Lớp nền tối (Backdrop): nằm dưới, click vào để đóng */}
      {showBackdrop && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity cursor-pointer animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Khung nội dung Modal: BẮT BUỘC có relative, z-10, pointer-events-auto */}
      <div
        className={cn(
          "relative z-10 w-full rounded-2xl border border-amber-500/30 bg-[#1C1612] p-6 shadow-2xl text-stone-200 pointer-events-auto animate-in zoom-in-95 duration-200",
          maxWidth,
          className
        )}
        onClick={(e) => e.stopPropagation()} // Ngăn nổi bọt click ra backdrop
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
