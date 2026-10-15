import { Suspense } from "react";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Đăng ký | Virtual Study Room",
};

export default function RegisterPage() {
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
            Tạo tài khoản
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Bắt đầu với một phòng học nhóm yên tĩnh.
          </p>
        </div>

        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-900/60" />}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
