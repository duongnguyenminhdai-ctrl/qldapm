"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { X, MessageSquare, LogOut, AlertTriangle, Hand, CheckCircle2, AlertCircle, ShieldCheck, Check } from "lucide-react";

const TOAST_DURATION = 5000; // ms

const ICONS = {
  message: MessageSquare,
  leave: LogOut,
  host_closed: AlertTriangle,
  hand: Hand,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  join_request: ShieldCheck,
};

const COLORS = {
  message: "border-stone-200 bg-[#FAF8F5]/95 text-[#2D241E] dark:border-[#3a3128] dark:bg-[#1c1815]/95 dark:text-[#f5ede3]",
  leave: "border-stone-200 bg-[#FAF8F5]/95 text-[#2D241E] dark:border-[#3a3128] dark:bg-[#1c1815]/95 dark:text-[#f5ede3]",
  host_closed: "border-[#c3a47b]/40 bg-amber-50/95 text-[#2D241E] dark:bg-[#292019]/95 dark:text-[#f5ede3]",
  hand: "border-[#c3a47b]/40 bg-[#FAF8F5]/95 text-[#2D241E] shadow-lg shadow-[#c3a47b]/10 dark:bg-[#1c1815]/95 dark:text-[#f5ede3]",
  success: "border-emerald-500/40 bg-emerald-50/95 text-emerald-950 dark:border-[#c3a47b]/40 dark:bg-[#1c1815]/95 dark:text-[#f5ede3]",
  warning: "border-amber-500/40 bg-amber-50/95 text-amber-950 dark:border-[#c3a47b]/40 dark:bg-[#292019]/95 dark:text-[#f5ede3]",
  error: "border-rose-400/50 bg-rose-50/95 text-rose-950 dark:border-[#8b2626]/40 dark:bg-[#1c1815]/95 dark:text-[#f5ede3]",
  join_request: "border-[#c3a47b]/50 bg-[#FAF8F5]/95 text-[#2D241E] shadow-xl shadow-[#c3a47b]/10 dark:bg-[#1c1815]/95 dark:text-[#f5ede3]",
};

const ICON_COLORS = {
  message: "text-[#c3a47b]",
  leave: "text-[#a89b8d]",
  host_closed: "text-[#c3a47b]",
  hand: "text-[#e8cca4]",
  success: "text-[#c3a47b]",
  warning: "text-[#e8cca4]",
  error: "text-rose-400",
  join_request: "text-[#c3a47b]",
};

/**
 * Một toast item duy nhất - tự dismiss sau TOAST_DURATION
 */
function ToastItem({ id, type = "message", title, body, actionLabel, onAction, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  // Slide-in ngay khi mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, TOAST_DURATION);

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => onDismiss(id), 300);
  };

  const Icon = ICONS[type] || MessageSquare;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex w-72 items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md transition-all duration-300",
        COLORS[type],
        visible && !exiting
          ? "translate-x-0 opacity-100"
          : "-translate-x-4 opacity-0"
      )}
    >
      {/* Progress bar ở đáy */}
      <div
        className="absolute bottom-0 left-0 h-[2px] rounded-b-2xl bg-[#3a3128]/60"
        style={{ width: "100%" }}
      >
        <div
          className={cn(
            "h-full rounded-b-2xl transition-none",
            "bg-[#c3a47b]/70"
          )}
          style={{
            animation: `toast-shrink ${TOAST_DURATION}ms linear forwards`,
          }}
        />
      </div>

      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className={cn("h-4 w-4", ICON_COLORS[type])} strokeWidth={1.75} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {title && (
          <p className="truncate text-xs font-serif font-semibold text-[#2D241E] dark:text-[#f5ede3]">{title}</p>
        )}
        {body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-[#615247] dark:text-[#a89b8d] leading-relaxed">
            {body}
          </p>
        )}
        {actionLabel && typeof onAction === "function" && (
          <div className="mt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction();
                handleDismiss();
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-[#c3a47b] px-2.5 py-1 text-xs font-semibold text-[#161311] shadow-sm hover:bg-[#d6b88f] transition active:scale-95"
            >
              <Check className="h-3 w-3" strokeWidth={2} />
              <span>{actionLabel}</span>
            </button>
          </div>
        )}
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={handleDismiss}
        className="mt-0.5 shrink-0 rounded p-0.5 text-stone-400 hover:text-[#2D241E] dark:text-[#75695e] dark:hover:text-[#f5ede3]"
        aria-label="Đóng thông báo"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * RoomToastContainer - render stack toast ở góc dưới trái
 * Dùng: const { addToast } = useRoomToast(); (hoặc truyền ref)
 */
export function RoomToastContainer({ toasts, onDismiss }) {
  return (
    <div
      aria-label="Thông báo phòng"
      className="pointer-events-none fixed bottom-24 left-4 z-[9999] flex flex-col gap-2 sm:left-6"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem
            id={t.id}
            type={t.type}
            title={t.title}
            body={t.body}
            actionLabel={t.actionLabel}
            onAction={t.onAction}
            onDismiss={onDismiss}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Hook tạo và quản lý danh sách toast
 */
export function useRoomToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = ({
    type = "message",
    title,
    body,
    actionLabel,
    onAction,
    key,
  }) => {
    const id = key || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => {
      // 1. Chống lặp thông báo nếu đã có toast cùng key hoặc cùng title & body đang hiển thị
      if (key && prev.some((t) => t.id === key)) {
        return prev;
      }
      if (prev.some((t) => t.title === title && t.body === body)) {
        return prev;
      }

      let filtered = prev;
      if (type === "join_request") {
        filtered = filtered.filter((t) => t.type !== "join_request");
      }
      return [
        ...filtered.slice(-3),
        { id, type, title, body, actionLabel, onAction },
      ];
    });
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, dismissToast };
}
