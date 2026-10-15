"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  X,
  Lock,
  Unlock,
  Edit2,
  Crown,
  Shield,
  User,
  AlertCircle,
  Loader2,
  Flame,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { EditUserModal } from "@/components/admin/modals/EditUserModal";

export function AdminUsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [proFilter, setProFilter] = useState("ALL");
  const [sort, setSort] = useState("createdAt_desc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10,
  });

  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({
        page,
        limit: 10,
        search: debouncedSearch,
        role: roleFilter,
        status: statusFilter,
        isPro: proFilter,
        sort,
      });

      if (res?.data?.users) {
        setUsers(res.data.users);
      }
      const pageMeta = res?.data?.pagination || res?.pagination;
      if (pageMeta) {
        setPagination(pageMeta);
      }
    } catch (err) {
      console.warn("Lỗi tải danh sách người dùng:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter, statusFilter, proFilter, sort]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Toggle Khóa / Mở khóa người dùng
  const handleToggleLock = async (user) => {
    const isBlocking = user.status === "ACTIVE";
    const confirmMsg = isBlocking
      ? `Bạn có chắc chắn muốn KHÓA tài khoản ${user.name} (${user.email})? Người dùng sẽ bị chặn đăng nhập và thao tác.`
      : `Bạn có muốn MỞ KHÓA tài khoản ${user.name} (${user.email})?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(user._id || user.id);
    try {
      const res = await adminApi.deleteUser(user._id || user.id);
      setFeedback({
        message: res.message || "Thao tác thành công.",
        type: "success",
      });
      fetchUsers();
    } catch (err) {
      setFeedback({
        message: err?.message || "Không thể thay đổi trạng thái tài khoản.",
        type: "error",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cập nhật người dùng sau khi lưu từ modal
  const handleSaveUser = async (id, data) => {
    await adminApi.updateUser(id, data);
    setFeedback({
      message: "Cập nhật thông tin tài khoản thành công.",
      type: "success",
    });
    fetchUsers();
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

      {/* Toolbar: Tìm kiếm, Lọc vai trò, Lọc trạng thái, Sắp xếp */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
        {/* Tìm kiếm */}
        <div className="relative flex-1 max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-8 pr-7 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc Role */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="USER">Học viên (USER)</option>
            <option value="ADMIN">Quản trị (ADMIN)</option>
          </select>

          {/* Lọc Status */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="BLOCKED">Bị khóa</option>
          </select>

          {/* Lọc VIP */}
          <select
            value={proFilter}
            onChange={(e) => {
              setProFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
          >
            <option value="ALL">Tất cả loại gói</option>
            <option value="true">Gói VIP Pro</option>
            <option value="false">Tài khoản thường</option>
          </select>

          {/* Sắp xếp */}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
          >
            <option value="createdAt_desc">Mới nhất</option>
            <option value="createdAt_asc">Cũ nhất</option>
            <option value="name_asc">Tên A-Z</option>
            <option value="streak_desc">Streak cao nhất</option>
          </select>
        </div>
      </div>

      {/* Bảng Danh sách Người dùng */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800/80 font-medium">
              <tr>
                <th className="px-4 py-3">Người dùng</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Gói Pro</th>
                <th className="px-4 py-3">Streak</th>
                <th className="px-4 py-3">Ngày đăng ký</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang tải danh sách người dùng...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    Không tìm thấy người dùng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isBlocked = u.status === "BLOCKED";
                  const isAdmin = u.role === "ADMIN";
                  const isPro = Boolean(u.isPro);
                  const isCurrentAction = actionLoadingId === (u._id || u.id);

                  return (
                    <tr
                      key={u._id || u.id}
                      className="hover:bg-zinc-800/30 transition group"
                    >
                      {/* Người dùng */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover border border-zinc-700/60"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 font-semibold text-[10px]">
                              {u.name?.slice(0, 1)?.toUpperCase() || "U"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-200 truncate">
                              {u.name}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vai trò */}
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <Shield className="h-3 w-3" />
                            ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                            <User className="h-3 w-3" />
                            USER
                          </span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <Lock className="h-3 w-3" />
                            Đã khóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Unlock className="h-3 w-3" />
                            Hoạt động
                          </span>
                        )}
                      </td>

                      {/* Gói Pro */}
                      <td className="px-4 py-3">
                        {isPro ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Crown className="h-3 w-3" />
                            VIP
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">
                            Thường
                          </span>
                        )}
                      </td>

                      {/* Streak */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-mono text-zinc-400">
                          <Flame className="h-3 w-3 text-amber-500" />
                          {u.streak || 0}
                        </span>
                      </td>

                      {/* Ngày đăng ký */}
                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString("vi-VN")
                          : "-"}
                      </td>

                      {/* Thao tác */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Xem / Sửa */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setIsEditModalOpen(true);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Nút Khóa / Mở khóa */}
                          <button
                            type="button"
                            onClick={() => handleToggleLock(u)}
                            disabled={isCurrentAction}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                              isBlocked
                                ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/50"
                                : "border-rose-800/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50"
                            }`}
                            title={isBlocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                          >
                            {isCurrentAction ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isBlocked ? (
                              <Unlock className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="border-t border-zinc-800/80 px-4 py-3 bg-zinc-950/40">
          <PaginationControl
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            limit={pagination.limit}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </div>

      {/* Modal Chỉnh sửa User */}
      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onSave={handleSaveUser}
      />
    </div>
  );
}
