"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CinematicIntro } from "@/components/landing/CinematicIntro";
import AuthSceneLayout from "@/components/auth/AuthSceneLayout";
import { getStoredUser, getAuthToken } from "@/lib/api";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookParam = searchParams.get("book");
  const [showIntro, setShowIntro] = useState(true);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    const token = getAuthToken();
    if (user && token) {
      if (bookParam) {
        router.replace(`/dashboard?book=${bookParam}`);
      } else {
        router.replace("/dashboard");
      }
    } else {
      setCheckedAuth(true);
    }
  }, [router, bookParam]);

  const handleComplete = () => {
    const user = getStoredUser();
    const token = getAuthToken();
    if (user && token) {
      router.push(bookParam ? `/dashboard?book=${bookParam}` : "/dashboard");
    } else {
      setShowIntro(false);
    }
  };

  if (!checkedAuth) {
    return (
      <div className="min-h-screen bg-[#141210] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141210] text-[#f5ede3]">
      {showIntro ? (
        <CinematicIntro
          tagline="Virtual Study Room"
          title="Chào Mừng Bạn"
          description="Cuộn chuột hoặc bấm nút để bắt đầu đăng nhập"
          buttonText="Đăng Nhập Ngay"
          onComplete={handleComplete}
        />
      ) : (
        <AuthSceneLayout
          defaultView="login"
          onBackToIntro={() => setShowIntro(true)}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#141210]" />}>
      <HomeContent />
    </Suspense>
  );
}
