"use client";

import React, {
  useState,
  useRef,
  useId,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { cn } from "@/lib/utils";
import { OwlMascot } from "./OwlMascot";
import { useAuthScene } from "./AuthSceneContext";
import "./flashlight.css";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const FlashlightPasswordField = forwardRef(function FlashlightPasswordField(
  {
    id: propId,
    name = "password",
    label,
    rightLabel,
    value = "",
    onChange,
    placeholder = "••••••••",
    required = false,
    autoComplete = "current-password",
    error,
    hint,
    className,
    disabled = false,
    autoFocus = false,
    ...props
  },
  ref
) {
  const autoId = useId();
  const fieldId = propId || `password-${autoId}`;

  const { isNight } = useAuthScene();
  const [isTorchActive, setIsTorchActive] = useState(false);

  const inputRef = useRef(null);
  const buttonRef = useRef(null);
  const beamRef = useRef(null);
  const flashlightRef = useRef(null);
  const overlayRef = useRef(null);
  const charsRef = useRef(null);

  const pointerRef = useRef({ x: 0, y: 0 });
  const angleRadRef = useRef(Math.PI);
  const rafIdRef = useRef(null);

  useImperativeHandle(ref, () => inputRef.current);

  const toggleFlashlight = () => {
    setIsTorchActive((prev) => !prev);
  };

  // Tính toán góc chiếu sáng, vệt sáng và đèn pin quay theo con trỏ chuột
  const updateBeamAndTorch = () => {
    if (!isTorchActive) return;

    const btnEl = buttonRef.current;
    const inputEl = inputRef.current;
    const beamEl = beamRef.current;
    const torchEl = flashlightRef.current;
    const overlayEl = overlayRef.current;
    const charsEl = charsRef.current;

    if (!btnEl || !inputEl || !beamEl || !torchEl || !overlayEl || !charsEl) return;

    const eyeRect = btnEl.getBoundingClientRect();
    const fieldRect = inputEl.getBoundingClientRect();

    const eyeX = eyeRect.left + eyeRect.width / 2;
    const eyeY = eyeRect.top + eyeRect.height / 2;

    const pointerDistance = Math.hypot(
      pointerRef.current.x - eyeX,
      pointerRef.current.y - eyeY
    );

    if (pointerDistance > 16) {
      angleRadRef.current = Math.atan2(
        pointerRef.current.y - eyeY,
        pointerRef.current.x - eyeX
      );
    }

    const angleDeg = (angleRadRef.current * 180) / Math.PI;
    const unitX = Math.cos(angleRadRef.current);
    const unitY = Math.sin(angleRadRef.current);
    const originX = eyeX + unitX * 13;
    const originY = eyeY + unitY * 13;
    const beamLength = clamp(pointerDistance * 1.65, 160, 1600);
    const beamHeight = beamLength * 0.38;

    beamEl.style.left = `${originX}px`;
    beamEl.style.top = `${originY - beamHeight / 2}px`;
    beamEl.style.width = `${beamLength}px`;
    beamEl.style.height = `${beamHeight}px`;
    beamEl.style.transform = `rotate(${angleDeg}deg)`;

    torchEl.style.left = `${eyeX - 17}px`;
    torchEl.style.top = `${eyeY - 17}px`;
    torchEl.style.transform = `rotate(${angleDeg}deg)`;

    overlayEl.style.left = `${fieldRect.left}px`;
    overlayEl.style.top = `${fieldRect.top}px`;
    overlayEl.style.width = `${Math.max(0, fieldRect.width - 46)}px`;
    overlayEl.style.height = `${fieldRect.height}px`;
    charsEl.style.transform = `translateX(${-inputEl.scrollLeft}px)`;

    function getLightLevel(x, y) {
      const offsetX = x - originX;
      const offsetY = y - originY;
      const along = offsetX * unitX + offsetY * unitY;
      const sideways = Math.abs(-offsetX * unitY + offsetY * unitX);
      const halfBeam = beamHeight * (0.01 + (0.49 * Math.max(0, along)) / beamLength);
      const edgeFade = clamp((halfBeam - sideways + 4) / 16, 0, 1);
      const tail = clamp((along / beamLength - 0.55) / 0.41, 0, 1);
      const endFade = 1 - tail * tail * (3 - 2 * tail);
      return along >= 0 ? edgeFade * endFade : 0;
    }

    // Cập nhật độ rọi sáng cho từng ký tự mật khẩu
    for (const character of charsEl.children) {
      const bounds = character.getBoundingClientRect();
      const light = getLightLevel(
        bounds.left + bounds.width / 2,
        fieldRect.top + fieldRect.height / 2
      );
      character.style.setProperty("--lit", String(light));
    }

    // Rọi sáng tới con cú (nếu có trên form)
    const owlEl = document.querySelector(".email-owl");
    if (owlEl) {
      const owlBounds = owlEl.getBoundingClientRect();
      const owlX = owlBounds.left + owlBounds.width / 2;
      const owlY = owlBounds.top + owlBounds.height / 2;
      const owlLight = getLightLevel(owlX, owlY);
      owlEl.classList.toggle("is-lit", owlLight > 0.08);

      if (owlLight > 0.08) {
        const dx = originX - owlX;
        const dy = originY - (owlBounds.top + owlBounds.height * 0.36);
        const dist = Math.max(1, Math.hypot(dx, dy));
        const x = dx / dist;
        const y = dy / dist;
        owlEl.style.setProperty("--owl-gaze-x", `${(x * 3.2).toFixed(2)}px`);
        owlEl.style.setProperty("--owl-gaze-y", `${(y * 2.6).toFixed(2)}px`);
        owlEl.style.setProperty("--owl-head-x", `${(x * 2).toFixed(2)}px`);
        owlEl.style.setProperty("--owl-head-y", `${(y * 1.2).toFixed(2)}px`);
        owlEl.style.setProperty("--owl-tilt", `${(x * 9).toFixed(2)}deg`);
      }
    }
  };

  // Khởi tạo tọa độ ban đầu khi bật đèn
  useEffect(() => {
    if (!isTorchActive) {
      const owlEl = document.querySelector(".email-owl");
      if (owlEl) {
        owlEl.classList.remove("is-lit");
      }
      return;
    }

    if (inputRef.current) {
      const fieldRect = inputRef.current.getBoundingClientRect();
      angleRadRef.current = Math.PI; // Chiếu sang trái (về phía văn bản mật khẩu)
      pointerRef.current = {
        x: fieldRect.left + 20,
        y: fieldRect.top + fieldRect.height / 2,
      };
      updateBeamAndTorch();
    }

    const handlePointerMove = (e) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(updateBeamAndTorch);
    };

    const handleScrollOrResize = () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(updateBeamAndTorch);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isTorchActive, value]);

  // Biến mảng ký tự mật khẩu thành các phần tử DOM reveal (masked • và plain letter)
  const passwordLetters = String(value || "").split("");

  return (
    <div className="flex w-full flex-col gap-1.5 relative group">
      {/* Tiêu đề ô nhập (Label) và liên kết phụ (Right Label) */}
      {(label || rightLabel) && (
        <div className="flex items-center justify-between mb-0.5">
          {label && (
            <label
              htmlFor={fieldId}
              className={cn(
                "text-xs font-medium transition-colors duration-300",
                isNight ? "text-[#d8c8b4]" : "text-[#2D241E]"
              )}
            >
              {label}
            </label>
          )}
          {rightLabel}
        </div>
      )}

      {/* Container ô input */}
      <div className="relative w-full">
        <input
          ref={inputRef}
          id={fieldId}
          name={name}
          type="password"
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          className={cn(
            "flex h-10 w-full rounded-lg border pl-3.5 pr-12 py-2 text-sm shadow-sm transition-all duration-300 font-mono tracking-[0.22em]",
            "focus-visible:outline-none focus-visible:ring-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isNight
              ? "border-[#3a3128] bg-[#141210] text-[#f5ede3] placeholder:text-[#75695e] focus-visible:ring-[#c3a47b] focus-visible:border-[#c3a47b]"
              : "border-stone-300 bg-[#FAF8F5] text-[#2D241E] placeholder:text-stone-400 focus-visible:ring-[#b3894e] focus-visible:border-[#b3894e]",
            // Khi đèn pin bật, ẩn text gốc của input để overlay chữ được chiếu sáng hiển thị lên
            isTorchActive && "text-transparent caret-amber-400 select-none",
            error && "border-rose-500/80 focus-visible:ring-rose-500/50",
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
          }
          {...props}
        />

        {/* Nút icon Mắt / Đèn pin ở góc phải ô mật khẩu */}
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleFlashlight}
          aria-label={
            isTorchActive ? "Tắt đèn pin" : "Soi mật khẩu bằng đèn pin"
          }
          aria-pressed={isTorchActive}
          aria-controls={fieldId}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-500/10 dark:hover:bg-[#3a3128]/60 active:scale-95 transition-all cursor-pointer z-10"
          title={isTorchActive ? "Tắt đèn pin" : "Bật đèn pin soi mật khẩu"}
        >
          <img
            src={
              isTorchActive
                ? "/image/flashlight-login/flashlight.svg"
                : "/image/flashlight-login/icon-eye.svg"
            }
            alt="Flashlight"
            width={18}
            height={18}
            className={cn(
              "select-none transition-all duration-300",
              isTorchActive
                ? "opacity-0 scale-75"
                : "opacity-60 hover:opacity-100 dark:brightness-200"
            )}
          />
        </button>
      </div>

      {/* Lớp Overlay hiển thị mật khẩu được chiếu sáng từng ký tự theo vệt đèn */}
      <div
        ref={overlayRef}
        className={cn(
          "password-reveal",
          isTorchActive && "is-active"
        )}
        aria-hidden="true"
      >
        <span ref={charsRef}>
          {passwordLetters.map((char, index) => (
            <span key={index} className="reveal-char">
              <span className="masked-char">•</span>
              <span className="plain-char">{char}</span>
            </span>
          ))}
        </span>
      </div>

      {/* Vệt sáng chiếu hình nón từ đèn pin */}
      <div
        ref={beamRef}
        className={cn("flash-beam", isTorchActive && "is-active")}
        aria-hidden="true"
      />

      {/* Đèn pin quay theo con trỏ chuột */}
      <div
        ref={flashlightRef}
        className={cn("flashlight", isTorchActive && "is-active")}
        aria-hidden="true"
      >
        <img
          src="/image/flashlight-login/flashlight.svg"
          alt=""
          width={33}
          height={33}
        />
      </div>

      {/* Thông tin phụ & Báo lỗi */}
      {hint && !error && (
        <p
          id={`${fieldId}-hint`}
          className={cn(
            "text-xs transition-colors duration-300",
            isNight ? "text-[#75695e]" : "text-stone-500"
          )}
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
});

export { OwlMascot };
export default FlashlightPasswordField;
