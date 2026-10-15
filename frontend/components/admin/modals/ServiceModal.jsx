"use client";

import { useState, useEffect } from "react";
import { X, Package, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ServiceModal({ isOpen, onClose, pkg, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    amount: 99000,
    days: 30,
    featuresText: "",
    isActive: true,
    isPopular: false,
    order: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(pkg);

  useEffect(() => {
    if (pkg) {
      setFormData({
        name: pkg.name || "",
        code: pkg.code || "",
        description: pkg.description || "",
        amount: pkg.amount || 99000,
        days: pkg.days || 30,
        featuresText: Array.isArray(pkg.features)
          ? pkg.features.join("\n")
          : "",
        isActive: pkg.isActive !== undefined ? pkg.isActive : true,
        isPopular: Boolean(pkg.isPopular),
        order: pkg.order || 0,
      });
      setError("");
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        amount: 99000,
        days: 30,
        featuresText:
          "Chép lời cuộc họp (Live Transcription)\nHuy hiệu VIP trong phòng học\nMở khóa danh hiệu VIP",
        isActive: true,
        isPopular: false,
        order: 0,
      });
      setError("");
    }
  }, [pkg, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setError("Vui lòng điền tên gói và mã gói dịch vụ.");
      return;
    }

    if (Number(formData.amount) < 0 || Number(formData.days) <= 0) {
      setError("Giá tiền không được âm và thời hạn phải lớn hơn 0 ngày.");
      return;
    }

    const features = formData.featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    setError("");

    try {
      await onSave({
        ...formData,
        amount: Number(formData.amount),
        days: Number(formData.days),
        order: Number(formData.order),
        features,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Không thể lưu gói dịch vụ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {isEdit ? "Chỉnh sửa gói dịch vụ" : "Thêm mới gói dịch vụ"}
              </h3>
              <p className="text-xs text-zinc-500">
                {isEdit
                  ? `Mã gói: ${pkg.code}`
                  : "Cấu hình gói VIP/Pro cho nền tảng"}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-300">
                Tên gói dịch vụ
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Gói Pro 1 Tháng..."
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300">
                Mã gói (Code)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="PRO_1M"
                disabled={isEdit}
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-300">
                Giá tiền (VNĐ)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300">
                Thời hạn (Ngày)
              </label>
              <input
                type="number"
                min="1"
                value={formData.days}
                onChange={(e) =>
                  setFormData({ ...formData, days: e.target.value })
                }
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300">
                Thứ tự sắp xếp
              </label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) =>
                  setFormData({ ...formData, order: e.target.value })
                }
                className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300">
              Mô tả ngắn
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Gói tiết kiệm phù hợp cho ôn thi..."
              className="mt-1 h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300">
              Danh sách tính năng (Mỗi dòng 1 tính năng)
            </label>
            <textarea
              rows={3}
              value={formData.featuresText}
              onChange={(e) =>
                setFormData({ ...formData, featuresText: e.target.value })
              }
              placeholder="Chép lời cuộc họp realtime&#10;Huy hiệu VIP phòng học&#10;Hỗ trợ 24/7"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 p-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none font-mono"
            />
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-zinc-100"
              />
              <span>Đang mở bán (Hiển thị)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={formData.isPopular}
                onChange={(e) =>
                  setFormData({ ...formData, isPopular: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-zinc-100"
              />
              <span>Gắn huy hiệu Phổ biến nhất (Popular)</span>
            </label>
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
              {isSubmitting
                ? "Đang lưu..."
                : isEdit
                ? "Lưu thay đổi"
                : "Tạo gói mới"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
