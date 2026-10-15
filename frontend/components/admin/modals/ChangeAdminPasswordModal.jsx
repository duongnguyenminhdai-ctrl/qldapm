"use client";

import { useState } from "react";
import { X, KeyRound, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChangeAdminPasswordModal({
  isOpen,
  onClose,
  adminUser,
  onSave,
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !adminUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu không trùng khớp.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onSave(adminUser._id || adminUser.id, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err) {
      setError(err?.message || "Không thể đổi mật khẩu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Đổi mật khẩu Admin
              </h3>
              <p className="text-xs text-zinc-500 font-mono">
                {adminUser.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-300">
              Mật khẩu mới
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 pl-2.5 pr-8 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300">
              Xác nhận mật khẩu mới
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 font-mono"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-medium"
            >
              {isSubmitting ? "Đang đổi..." : "Cập nhật mật khẩu"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
