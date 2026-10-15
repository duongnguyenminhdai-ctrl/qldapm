"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi, setAuthSession } from "@/lib/api";
import { parseAuthErrors, validateLoginFields } from "@/lib/authErrors";

import { GoogleAuthButton } from "./GoogleAuthButton";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") || searchParams.get("redirect") || "/";
  const callbackUrl = rawCallback === "/dashboard" ? "/" : rawCallback;

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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium text-zinc-300"
            >
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-purple-400 hover:text-purple-300 transition"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError("password");
            }}
            error={fieldErrors.password}
          />
        </div>

        {formError ? (
          <p className="text-sm text-rose-400" role="alert">
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={loading}
          id="btn-login-submit"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
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
          callbackUrl={callbackUrl}
          onError={(err) => setFormError(err)}
        />
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="text-zinc-200 hover:text-white">
          Đăng ký
        </Link>
      </p>
    </>
  );
}
