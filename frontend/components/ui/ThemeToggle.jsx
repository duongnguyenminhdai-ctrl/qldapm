"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { ICON_STROKE } from "@/lib/constants";

export function ThemeToggle({ className = "" }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`h-9 w-9 rounded-xl border border-zinc-200/80 bg-zinc-100/50 dark:border-zinc-800/80 dark:bg-zinc-900/60 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      id="theme-toggle-btn"
      aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      title={isDark ? "Giao diện sáng" : "Giao diện tối"}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md transition duration-taste ease-taste hover:border-zinc-300 hover:bg-zinc-100/80 hover:text-zinc-900 active:scale-[0.98] dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100 ${className}`}
    >
      {isDark ? (
        <Sun
          className="h-4 w-4 transition-transform duration-taste ease-taste group-hover:rotate-45 text-amber-400"
          strokeWidth={ICON_STROKE || 1.5}
        />
      ) : (
        <Moon
          className="h-4 w-4 transition-transform duration-taste ease-taste group-hover:-rotate-12 text-zinc-700"
          strokeWidth={ICON_STROKE || 1.5}
        />
      )}
    </button>
  );
}
