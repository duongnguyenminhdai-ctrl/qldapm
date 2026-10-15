"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, RotateCcw } from "lucide-react";

export function OtpInput({
  length = 6,
  value = "",
  onChange,
  onComplete,
  disabled = false,
  countdownSeconds = 60,
  onResend,
  isResending = false,
}) {
  const [digits, setDigits] = useState(() => {
    const arr = Array(length).fill("");
    if (value) {
      for (let i = 0; i < Math.min(value.length, length); i++) {
        arr[i] = value[i];
      }
    }
    return arr;
  });

  const [timeLeft, setTimeLeft] = useState(countdownSeconds);
  const inputsRef = useRef([]);

  // Cập nhật khi prop value thay đổi từ ngoài
  useEffect(() => {
    const currentStr = digits.join("");
    if (value !== currentStr) {
      const arr = Array(length).fill("");
      for (let i = 0; i < Math.min(value.length, length); i++) {
        arr[i] = value[i];
      }
      setDigits(arr);
    }
  }, [value, length, digits]);

  // Đồng hồ đếm ngược gửi lại mã
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleResendClick = async () => {
    if (timeLeft > 0 || isResending || disabled || !onResend) return;
    const success = await onResend();
    if (success !== false) {
      setTimeLeft(countdownSeconds);
      // Xóa ô nhập và focus về ô đầu
      setDigits(Array(length).fill(""));
      if (onChange) onChange("");
      inputsRef.current[0]?.focus();
    }
  };

  const lastCompletedRef = useRef("");

  const notifyChange = (newDigits) => {
    const code = newDigits.join("");
    if (onChange) onChange(code);
    if (code.length === length && !newDigits.includes("")) {
      if (lastCompletedRef.current !== code && onComplete) {
        lastCompletedRef.current = code;
        onComplete(code);
      }
    } else {
      lastCompletedRef.current = "";
    }
  };

  const handleChange = (index, e) => {
    const rawVal = e.target.value;
    const char = rawVal.replace(/\D/g, "").slice(-1);

    const next = [...digits];
    next[index] = char;
    setDigits(next);
    notifyChange(next);

    // Tự động focus sang ô kế tiếp nếu đã nhập
    if (char && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Nếu ô hiện tại rỗng, lùi về ô trước và xóa ô trước
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        notifyChange(next);
        inputsRef.current[index - 1]?.focus();
      } else {
        // Xóa ô hiện tại
        const next = [...digits];
        next[index] = "";
        setDigits(next);
        notifyChange(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;

    const next = Array(length).fill("");
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    notifyChange(next);

    // Focus vào ô tiếp theo sau chuỗi paste hoặc ô cuối
    const nextIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[nextIndex]?.focus();
  };

  return (
    <div className="space-y-4">
      {/* 6 ô OTP */}
      <div className="flex items-center justify-between gap-2 sm:gap-2.5">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => (inputsRef.current[idx] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(idx, e)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={idx === 0 ? handlePaste : undefined}
            className="w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-100 placeholder-zinc-700 transition duration-150 focus:border-purple-500 focus:bg-zinc-900 focus:ring-2 focus:ring-purple-500/20 focus:outline-none disabled:opacity-50"
            autoComplete="one-time-code"
          />
        ))}
      </div>

      {/* Bộ đếm và nút gửi lại mã */}
      <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
        <span>Không nhận được mã?</span>
        {timeLeft > 0 ? (
          <span className="font-mono text-zinc-500">
            Gửi lại sau <strong className="text-purple-400">{timeLeft}s</strong>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResendClick}
            disabled={disabled || isResending}
            className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-medium transition disabled:opacity-50"
          >
            {isResending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang gửi lại...</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-3 w-3" />
                <span>Gửi lại mã</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
