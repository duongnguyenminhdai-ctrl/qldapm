"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { authApi, setAuthSession } from "@/lib/api";
import { Loader2 } from "lucide-react";

export function GoogleAuthButton({ callbackUrl = "/", onError }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    "706124961536-m0cegjnn45imfdo5ejpcseaafkdnjg8m.apps.googleusercontent.com";

  const handleGoogleClick = useCallback(() => {
    if (loading) return;

    if (typeof window === "undefined" || !window.google?.accounts?.oauth2) {
      if (onError) {
        onError("Đang nạp kết nối Google... Vui lòng thử lại sau giây lát.");
      }
      return;
    }

    setLoading(true);
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "email profile openid",
        callback: async (tokenResponse) => {
          if (tokenResponse?.error) {
            setLoading(false);
            if (tokenResponse.error !== "popup_closed_by_user" && onError) {
              onError("Không thể kết nối với tài khoản Google.");
            }
            return;
          }

          if (tokenResponse?.access_token) {
            try {
              const res = await authApi.googleLogin({
                accessToken: tokenResponse.access_token,
              });

              if (res?.data?.token) {
                setAuthSession({
                  token: res.data.token,
                  user: res.data.user,
                });
                router.push(callbackUrl === "/dashboard" ? "/" : callbackUrl);
                router.refresh();
              }
            } catch (err) {
              setLoading(false);
              const msg =
                err?.data?.message ||
                err?.message ||
                "Đăng nhập bằng tài khoản Google thất bại.";
              if (onError) onError(msg);
            }
          } else {
            setLoading(false);
          }
        },
      });

      client.requestAccessToken({ prompt: "select_account" });
    } catch (e) {
      setLoading(false);
      console.error("Lỗi kích hoạt Google Sign-In:", e);
      if (onError) onError("Không thể khởi động đăng nhập Google.");
    }
  }, [clientId, callbackUrl, loading, onError, router]);

  return (
    <div className="w-full">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <button
        type="button"
        onClick={handleGoogleClick}
        disabled={loading}
        className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl border border-[#3a3128] bg-[#141210] hover:bg-[#26201c] hover:border-[#5c4e40] text-xs font-medium text-[#f5ede3] transition shadow-xs active:scale-[0.99] disabled:opacity-60 cursor-pointer"
        title="Đăng nhập nhanh bằng tài khoản Google"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-[#c3a47b]" />
            <span className="text-[#a89b8d]">Đang kết nối Google...</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Tiếp tục với Google</span>
          </>
        )}
      </button>
    </div>
  );
}
