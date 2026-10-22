"use client";

import { useState } from "react";
import { X, ShieldPlus, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateAdminModal({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setError("Vui lòng nhập họ tên và email.");
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setError("Mật khẩu khởi tạo phải có ít nhất 6 ký tự.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onSave(formData);
      setFormData({ name: "", email: "", password: "" });
      onClose();
    } catch (err) {
      setError(err?.message || "Không thể tạo tài khoản quản trị viên.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-md rounded-2xl border border-[#c3a47b]/30 bg-[#161311] p-6 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#c3a47b]/15">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c3a47b]/10 border border-[#c3a47b]/25 text-[#c3a47b]">
              <ShieldPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f5eedb]">
                Thêm Quản trị viên mới
              </h3>
              <p className="text-xs text-stone-400">
                Cấp quyền Quản trị (ADMIN) cho thành viên
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
              Họ và tên
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Nguyễn Văn A"
              className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2.5 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-300">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="admin@studyroom.vn"
              className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2.5 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-300">
              Mật khẩu khởi tạo
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
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
              {isSubmitting ? "Đang tạo..." : "Khởi tạo Admin"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
