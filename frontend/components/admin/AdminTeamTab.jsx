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
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CreateAdminModal } from "@/components/admin/modals/CreateAdminModal";
import { ChangeAdminPasswordModal } from "@/components/admin/modals/ChangeAdminPasswordModal";

export function AdminTeamTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAdminForPassword, setSelectedAdminForPassword] =
    useState(null);
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAdmins();
      if (res?.data?.admins) {
        setAdmins(res.data.admins);
      }
    } catch (err) {
      console.warn("Lỗi tải danh sách admin:", err);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

      {/* Header action */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            Danh sách Ban Quản trị
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Các tài khoản có đặc quyền quản trị viên cao nhất trên toàn hệ thống
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          className="h-8 gap-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white"
        >
          <ShieldPlus className="h-3.5 w-3.5" />
          <span>Thêm Quản trị viên</span>
        </Button>
      </div>

      {/* Table Quản trị viên */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800/80 font-medium">
              <tr>
                <th className="px-4 py-3">Quản trị viên</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Ngày khởi tạo</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang tải danh sách...</span>
                    </div>
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
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
                      className="hover:bg-zinc-800/30 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {adm.avatar ? (
                            <img
                              src={adm.avatar}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover border border-purple-500/40"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-950/80 text-purple-300 font-semibold text-[10px] border border-purple-800/50">
                              {adm.name?.slice(0, 1)?.toUpperCase() || "A"}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-zinc-100 flex items-center gap-1.5">
                              <span>{adm.name}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                ROOT
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono">
                              {adm.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <Shield className="h-3 w-3" />
                          ADMIN
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          Hoạt động
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                        {dateStr}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedAdminForPassword(adm)}
                          className="h-7 gap-1.5 text-[11px] border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                        >
                          <KeyRound className="h-3 w-3" />
                          <span>Đổi mật khẩu</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tạo Admin */}
      <CreateAdminModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateAdmin}
      />

      {/* Modal Đổi mật khẩu Admin */}
      <ChangeAdminPasswordModal
        isOpen={Boolean(selectedAdminForPassword)}
        onClose={() => setSelectedAdminForPassword(null)}
        adminUser={selectedAdminForPassword}
        onSave={handleChangePassword}
      />
    </div>
  );
}
