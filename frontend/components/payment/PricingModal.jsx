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
  Loader2,
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

  const handleUpgrade = async () => {
    if (!user) {
      setError("Vui lòng đăng nhập để nâng cấp.");
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: "fadeInScale 0.2s ease-out" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-transparent pointer-events-none" />
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <Crown className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-50 mb-1">Nâng cấp lên Pro</h2>
          <p className="text-zinc-400 text-sm">
            Mở khóa toàn bộ tính năng nâng cao của Virtual Study Room
          </p>
        </div>

        {/* Plans grid */}
        <div className="px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Free plan */}
          <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Miễn phí
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-zinc-200">0 ₫</span>
                <span className="text-zinc-500 text-sm">/mãi mãi</span>
              </div>
            </div>
            <ul className="space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                  <Check className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <div className="w-full py-2.5 rounded-xl bg-zinc-700/50 text-zinc-500 text-sm font-medium text-center cursor-default">
                Gói hiện tại
              </div>
            </div>
          </div>

          {/* Pro plan */}
          <div className="relative bg-gradient-to-b from-violet-500/10 to-zinc-900 border border-violet-500/30 rounded-xl p-5 space-y-4 overflow-hidden">
            {/* Badge */}
            <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-amber-500 text-xs font-bold text-white flex items-center gap-1">
              <Star className="w-3 h-3" />
              VIP
            </div>

            <div>
              <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1">
                {selectedPackage ? selectedPackage.name : "Gói Pro"}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-zinc-50 font-mono">
                  {selectedPackage
                    ? new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                    }).format(selectedPackage.amount)
                    : "99,000 ₫"}
                </span>
                <span className="text-zinc-400 text-sm">
                  /{selectedPackage ? selectedPackage.days : 30} ngày
                </span>
              </div>
            </div>

            {/* Bộ chọn gói dịch vụ */}
            {packages.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {packages.map((p) => {
                  const isSelected = selectedPackage?.code === p.code;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setSelectedPackage(p)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${isSelected
                          ? "bg-violet-600 text-white shadow-xs"
                          : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        }`}
                    >
                      {p.name.replace("Gói Pro ", "")}
                    </button>
                  );
                })}
              </div>
            )}

            <ul className="space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-2 text-sm">
                  <Check
                    className={`w-4 h-4 flex-shrink-0 mt-0.5 ${f.highlight ? "text-violet-400" : "text-emerald-400"
                      }`}
                  />
                  <span className={f.highlight ? "text-zinc-200 font-medium" : "text-zinc-400"}>
                    {f.label}
                  </span>
                  {f.highlight && (
                    <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  )}
                </li>
              ))}
            </ul>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="pt-2">
              <button
                onClick={handleUpgrade}
                disabled={isLoading || user?.isPro}
                className={[
                  "w-full py-3 rounded-xl font-semibold text-sm transition-all",
                  "bg-gradient-to-r from-violet-600 to-violet-500",
                  "hover:from-violet-500 hover:to-violet-400",
                  "text-white shadow-lg shadow-violet-500/20",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2",
                ].join(" ")}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang chuyển hướng...
                  </>
                ) : user?.isPro ? (
                  <>
                    <Shield className="w-4 h-4" />
                    Bạn đã là VIP
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    Nâng cấp ngay — 99,000 ₫
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-zinc-600">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              Thanh toán qua VNPay Sandbox
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              Bảo mật SSL
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
