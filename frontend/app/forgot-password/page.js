import { Suspense } from "react";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "Quên mật khẩu | Virtual Study Room",
  description: "Xác thực OTP qua email để đặt lại mật khẩu Virtual Study Room.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12 bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Link
            href="/"
            className="text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
          >
            Virtual Study Room
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-900/60" />}>
            <ForgotPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
