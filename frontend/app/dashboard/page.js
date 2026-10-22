"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import BookShowcaseHome from "@/components/landing/BookShowcaseHome";
import { getStoredUser, getAuthToken, authApi, clearAuthSession, setStoredUser } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const user = getStoredUser();
    const token = getAuthToken();

    if (!user || !token) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    // Xác thực thực tế token với server để tránh lỗi tài khoản đã bị xóa hoặc phiên hết hạn
    authApi
      .me()
      .then((res) => {
        if (!isMounted) return;
        const validUser = res?.data?.user || res?.data;
        if (validUser) {
          setStoredUser(validUser);
          setIsAuthenticated(true);
        } else {
          clearAuthSession();
          router.replace("/login");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("[Dashboard] Xác thực phiên không thành công:", err?.message);
        clearAuthSession();
        router.replace("/login");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#141210] text-[#f5ede3]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <span className="text-xs font-mono text-[#a89b8d] tracking-widest uppercase">
            Đang xác thực bảo mật...
          </span>
        </div>
      </div>
    );
  }

  return (
    <main className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-screen max-w-[100vw] overflow-hidden select-none">
      <Suspense fallback={<div className="h-full w-full bg-[#141210]" />}>
        <BookShowcaseHome />
      </Suspense>
    </main>
  );
}
