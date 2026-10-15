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
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ServiceModal } from "@/components/admin/modals/ServiceModal";

export function AdminServicesTab() {
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
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA gói dịch vụ "${pkg.name}"?`)) {
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
          className={`flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs transition ${
            feedback.type === "error"
              ? "border border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback({ message: "", type: "" })}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar: Tìm kiếm, Bộ lọc & Nút Thêm mới */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc mã gói..."
            className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="true">Đang mở bán</option>
            <option value="false">Đã ẩn</option>
          </select>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => {
            setSelectedPkg(null);
            setIsModalOpen(true);
          }}
          className="h-8 gap-1.5 text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Thêm gói mới</span>
        </Button>
      </div>

      {/* Grid danh sách gói dịch vụ */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 animate-pulse"
            />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 py-16 text-center text-zinc-500 text-xs">
          Chưa có gói dịch vụ nào. Hãy bấm &quot;Thêm gói mới&quot; để cấu hình gói VIP/Pro đầu tiên.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => {
            const isActing = actionLoadingId === (pkg._id || pkg.id);
            return (
              <div
                key={pkg._id || pkg.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition ${
                  pkg.isActive
                    ? "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80"
                    : "border-zinc-800/40 bg-zinc-950/40 opacity-70"
                }`}
              >
                <div>
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 font-semibold">
                      {pkg.code}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {pkg.isPopular && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Crown className="h-3 w-3" />
                          Phổ biến
                        </span>
                      )}
                      {pkg.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Đang bán
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-500 border border-zinc-700/40">
                          Đã ẩn
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Price */}
                  <div className="mt-3">
                    <h4 className="text-base font-semibold text-zinc-100">
                      {pkg.name}
                    </h4>
                    {pkg.description && (
                      <p className="mt-1 text-xs text-zinc-400">
                        {pkg.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold font-mono text-zinc-50">
                        {formatVnd(pkg.amount)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        / {pkg.days} ngày
                      </span>
                    </div>
                  </div>

                  {/* Feature list */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/60 space-y-2">
                    {Array.isArray(pkg.features) && pkg.features.length > 0 ? (
                      pkg.features.map((feat, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-xs text-zinc-300"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-zinc-500 italic">
                        Chưa cấu hình mô tả tính năng.
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-6 pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {/* Toggle Ẩn / Hiện */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(pkg)}
                      disabled={isActing}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
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
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-rose-950/50 hover:text-rose-400 hover:border-rose-900/50 transition"
                      title="Xóa gói dịch vụ"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Sửa thông tin */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPkg(pkg);
                      setIsModalOpen(true);
                    }}
                    className="h-8 gap-1 text-xs border-zinc-800 hover:bg-zinc-800"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Chỉnh sửa</span>
                  </Button>
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
