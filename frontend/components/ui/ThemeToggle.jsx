"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import RubberSegment from "./RubberSegment";

export function ThemeToggle({ className = "", size = "sm" }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = resolvedTheme || theme || "dark";
  const isDark = currentTheme === "dark";

  // Ngăn hydration mismatch trong khi Next.js khởi tạo client
  if (!mounted) {
    return (
      <div
        className={`h-7 w-[124px] rounded-xl border border-[#c3a47b]/20 bg-[#201b18]/60 animate-pulse ${className}`}
        aria-hidden="true"
      />
    );
  }

  const items = [
    {
      value: "dark",
      label: "Tối",
      icon: <Moon className="h-3 w-3 shrink-0" strokeWidth={2} />,
    },
    {
      value: "light",
      label: "Sáng",
      icon: <Sun className="h-3 w-3 shrink-0" strokeWidth={2} />,
    },
  ];

  return (
    <div
      className={`inline-flex items-center rounded-xl p-0.5 border border-[#c3a47b]/25 shadow-xs backdrop-blur-md transition-colors duration-300 ${
        isDark ? "bg-[#181513]/90" : "bg-[#f5f0e8]/90"
      } ${className}`}
      title={isDark ? "Chuyển sang giao diện Giấy cổ Sáng" : "Chuyển sang giao diện Thư viện Tối"}
    >
      <RubberSegment
        items={items}
        value={isDark ? "dark" : "light"}
        onChange={(val) => setTheme(val)}
        size={size}
        radius={10}
        inset={2}
        equalSlots={true}
        speed={1.2}
        stretch={75}
        squash={3}
        trackColor={isDark ? "rgba(28, 23, 20, 0.9)" : "rgba(233, 224, 212, 0.9)"}
        thumbColor={isDark ? "#c3a47b" : "#b3894e"}
        textColor={isDark ? "#a89b8d" : "#7c6f64"}
        activeTextColor={isDark ? "#141210" : "#faf8f5"}
        className="!text-xs font-medium"
        aria-label="Chuyển đổi giao diện Dark / Light"
      />
    </div>
  );
}

export default ThemeToggle;
