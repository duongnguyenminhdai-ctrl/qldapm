"use client";

import React, {
  useState,
  useRef,
  useId,
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
    ...props
  },
  ref
) {
  const autoId = useId();
  const fieldId = propId || `password-${autoId}`;

  const { isNight } = useAuthScene();
  const [isTorchActive, setIsTorchActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const inputRef = useRef(null);
  const buttonRef = useRef(null);

  useImperativeHandle(ref, () => inputRef.current);

  const toggleFlashlight = () => {
    setIsTorchActive((prev) => !prev);
  };

  // Trạng thái hiển thị mật khẩu: Khi click đèn pin hoặc rê chuột vào ô mật khẩu
  const isRevealed = isTorchActive || isHovered;

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
          type={isRevealed ? "text" : "password"}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            // Bắt buộc có padding an toàn: pr-12 (~48px) để không bị đè icon
            "flex h-10 w-full rounded-lg border pl-3.5 pr-12 py-2 text-sm shadow-sm transition-all duration-300",
            "focus-visible:outline-none focus-visible:ring-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Trạng thái bình thường (khi chưa rọi trúng hoặc đèn tắt):
            !isRevealed && (
              isNight
                ? "border-[#3a3128] bg-[#141210] text-[#f5ede3] placeholder:text-[#75695e] focus-visible:ring-[#c3a47b] focus-visible:border-[#c3a47b] font-mono tracking-[0.22em]"
                : "border-stone-300 bg-[#FAF8F5] text-[#2D241E] placeholder:text-stone-400 focus-visible:ring-[#b3894e] focus-visible:border-[#b3894e] font-mono tracking-[0.22em]"
            ),
            // Trạng thái rọi sáng: Hiển thị 100% mật khẩu với viền & nền sáng hổ phách ấm áp
            isRevealed && [
              "bg-gradient-to-l from-amber-500/25 via-amber-400/12 to-transparent",
              "border-amber-500/60",
              "shadow-[0_0_16px_rgba(245,208,97,0.22)]",
              isNight ? "text-[#fff7df] bg-[#18130c]" : "text-[#28201a] bg-[#fffcf5]",
              "font-mono tracking-wider font-medium",
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

        {/* Nút icon Đèn pin soi mật khẩu cố định DUY NHẤT ở mép phải của ô mật khẩu */}
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleFlashlight}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label={
            isRevealed ? "Ẩn mật khẩu" : "Soi mật khẩu bằng đèn pin"
          }
          aria-pressed={isTorchActive}
          aria-controls={fieldId}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-md hover:bg-stone-500/10 dark:hover:bg-[#3a3128]/60 active:scale-90 transition-all cursor-pointer z-10"
          title={isRevealed ? "Ẩn mật khẩu" : "Bật đèn pin soi mật khẩu"}
        >
          <img
            src="/image/flashlight-login/flashlight.svg"
            alt="Đèn pin"
            width={20}
            height={20}
            className={cn(
              "select-none transition-all duration-300",
              isRevealed
                ? "scale-115 drop-shadow-[0_0_10px_rgba(245,208,97,0.95)] filter brightness-125 rotate-[-15deg]"
                : "opacity-60 hover:opacity-100 hover:scale-105"
            )}
          />
        </button>
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
