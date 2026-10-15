"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/auth/OtpInput";
import { authApi } from "@/lib/api";
import {
  ArrowLeft,
  Mail,
  KeyRound,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export function ForgotPasswordForm() {
  const router = useRouter();

  // steps: 'EMAIL' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS'
  const [step, setStep] = useState("EMAIL");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");

  const verifyingRef = useRef(false);

  const clearError = () => setErrorMsg("");

  // BƯỚC 1: Gửi yêu cầu OTP quên mật khẩu
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    clearError();
    verifyingRef.current = false;

    if (!email || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrorMsg("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.forgotPasswordRequestOtp({
        email: email.trim().toLowerCase(),
      });
      setSuccessToast(res?.message || "Đã gửi mã xác thực tới email của bạn.");
      setStep("OTP");
    } catch (err) {
      setErrorMsg(
        err?.data?.message ||
          err?.message ||
          "Không thể gửi mã xác nhận. Vui lòng kiểm tra lại email."
      );
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 2: Xác minh OTP 6 số
  const handleVerifyOtp = async (codeToVerify) => {
    if (verifyingRef.current) return;
    const finalOtp = codeToVerify || otp;

    if (!finalOtp || finalOtp.length !== 6) {
      setErrorMsg("Vui lòng nhập đủ 6 chữ số mã OTP.");
      return;
    }

    verifyingRef.current = true;
    clearError();
    setLoading(true);

    try {
      const res = await authApi.forgotPasswordVerifyOtp({
        email: email.trim().toLowerCase(),
        otp: finalOtp,
      });

      if (res?.data?.resetToken) {
        setResetToken(res.data.resetToken);
        setStep("NEW_PASSWORD");
        setSuccessToast("Xác thực OTP thành công. Vui lòng đặt mật khẩu mới.");
      } else {
        verifyingRef.current = false;
        setErrorMsg("Mã xác thực không hợp lệ. Vui lòng thử lại.");
      }
    } catch (err) {
      verifyingRef.current = false;
      setErrorMsg(
        err?.data?.message ||
          err?.message ||
          "Mã OTP không chính xác hoặc đã hết hạn."
      );
    } finally {
      setLoading(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    verifyingRef.current = false;
    clearError();
    setResending(true);
    try {
      const res = await authApi.resendOtp({
        email: email.trim().toLowerCase(),
        type: "RESET_PASSWORD",
      });
      setSuccessToast(res?.message || "Đã gửi lại mã OTP mới tới email của bạn.");
      return true;
    } catch (err) {
      setErrorMsg(
        err?.data?.message ||
          err?.message ||
          "Không thể gửi lại mã OTP. Vui lòng thử lại sau giây lát."
      );
      return false;
    } finally {
      setResending(false);
    }
  };

  // BƯỚC 3: Đặt lại mật khẩu mới
  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearError();

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        resetToken,
        newPassword,
        confirmPassword,
      });

      setStep("SUCCESS");
      setSuccessToast("Đặt lại mật khẩu thành công!");
    } catch (err) {
      setErrorMsg(
        err?.data?.message ||
          err?.message ||
          "Đặt lại mật khẩu thất bại. Vui lòng thử lại từ đầu."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast thông báo nhanh */}
      {successToast && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Thông báo lỗi */}
      {errorMsg && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ==================== BƯỚC 1: NHẬP EMAIL ==================== */}
      {step === "EMAIL" && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div className="text-left space-y-1 mb-2">
            <h2 className="text-lg font-semibold text-zinc-100">
              Quên mật khẩu?
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Nhập địa chỉ email đăng ký của bạn. Chúng tôi sẽ gửi mã xác thực OTP 6 số để bạn thiết lập lại mật khẩu.
            </p>
          </div>

          <Input
            id="forgot-email"
            type="email"
            label="Email tài khoản"
            placeholder="ban@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
            required
            autoFocus
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
              <span>Gửi mã xác nhận</span>
            )}
          </Button>

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Quay lại trang Đăng nhập</span>
            </Link>
          </div>
        </form>
      )}

      {/* ==================== BƯỚC 2: NHẬP OTP 6 SỐ ==================== */}
      {step === "OTP" && (
        <div className="space-y-5">
          <div className="text-left space-y-1">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
              <span>Xác thực mã OTP</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Mã xác nhận 6 số đã được gửi tới email{" "}
              <strong className="text-zinc-200 font-mono">{email}</strong>. Mã có hiệu lực trong 5 phút.
            </p>
          </div>

          <OtpInput
            length={6}
            value={otp}
            onChange={(val) => {
              setOtp(val);
              clearError();
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
                <span>Đang kiểm tra mã...</span>
              </>
            ) : (
              <span>Tiếp tục đặt mật khẩu</span>
            )}
          </Button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("EMAIL");
                clearError();
              }}
              className="text-zinc-500 hover:text-zinc-300 transition"
            >
              Đổi email khác
            </button>
            <Link
              href="/login"
              className="text-zinc-500 hover:text-zinc-300 transition"
            >
              Hủy bỏ
            </Link>
          </div>
        </div>
      )}

      {/* ==================== BƯỚC 3: ĐẶT MẬT KHẨU MỚI ==================== */}
      {step === "NEW_PASSWORD" && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="text-left space-y-1 mb-2">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-purple-400" />
              <span>Đặt mật khẩu mới</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Tạo mật khẩu an toàn mới cho tài khoản <strong className="text-zinc-200">{email}</strong>.
            </p>
          </div>

          <Input
            id="reset-new-password"
            type="password"
            label="Mật khẩu mới"
            placeholder="Tối thiểu 6 ký tự"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              clearError();
            }}
            required
            autoFocus
          />

          <Input
            id="reset-confirm-password"
            type="password"
            label="Xác nhận mật khẩu mới"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearError();
            }}
            required
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
                <span>Đang cập nhật mật khẩu...</span>
              </>
            ) : (
              <span>Hoàn tất đặt lại mật khẩu</span>
            )}
          </Button>
        </form>
      )}

      {/* ==================== BƯỚC 4: THÀNH CÔNG ==================== */}
      {step === "SUCCESS" && (
        <div className="text-center py-4 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-7 w-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-zinc-100">
              Đổi mật khẩu thành công!
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              Mật khẩu mới của bạn đã được cập nhật thành công. Bạn có thể đăng nhập ngay bây giờ.
            </p>
          </div>

          <Button
            type="button"
            className="w-full mt-2"
            size="lg"
            onClick={() => router.push("/login")}
          >
            Đăng nhập ngay
          </Button>
        </div>
      )}
    </div>
  );
}
