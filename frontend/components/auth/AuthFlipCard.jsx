"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { cn } from "@/lib/utils";

/**
 * Hiệu ứng âm thanh tổng hợp bằng Web Audio API khi lật thẻ
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
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch (_) {}
}

/**
 * AuthFlipCard: Container 3D Flip Card linh hoạt cho Login / Register / Forgot Password
 * - Ứng dụng mô hình Double-Sided Active Card:
 *   + Mặt A và Mặt B thay phiên nhau nhận trạng thái đích
 *   + Mọi tương tác chuyển đổi giữa Login, Register và Forgot Password ĐỀU kích hoạt xoay 3D 180 độ
 *   + Sử dụng window.history.replaceState để cập nhật URL tức thì (/login, /register, /forgot-password) mà không reload
 */
export function AuthFlipCard({ initialMode = "login" }) {
  // activeFace: 'A' (góc xoay 0°) hoặc 'B' (góc xoay 180°)
  const [activeFace, setActiveFace] = useState("A");
  // faceA và faceB lưu nội dung của từng mặt: 'login' | 'register' | 'forgot'
  const [faceA, setFaceA] = useState(initialMode);
  const [faceB, setFaceB] = useState(
    initialMode === "login" ? "register" : "login"
  );
  // rotation: 0 | 180
  const [rotation, setRotation] = useState(0);

  const updateUrl = (targetMode) => {
    if (typeof window === "undefined") return;
    const path =
      targetMode === "register"
        ? "/register"
        : targetMode === "forgot"
        ? "/forgot-password"
        : "/login";
    window.history.replaceState(null, "", path);
  };

  const switchTo = (targetMode) => {
    const currentMode = activeFace === "A" ? faceA : faceB;
    if (targetMode === currentMode) return;

    playCardFlipAudio();
    updateUrl(targetMode);

    if (activeFace === "A") {
      // Đang hiển thị Mặt A (0°) -> Nạp targetMode vào Mặt B và xoay sang 180°
      setFaceB(targetMode);
      setRotation(180);
      setActiveFace("B");
    } else {
      // Đang hiển thị Mặt B (180°) -> Nạp targetMode vào Mặt A và xoay về 0°
      setFaceA(targetMode);
      setRotation(0);
      setActiveFace("A");
    }
  };

  const renderContent = (mode) => {
    switch (mode) {
      case "register":
        return (
          <>
            <div className="mb-6 text-center">
              <div className="flex items-center justify-between mb-3">
                <Link
                  href="/?book=rooms"
                  className="text-xs font-medium text-[#a89b8d] transition hover:text-[#c3a47b]"
                >
                  ← Virtual Study Room
                </Link>
              </div>
              <Link href="/?book=rooms" className="inline-block mb-3">
                <img
                  src="/image/logo.png"
                  alt="Virtual Study Room Logo"
                  className="h-12 w-auto object-contain mx-auto drop-shadow-md hover:scale-105 transition-transform duration-200"
                />
              </Link>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5ede3]">
                Tạo tài khoản
              </h1>
              <p className="mt-1.5 text-sm text-[#a89b8d]">
                Bắt đầu với một phòng học nhóm yên tĩnh.
              </p>
            </div>
            <RegisterForm
              onSwitchToLogin={() => switchTo("login")}
              onSwitchToForgot={() => switchTo("forgot")}
            />
          </>
        );

      case "forgot":
        return (
          <>
            <div className="mb-4 text-center">
              <div className="flex items-center justify-between mb-3">
                <Link
                  href="/?book=rooms"
                  className="text-xs font-medium text-[#a89b8d] transition hover:text-[#c3a47b]"
                >
                  ← Virtual Study Room
                </Link>
              </div>
              <Link href="/?book=rooms" className="inline-block mb-2">
                <img
                  src="/image/logo.png"
                  alt="Virtual Study Room Logo"
                  className="h-12 w-auto object-contain mx-auto drop-shadow-md hover:scale-105 transition-transform duration-200"
                />
              </Link>
            </div>
            <ForgotPasswordForm
              onSwitchToLogin={() => switchTo("login")}
              onSwitchToRegister={() => switchTo("register")}
            />
          </>
        );

      case "login":
      default:
        return (
          <>
            <div className="mb-6 text-center">
              <div className="flex items-center justify-between mb-3">
                <Link
                  href="/?book=rooms"
                  className="text-xs font-medium text-[#a89b8d] transition hover:text-[#c3a47b]"
                >
                  ← Virtual Study Room
                </Link>
              </div>
              <Link href="/?book=rooms" className="inline-block mb-3">
                <img
                  src="/image/logo.png"
                  alt="Virtual Study Room Logo"
                  className="h-12 w-auto object-contain mx-auto drop-shadow-md hover:scale-105 transition-transform duration-200"
                />
              </Link>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5ede3]">
                Đăng nhập
              </h1>
              <p className="mt-1.5 text-sm text-[#a89b8d]">
                Tiếp tục phiên học nhóm của bạn.
              </p>
            </div>
            <LoginForm
              onSwitchToRegister={() => switchTo("register")}
              onSwitchToForgot={() => switchTo("forgot")}
            />
          </>
        );
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12 bg-[#141210]">
      {/* 3D Perspective Container */}
      <div className="perspective-container w-full max-w-md">
        {/* Khung xoay 3D (flip-card-inner) */}
        <div
          className="flip-card-inner relative w-full"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${rotation}deg)`,
            transition: "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* ===================================================================
              MẶT A (Face A - 0 độ)
              =================================================================== */}
          <div
            className={cn(
              "card-front w-full rounded-2xl border border-[#3a3128] bg-[#201b18] p-6 sm:p-8 shadow-2xl transition-opacity duration-300",
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
            {renderContent(faceA)}
          </div>

          {/* ===================================================================
              MẶT B (Face B - 180 độ)
              =================================================================== */}
          <div
            className={cn(
              "card-back w-full rounded-2xl border border-[#3a3128] bg-[#201b18] p-6 sm:p-8 shadow-2xl transition-opacity duration-300",
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
            {renderContent(faceB)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthFlipCard;
