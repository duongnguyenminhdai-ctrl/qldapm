"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Gift, Sparkles, Layers, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api";
import { SCHOLAR_CARDS } from "@/constants/cardsData";

export function AdminGiftCardModal({ isOpen, onClose, user, onSuccess }) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState("draws"); // 'draws' | 'single' | 'fullSet'
  const [draws, setDraws] = useState(3);
  const [selectedCardId, setSelectedCardId] = useState(1);
  const [count, setCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMode("draws");
      setDraws(3);
      setSelectedCardId(1);
      setCount(1);
      setError("");
    }
  }, [isOpen]);

  if (!isOpen || !user || !mounted) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        userId: user._id || user.id,
      };

      if (mode === "draws") {
        if (!draws || draws < 1) {
          setError("Vui lòng nhập số lượt mở hợp lệ (tối thiểu 1).");
          setIsSubmitting(false);
          return;
        }
        payload.draws = parseInt(draws, 10);
      } else if (mode === "single") {
        if (!selectedCardId || selectedCardId < 1 || selectedCardId > 7) {
          setError("Vui lòng chọn 1 lá bài hợp lệ (1-7).");
          setIsSubmitting(false);
          return;
        }
        payload.cardId = parseInt(selectedCardId, 10);
        payload.count = parseInt(count, 10) || 1;
      } else if (mode === "fullSet") {
        payload.fullSet = true;
        payload.count = parseInt(count, 10) || 1;
      }

      const res = await adminApi.giftCards(payload);
      if (res?.success) {
        if (onSuccess) {
          onSuccess(res.message || "Tặng thẻ bài học giả thành công!");
        }
        onClose();
      } else {
        setError(res?.message || "Tặng thẻ thất bại.");
      }
    } catch (err) {
      setError(err?.message || "Đã xảy ra lỗi khi trao tặng thẻ bài.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-amber-600/30 dark:border-amber-500/30 bg-[#fbf9f5] dark:bg-[#1c1815] p-5 sm:p-6 shadow-2xl text-[#2D241E] dark:text-[#f5ede3] animate-in zoom-in-95 duration-150">
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 rounded-lg p-1 text-[#8C7E72] dark:text-[#a89b8d] hover:bg-black/5 dark:hover:bg-[#26201c] hover:text-[#2D241E] dark:hover:text-[#f5ede3] transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Tiêu đề Modal */}
        <div className="flex items-center gap-3 border-b border-amber-200/70 dark:border-[#3a3128] pb-4 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 dark:bg-amber-500/10 border border-amber-600/30 dark:border-amber-500/30 text-amber-700 dark:text-amber-400">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-serif font-bold text-[#2D241E] dark:text-[#f5ede3]">
              Tặng Thẻ Bài Học Giả
            </h3>
            <p className="text-xs text-[#6e6358] dark:text-[#a89b8d] truncate max-w-[260px]">
              Tài khoản: <span className="font-semibold text-amber-700 dark:text-amber-300">{user.name}</span> ({user.email})
            </p>
          </div>
        </div>

        {/* Thông báo lỗi nếu có */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lựa chọn hình thức tặng */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4]">
              Hình thức trao tặng
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#eee6d8] dark:bg-[#141210] border border-amber-200/80 dark:border-[#3a3128]">
              <button
                type="button"
                onClick={() => setMode("draws")}
                className={`py-1.5 text-xs font-medium rounded-lg transition ${
                  mode === "draws"
                    ? "bg-[#b3894e] dark:bg-[#c3a47b] text-white dark:text-[#161311] font-semibold shadow-xs"
                    : "text-[#6e6358] dark:text-[#a89b8d] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
                }`}
              >
                Lượt mở
              </button>
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`py-1.5 text-xs font-medium rounded-lg transition ${
                  mode === "single"
                    ? "bg-[#b3894e] dark:bg-[#c3a47b] text-white dark:text-[#161311] font-semibold shadow-xs"
                    : "text-[#6e6358] dark:text-[#a89b8d] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
                }`}
              >
                1 Lá bài
              </button>
              <button
                type="button"
                onClick={() => setMode("fullSet")}
                className={`py-1.5 text-xs font-medium rounded-lg transition ${
                  mode === "fullSet"
                    ? "bg-[#b3894e] dark:bg-[#c3a47b] text-white dark:text-[#161311] font-semibold shadow-xs"
                    : "text-[#6e6358] dark:text-[#a89b8d] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
                }`}
              >
                Trọn bộ 7 lá
              </button>
            </div>
          </div>

          {/* Trường nhập theo mode */}
          {mode === "draws" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4]">
                Số lượt mở thẻ muốn tặng
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draws}
                  onChange={(e) => setDraws(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-xl border border-amber-200/80 dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 text-xs text-[#2D241E] dark:text-[#f5ede3] focus:border-amber-500/60 focus:outline-none"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#8C7E72] dark:text-[#786c5e]">
                  lượt
                </span>
              </div>
              <p className="text-[11px] text-[#8C7E72] dark:text-[#786c5e]">
                Người dùng sẽ nhận thông báo in-app và có thể bấm vào để mở thẻ ngay.
              </p>
            </div>
          )}

          {mode === "single" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4]">
                  Chọn lá bài muốn trao tặng
                </label>
                <select
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-amber-200/80 dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 text-xs text-[#2D241E] dark:text-[#f5ede3] focus:border-amber-500/60 focus:outline-none"
                >
                  {SCHOLAR_CARDS.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#fbf9f5] dark:bg-[#1c1815] text-[#2D241E] dark:text-[#f5ede3]">
                      Thẻ #{c.id}: {c.name} ({c.rarity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview nhỏ thẻ bài */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-amber-600/25 dark:border-amber-500/20 bg-[#f5ede0] dark:bg-[#16120f]">
                <img
                  src={`/image/card/${selectedCardId}.png`}
                  alt=""
                  className="h-14 w-auto rounded object-cover border border-amber-600/35 dark:border-amber-500/30"
                />
                <div className="min-w-0">
                  <div className="text-xs font-serif font-bold text-amber-800 dark:text-amber-300">
                    Thẻ #{selectedCardId}: {SCHOLAR_CARDS.find((c) => c.id === selectedCardId)?.name}
                  </div>
                  <div className="text-[10px] text-[#6e6358] dark:text-[#a89b8d]">
                    Độ hiếm: {SCHOLAR_CARDS.find((c) => c.id === selectedCardId)?.rarity}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4]">
                  Số lượng lá bài này
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-xl border border-amber-200/80 dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 text-xs text-[#2D241E] dark:text-[#f5ede3] focus:border-amber-500/60 focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          {mode === "fullSet" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-amber-600/30 dark:border-amber-500/30 bg-amber-500/15 dark:bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Trọn bộ 7 lá bài học giả (Thẻ 1 đến 7)</span>
                </div>
                <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
                  Hệ thống sẽ cộng thêm {count} lá bài vào mỗi loại thẻ trong số 7 lá của người dùng. Họ sẽ đủ điều kiện đổi ngay 30 ngày VIP!
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4]">
                  Số bộ muốn tặng
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-xl border border-amber-200/80 dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 text-xs text-[#2D241E] dark:text-[#f5ede3] focus:border-amber-500/60 focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* Các nút bấm hành động */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-amber-200/70 dark:border-[#3a3128]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 text-xs border-amber-200/80 dark:border-[#3a3128] bg-[#ece5da] dark:bg-[#201b18] text-[#3E3228] dark:text-[#a89b8d] hover:bg-[#e2d6c6] dark:hover:bg-[#26201c] hover:text-[#181513] dark:hover:text-[#f5ede3]"
            >
              Hủy
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-5 gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white dark:text-[#141210] font-semibold text-xs hover:from-amber-400 hover:to-amber-500 shadow-md disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Gift className="h-3.5 w-3.5" />
              )}
              <span>{isSubmitting ? "Đang gửi..." : "Xác nhận trao tặng"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
