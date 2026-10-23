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
    revealed,
    onToggleReveal,
    showTorch = true,
    ...props
  },
  ref
) {
  const autoId = useId();
  const fieldId = propId || `password-${autoId}`;

  const { isNight } = useAuthScene();
  const [internalActive, setInternalActive] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);

  const inputRef = useRef(null);
  const torchContainerRef = useRef(null);

  useImperativeHandle(ref, () => inputRef.current);

  const isControlled = typeof revealed === "boolean";
  const isTorchActive = isControlled ? revealed : internalActive;

  const handleToggle = () => {
    if (isControlled) {
      if (onToggleReveal) onToggleReveal();
    } else {
      setInternalActive((prev) => !prev);
    }
  };

  // Đồng bộ góc quay của cụm đèn pin và vệt sáng hình nón theo vị trí con trỏ chuột
  useEffect(() => {
    if (!isTorchActive) {
      setRotationAngle(0);
      const owlEl = document.querySelector(".email-owl");
      if (owlEl) owlEl.classList.remove("is-lit");
      return;
    }

    const handlePointerMove = (e) => {
      if (!torchContainerRef.current) return;
      const rect = torchContainerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;

      // Với góc mặc định chĩa sang trái (-X), góc quay rotation:
      const angle = (Math.atan2(-dy, -dx) * 180) / Math.PI;
      setRotationAngle(angle);

      // Tương tác rọi sáng tới Con Cú học giả ở nhãn Email
      const owlEl = document.querySelector(".email-owl");
      if (owlEl) {
        const owlRect = owlEl.getBoundingClientRect();
        const owlX = owlRect.left + owlRect.width / 2;
        const owlY = owlRect.top + owlRect.height / 2;
        const odx = owlX - centerX;
        const ody = owlY - centerY;
        const targetAngle = (Math.atan2(-ody, -odx) * 180) / Math.PI;
        const diff = Math.abs(angle - targetAngle);
        const isOwlLit = diff < 28;
        owlEl.classList.toggle("is-lit", isOwlLit);

        if (isOwlLit) {
          const dist = Math.max(1, Math.hypot(odx, ody));
          const nx = odx / dist;
          const ny = ody / dist;
          owlEl.style.setProperty("--owl-gaze-x", `${(nx * 3.2).toFixed(2)}px`);
          owlEl.style.setProperty("--owl-gaze-y", `${(ny * 2.6).toFixed(2)}px`);
          owlEl.style.setProperty("--owl-head-x", `${(nx * 2).toFixed(2)}px`);
          owlEl.style.setProperty("--owl-head-y", `${(ny * 1.2).toFixed(2)}px`);
          owlEl.style.setProperty("--owl-tilt", `${(nx * 9).toFixed(2)}deg`);
        }
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [isTorchActive]);

  return (
    <div className="flex w-full flex-col gap-1.5 relative group overflow-visible">
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

      {/* Container ô input: overflow-visible để chùm sáng không bị cắt */}
      <div className="relative w-full overflow-visible">
        <input
          ref={inputRef}
          id={fieldId}
          name={name}
          type={isTorchActive ? "text" : "password"}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          className={cn(
            "flex h-10 w-full rounded-lg border pl-3.5 pr-12 py-2 text-sm shadow-sm transition-all duration-300 font-mono",
            !isTorchActive && "tracking-[0.22em]",
            "focus-visible:outline-none focus-visible:ring-1",
            "disabled:cursor-not-allowed disabled:opacity-50 relative z-10",
            // Trạng thái tắt đèn:
            !isTorchActive && (
              isNight
                ? "border-[#3a3128] bg-[#141210] text-[#f5ede3] placeholder:text-[#75695e] focus-visible:ring-[#c3a47b] focus-visible:border-[#c3a47b]"
                : "border-stone-300 bg-[#FAF8F5] text-[#2D241E] placeholder:text-stone-400 focus-visible:ring-[#b3894e] focus-visible:border-[#b3894e]"
            ),
            // Trạng thái bật đèn: Rọi sáng toàn bộ ô với ánh hào quang vàng hổ phách, chữ rõ nét
            isTorchActive && [
              "border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.25),inset_0_0_15px_rgba(245,158,11,0.15)]",
              isNight ? "bg-[#1c1710] text-[#fff7df]" : "bg-[#fffdf7] text-[#28201a]",
              "font-medium tracking-normal focus-visible:ring-amber-400 focus-visible:border-amber-400",
            ],
            error && "border-rose-500/80 focus-visible:ring-rose-500/50",
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
          }
          {...props}
        />

        {/* CỤM ĐÈN PIN & VỆT SÁNG NÓN: Gom chung 1 container tọa độ, cùng tâm xoay */}
        {showTorch && (
          <div
            ref={torchContainerRef}
            className="absolute right-3 top-1/2 flex items-center justify-center z-20 pointer-events-none"
            style={{
              transform: `translateY(-50%) rotate(${rotationAngle}deg)`,
              transformOrigin: "center center",
            }}
          >
            {/* THẺ VỆT SÁNG NÓN: Cắm chặt vào đầu chụp đèn pin (right: 100%, top: 50%) */}
            {isTorchActive && (
              <div
                className="pointer-events-none"
                style={{
                  position: "absolute",
                  right: "100%",
                  top: "50%",
                  transform: "translateY(-50%)",
                  transformOrigin: "right center",
                  width: "350px",
                  height: "120px",
                  clipPath: "polygon(0% 15%, 100% 45%, 100% 55%, 0% 85%)",
                  background:
                    "linear-gradient(to left, rgba(251, 191, 36, 0.4), rgba(245, 158, 11, 0.15) 70%, transparent 100%)",
                  filter: "blur(1px) drop-shadow(0 0 12px rgba(245, 158, 11, 0.3))",
                }}
                aria-hidden="true"
              />
            )}

            {/* Nút Đèn Pin */}
            <button
              type="button"
              onClick={handleToggle}
              aria-label={isTorchActive ? "Tắt đèn pin" : "Soi mật khẩu bằng đèn pin"}
              aria-pressed={isTorchActive}
              aria-controls={fieldId}
              className="pointer-events-auto flex items-center justify-center w-7 h-7 cursor-pointer active:scale-90 transition-transform duration-150"
              title={isTorchActive ? "Tắt đèn pin" : "Bật đèn pin soi mật khẩu"}
            >
              <img
                src="/image/flashlight-login/flashlight.svg"
                alt="Đèn pin"
                width={24}
                height={24}
                className={cn(
                  "select-none pointer-events-none transition-all duration-200",
                  "-scale-x-100", // Quay đầu đèn về phía bên trái để cắm chặt vào vệt sáng
                  isTorchActive
                    ? "opacity-100 drop-shadow-[0_0_10px_rgba(245,158,11,0.95)] filter brightness-125"
                    : "opacity-50 hover:opacity-80 grayscale contrast-125"
                )}
              />
            </button>
          </div>
        )}
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
