"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasPassedIntroGate, markIntroGatePassed } from "@/lib/introGate";

function isVnpayReturnLocation() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("vnp_TxnRef") && params.has("vnp_SecureHash");
}

/**
 * Đảm bảo mọi truy cập URL trực tiếp (kể cả /login, /dashboard, ...)
 * đều phải đi qua màn hình Intro tại "/" và chỉ chuyển tiếp khi người dùng bấm nút.
 */
export function IntroGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, setGateTick] = useState(0);

  const isRoot = pathname === "/";
  const isPaymentReturnPath = pathname === "/payment/result";
  const isAllowed = isRoot || hasPassedIntroGate();

  useEffect(() => {
    if (isAllowed) return;

    // Giữ nguyên callback trả về từ cổng thanh toán VNPay để xác minh giao dịch
    if (isPaymentReturnPath && isVnpayReturnLocation()) {
      markIntroGatePassed();
      setGateTick((t) => t + 1);
      return;
    }

    router.replace("/");
  }, [isAllowed, isPaymentReturnPath, pathname, router]);

  if (!isAllowed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141210] text-[#f5ede3]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <span className="text-xs font-mono text-[#a89b8d] tracking-widest uppercase">
            Đang chuyển tới trang giới thiệu...
          </span>
        </div>
      </div>
    );
  }

  return children;
}

export default IntroGate;

