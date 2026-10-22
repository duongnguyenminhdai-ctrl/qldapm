"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlashlightPasswordField, OwlMascot } from "@/components/auth/FlashlightPasswordField";
import { OtpInput } from "@/components/auth/OtpInput";
import { authApi } from "@/lib/api";
import {
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";

export function ForgotPasswordForm({ onSwitchToLogin, onSwitchToRegister } = {}) {
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
            <h2 className="font-serif text-xl font-semibold text-[#f5ede3]">
              Quên mật khẩu?
            </h2>
            <p className="text-xs text-[#a89b8d] leading-relaxed">
              Nhập địa chỉ email đăng ký của bạn. Chúng tôi sẽ gửi mã xác thực OTP 6 số để bạn thiết lập lại mật khẩu.
            </p>
          </div>

          {/* Ô Email: Không gắn đèn pin, con cú đậu gọn gàng trên nhãn */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="forgot-email"
                className="text-xs font-medium text-[#2D241E] dark:text-[#d8c8b4]"
              >
                Email tài khoản
              </label>
              <div className="owl-wrapper scale-75 origin-bottom-right">
                <OwlMascot />
              </div>
            </div>
            <Input
              id="forgot-email"
              type="email"
              placeholder="ban@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
              required
              autoFocus
            />
          </div>

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
              "Gửi mã xác nhận"
            )}
          </Button>

          <div className="pt-4 flex flex-col items-center gap-2 text-xs text-[#75695e]">
            <p>
              Đã nhớ mật khẩu?{" "}
              {onSwitchToLogin ? (
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-medium text-[#c3a47b] hover:text-[#d6b88f] transition cursor-pointer"
                >
                  Đăng nhập ngay
                </button>
              ) : (
                <Link href="/login" className="font-medium text-[#c3a47b] hover:text-[#d6b88f]">
                  Đăng nhập ngay
                </Link>
              )}
            </p>
            <p>
              Chưa có tài khoản?{" "}
              {onSwitchToRegister ? (
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="font-medium text-[#c3a47b] hover:text-[#d6b88f] transition cursor-pointer"
                >
                  Đăng ký tài khoản
                </button>
              ) : (
                <Link href="/register" className="font-medium text-[#c3a47b] hover:text-[#d6b88f]">
                  Đăng ký tài khoản
                </Link>
              )}
            </p>
          </div>
        </form>
      )}

      {/* ==================== BƯỚC 2: NHẬP OTP 6 SỐ ==================== */}
      {step === "OTP" && (
        <div className="space-y-5">
          <div className="text-left space-y-1">
            <h2 className="text-lg font-semibold text-[#f5ede3] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#c3a47b]" />
              <span>Xác thực mã OTP</span>
            </h2>
            <p className="text-xs text-[#a89b8d] leading-relaxed">
              Mã xác nhận 6 số đã được gửi tới email{" "}
              <strong className="text-[#f5ede3] font-mono">{email}</strong>. Mã có hiệu lực trong 5 phút.
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
            disabled={loading || otp.length < 6}
            className="w-full h-11 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-600 hover:via-amber-500 hover:to-amber-600 text-stone-950 font-serif font-bold text-sm tracking-wide rounded-xl shadow-md hover:shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-stone-950" />
                <span>Đang kiểm tra mã...</span>
              </span>
            ) : (
              "Tiếp tục đặt mật khẩu"
            )}
          </Button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("EMAIL");
                clearError();
              }}
              className="text-[#75695e] hover:text-[#f5ede3] transition"
            >
              Đổi email khác
            </button>
            {onSwitchToLogin ? (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-[#75695e] hover:text-[#f5ede3] transition cursor-pointer"
              >
                Hủy bỏ
              </button>
            ) : (
              <Link
                href="/login"
                className="text-[#75695e] hover:text-[#f5ede3] transition"
              >
                Hủy bỏ
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ==================== BƯỚC 3: ĐẶT MẬT KHẨU MỚI ==================== */}
      {step === "NEW_PASSWORD" && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="text-left space-y-1 mb-2">
            <h2 className="text-lg font-semibold text-[#f5ede3] flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#c3a47b]" />
              <span>Đặt mật khẩu mới</span>
            </h2>
            <p className="text-xs text-[#a89b8d] leading-relaxed">
              Tạo mật khẩu an toàn mới cho tài khoản <strong className="text-[#f5ede3]">{email}</strong>.
            </p>
          </div>

          {/* Ô Mật khẩu mới: Đèn pin cố định, hiển thị trọn vẹn khi hover/focus */}
          <FlashlightPasswordField
            id="reset-new-password"
            name="newPassword"
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

          {/* Ô Xác nhận mật khẩu: Đồng bộ hoàn toàn cùng component và style */}
          <FlashlightPasswordField
            id="reset-confirm-password"
            name="confirmPassword"
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
            disabled={loading}
            className="w-full h-11 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-600 hover:via-amber-500 hover:to-amber-600 text-stone-950 font-serif font-bold text-sm tracking-wide rounded-xl shadow-md hover:shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-stone-950" />
                <span>Đang cập nhật mật khẩu...</span>
              </span>
            ) : (
              "Hoàn tất đặt lại mật khẩu"
            )}
          </Button>

          <div className="pt-2 text-center">
            {onSwitchToLogin ? (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-xs text-[#75695e] hover:text-[#f5ede3] transition cursor-pointer"
              >
                Hủy bỏ và quay lại Đăng nhập
              </button>
            ) : (
              <Link
                href="/login"
                className="text-xs text-[#75695e] hover:text-[#f5ede3] transition"
              >
                Hủy bỏ và quay lại Đăng nhập
              </Link>
            )}
          </div>
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
            className="w-full h-11 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-600 hover:via-amber-500 hover:to-amber-600 text-stone-950 font-serif font-bold text-sm tracking-wide rounded-xl shadow-md hover:shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer mt-2"
            onClick={() => {
              if (onSwitchToLogin) onSwitchToLogin();
              else router.push("/login");
            }}
          >
            Đăng nhập ngay
          </Button>
        </div>
      )}
    </div>
  );
}

export default ForgotPasswordForm;
