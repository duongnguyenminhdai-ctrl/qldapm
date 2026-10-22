import { Suspense } from "react";
import AuthSceneLayout from "@/components/auth/AuthSceneLayout";

export const metadata = {
  title: "Quên mật khẩu | Virtual Study Room",
  description: "Xác thực OTP qua email để đặt lại mật khẩu Virtual Study Room.",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#141210] flex items-center justify-center text-sm text-[#a89b8d]" />
      }
    >
      <AuthSceneLayout defaultView="forgot" />
    </Suspense>
  );
}
