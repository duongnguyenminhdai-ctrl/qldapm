"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Crown,
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Định dạng ngày giờ chuẩn Việt Nam (Ngày/Tháng/Năm Giờ:Phút)
 */
function formatVipDate(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function VipStatusModal({ isOpen, onClose, user, onOpenPricing }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Đóng modal khi nhấn phím ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const rawExpiry = user?.vipExpiresAt || user?.proExpiresAt;
  const expiryDate = rawExpiry ? new Date(rawExpiry) : null;
  const hasValidDate = Boolean(expiryDate && !isNaN(expiryDate.getTime()));
  const isExpired = !hasValidDate || expiryDate.getTime() <= Date.now();
  const isVipActive = Boolean((user?.isVip || user?.isPro) && !isExpired);

  // Tính số ngày còn lại
  const daysLeft =
    hasValidDate && !isExpired
      ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

  const handleOpenPricingModal = () => {
    onClose();
    if (onOpenPricing) {
      onOpenPricing();
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vsr:open-pricing-modal"));
    }
  };

  const handleGoToCards = () => {
    onClose();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vsr:open-cards-tab"));
    }
    router.push("/profile?tab=cards");
  };

  const privileges = [
    {
      title: "Không giới hạn thời gian phòng học",
      desc: "Thỏa sức tham gia và host các phòng tự học không giới hạn giờ cùng bạn bè.",
      icon: Clock,
    },
    {
      title: "Huy hiệu VIP hoàng kim độc quyền",
      desc: "Nổi bật trên thanh điều hướng, danh sách phòng và bảng xếp hạng học giả.",
      icon: Crown,
    },
    {
      title: "Tăng tỉ lệ rơi thẻ hiếm",
      desc: "Ưu tiên tỉ lệ xuất hiện các lá bài Sử thi, Huyền thoại và Thần thoại khi mở thẻ.",
      icon: Layers,
    },
    {
      title: "Study AI Tutor không giới hạn",
      desc: "Trợ lý AI đồng hành giải đáp thắc mắc và phiên dịch trực tiếp mọi bài học.",
      icon: Zap,
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop mờ tối */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container Dark Academia */}
      <div
        className="relative z-10 w-full max-w-lg bg-gradient-to-b from-[#241c16] via-[#1a1410] to-[#120d0a] border border-amber-500/35 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-black/90 text-[#f5ede3] max-h-[92vh] flex flex-col justify-between overflow-y-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow nền mờ màu hổ phách */}
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Nút đóng (X) góc phải */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/25 bg-[#201b18]/80 text-[#a89b8d] hover:text-[#f5ede3] hover:bg-[#2e2621] hover:scale-105 transition-all cursor-pointer"
          title="Đóng cửa sổ"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 1. Header: Icon Vương Miện 3D & Tiêu Đề */}
        <div className="flex items-center gap-3.5 mb-5 shrink-0">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 via-amber-600/20 to-amber-950/60 border border-amber-400/50 shadow-[0_0_24px_rgba(245,158,11,0.3)] shrink-0">
            <Crown className="w-6 h-6 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.85)] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/90 font-semibold">
                Tài Khoản Cao Cấp
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-amber-300 tracking-tight leading-snug">
              Đặc Quyền Học Giả VIP
            </h2>
          </div>
        </div>

        {/* 2. Thẻ hiển thị trạng thái thời hạn */}
        <div
          className={cn(
            "rounded-2xl p-4 sm:p-5 border transition-all mb-5 shrink-0",
            isVipActive
              ? "bg-gradient-to-br from-amber-500/15 via-[#251e18] to-[#171310] border-amber-500/40 shadow-[0_4px_24px_rgba(245,158,11,0.15)]"
              : "bg-[#181412] border-stone-800 text-stone-400"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-medium text-[#a89b8d]">
              Trạng thái gói:
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                isVipActive
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/30"
              )}
            >
              {isVipActive ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Đang hoạt động</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>{hasValidDate ? "Đã hết hạn" : "Chưa kích hoạt"}</span>
                </>
              )}
            </span>
          </div>

          {isVipActive ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-mono tracking-tight drop-shadow-sm">
                    {daysLeft}
                  </span>
                  <span className="text-base sm:text-lg font-serif font-semibold text-amber-200">
                    ngày còn lại
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenPricingModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-400/50 bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 text-xs font-serif font-bold tracking-wide hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                  title="Gia hạn thêm ngày vào hạn hiện tại"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>Gia hạn ngay</span>
                </button>
              </div>
              <p className="text-xs font-mono text-[#d8c8b4] flex items-center gap-1.5 pt-1.5 border-t border-amber-500/20">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Hạn sử dụng đến:{" "}
                  <strong className="text-amber-300 font-bold">
                    {formatVipDate(expiryDate)}
                  </strong>
                </span>
              </p>
            </div>
          ) : (
            <div className="py-1">
              <h4 className="text-base sm:text-lg font-serif font-bold text-[#e6ded2] mb-1">
                {hasValidDate ? "Gói VIP đã hết hạn" : "Bạn chưa kích hoạt Gói VIP"}
              </h4>
              <p className="text-xs text-[#a89b8d] leading-relaxed mb-3">
                Gia hạn gói VIP ngay hoặc đổi 1 bộ 7 lá Thẻ Bài Học Giả để nhận 30 ngày VIP hoàn toàn miễn phí!
              </p>
              <button
                type="button"
                onClick={handleOpenPricingModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-amber-400/60 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 text-xs font-serif font-bold hover:brightness-110 active:scale-95 transition shadow cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Kích hoạt VIP ngay</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Danh sách đặc quyền đang sở hữu */}
        <div className="space-y-3 mb-5 shrink-0">
          <h3 className="text-xs font-mono uppercase tracking-widest text-amber-400/90 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Đặc quyền đang sở hữu</span>
          </h3>

          <div className="grid grid-cols-1 gap-2.5">
            {privileges.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-[#1d1713]/90 border border-amber-500/15 hover:border-amber-500/30 transition-all"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-serif font-semibold text-[#f5ede3] leading-snug">
                      {item.title}
                    </h5>
                    <p className="text-[11px] text-[#a89b8d] leading-relaxed mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Lối tắt gia hạn & Gợi ý đổi thẻ */}
        <div className="rounded-2xl p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-600/15 to-amber-500/10 border border-amber-500/30 mb-5 shrink-0">
          <div className="flex items-start gap-2.5">
            <Gift className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200 leading-relaxed font-sans">
              <strong>Gợi ý:</strong> Thu thập đủ bộ 7 lá <strong>Thẻ Bài Học Giả</strong> để tích lũy thêm 30 ngày VIP miễn phí hoặc bấm <strong>Gia hạn Gói VIP</strong> để cộng dồn thêm hạn bất cứ lúc nào!
            </p>
          </div>
        </div>

        {/* 5. Cụm nút hành động dưới đáy */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
          {/* Nút hành động chính: Gia hạn Gói VIP */}
          <button
            type="button"
            onClick={handleOpenPricingModal}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-amber-400/80 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-stone-950 text-xs font-serif font-bold tracking-wide hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/25 cursor-pointer flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            <span>{isVipActive ? "Gia hạn Gói VIP" : "Mua Gói VIP"}</span>
            <Sparkles className="w-3.5 h-3.5 opacity-90" />
          </button>

          {/* Nút phụ: Đến Kho Thẻ Bài */}
          <button
            type="button"
            onClick={handleGoToCards}
            className="w-full sm:w-auto py-3 px-3.5 rounded-xl border border-amber-500/35 bg-[#201b18] hover:bg-[#2e2621] text-[#f5ede3] text-xs font-medium hover:border-amber-400/60 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            title="Đổi 7 lá bài lấy 30 ngày VIP miễn phí"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Kho Thẻ Bài</span>
          </button>

          {/* Nút Đóng */}
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-20 py-3 px-3 rounded-xl border border-stone-800 bg-[#161210] text-xs font-medium text-[#a89b8d] hover:text-[#f5ede3] hover:bg-[#201b18] hover:border-stone-700 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default VipStatusModal;
