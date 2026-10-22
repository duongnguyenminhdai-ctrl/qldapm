"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AuthSceneProvider, useAuthScene } from "./AuthSceneContext";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import styles from "./AuthScene.module.css";

/**
 * Hiệu ứng âm thanh tổng hợp bằng Web Audio API khi lật thẻ Auth 3D
 */
function playCardFlipAudio() {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (_) {}
}

/**
 * Inner component that has access to AuthSceneContext
 */
function AuthSceneCardInner({
  defaultView,
  initialMode = "login",
  onBackToIntro,
  children,
}) {
  const effectiveInitial = defaultView || initialMode || "login";
  const { isNight, toggleNight } = useAuthScene();

  // Cơ chế Double-Sided Active Card 3D Flip:
  // - activeFace: 'A' (Mặt A: 0deg) | 'B' (Mặt B: 180deg)
  // - Khi ở Mặt A (0deg) và chuyển sang view khác -> nạp vào Mặt B và xoay 180deg
  // - Khi ở Mặt B (180deg) và chuyển sang view khác -> nạp vào Mặt A và xoay về 0deg
  const [activeFace, setActiveFace] = useState(
    effectiveInitial === "login" ? "A" : "B"
  );
  const [faceA, setFaceA] = useState(
    effectiveInitial === "login" ? "login" : "login"
  );
  const [faceB, setFaceB] = useState(
    effectiveInitial !== "login" ? effectiveInitial : "register"
  );
  const [rotation, setRotation] = useState(
    effectiveInitial === "login" ? 0 : 180
  );
  const [currentMode, setCurrentMode] = useState(effectiveInitial);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const target = defaultView || initialMode || "login";
    setCurrentMode(target);
    if (target === "login") {
      setFaceA("login");
      setRotation(0);
      setActiveFace("A");
    } else {
      setFaceB(target);
      setRotation(180);
      setActiveFace("B");
    }
  }, [defaultView, initialMode]);

  const updateUrl = (targetMode) => {
    if (typeof window === "undefined") return;
    const path =
      targetMode === "register"
        ? "/register"
        : targetMode === "forgot" || targetMode === "forgot-password"
        ? "/forgot-password"
        : "/login";
    window.history.replaceState(null, "", path);
  };

  const switchTo = (targetMode) => {
    if (targetMode === currentMode) return;
    playCardFlipAudio();
    updateUrl(targetMode);
    setCurrentMode(targetMode);

    if (activeFace === "A") {
      // Đang hiển thị Mặt A (0deg) -> nạp target vào Mặt B và xoay sang 180deg
      setFaceB(targetMode);
      setRotation(180);
      setActiveFace("B");
    } else {
      // Đang hiển thị Mặt B (180deg) -> nạp target vào Mặt A và xoay về 0deg
      setFaceA(targetMode);
      setRotation(0);
      setActiveFace("A");
    }
  };

  const renderFormContent = (formMode) => {
    switch (formMode) {
      case "register":
        return (
          <RegisterForm
            onSwitchToLogin={() => switchTo("login")}
            onSwitchToForgot={() => switchTo("forgot")}
            onNavigate={switchTo}
          />
        );
      case "forgot":
      case "forgot-password":
        return (
          <ForgotPasswordForm
            onSwitchToLogin={() => switchTo("login")}
            onSwitchToRegister={() => switchTo("register")}
            onNavigate={switchTo}
          />
        );
      case "login":
      default:
        return (
          <LoginForm
            onSwitchToRegister={() => switchTo("register")}
            onSwitchToForgot={() => switchTo("forgot")}
            onNavigate={switchTo}
          />
        );
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center p-3 sm:p-6 lg:p-8 relative select-none">
      {/* ===================================================================
          1. FULLSCREEN PAGE LANDSCAPE (Day & Night Atmospheric Canvas)
          =================================================================== */}
      <div className={styles.pageLandscape} aria-hidden="true">
        {/* Day background */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            isNight ? "opacity-0" : "opacity-100"
          )}
          style={{
            background:
              "radial-gradient(ellipse at 18% 20%, rgba(242, 255, 255, 0.75), transparent 55%), linear-gradient(180deg, #7bb8cf 0%, #badfe1 45%, #c2ddd7 72%, #85b8c5 100%)",
          }}
        >
          <img
            src="/image/flashlight-login/background-day.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-bottom"
          />
        </div>

        {/* Night background */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            isNight ? "opacity-100" : "opacity-0"
          )}
          style={{
            background:
              "radial-gradient(ellipse at 82% 14%, rgba(61, 89, 130, 0.28), transparent 52%), linear-gradient(180deg, #020711 0%, #091525 49%, #142638 74%, #06121f 100%)",
          }}
        >
          <img
            src="/image/flashlight-login/background-night.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-bottom opacity-85"
          />
        </div>
      </div>

      {/* ===================================================================
          2. MAIN SPLIT-PANEL CARD (Card 2 Cột Desktop / Xếp Chồng Mobile)
          =================================================================== */}
      <main
        className={cn(
          styles.sceneCard,
          isNight ? styles.sceneCardNight : styles.sceneCardDay
        )}
        aria-label="Khung xác thực người dùng"
      >
        {/* =================================================================
            CỘT TRÁI - KHUNG CẢNH THIÊN NHIÊN (Scene Panel - Desktop md:flex)
            ================================================================= */}
        <section
          className={cn(
            styles.scenePanel,
            isNight ? styles.scenePanelNight : styles.scenePanelDay
          )}
          aria-label="Khung cảnh thiên nhiên ngày và đêm"
        >
          {/* Landscape container with sky & celestial objects */}
          <div
            className={cn(
              styles.landscapeScene,
              isNight && styles.landscapeSceneNight
            )}
            aria-hidden="true"
          >
            {/* Sky objects (Sun & Moon swap motion clipped behind mountain range) */}
            <div className={styles.skyObjects}>
              <div
                className={cn(
                  styles.sun,
                  isNight ? styles.sunDown : styles.sunUp
                )}
                title="Mặt trời tỏa sáng ban ngày"
              />
              <div
                className={cn(
                  styles.moon,
                  isNight ? styles.moonUp : styles.moonDown
                )}
                title="Mặt trăng dịu êm ban đêm"
              />
            </div>

            {/* Mountains landscape layer: panel-day.svg & panel-night.svg */}
            <img
              className={cn(
                styles.sceneLand,
                "transition-opacity duration-1000",
                isNight ? "opacity-0" : "opacity-100"
              )}
              src="/image/flashlight-login/panel-day.svg"
              alt=""
            />
            <img
              className={cn(
                styles.sceneLand,
                "transition-opacity duration-1000",
                isNight ? "opacity-100" : "opacity-0"
              )}
              src="/image/flashlight-login/panel-night.svg"
              alt=""
            />

            {/* Subtle bottom vignette to guarantee text legibility */}
            <div className={styles.sceneOverlayVignette} />
          </div>

          {/* Navigation link at top left */}
          <div className="absolute top-4 left-4 z-10">
            {onBackToIntro ? (
              <button
                type="button"
                onClick={onBackToIntro}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white/90 bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/15 transition-colors cursor-pointer"
              >
                <span>←</span>
                <span>Quay lại giới thiệu</span>
              </button>
            ) : (
              <Link
                href="/?book=rooms"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white/90 bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/15 transition-colors cursor-pointer"
              >
                <span>←</span>
                <span>Trang chủ</span>
              </Link>
            )}
          </div>

          {/* Independent Day / Night Toggle Switch at top right of Scene Panel */}
          <div className="absolute top-4 right-4 z-10">
            <button
              type="button"
              onClick={toggleNight}
              aria-label={isNight ? "Chuyển sang chế độ Ngày" : "Chuyển sang chế độ Đêm"}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-black/35 hover:bg-black/55 backdrop-blur-md border border-white/20 text-white shadow-sm transition cursor-pointer"
            >
              {isNight ? (
                <>
                  <span className="text-amber-300">🌙</span>
                  <span className="text-[11px] font-sans">Đêm</span>
                </>
              ) : (
                <>
                  <span className="text-amber-400">☀️</span>
                  <span className="text-[11px] font-sans">Ngày</span>
                </>
              )}
            </button>
          </div>

          {/* Scholar Titles & Atmosphere Copy at bottom of Scene Panel */}
          <div className={styles.sceneCopy}>
            <h2 className="font-serif">Thư phòng học giả</h2>
            <p className="line-clamp-2">
              Không gian học tập ảo tĩnh lặng & rèn luyện tập trung chuyên sâu.
            </p>
          </div>
        </section>

        {/* =================================================================
            CỘT PHẢI - FORM NHẬP LIỆU (Form Panel)
            ================================================================= */}
        <section
          className={cn(
            styles.formPanel,
            isNight ? styles.formPanelNight : styles.formPanelDay
          )}
          aria-label="Khu vực đăng nhập hoặc đăng ký"
        >
          {/* Header Branding */}
          <div className="mb-5 text-center">
            <Link href="/?book=rooms" className="inline-block mb-2.5">
              <img
                src="/image/logo.png"
                alt="Virtual Study Room Logo"
                className="h-10 sm:h-11 w-auto object-contain mx-auto drop-shadow-md hover:scale-105 transition-transform duration-200"
              />
            </Link>

            <h1
              className={cn(
                "font-serif text-2xl sm:text-3xl font-semibold tracking-tight transition-colors duration-500",
                isNight ? "text-[#f5ede3]" : "text-[#28201a]"
              )}
            >
              {currentMode === "register"
                ? "Tạo tài khoản"
                : currentMode === "forgot" || currentMode === "forgot-password"
                ? "Khôi phục mật khẩu"
                : "Đăng nhập"}
            </h1>

            <p
              className={cn(
                "mt-1 text-xs sm:text-sm transition-colors duration-500",
                isNight ? "text-[#a89b8d]" : "text-[#6b5c4f]"
              )}
            >
              {currentMode === "register"
                ? "Bắt đầu với một phòng học nhóm yên tĩnh."
                : currentMode === "forgot" || currentMode === "forgot-password"
                ? "Thiết lập lại mật khẩu tài khoản của bạn."
                : "Tiếp tục phiên học nhóm của bạn."}
            </p>
          </div>

          {/* Form Content: 3D Perspective Flip Container */}
          {children ? (
            children
          ) : (
            <div className="relative w-full max-w-md mx-auto [perspective:1200px]">
              <div
                className={cn(
                  "relative w-full [transform-style:preserve-3d]",
                  mounted ? "transition-transform duration-700 ease-in-out" : ""
                )}
                style={{
                  transformStyle: "preserve-3d",
                  WebkitTransformStyle: "preserve-3d",
                  transform: `rotateY(${rotation}deg)`,
                  transition: mounted
                    ? "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)"
                    : "none",
                }}
              >
                {/* MẶT A (FRONT FACE - GÓC 0deg) */}
                <div
                  className={cn(
                    "w-full [backface-visibility:hidden] [transform:rotateY(0deg)] transition-opacity duration-300",
                    activeFace === "A"
                      ? "relative z-10 opacity-100 pointer-events-auto"
                      : "absolute inset-0 z-0 opacity-0 pointer-events-none"
                  )}
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(0deg)",
                  }}
                >
                  {renderFormContent(faceA)}
                </div>

                {/* MẶT B (BACK FACE - GÓC 180deg) */}
                <div
                  className={cn(
                    "w-full [backface-visibility:hidden] [transform:rotateY(180deg)] transition-opacity duration-300",
                    activeFace === "B"
                      ? "relative z-10 opacity-100 pointer-events-auto"
                      : "absolute inset-0 z-0 opacity-0 pointer-events-none"
                  )}
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  {renderFormContent(faceB)}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * AuthSceneLayout: Public export wrapped in AuthSceneProvider
 */
export function AuthSceneLayout({
  defaultView,
  initialMode = "login",
  onBackToIntro,
  children,
}) {
  const mode = defaultView || initialMode || "login";
  return (
    <AuthSceneProvider initialNight={true}>
      <AuthSceneCardInner
        defaultView={mode}
        initialMode={mode}
        onBackToIntro={onBackToIntro}
      >
        {children}
      </AuthSceneCardInner>
    </AuthSceneProvider>
  );
}

export default AuthSceneLayout;
