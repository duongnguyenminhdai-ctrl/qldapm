import { Suspense } from "react";
import AuthSceneLayout from "@/components/auth/AuthSceneLayout";

export const metadata = {
  title: "Đăng nhập | Virtual Study Room",
  description: "Đăng nhập để tiếp tục phiên học nhóm của bạn.",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#141210] flex items-center justify-center text-sm text-[#a89b8d]" />
      }
    >
      <AuthSceneLayout defaultView="login" />
    </Suspense>
  );
}
