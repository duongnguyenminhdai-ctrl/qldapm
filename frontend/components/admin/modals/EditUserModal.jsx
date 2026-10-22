"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Shield, User, Crown, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditUserModal({ isOpen, onClose, user, onSave }) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "USER",
    status: "ACTIVE",
    reason: "",
    isPro: false,
    phone: "",
    school: "",
    bio: "",
    equippedTitle: "",
    streak: 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        role: user.role || "USER",
        status: user.status || "ACTIVE",
        reason: user.banReason || "",
        isPro: Boolean(user.isPro),
        phone: user.phone || "",
        school: user.school || "",
        bio: user.bio || "",
        equippedTitle: user.equippedTitle || user.title || "",
        streak: typeof user.streak === "number" ? user.streak : 1,
      });
      setError("");
    }
  }, [user]);

  if (!isOpen || !user || !mounted) return null;

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

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#c3a47b]/30 bg-[#161311] p-6 shadow-2xl shadow-black/60 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#c3a47b]/15">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c3a47b]/10 border border-[#c3a47b]/25 text-[#c3a47b]">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f5eedb]">
                Chỉnh sửa tài khoản
              </h3>
              <p className="text-xs text-stone-400 font-mono">{user.email}</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2.5 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-300">
                Số điện thoại
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="0987654321"
                className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2.5 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-300">
                Vai trò (Role)
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40 cursor-pointer"
              >
                <option value="USER" className="bg-[#1c1815] text-[#f5eedb]">USER (Học viên)</option>
                <option value="ADMIN" className="bg-[#1c1815] text-[#f5eedb]">ADMIN (Quản trị)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-300">
                Trạng thái
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40 cursor-pointer"
              >
                <option value="ACTIVE" className="bg-[#1c1815] text-[#f5eedb]">ACTIVE (Hoạt động)</option>
                <option value="BLOCKED" className="bg-[#1c1815] text-[#f5eedb]">BLOCKED (Đã khóa)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-300">
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
                className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40 cursor-pointer"
              >
                <option value="false" className="bg-[#1c1815] text-[#f5eedb]">Tài khoản thường</option>
                <option value="true" className="bg-[#1c1815] text-[#f5eedb]">Gói VIP Pro</option>
              </select>
            </div>

            {formData.status === "BLOCKED" && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-rose-300">
                  Lý do khóa tài khoản (hiển thị trực tiếp cho người dùng)
                </label>
                <input
                  type="text"
                  placeholder="Nhập lý do khóa..."
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  className="mt-1 h-8 w-full rounded-lg border border-rose-500/35 bg-[#1c1815] px-2.5 text-xs text-rose-200 placeholder:text-rose-400/40 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-500/40"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-300">
                Chuỗi ngày học (Streak)
              </label>
              <input
                type="number"
                min="0"
                value={formData.streak}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    streak: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2.5 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-300">
                Danh hiệu hiển thị
              </label>
              <input
                type="text"
                value={formData.equippedTitle}
                onChange={(e) =>
                  setFormData({ ...formData, equippedTitle: e.target.value })
                }
                placeholder="Nhập môn học giả, Thiếu úy..."
                className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2.5 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-300">
              Trường học / Nơi làm việc
            </label>
            <input
              type="text"
              value={formData.school}
              onChange={(e) =>
                setFormData({ ...formData, school: e.target.value })
              }
              placeholder="Đại học Bách Khoa, THPT..."
              className="mt-1 h-8 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] px-2.5 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-300">
              Tiểu sử (Bio)
            </label>
            <textarea
              rows={2}
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              placeholder="Giới thiệu bản thân..."
              className="mt-1 w-full rounded-lg border border-[#c3a47b]/25 bg-[#1c1815] p-2 text-xs text-[#f5eedb] focus:outline-none focus:border-[#c3a47b]/60 focus:ring-1 focus:ring-[#c3a47b]/40 resize-none"
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
              {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
