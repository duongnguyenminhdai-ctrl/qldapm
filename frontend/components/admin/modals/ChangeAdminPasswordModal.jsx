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
      <div className="relative w-full max-w-sm rounded-2xl border border-[#c3a47b]/30 bg-[#161311] p-6 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#c3a47b]/15">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c3a47b]/10 border border-[#c3a47b]/25 text-[#c3a47b]">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f5eedb]">
                Đổi mật khẩu Admin
              </h3>
              <p className="text-xs text-stone-400 font-mono">
                {adminUser.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-[#201b17] hover:text-[#f5eedb] transition"
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
            <label className="text-xs font-medium text-stone-300">
              Mật khẩu mới
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] pl-2.5 pr-8 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#f5eedb]"
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
            <label className="text-xs font-medium text-stone-300">
              Xác nhận mật khẩu mới
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2.5 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40 font-mono"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#c3a47b]/15">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs text-stone-400 hover:text-stone-200 hover:bg-[#201b17]"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-semibold bg-gradient-to-r from-[#c3a47b] to-[#a0825b] hover:from-[#d6b78e] hover:to-[#b3936a] text-black shadow-md shadow-[#c3a47b]/10"
            >
              {isSubmitting ? "Đang đổi..." : "Cập nhật mật khẩu"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
