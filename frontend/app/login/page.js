import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Đăng nhập | Virtual Study Room",
  description: "Đăng nhập để tiếp tục phiên học nhóm của bạn.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link
            href="/"
            className="text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
          >
            Virtual Study Room
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-50">
            Đăng nhập
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tiếp tục phiên học nhóm của bạn.
          </p>
        </div>

        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-zinc-900/60" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
