"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlashlightPasswordField, OwlMascot } from "@/components/auth/FlashlightPasswordField";
import { OtpInput } from "@/components/auth/OtpInput";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { authApi, setAuthSession } from "@/lib/api";
import { parseAuthErrors, validateRegisterFields } from "@/lib/authErrors";
import {
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  Mail,
  Loader2,
} from "lucide-react";

export function RegisterForm({ onSwitchToLogin, onSwitchToForgot } = {}) {
  const router = useRouter();

  // steps: 'FORM' | 'OTP'
  const [step, setStep] = useState("FORM");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const verifyingRef = useRef(false);

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // BƯỚC 1: Gửi thông tin & Nhận mã OTP qua Email
  const handleSubmitForm = async (event) => {
    event.preventDefault();
    setFormError("");
    setInfoMessage("");
    verifyingRef.current = false;

    const clientErrors = validateRegisterFields({
      name,
      email,
      password,
      confirmPassword,
    });

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const res = await authApi.registerRequestOtp({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
      });

      setInfoMessage(
        res?.message || "Mã xác thực OTP đã được gửi tới email của bạn."
      );
      setStep("OTP");
    } catch (error) {
      const { formError: message, fieldErrors: nextFields } =
        parseAuthErrors(error);
      setFieldErrors(nextFields);
      if (Object.keys(nextFields).length === 0) {
        setFormError(message);
      } else {
        setFormError("");
      }
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 2: Xác minh OTP & Kích hoạt tài khoản
  const handleVerifyOtp = async (codeToVerify) => {
    if (verifyingRef.current) return;
    const finalOtp = codeToVerify || otp;

    if (!finalOtp || finalOtp.length !== 6) {
      setFormError("Vui lòng nhập đủ 6 chữ số mã OTP.");
      return;
    }

    verifyingRef.current = true;
    setFormError("");
    setLoading(true);

    try {
      const result = await authApi.registerVerifyOtp({
        email: email.trim().toLowerCase(),
        otp: finalOtp,
      });

      if (result?.data?.token) {
        setAuthSession({
          token: result.data.token,
          user: result.data.user,
        });

        router.push("/dashboard");
        router.refresh();
        return;
      }
    } catch (error) {
      verifyingRef.current = false;
      setFormError(
        error?.data?.message ||
          error?.message ||
          "Mã OTP không chính xác hoặc đã hết hạn."
      );
    } finally {
      setLoading(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    verifyingRef.current = false;
    setFormError("");
    setResending(true);
    try {
      const res = await authApi.resendOtp({
        email: email.trim().toLowerCase(),
        type: "REGISTER",
      });
      setInfoMessage(res?.message || "Đã gửi lại mã OTP mới tới email của bạn.");
      return true;
    } catch (err) {
      setFormError(
        err?.data?.message ||
          err?.message ||
          "Không thể gửi lại mã OTP. Vui lòng thử lại sau giây lát."
      );
      return false;
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      {/* Thông báo thông tin / Toast */}
      {infoMessage && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
          <Mail className="h-4 w-4 shrink-0 text-purple-400" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Thông báo lỗi tổng thể */}
      {formError && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* ==================== BƯỚC 1: FORM ĐĂNG KÝ ==================== */}
      {step === "FORM" && (
        <form className="space-y-4" onSubmit={handleSubmitForm} noValidate>
          <Input
            id="name"
            name="name"
            type="text"
            label="Họ và tên"
            placeholder="Nguyễn Văn A"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError("name");
            }}
            error={fieldErrors.name}
          />

          {/* Ô Email: Không gắn đèn pin, con cú đậu gọn gàng trên nhãn */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium text-[#2D241E] dark:text-[#d8c8b4]"
              >
                Email
              </label>
              <div className="owl-wrapper scale-75 origin-bottom-right">
                <OwlMascot />
              </div>
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="ban@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("email");
              }}
              error={fieldErrors.email}
            />
          </div>

          {/* Ô Mật khẩu: Đèn pin cố định, hiển thị trọn vẹn khi hover/focus */}
          <FlashlightPasswordField
            id="password"
            name="password"
            label="Mật khẩu"
            placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError("password");
            }}
            error={fieldErrors.password}
          />

          {/* Ô Xác nhận mật khẩu: Đồng bộ hoàn toàn cùng component và style */}
          <FlashlightPasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Xác nhận mật khẩu"
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearFieldError("confirmPassword");
            }}
            error={fieldErrors.confirmPassword}
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-600 hover:via-amber-500 hover:to-amber-600 text-stone-950 font-serif font-bold text-sm tracking-wide rounded-xl shadow-md hover:shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-stone-950" />
                <span>Đang gửi mã xác thực...</span>
              </span>
            ) : (
              "Đăng ký với Email & OTP"
            )}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#3a3128]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-[#201b18] px-2.5 text-[#75695e]">
                Hoặc tiếp tục với
              </span>
            </div>
          </div>

          <GoogleAuthButton
            callbackUrl="/"
            onError={(err) => setFormError(err)}
          />
        </form>
      )}

      {/* ==================== BƯỚC 2: XÁC THỰC OTP EMAIL ==================== */}
      {step === "OTP" && (
        <div className="space-y-5">
          <div className="text-left space-y-1">
            <h2 className="text-lg font-semibold text-[#f5ede3] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#c3a47b]" />
              <span>Xác thực mã OTP</span>
            </h2>
            <p className="text-xs text-[#a89b8d] leading-relaxed">
              Mã xác thực gồm 6 số đã được gửi tới email{" "}
              <strong className="text-[#f5ede3] font-mono">{email}</strong>.
            </p>
          </div>

          <OtpInput
            length={6}
            value={otp}
            onChange={(val) => {
              setOtp(val);
              setFormError("");
            }}
            onComplete={handleVerifyOtp}
            disabled={loading}
            countdownSeconds={60}
            onResend={handleResendOtp}
            isResending={resending}
          />

          <Button
            type="button"
            onClick={() => handleVerifyOtp()}
            disabled={loading || otp.length < 6}
            className="w-full h-11 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-600 hover:via-amber-500 hover:to-amber-600 text-stone-950 font-serif font-bold text-sm tracking-wide rounded-xl shadow-md hover:shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-stone-950" />
                <span>Đang kích hoạt tài khoản...</span>
              </span>
            ) : (
              "Xác nhận & Tạo tài khoản"
            )}
          </Button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("FORM");
                setFormError("");
              }}
              className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Đổi thông tin đăng ký</span>
            </button>
            {onSwitchToForgot ? (
              <button
                type="button"
                onClick={onSwitchToForgot}
                className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
              >
                Quên mật khẩu?
              </button>
            ) : (
              <Link
                href="/forgot-password"
                className="text-zinc-500 hover:text-zinc-300 transition"
              >
                Quên mật khẩu?
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Chân trang điều hướng */}
      <div className="mt-6 flex flex-col items-center gap-2 text-xs text-[#75695e]">
        <p>
          Đã có tài khoản?{" "}
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-[#c3a47b] hover:text-[#d6b88f] font-medium transition cursor-pointer"
            >
              Đăng nhập ngay
            </button>
          ) : (
            <Link href="/login" className="text-[#c3a47b] hover:text-[#d6b88f] font-medium">
              Đăng nhập ngay
            </Link>
          )}
        </p>
        {onSwitchToForgot ? (
          <button
            type="button"
            onClick={onSwitchToForgot}
            className="text-[#75695e] hover:text-[#f5ede3] transition cursor-pointer"
          >
            Quên mật khẩu?
          </button>
        ) : (
          <Link
            href="/forgot-password"
            className="text-[#75695e] hover:text-[#f5ede3] transition"
          >
            Quên mật khẩu?
          </Link>
        )}
      </div>
    </>
  );
}

export default RegisterForm;
