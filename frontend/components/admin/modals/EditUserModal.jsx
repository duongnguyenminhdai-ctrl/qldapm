"use client";

import { useState, useEffect } from "react";
import { X, Shield, User, Crown, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditUserModal({ isOpen, onClose, user, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    role: "USER",
    status: "ACTIVE",
    isPro: false,
    phone: "",
    school: "",
    bio: "",
    equippedTitle: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        role: user.role || "USER",
        status: user.status || "ACTIVE",
        isPro: Boolean(user.isPro),
        phone: user.phone || "",
        school: user.school || "",
        bio: user.bio || "",
        equippedTitle: user.equippedTitle || user.title || "",
      });
      setError("");
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Họ tên không được để trống.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onSave(user._id || user.id, formData);
      onClose();
    } catch (err) {
      setError(err?.message || "Không thể cập nhật người dùng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Chỉnh sửa tài khoản
              </h3>
              <p className="text-xs text-zinc-500 font-mono">{user.email}</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-300">
                Họ và tên
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300">
                Số điện thoại
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="0987654321"
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-300">
                Vai trò (Role)
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
              >
                <option value="USER">USER (Học viên)</option>
                <option value="ADMIN">ADMIN (Quản trị)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300">
                Trạng thái
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
              >
                <option value="ACTIVE">ACTIVE (Hoạt động)</option>
                <option value="BLOCKED">BLOCKED (Đã khóa)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300">
                Cấp VIP/Pro
              </label>
              <select
                value={formData.isPro ? "true" : "false"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    isPro: e.target.value === "true",
                  })
                }
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
              >
                <option value="false">Tài khoản thường</option>
                <option value="true">Gói VIP Pro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300">
              Trường học / Nơi làm việc
            </label>
            <input
              type="text"
              value={formData.school}
              onChange={(e) =>
                setFormData({ ...formData, school: e.target.value })
              }
              placeholder="Đại học Bách Khoa, THPT..."
              className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300">
              Tiểu sử (Bio)
            </label>
            <textarea
              rows={2}
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              placeholder="Giới thiệu bản thân..."
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 p-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none"
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
              {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
