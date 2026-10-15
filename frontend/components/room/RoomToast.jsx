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
  message: "border-zinc-700/60 bg-zinc-900/95",
  leave: "border-zinc-700/60 bg-zinc-900/95",
  host_closed: "border-amber-500/40 bg-amber-950/90",
  hand: "border-amber-500/40 bg-zinc-900/95 shadow-lg shadow-amber-500/10",
  success: "border-emerald-500/40 bg-zinc-900/95",
  warning: "border-amber-500/40 bg-amber-950/90",
  error: "border-rose-500/40 bg-zinc-900/95",
  join_request: "border-amber-500/50 bg-zinc-950/95 shadow-xl shadow-amber-500/10",
};

const ICON_COLORS = {
  message: "text-indigo-400",
  leave: "text-zinc-400",
  host_closed: "text-amber-400",
  hand: "text-amber-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-rose-400",
  join_request: "text-amber-400",
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
        className="absolute bottom-0 left-0 h-[2px] rounded-b-2xl bg-white/10"
        style={{ width: "100%" }}
      >
        <div
          className={cn(
            "h-full rounded-b-2xl transition-none",
            type === "host_closed" || type === "hand" ? "bg-amber-400/60" : "bg-indigo-400/50"
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
          <p className="truncate text-xs font-semibold text-zinc-100">{title}</p>
        )}
        {body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400 leading-relaxed">
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
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition active:scale-95"
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
        className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-500 transition hover:text-zinc-300"
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
      // Giảm xuống duy nhất 1 thông báo cho yêu cầu vào phòng (join_request) thay vì xếp chồng
      let filtered = prev;
      if (type === "join_request") {
        filtered = filtered.filter((t) => t.type !== "join_request");
      } else if (key) {
        filtered = filtered.filter((t) => t.id !== key);
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
