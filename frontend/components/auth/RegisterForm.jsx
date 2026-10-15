"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/auth/OtpInput";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { authApi, setAuthSession } from "@/lib/api";
import { parseAuthErrors, validateRegisterFields } from "@/lib/authErrors";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Mail,
} from "lucide-react";

export function RegisterForm() {
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

        router.push("/");
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

          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="ban@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError("email");
            }}
            error={fieldErrors.email}
          />

          <Input
            id="password"
            name="password"
            type="password"
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

          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
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
            className="w-full mt-2"
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>Đang gửi mã xác thực...</span>
              </>
            ) : (
              "Đăng ký với Email & OTP"
            )}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-zinc-950 px-2 text-zinc-500">
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
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
              <span>Xác thực mã OTP</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Mã xác thực gồm 6 số đã được gửi tới email{" "}
              <strong className="text-zinc-200 font-mono">{email}</strong>.
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
            className="w-full"
            size="lg"
            disabled={loading || otp.length < 6}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>Đang kích hoạt tài khoản...</span>
              </>
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
            <Link
              href="/forgot-password"
              className="text-zinc-500 hover:text-zinc-300 transition"
            >
              Quên mật khẩu?
            </Link>
          </div>
        </div>
      )}

      {/* Chân trang điều hướng */}
      <div className="mt-6 flex flex-col items-center gap-2 text-xs text-zinc-500">
        <p>
          Đã có tài khoản?{" "}
          <Link href="/login" className="text-zinc-200 hover:text-white font-medium">
            Đăng nhập ngay
          </Link>
        </p>
        <Link
          href="/forgot-password"
          className="text-zinc-500 hover:text-zinc-300 transition"
        >
          Quên mật khẩu?
        </Link>
      </div>
    </>
  );
}
