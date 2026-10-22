"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuthScene } from "./AuthSceneContext";
import "./flashlight.css";

/**
 * OwlMascot - Linh vật Con Cú học giả (Dark Academia Mascot)
 * - Đậu ngay ngắn ở góc phải của thanh nhãn Email (Label bar), không đè lên ô input
 * - Ban ngày: Lim dim ngủ / nghỉ ngơi với nhịp thở êm đềm (owl-daytime).
 * - Ban đêm: Mắt mở to tỉnh táo đón nhận tri thức, ánh mắt liếc nhẹ theo chuột.
 */
export function OwlMascot({ id = "auth-owl", className = "", style = {} }) {
  const { isNight } = useAuthScene();
  const owlRef = useRef(null);
  const rafIdRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const owlEl = owlRef.current;
    if (!owlEl) return;

    if (!isNight) {
      // Khi là ban ngày: Cú ngủ, reset vị trí liếc mắt về 0
      owlEl.style.setProperty("--owl-gaze-x", "0px");
      owlEl.style.setProperty("--owl-gaze-y", "0px");
      owlEl.style.setProperty("--owl-head-x", "0px");
      owlEl.style.setProperty("--owl-head-y", "0px");
      owlEl.style.setProperty("--owl-tilt", "0deg");
      return;
    }

    // Ban đêm: Ánh mắt liếc nhẹ theo chuột
    const handlePointerMove = (e) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        if (!owlEl) return;
        // Nếu đang bị chùm sáng đèn pin rọi trúng, hướng nhìn do Flashlight điều khiển trực tiếp
        if (owlEl.classList.contains("is-lit")) return;

        const rect = owlEl.getBoundingClientRect();
        const owlCenterX = rect.left + rect.width / 2;
        const owlEyeY = rect.top + rect.height * 0.38;

        const dx = e.clientX - owlCenterX;
        const dy = e.clientY - owlEyeY;
        const distance = Math.max(1, Math.hypot(dx, dy));

        const normX = dx / distance;
        const normY = dy / distance;

        // Giới hạn biên độ liếc mắt nhẹ nhàng, tự nhiên
        const gazeX = (normX * 3.4).toFixed(2);
        const gazeY = (normY * 2.6).toFixed(2);
        const headX = (normX * 1.8).toFixed(2);
        const headY = (normY * 1.0).toFixed(2);
        const tilt = (normX * 8.0).toFixed(2);

        owlEl.style.setProperty("--owl-gaze-x", `${gazeX}px`);
        owlEl.style.setProperty("--owl-gaze-y", `${gazeY}px`);
        owlEl.style.setProperty("--owl-head-x", `${headX}px`);
        owlEl.style.setProperty("--owl-head-y", `${headY}px`);
        owlEl.style.setProperty("--owl-tilt", `${tilt}deg`);
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isNight]);

  return (
    <div
      ref={owlRef}
      id={id}
      data-owl-mascot="true"
      className={cn(
        "email-owl",
        !isNight && "owl-daytime",
        className
      )}
      style={style}
      aria-hidden="true"
    >
      <div className="owl-art">
        <img
          src="/image/flashlight-login/owl-perch.svg"
          alt=""
          className="select-none pointer-events-none"
        />
        <div className="owl-breath">
          <img
            src="/image/flashlight-login/owl-body.svg"
            alt=""
            className="select-none pointer-events-none"
          />
          <div className="owl-head">
            <img
              src="/image/flashlight-login/owl-head.svg"
              alt=""
              className="select-none pointer-events-none"
            />
            <div className="owl-eyes">
              <img
                src="/image/flashlight-login/owl-eyes.svg"
                alt=""
                className="select-none pointer-events-none"
              />
              <div className="owl-gaze">
                <img
                  src="/image/flashlight-login/owl-gaze.svg"
                  alt=""
                  className="select-none pointer-events-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OwlMascot;
