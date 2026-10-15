"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reusable PaginationControl component theo chuẩn Taste-Skill
 * Hỗ trợ các nút chuyển trang thông minh, tóm tắt kết quả, và thiết kế hairline tối giản.
 */
export function PaginationControl({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  limit = 8,
  onPageChange,
  compact = false,
  className = "",
}) {
  if (totalPages <= 1 && totalItems <= limit) {
    return null;
  }

  // Thuật toán sinh danh sách trang có dấu ba chấm thông minh
  const generatePages = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "ellipsis", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages);
      }
    }
    return pages;
  };

  const pages = generatePages();
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalItems);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs select-none",
        className
      )}
    >
      {/* Tóm tắt số lượng mục */}
      {!compact && totalItems > 0 && (
        <p className="text-zinc-500 font-mono text-[11px] order-2 sm:order-1">
          Hiển thị <span className="text-zinc-300 font-medium">{startItem}</span> -{" "}
          <span className="text-zinc-300 font-medium">{endItem}</span> trong{" "}
          <span className="text-zinc-300 font-medium">{totalItems}</span> mục
        </p>
      )}

      {/* Cụm nút điều hướng trang */}
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Trang trước"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-35 disabled:hover:bg-zinc-900/60 disabled:hover:text-zinc-400 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, idx) => {
          if (p === "ellipsis") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="inline-flex h-8 w-6 items-center justify-center text-zinc-600"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </span>
            );
          }

          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex h-8 min-w-[2rem] px-2 items-center justify-center rounded-lg text-xs font-mono transition",
                isActive
                  ? "bg-zinc-100 text-zinc-950 font-semibold shadow-xs"
                  : "border border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
              )}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Trang tiếp theo"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-35 disabled:hover:bg-zinc-900/60 disabled:hover:text-zinc-400 transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default PaginationControl;
