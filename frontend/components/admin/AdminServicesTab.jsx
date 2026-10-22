"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Crown,
  Calendar,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ServiceModal } from "@/components/admin/modals/ServiceModal";
import { useConfirm } from "@/context/ConfirmContext";

export function AdminServicesTab() {
  const confirm = useConfirm();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const [selectedPkg, setSelectedPkg] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", type: "" });
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getServices({
        search,
        isActive: activeFilter,
      });
      if (res?.data?.packages) {
        setPackages(res.data.packages);
      }
    } catch (err) {
      console.warn("Lỗi tải danh sách gói dịch vụ:", err);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Tạo hoặc cập nhật gói
  const handleSavePackage = async (formData) => {
    if (selectedPkg) {
      await adminApi.updateService(selectedPkg._id || selectedPkg.id, formData);
      setFeedback({
        message: "Cập nhật gói dịch vụ thành công.",
        type: "success",
      });
    } else {
      await adminApi.createService(formData);
      setFeedback({
        message: "Thêm mới gói dịch vụ thành công.",
        type: "success",
      });
    }
    fetchPackages();
  };

  // Toggle Ẩn / Hiện gói
  const handleToggleActive = async (pkg) => {
    setActionLoadingId(pkg._id || pkg.id);
    try {
      await adminApi.updateService(pkg._id || pkg.id, {
        isActive: !pkg.isActive,
      });
      setFeedback({
        message: `Đã ${!pkg.isActive ? "hiện" : "ẩn"} gói ${pkg.name}.`,
        type: "success",
      });
      fetchPackages();
    } catch (err) {
      setFeedback({
        message: err?.message || "Không thể cập nhật trạng thái gói.",
        type: "error",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Xóa gói
  const handleDeletePackage = async (pkg) => {
    const isConfirmed = await confirm({
      title: "Xóa gói dịch vụ",
      message: `Bạn có chắc chắn muốn XÓA gói dịch vụ "${pkg.name}" không? Thao tác này không thể hoàn tác.`,
      confirmText: "Xóa gói",
      cancelText: "Hủy bỏ",
      variant: "danger",
      icon: "trash",
    });
    if (!isConfirmed) {
      return;
    }
    setActionLoadingId(pkg._id || pkg.id);
    try {
      await adminApi.deleteService(pkg._id || pkg.id);
      setFeedback({
        message: "Đã xóa gói dịch vụ thành công.",
        type: "success",
      });
      fetchPackages();
    } catch (err) {
      setFeedback({
        message: err?.message || "Không thể xóa gói dịch vụ.",
        type: "error",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatVnd = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Feedback Toast */}
      {feedback.message && (
        <div
          className={`flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs transition border ${
            feedback.type === "error"
              ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback({ message: "", type: "" })}
            className="text-[#a89b8d] hover:text-[#f5ede3]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar: Tìm kiếm, Bộ lọc & Nút Thêm mới */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-3.5 shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc mã gói..."
            className="h-8 w-full rounded-xl border border-amber-200/70 dark:border-[#3a3128] bg-amber-50/50 dark:bg-[#181513] px-3 text-xs text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:outline-none focus:border-amber-500 dark:focus:border-[#c3a47b] transition"
          />
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="h-8 rounded-xl border border-amber-200/70 dark:border-[#3a3128] bg-amber-50/50 dark:bg-[#181513] px-2.5 text-xs text-[#2D241E] dark:text-[#d8c8b4] focus:outline-none focus:border-amber-500 dark:focus:border-[#c3a47b] transition cursor-pointer shrink-0"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="true">Đang mở bán</option>
            <option value="false">Đã ẩn</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedPkg(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-stone-900 dark:bg-[#c3a47b] dark:text-[#161311] dark:hover:bg-[#d6b88f] transition shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Thêm gói mới</span>
        </button>
      </div>

      {/* Grid danh sách gói dịch vụ */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-amber-200/50 dark:border-[#c3a47b]/20 bg-amber-50/50 dark:bg-[#201b18]/60 animate-pulse"
            />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 py-16 text-center text-[#8C7E72] dark:text-[#75695e] text-xs font-serif">
          Chưa có gói dịch vụ nào. Hãy bấm &quot;Thêm gói mới&quot; để cấu hình gói VIP/Pro đầu tiên.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => {
            const isActing = actionLoadingId === (pkg._id || pkg.id);
            return (
              <div
                key={pkg._id || pkg.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 backdrop-blur-md shadow-sm ${
                  pkg.isActive
                    ? "border-amber-200/70 dark:border-[#c3a47b]/30 bg-white/85 dark:bg-[#201b18]/85 hover:border-amber-400 dark:hover:border-[#c3a47b]/60 hover:shadow-md"
                    : "border-stone-200 dark:border-[#3a3128]/50 bg-stone-100/60 dark:bg-[#181513]/60 opacity-70"
                }`}
              >
                <div>
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-md bg-amber-100/70 dark:bg-[#181513] text-amber-900 dark:text-[#e8cca4] border border-amber-300/60 dark:border-[#c3a47b]/30 font-semibold">
                      {pkg.code}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {pkg.isPopular && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <Crown className="h-3 w-3" />
                          Phổ biến
                        </span>
                      )}
                      {pkg.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          Đang bán
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 dark:bg-[#181513] text-stone-500 dark:text-[#75695e] border border-stone-300 dark:border-[#3a3128]">
                          Đã ẩn
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Price */}
                  <div className="mt-3">
                    <h4 className="text-base font-serif font-semibold text-[#2D241E] dark:text-[#f5ede3]">
                      {pkg.name}
                    </h4>
                    {pkg.description && (
                      <p className="mt-1 text-xs text-[#615247] dark:text-[#a89b8d] line-clamp-2">
                        {pkg.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-2xl font-serif font-bold text-amber-700 dark:text-amber-300">
                        {formatVnd(pkg.amount)}
                      </span>
                      <span className="text-xs text-[#8C7E72] dark:text-[#75695e]">
                        / {pkg.days} ngày
                      </span>
                    </div>
                  </div>

                  {/* Feature list */}
                  <div className="mt-4 pt-3 border-t border-amber-100 dark:border-[#3a3128]/70 space-y-2">
                    {Array.isArray(pkg.features) && pkg.features.length > 0 ? (
                      pkg.features.map((feat, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-xs text-[#3E3228] dark:text-[#d8c8b4]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 dark:text-[#c3a47b] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-[#8C7E72] dark:text-[#75695e] italic">
                        Chưa cấu hình mô tả tính năng.
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-6 pt-3 border-t border-amber-100 dark:border-[#3a3128]/70 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {/* Toggle Ẩn / Hiện */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(pkg)}
                      disabled={isActing}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200/80 dark:border-[#3a3128] bg-amber-50/60 dark:bg-[#181513] text-[#615247] dark:text-[#a89b8d] hover:bg-amber-100 dark:hover:bg-[#29231f] hover:text-[#2D241E] dark:hover:text-[#f5ede3] hover:border-amber-300 dark:hover:border-[#c3a47b]/40 transition"
                      title={pkg.isActive ? "Ẩn gói này" : "Mở bán lại"}
                    >
                      {pkg.isActive ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Xóa gói */}
                    <button
                      type="button"
                      onClick={() => handleDeletePackage(pkg)}
                      disabled={isActing}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 dark:border-[#3a3128] bg-rose-50/60 dark:bg-[#181513] text-rose-600 dark:text-[#a89b8d] hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-900/50 transition"
                      title="Xóa gói dịch vụ"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Sửa thông tin */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPkg(pkg);
                      setIsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300/80 dark:border-[#c3a47b]/40 bg-amber-100/80 dark:bg-[#c3a47b]/15 text-amber-900 dark:text-[#e8cca4] hover:bg-amber-500 hover:text-white dark:hover:bg-[#c3a47b] dark:hover:text-[#161311] transition shadow-xs"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Chỉnh sửa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Thêm / Sửa Gói */}
      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPkg(null);
        }}
        pkg={selectedPkg}
        onSave={handleSavePackage}
      />
    </div>
  );
}

export default AdminServicesTab;
