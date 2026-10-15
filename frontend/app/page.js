import Link from "next/link";
import { ArrowRight, ShieldCheck, Headphones, Timer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON_STROKE } from "@/lib/constants";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeBentoGrid } from "@/components/home/HomeBentoGrid";

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-stone-50 text-zinc-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col">
      {/* Header tối giản */}
      <HomeHeader />

      {/* Bento Grid trung tâm */}
      <main className="flex-1">
        <HomeBentoGrid />

        {/* Khối triết lý thiết kế & tính năng cốt lõi */}
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
          <div className="rounded-2xl border border-zinc-200/80 bg-white/60 p-6 shadow-sm backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/40 sm:p-8">
            <div className="max-w-xl">
              <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Thiết kế cho sự tập trung tuyệt đối
              </h2>
              <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                Mọi chi tiết được tinh giản để loại bỏ phân tâm, giúp bạn duy trì trạng thái dòng chảy sâu.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100">
                  <Timer className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                  Pomodoro đồng bộ
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Cả phòng cùng làm việc 25 phút và nghỉ ngơi 5 phút. Tạo động lực học nhóm kỷ luật.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100">
                  <Headphones className="h-4 w-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                  Khung hình chuẩn mực
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Lưới video tự căn chỉnh tỷ lệ, viền mảnh hairline và hiển thị rõ ràng người đang phát biểu.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                  Bảo mật và riêng tư
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Tùy chọn tạo phòng riêng tư chỉ cho người có mã mời. Không quảng cáo, không theo dõi.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer tối giản */}
      <footer className="border-t border-zinc-200/80 bg-stone-50/50 py-6 dark:border-zinc-800/60 dark:bg-zinc-950/50 transition-colors duration-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-500">
              Virtual Study Room · Hệ thống hoạt động ổn định
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            © 2026 Virtual Study Room. Không gian học tập tối giản.
          </p>
        </div>
      </footer>
    </div>
  );
}
