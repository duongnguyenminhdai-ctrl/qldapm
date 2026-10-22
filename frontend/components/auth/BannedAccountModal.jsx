"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ShieldAlert, LogOut, AlertTriangle, Mail } from "lucide-react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { getStoredUser, clearAuthSession } from "@/lib/api";

export function BannedAccountModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [banData, setBanData] = useState({
    reason: "",
    bannedAt: null,
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Xử lý Force Logout triệt để khi người dùng nhấn nút Đăng xuất
  const handleLogout = useCallback(() => {
    setIsLoggingOut(true);
    try {
      // 1. Ngắt kết nối socket
      disconnectSocket();
    } catch (_) {}

    try {
      // 2. Xóa sạch session trong localStorage & sessionStorage
      clearAuthSession();
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem("vsr_token");
          window.localStorage.removeItem("vsr_user");
          window.sessionStorage.clear();
        } catch (_) {}

        // 3. Cưỡng chế điều hướng về trang đăng nhập
        window.location.href = "/login";
      }
    } catch (_) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }, []);

  useEffect(() => {
    setMounted(true);

    const defaultReason =
      "Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng hoặc theo quyết định của Quản trị viên.";

    // Handler nhận dữ liệu sự kiện khóa tài khoản
    const triggerBan = (payload) => {
      const user = getStoredUser();
      const currentUserId = user?._id || user?.id;

      // Nếu payload có chỉ định target userId, kiểm tra xem có đúng là user hiện tại không
      if (
        payload?.userId &&
        currentUserId &&
        String(payload.userId) !== String(currentUserId)
      ) {
        return;
      }

      const reason =
        payload?.reason && String(payload.reason).trim()
          ? String(payload.reason).trim()
          : defaultReason;

      setBanData({
        reason,
        bannedAt: payload?.bannedAt || new Date().toISOString(),
      });
      setIsOpen(true);

      // Ngắt token ngay lập tức khỏi localStorage để chặn mọi API background
      try {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("vsr_token");
        }
      } catch (_) {}
    };

    // 1. Kiểm tra trạng thái hiện tại của tài khoản đã lưu (nếu bị reload khi đang bị khóa)
    const currentUser = getStoredUser();
    if (
      currentUser &&
      (currentUser.status === "BLOCKED" || currentUser.isBanned)
    ) {
      triggerBan({
        reason: currentUser.banReason || defaultReason,
      });
    }

    // 2. Lắng nghe sự kiện socket realtime
    const socket = getSocket();
    if (socket) {
      socket.on("account_banned", triggerBan);
      socket.on("account:banned", triggerBan);
    }

    // 3. Lắng nghe sự kiện toàn cục CustomEvent (khi API Interceptor bắt được 403)
    const handleWindowEvent = (e) => {
      triggerBan(e?.detail || {});
    };

    window.addEventListener("account_banned", handleWindowEvent);
    window.addEventListener("vsr:account-banned", handleWindowEvent);

    // 4. Khóa phím Escape khi modal đang mở (Chặn hoàn toàn hành vi tắt)
    const handleKeyDown = (e) => {
      if (e.key === "Escape" || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      if (socket) {
        socket.off("account_banned", triggerBan);
        socket.off("account:banned", triggerBan);
      }
      window.removeEventListener("account_banned", handleWindowEvent);
      window.removeEventListener("vsr:account-banned", handleWindowEvent);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  if (!mounted || !isOpen) return null;

  // Format thời gian khóa
  const formattedTime = banData.bannedAt
    ? new Date(banData.bannedAt).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  const modalContent = (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="banned-dialog-title"
      aria-describedby="banned-dialog-desc"
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none"
      onClick={(e) => {
        // Chặn hoàn toàn click outside
        e.stopPropagation();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#16120e] dark:bg-[#13100d] p-6 text-center text-[#f4ede4] shadow-[0_0_60px_rgba(225,29,72,0.22)] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow hiệu ứng cảnh báo phía trên */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-rose-500/15 blur-2xl pointer-events-none rounded-full" />

        {/* Biểu tượng cảnh báo nghiêm ngặt */}
        <div className="relative mx-auto inline-flex items-center justify-center">
          <div className="h-16 w-16 rounded-2xl bg-rose-950/70 border border-rose-500/50 flex items-center justify-center text-rose-500 ring-8 ring-rose-950/30 shadow-[0_0_30px_rgba(244,63,94,0.3)] animate-pulse">
            <ShieldAlert className="h-8 w-8 text-rose-400 stroke-[2.2]" />
          </div>
        </div>

        {/* Tiêu đề Modal */}
        <h2
          id="banned-dialog-title"
          className="mt-4 font-serif text-2xl font-bold tracking-wide text-rose-500"
        >
          Tài khoản đã bị khóa
        </h2>
        <p className="mt-1 text-xs uppercase tracking-widest text-rose-300/70 font-mono">
          Quyền truy cập hệ thống đã bị đình chỉ
        </p>

        {/* Khung hiển thị lý do vi phạm */}
        <div
          id="banned-dialog-desc"
          className="mt-5 rounded-xl border border-rose-500/25 bg-rose-950/20 p-4 text-left"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            <span>Lý do xử lý:</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-rose-200/90 font-serif italic whitespace-pre-wrap">
            &ldquo;{banData.reason}&rdquo;
          </p>
          {formattedTime && (
            <p className="mt-2.5 text-[11px] text-rose-400/60 font-mono">
              Thời gian ghi nhận: {formattedTime}
            </p>
          )}
        </div>

        {/* Thông tin hỗ trợ & khiếu nại */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#221b16]/70 border border-[#3d2f25] p-3 text-left">
          <Mail className="h-4 w-4 text-amber-400/80 shrink-0 mt-0.5" />
          <div className="text-xs text-[#c9bcad] leading-relaxed">
            Nếu bạn cho rằng đây là một sự nhầm lẫn, vui lòng liên hệ Ban Quản
            trị qua hòm thư{" "}
            <a
              href="mailto:support@virtualstudyroom.com"
              className="font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200"
            >
              support@virtualstudyroom.com
            </a>{" "}
            để được hỗ trợ kiểm tra và giải quyết.
          </div>
        </div>

        {/* Nút hành động duy nhất: Đăng xuất */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-950/60 hover:from-rose-600 hover:to-rose-500 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <LogOut className="h-4 w-4" />
            <span>
              {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất tài khoản"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default BannedAccountModal;
