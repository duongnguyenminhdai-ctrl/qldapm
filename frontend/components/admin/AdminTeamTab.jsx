"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldPlus,
  KeyRound,
  X,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CreateAdminModal } from "@/components/admin/modals/CreateAdminModal";
import { ChangeAdminPasswordModal } from "@/components/admin/modals/ChangeAdminPasswordModal";

export function AdminTeamTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAdminForPassword, setSelectedAdminForPassword] =
    useState(null);
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAdmins({ page, limit: 10 });
      if (res?.data?.admins) {
        setAdmins(res.data.admins);
      }
      const pageMeta = res?.data?.pagination || res?.pagination;
      if (pageMeta) {
        setPagination(pageMeta);
      }
    } catch (err) {
      console.warn("Lỗi tải danh sách admin:", err);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Tạo admin mới
  const handleCreateAdmin = async (formData) => {
    await adminApi.createAdmin(formData);
    setFeedback({
      message: `Đã tạo tài khoản quản trị viên ${formData.email} thành công.`,
      type: "success",
    });
    fetchAdmins();
  };

  // Đổi mật khẩu admin
  const handleChangePassword = async (adminId, newPassword) => {
    await adminApi.changeAdminPassword(adminId, newPassword);
    setFeedback({
      message: "Đổi mật khẩu quản trị viên thành công.",
      type: "success",
    });
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
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

      {/* Header action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-4 shadow-sm">
        <div>
          <h3 className="text-sm font-serif font-semibold text-[#2D241E] dark:text-[#f5ede3]">
            Danh sách Ban Quản trị
          </h3>
          <p className="text-xs text-[#615247] dark:text-[#a89b8d] mt-0.5">
            Các tài khoản có đặc quyền quản trị viên cao nhất trên toàn hệ thống
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-stone-900 dark:bg-[#c3a47b] dark:text-[#161311] dark:hover:bg-[#d6b88f] transition shadow-xs shrink-0"
        >
          <ShieldPlus className="h-3.5 w-3.5" />
          <span>Thêm Quản trị viên</span>
        </button>
      </div>

      {/* Table Quản trị viên */}
      <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-amber-100/60 dark:bg-[#181513]/70 text-[#615247] dark:text-[#a89b8d] border-b border-amber-200/60 dark:border-[#3a3128] font-serif font-medium">
              <tr>
                <th className="px-4 py-3">Quản trị viên</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ngày khởi tạo</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100 dark:divide-[#3a3128]/50 text-[#3E3228] dark:text-[#d8c8b4]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#8C7E72] dark:text-[#a89b8d]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-[#c3a47b]" />
                      <span>Đang tải danh sách...</span>
                    </div>
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#8C7E72] dark:text-[#75695e] font-serif">
                    Chưa có tài khoản quản trị viên nào.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => {
                  const dateStr = adm.createdAt
                    ? new Date(adm.createdAt).toLocaleDateString("vi-VN")
                    : "-";
                  return (
                    <tr
                      key={adm._id || adm.id}
                      className="hover:bg-amber-50/70 dark:hover:bg-[#29231f]/60 transition-colors duration-150"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {adm.avatar ? (
                            <img
                              src={adm.avatar}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover border border-amber-300 dark:border-[#c3a47b]/40"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-[#181513] text-amber-900 dark:text-[#e8cca4] font-serif font-bold text-[10px] border border-amber-300 dark:border-[#c3a47b]/30">
                              {adm.name?.slice(0, 1)?.toUpperCase() || "A"}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-[#2D241E] dark:text-[#f5ede3] flex items-center gap-1.5">
                              <span>{adm.name}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-[#c3a47b]/20 text-amber-900 dark:text-[#e8cca4] border border-amber-300 dark:border-[#c3a47b]/35">
                                ROOT
                              </span>
                            </div>
                            <div className="text-[11px] text-[#8C7E72] dark:text-[#75695e] font-mono">
                              {adm.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100/70 dark:bg-[#c3a47b]/20 text-amber-900 dark:text-[#e8cca4] border border-amber-300 dark:border-[#c3a47b]/40">
                          <Shield className="h-3 w-3 text-amber-600 dark:text-[#c3a47b]" />
                          ADMIN
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3" />
                          Hoạt động
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-[#8C7E72] dark:text-[#75695e]">
                        {dateStr}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedAdminForPassword(adm)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-amber-200/80 dark:border-[#3a3128] bg-amber-50/60 dark:bg-[#181513] text-[#615247] dark:text-[#d8c8b4] hover:bg-amber-100 dark:hover:bg-[#29231f] hover:text-[#2D241E] dark:hover:text-[#f5ede3] hover:border-amber-300 dark:hover:border-[#c3a47b]/40 transition shadow-xs"
                        >
                          <KeyRound className="h-3 w-3 text-amber-600 dark:text-[#c3a47b]" />
                          <span>Đổi mật khẩu</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang đồng bộ giao diện VNPay */}
        <div className="p-4 border-t border-amber-200/60 dark:border-[#3a3128] bg-amber-50/40 dark:bg-[#181513]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-stone-500 dark:text-[#75695e]">
            {pagination.totalItems > 0 ? (
              <span>
                Hiển thị{" "}
                <span className="font-semibold text-[#2D241E] dark:text-[#f5ede3]">
                  {(pagination.currentPage - 1) * pagination.limit + 1}
                </span>{" "}
                -{" "}
                <span className="font-semibold text-[#2D241E] dark:text-[#f5ede3]">
                  {Math.min(
                    pagination.currentPage * pagination.limit,
                    pagination.totalItems
                  )}
                </span>{" "}
                trên tổng số{" "}
                <span className="font-semibold text-[#2D241E] dark:text-[#f5ede3]">
                  {pagination.totalItems}
                </span>{" "}
                quản trị viên
              </span>
            ) : (
              <span>Không có bản ghi</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={!pagination.hasPrevPage || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-amber-200/80 dark:border-[#3a3128] bg-white dark:bg-[#1c1815] text-[#2D241E] dark:text-[#f5ede3] hover:bg-amber-100/60 dark:hover:bg-[#25201c] disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Trang trước</span>
            </button>

            <span className="px-2 py-1 text-xs font-mono font-medium text-amber-800 dark:text-[#e8cca4]">
              {pagination.currentPage} / {pagination.totalPages}
            </span>

            <button
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!pagination.hasNextPage || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-amber-200/80 dark:border-[#3a3128] bg-white dark:bg-[#1c1815] text-[#2D241E] dark:text-[#f5ede3] hover:bg-amber-100/60 dark:hover:bg-[#25201c] disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium"
            >
              <span>Trang sau</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Tạo Admin mới */}
      <CreateAdminModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateAdmin}
      />

      {/* Modal Đổi mật khẩu Admin */}
      <ChangeAdminPasswordModal
        isOpen={Boolean(selectedAdminForPassword)}
        onClose={() => setSelectedAdminForPassword(null)}
        admin={selectedAdminForPassword}
        onChangePassword={handleChangePassword}
      />
    </div>
  );
}

export default AdminTeamTab;
