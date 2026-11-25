"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CinematicIntro } from "@/components/landing/CinematicIntro";
import AuthSceneLayout from "@/components/auth/AuthSceneLayout";
import { getStoredUser, getAuthToken } from "@/lib/api";
import { markIntroGatePassed, resetIntroGate } from "@/lib/introGate";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookParam = searchParams.get("book");
  const [showIntro, setShowIntro] = useState(true);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useEffect(() => {
    resetIntroGate();
    const user = getStoredUser();
    const token = getAuthToken();
    setHasActiveSession(Boolean(user && token));
  }, []);

  const handleComplete = () => {
    markIntroGatePassed();
    const user = getStoredUser();
    const token = getAuthToken();
    if (user && token) {
      router.push(bookParam ? `/dashboard?book=${bookParam}` : "/dashboard");
    } else {
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/login");
      }
      setShowIntro(false);
    }
  };

  const handleBackToIntro = () => {
    resetIntroGate();
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/");
    }
    setShowIntro(true);
  };

  return (
    <div className="min-h-screen bg-[#141210] text-[#f5ede3]">
      {showIntro ? (
        <CinematicIntro
          tagline="Virtual Study Room"
          title="Chào Mừng Bạn"
          description={
            hasActiveSession
              ? "Bấm nút bên dưới để vào không gian học tập của bạn"
              : "Bấm nút bên dưới để bắt đầu đăng nhập"
          }
          buttonText={hasActiveSession ? "Vào Hệ Thống" : "Đăng Nhập Ngay"}
          onComplete={handleComplete}
        />
      ) : (
        <AuthSceneLayout
          defaultView="login"
          onBackToIntro={handleBackToIntro}
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
