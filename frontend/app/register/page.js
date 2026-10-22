import { Suspense } from "react";
import AuthSceneLayout from "@/components/auth/AuthSceneLayout";

export const metadata = {
  title: "Đăng ký | Virtual Study Room",
  description: "Tạo tài khoản để bắt đầu phòng học nhóm Virtual Study Room.",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#141210] flex items-center justify-center text-sm text-[#a89b8d]" />
      }
    >
      <AuthSceneLayout defaultView="register" />
    </Suspense>
  );
}
