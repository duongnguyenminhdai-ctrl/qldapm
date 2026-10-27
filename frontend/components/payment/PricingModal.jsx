"use client";

import { useState, useEffect } from "react";
import {
  Crown,
  Check,
  X,
  Zap,
  FileText,
  Shield,
  Star,
  Sparkles,
  Loader2,
  CalendarCheck,
} from "lucide-react";
import { paymentApi } from "@/lib/api";

const FREE_FEATURES = [
  "Tạo & tham gia phòng học",
  "Chat nhóm realtime",
  "Video call (LiveKit)",
  "Kick & ban thành viên (Host)",
  "Tìm kiếm phòng công khai",
];

const PRO_FEATURES = [
  { label: "Tất cả tính năng Free", included: true },
  { label: "Chép lời cuộc họp (Live Transcription)", included: true, highlight: true },
  { label: "Mở khóa tính năng trò chuyện với AI", included: true, highlight: true },
  { label: "Danh hiệu \"VIP\" trên hồ sơ", included: true },
  { label: "Ưu tiên hỗ trợ kỹ thuật", included: true },
];

function formatDateVN(d) {
  if (!d) return "";
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()}`;
}

export default function PricingModal({ isOpen, onClose, user }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      paymentApi
        .getPackages()
        .then((res) => {
          if (res?.data?.packages?.length > 0) {
            setPackages(res.data.packages);
            const pop =
              res.data.packages.find((p) => p.isPopular) ||
              res.data.packages[0];
            setSelectedPackage(pop);
          }
        })
        .catch(() => { });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Xác định trạng thái VIP hiện tại của người dùng
  const rawExpiry = user?.vipExpiresAt || user?.proExpiresAt;
  const expiryDate = rawExpiry ? new Date(rawExpiry) : null;
  const hasValidDate = Boolean(expiryDate && !isNaN(expiryDate.getTime()));
  const isExpired = !hasValidDate || expiryDate.getTime() <= Date.now();
  const isCurrentlyVip = Boolean((user?.isPro || user?.isVip) && !isExpired);

  // Tính hạn dùng mới ước tính sau khi gia hạn cộng dồn
  const addedDays = selectedPackage?.days || 30;
  const baseExpiryTime = isCurrentlyVip ? expiryDate.getTime() : Date.now();
  const estimatedNewExpiry = new Date(baseExpiryTime + addedDays * 24 * 60 * 60 * 1000);

  const handleUpgrade = async () => {
    if (!user) {
      setError("Vui lòng đăng nhập để thực hiện giao dịch.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data = await paymentApi.createPaymentUrl(selectedPackage?.code);
      if (data?.data?.paymentUrl) {
        window.location.href = data.data.paymentUrl;
      } else {
        setError("Không thể tạo link thanh toán. Vui lòng thử lại.");
      }
    } catch (err) {
      setError(err.message || "Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: "rgba(20, 18, 16, 0.85)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#FAF8F5] border border-stone-200 dark:bg-[#1c1815] dark:border-[#3a3128] rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col justify-between overflow-y-auto"
        style={{ animation: "fadeInScale 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg text-[#8C7E72] hover:text-[#2D241E] hover:bg-[#ECE5DA] dark:text-[#75695e] dark:hover:text-[#f5ede3] dark:hover:bg-[#201b18] transition-colors cursor-pointer"
          title="Đóng cửa sổ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="relative px-6 sm:px-8 pt-7 pb-5 text-center shrink-0">
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#c3a47b]/15 border border-[#c3a47b]/30 mb-3 shadow-[0_0_20px_rgba(195,164,123,0.25)]">
            <Crown className="w-7 h-7 text-[#b3894e] dark:text-[#c3a47b] animate-pulse" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#2D241E] dark:text-[#f5ede3] mb-1">
            {isCurrentlyVip ? "Gia Hạn Đặc Quyền VIP Học Giả" : "Nâng Cấp Lên Pro"}
          </h2>
          <p className="text-[#615247] dark:text-[#a89b8d] text-xs sm:text-sm max-w-md mx-auto">
            {isCurrentlyVip
              ? "Gia hạn gói VIP bất cứ lúc nào. Thời hạn gói mới sẽ được tự động cộng dồn tiếp nối vào hạn dùng hiện tại của bạn."
              : "Mở khóa toàn bộ tính năng nâng cao và đặc quyền hoàng kim của Virtual Study Room"}
          </p>
        </div>

        {/* Plans grid */}
        <div className="px-5 sm:px-8 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
          {/* Free plan */}
          <div className="bg-[#ECE5DA]/50 border border-stone-200 dark:bg-[#201b18] dark:border-[#3a3128] rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-[#8C7E72] dark:text-[#75695e] uppercase tracking-wider mb-1">
                  Miễn phí
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[#2D241E] dark:text-[#f5ede3]">0 ₫</span>
                  <span className="text-[#8C7E72] dark:text-[#75695e] text-sm">/mãi mãi</span>
                </div>
              </div>
              <ul className="space-y-2.5">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#615247] dark:text-[#a89b8d]">
                    <Check className="w-4 h-4 text-[#8C7E72] dark:text-[#75695e] flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-2">
              <div className="w-full py-2.5 rounded-xl bg-[#ECE5DA] border border-stone-300 text-[#8C7E72] dark:bg-[#181513] dark:border-[#2d2620] dark:text-[#75695e] text-xs sm:text-sm font-medium text-center cursor-default">
                {isCurrentlyVip ? "Gói Tiêu Chuẩn (Đã nâng cấp)" : "Gói hiện tại"}
              </div>
            </div>
          </div>

          {/* Pro / VIP plan */}
          <div className="relative bg-gradient-to-b from-[#b3894e]/15 to-[#ECE5DA]/70 border border-[#b3894e]/40 dark:from-[#c3a47b]/15 dark:to-[#201b18] dark:border-[#c3a47b]/40 rounded-xl p-5 space-y-4 overflow-hidden flex flex-col justify-between">
            {/* Badge */}
            <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-bold text-stone-950 flex items-center gap-1 shadow-sm">
              {isCurrentlyVip ? (
                <>
                  <Sparkles className="w-3 h-3 fill-current" />
                  <span>Đang hoạt động</span>
                </>
              ) : (
                <>
                  <Star className="w-3 h-3 fill-current" />
                  <span>VIP</span>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-[#966f38] dark:text-[#e8cca4] uppercase tracking-wider mb-1">
                  {selectedPackage ? selectedPackage.name : "Gói Pro"}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[#2D241E] dark:text-[#f5ede3] font-mono">
                    {selectedPackage
                      ? new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(selectedPackage.amount)
                      : "99,000 ₫"}
                  </span>
                  <span className="text-[#615247] dark:text-[#a89b8d] text-sm">
                    /{selectedPackage ? selectedPackage.days : 30} ngày
                  </span>
                </div>
              </div>

              {/* Bộ chọn gói dịch vụ nếu có nhiều gói */}
              {packages.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {packages.map((p) => {
                    const isSelected = selectedPackage?.code === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => setSelectedPackage(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer ${isSelected
                          ? "bg-[#b3894e] text-white dark:bg-[#c3a47b] dark:text-[#161311] shadow-xs"
                          : "border border-stone-200 bg-[#FAF8F5] text-[#615247] hover:bg-[#ECE5DA] hover:text-[#2D241E] dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#a89b8d] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
                          }`}
                      >
                        {p.name.replace("Gói Pro ", "")}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Box hiển thị cộng dồn thời hạn VIP trực quan */}
              {isCurrentlyVip && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-[#8C7E72] dark:text-[#a89b8d]">
                    <span className="flex items-center gap-1">
                      <CalendarCheck className="w-3.5 h-3.5 text-amber-500" />
                      Hạn VIP hiện tại:
                    </span>
                    <strong className="font-mono text-[#2D241E] dark:text-amber-300">
                      {formatDateVN(expiryDate)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-medium pt-1 border-t border-amber-500/20">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      Sau gia hạn (+{addedDays} ngày):
                    </span>
                    <strong className="font-mono text-emerald-800 dark:text-emerald-300">
                      {formatDateVN(estimatedNewExpiry)}
                    </strong>
                  </div>
                </div>
              )}

              <ul className="space-y-2">
                {PRO_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-xs sm:text-sm">
                    <Check
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${f.highlight ? "text-[#b3894e] dark:text-[#c3a47b]" : "text-[#8C7E72] dark:text-[#d8c8b4]"
                        }`}
                    />
                    <span className={f.highlight ? "text-[#2D241E] dark:text-[#f5ede3] font-medium" : "text-[#615247] dark:text-[#a89b8d]"}>
                      {f.label}
                    </span>
                    {f.highlight && (
                      <Zap className="w-3.5 h-3.5 text-[#b3894e] dark:text-[#c3a47b] flex-shrink-0 mt-0.5" />
                    )}
                  </li>
                ))}
              </ul>

              {error && (
                <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            {/* Nút hành động Mua / Gia hạn VIP */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={isLoading || !selectedPackage}
                className={[
                  "w-full py-3 rounded-xl font-serif font-bold text-xs sm:text-sm tracking-wide transition-all cursor-pointer",
                  "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-stone-950",
                  "hover:brightness-110 active:scale-95 shadow-md shadow-amber-500/25 border border-amber-400/60",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2",
                ].join(" ")}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang kết nối cổng thanh toán...</span>
                  </>
                ) : isCurrentlyVip ? (
                  <>
                    <Sparkles className="w-4 h-4 text-stone-950" />
                    <span>
                      Gia hạn ngay — {selectedPackage ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(selectedPackage.amount) : "99,000 ₫"}
                    </span>
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 text-stone-950" />
                    <span>
                      Nâng cấp ngay — {selectedPackage ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(selectedPackage.amount) : "99,000 ₫"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-5 text-center shrink-0">
          <div className="flex items-center justify-center gap-4 text-xs text-[#75695e]">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-[#c3a47b]" />
              <span>Thanh toán bảo mật qua VNPay Sandbox</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-[#c3a47b]" />
              <span>Cộng dồn thời hạn tự động</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
