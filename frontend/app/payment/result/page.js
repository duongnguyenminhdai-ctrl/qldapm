"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, Crown, ArrowLeft } from "lucide-react";
import { setAuthSession, getStoredUser } from "@/lib/api";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // loading | success | failed | invalid
  const [orderId, setOrderId] = useState("");
  const [proExpiresAt, setProExpiresAt] = useState(null);

  useEffect(() => {
    const vnpResponseCode = searchParams.get("vnp_ResponseCode");
    const vnpTxnRef = searchParams.get("vnp_TxnRef");
    const vnpSecureHash = searchParams.get("vnp_SecureHash");

    if (!vnpSecureHash || !vnpTxnRef) {
      setStatus("invalid");
      return;
    }

    setOrderId(vnpTxnRef);

    // Gọi backend để xác minh và cập nhật trạng thái
    const query = new URLSearchParams(searchParams).toString();
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/payment/vnpay-return?${query}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          if (data.data?.proExpiresAt) {
            setProExpiresAt(new Date(data.data.proExpiresAt));
          }
          // Cập nhật user trong localStorage với thông tin Pro mới
          const storedUser = getStoredUser();
          if (storedUser) {
            setAuthSession({
              user: {
                ...storedUser,
                isPro: true,
                title: "VIP",
                proExpiresAt: data.data?.proExpiresAt,
              },
            });
          }
        } else {
          setStatus("failed");
        }
      })
      .catch(() => setStatus("failed"));
  }, [searchParams]);

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-[100dvh] bg-[#141210] flex items-center justify-center p-4 text-[#a89b8d]">
      <div className="w-full max-w-md">
        {status === "loading" && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#201b18] border border-[#3a3128]">
              <Loader2 className="w-8 h-8 text-[#c3a47b] animate-spin" />
            </div>
            <h2 className="text-xl font-serif font-semibold text-[#f5ede3]">
              Đang xác nhận giao dịch...
            </h2>
            <p className="text-sm text-[#75695e]">Vui lòng chờ trong giây lát</p>
          </div>
        )}

        {status === "success" && (
          <div className="bg-[#201b18] border border-[#3a3128] rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            {/* Icon */}
            <div className="relative inline-flex">
              <div className="w-20 h-20 rounded-full bg-[#c3a47b]/15 border border-[#c3a47b]/40 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-[#c3a47b]" />
              </div>
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#c3a47b] flex items-center justify-center shadow">
                <Crown className="w-4 h-4 text-[#161311]" />
              </div>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-2xl font-serif font-bold text-[#f5ede3] mb-1">
                Nâng cấp thành công!
              </h1>
              <p className="text-[#a89b8d] text-sm">
                Tài khoản của bạn đã được nâng lên hạng{" "}
                <span className="text-[#e8cca4] font-semibold">VIP</span>
              </p>
            </div>

            {/* Details */}
            <div className="bg-[#181513] border border-[#3a3128] rounded-xl p-4 space-y-3 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-[#75695e]">Mã đơn hàng</span>
                <span className="text-[#f5ede3] font-mono text-xs">{orderId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#75695e]">Gói</span>
                <span className="text-[#f5ede3]">Pro 30 ngày</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#75695e]">Số tiền</span>
                <span className="text-[#f5ede3]">99,000 ₫</span>
              </div>
              {proExpiresAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#75695e]">Hết hạn</span>
                  <span className="text-[#c3a47b] font-medium">{formatDate(proExpiresAt)}</span>
                </div>
              )}
            </div>

            {/* Benefits */}
            <div className="bg-gradient-to-r from-[#c3a47b]/15 to-[#201b18] border border-[#c3a47b]/30 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-[#e8cca4] uppercase tracking-wider mb-3">
                Quyền lợi đã mở khóa
              </p>
              {["Chép lời cuộc họp (Live Transcription)", "Huy hiệu VIP trong phòng học", "Ưu tiên hỗ trợ"].map(
                (benefit) => (
                  <div key={benefit} className="flex items-center gap-2 text-sm text-[#d8c8b4]">
                    <CheckCircle className="w-4 h-4 text-[#c3a47b] flex-shrink-0" />
                    {benefit}
                  </div>
                )
              )}
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-3 rounded-xl bg-[#c3a47b] hover:bg-[#d6b88f] text-[#161311] font-semibold text-sm transition-colors shadow-md"
            >
              Vào Dashboard
            </button>
          </div>
        )}

        {(status === "failed" || status === "invalid") && (
          <div className="bg-[#201b18] border border-[#3a3128] rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-[#8b2626]/20 border border-[#8b2626]/40 flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 text-rose-400" />
            </div>

            <div>
              <h1 className="text-2xl font-serif font-bold text-[#f5ede3] mb-1">
                Thanh toán thất bại
              </h1>
              <p className="text-[#a89b8d] text-sm">
                {status === "invalid"
                  ? "Liên kết không hợp lệ hoặc đã hết hạn."
                  : "Giao dịch không thành công. Bạn chưa bị trừ tiền."}
              </p>
            </div>

            {orderId && (
              <div className="bg-[#181513] border border-[#3a3128] rounded-xl p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#75695e]">Mã đơn hàng</span>
                  <span className="text-[#f5ede3] font-mono text-xs">{orderId}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full py-3 rounded-xl border border-[#3a3128] bg-[#181513] hover:bg-[#26201c] text-[#f5ede3] font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Về Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#141210] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#c3a47b] animate-spin" />
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
