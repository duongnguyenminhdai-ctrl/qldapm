"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlashlightPasswordField, OwlMascot } from "./FlashlightPasswordField";
import { authApi, setAuthSession } from "@/lib/api";
import { parseAuthErrors, validateLoginFields } from "@/lib/authErrors";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { Loader2 } from "lucide-react";

export function LoginForm({ onSwitchToRegister, onSwitchToForgot } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") || searchParams.get("redirect") || "/dashboard";
  const callbackUrl = rawCallback === "/" ? "/dashboard" : rawCallback;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    const clientErrors = validateLoginFields({ email, password });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const result = await authApi.login({
        email: email.trim(),
        password,
      });

      setAuthSession({
        token: result.data?.token,
        user: result.data?.user,
      });

      router.push(callbackUrl);
      router.refresh();
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

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
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

        {/* Ô Mật khẩu: Đèn pin cố định DUY NHẤT ở mép phải, hiển thị trọn vẹn khi click/hover */}
        <FlashlightPasswordField
          id="password"
          name="password"
          label="Mật khẩu"
          rightLabel={
            onSwitchToForgot ? (
              <button
                type="button"
                onClick={onSwitchToForgot}
                className="text-xs text-[#c3a47b] hover:text-[#d6b88f] transition cursor-pointer"
              >
                Quên mật khẩu?
              </button>
            ) : (
              <Link
                href="/forgot-password"
                className="text-xs text-[#c3a47b] hover:text-[#d6b88f] transition"
              >
                Quên mật khẩu?
              </Link>
            )
          }
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFieldError("password");
          }}
          error={fieldErrors.password}
        />

        {formError ? (
          <p className="text-sm text-rose-400" role="alert">
            {formError}
          </p>
        ) : null}

        {/* Nút Đăng nhập nguyên bản: Nút submit màu vàng kim sang trọng, không chứa đèn pin hay vệt sáng trôi dạt */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-600 hover:via-amber-500 hover:to-amber-600 text-stone-950 font-serif font-bold text-sm tracking-wide rounded-xl shadow-md hover:shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer mt-2"
          id="btn-login-submit"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-stone-950" />
              <span>Đang đăng nhập...</span>
            </span>
          ) : (
            "Đăng nhập"
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
          callbackUrl={callbackUrl}
          onError={(err) => setFormError(err)}
        />
      </form>

      <p className="mt-6 text-center text-sm text-[#75695e]">
        Chưa có tài khoản?{" "}
        {onSwitchToRegister ? (
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-medium text-[#c3a47b] hover:text-[#d6b88f] transition cursor-pointer"
          >
            Đăng ký
          </button>
        ) : (
          <Link href="/register" className="font-medium text-[#c3a47b] hover:text-[#d6b88f]">
            Đăng ký
          </Link>
        )}
      </p>
    </>
  );
}

export default LoginForm;
