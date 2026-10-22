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
  ChevronLeft,
  ChevronRight,
  Gift,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { EditUserModal } from "@/components/admin/modals/EditUserModal";
import { AdminGiftCardModal } from "@/components/admin/modals/AdminGiftCardModal";
import { useConfirm } from "@/context/ConfirmContext";

export function AdminUsersTab() {
  const confirm = useConfirm();
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
  const [giftUser, setGiftUser] = useState(null);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
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
    const isConfirmed = await confirm({
      title: isBlocking ? "Khóa tài khoản người dùng" : "Mở khóa tài khoản",
      message: isBlocking
        ? `Bạn có chắc chắn muốn KHÓA tài khoản ${user.name} (${user.email})? Người dùng sẽ bị cưỡng chế đăng xuất ngay lập tức và hiển thị thông báo khóa toàn màn hình.`
        : `Bạn có muốn MỞ KHÓA tài khoản ${user.name} (${user.email})?`,
      confirmText: isBlocking ? "Khóa tài khoản" : "Mở khóa",
      cancelText: "Hủy bỏ",
      variant: isBlocking ? "danger" : "warning",
      icon: isBlocking ? "lock" : "info",
    });

    if (!isConfirmed) return;

    setActionLoadingId(user._id || user.id);
    try {
      const res = await adminApi.deleteUser(user._id || user.id, {
        reason: "Tài khoản của bạn đã bị khóa do vi phạm tiêu chuẩn cộng đồng hoặc theo quyết định của Quản trị viên.",
      });
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

      {/* Toolbar: Tìm kiếm, Lọc vai trò, Lọc trạng thái, Sắp xếp */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-3.5 shadow-sm">
        {/* Tìm kiếm */}
        <div className="relative flex-1 max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C7E72] dark:text-[#a89b8d]"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="h-8 w-full rounded-xl border border-amber-200/70 dark:border-[#3a3128] bg-amber-50/50 dark:bg-[#181513] pl-8 pr-7 text-xs text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:outline-none focus:border-amber-500 dark:focus:border-[#c3a47b] transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8C7E72] dark:text-[#a89b8d] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
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
            className="h-8 rounded-xl border border-amber-200/70 dark:border-[#3a3128] bg-amber-50/50 dark:bg-[#181513] px-2.5 text-xs text-[#2D241E] dark:text-[#d8c8b4] focus:outline-none focus:border-amber-500 dark:focus:border-[#c3a47b] transition cursor-pointer"
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
            className="h-8 rounded-xl border border-amber-200/70 dark:border-[#3a3128] bg-amber-50/50 dark:bg-[#181513] px-2.5 text-xs text-[#2D241E] dark:text-[#d8c8b4] focus:outline-none focus:border-amber-500 dark:focus:border-[#c3a47b] transition cursor-pointer"
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
            className="h-8 rounded-xl border border-amber-200/70 dark:border-[#3a3128] bg-amber-50/50 dark:bg-[#181513] px-2.5 text-xs text-[#2D241E] dark:text-[#d8c8b4] focus:outline-none focus:border-amber-500 dark:focus:border-[#c3a47b] transition cursor-pointer"
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
            className="h-8 rounded-xl border border-amber-200/70 dark:border-[#3a3128] bg-amber-50/50 dark:bg-[#181513] px-2.5 text-xs text-[#2D241E] dark:text-[#d8c8b4] focus:outline-none focus:border-amber-500 dark:focus:border-[#c3a47b] transition cursor-pointer"
          >
            <option value="createdAt_desc">Mới nhất</option>
            <option value="createdAt_asc">Cũ nhất</option>
            <option value="name_asc">Tên A-Z</option>
            <option value="streak_desc">Streak cao nhất</option>
          </select>
        </div>
      </div>

      {/* Bảng Danh sách Người dùng */}
      <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-amber-100/60 dark:bg-[#181513]/70 text-[#615247] dark:text-[#a89b8d] border-b border-amber-200/60 dark:border-[#3a3128] font-medium font-serif">
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
            <tbody className="divide-y divide-amber-100 dark:divide-[#3a3128]/50 text-[#3E3228] dark:text-[#d8c8b4]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8C7E72] dark:text-[#a89b8d]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-[#c3a47b]" />
                      <span>Đang tải danh sách người dùng...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8C7E72] dark:text-[#75695e]">
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
                      className="hover:bg-amber-50/70 dark:hover:bg-[#29231f]/60 transition-colors duration-150 group"
                    >
                      {/* Người dùng */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover border border-amber-300 dark:border-[#c3a47b]/30"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-[#181513] border border-amber-200 dark:border-[#3a3128] text-amber-900 dark:text-[#c3a47b] font-serif font-bold text-[10px]">
                              {u.name?.slice(0, 1)?.toUpperCase() || "U"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-[#2D241E] dark:text-[#f5ede3] truncate">
                              {u.name}
                            </div>
                            <div className="text-[11px] text-[#8C7E72] dark:text-[#75695e] font-mono truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vai trò */}
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100/70 dark:bg-[#c3a47b]/20 text-amber-900 dark:text-[#e8cca4] border border-amber-300 dark:border-[#c3a47b]/40">
                            <Shield className="h-3 w-3" />
                            ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-[#181513] text-[#615247] dark:text-[#a89b8d] border border-amber-200 dark:border-[#3a3128]">
                            <User className="h-3 w-3" />
                            USER
                          </span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                            <Lock className="h-3 w-3" />
                            Đã khóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <Unlock className="h-3 w-3" />
                            Hoạt động
                          </span>
                        )}
                      </td>

                      {/* Gói Pro */}
                      <td className="px-4 py-3">
                        {isPro ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Crown className="h-3 w-3" />
                            VIP
                          </span>
                        ) : (
                          <span className="text-[#8C7E72] dark:text-[#75695e] font-mono text-[11px]">
                            Thường
                          </span>
                        )}
                      </td>

                      {/* Streak */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-mono text-amber-700 dark:text-[#e8cca4]">
                          <Flame className="h-3 w-3 text-amber-500" />
                          {u.streak || 0}
                        </span>
                      </td>

                      {/* Ngày đăng ký */}
                      <td className="px-4 py-3 font-mono text-[11px] text-[#8C7E72] dark:text-[#75695e]">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString("vi-VN")
                          : "-"}
                      </td>

                      {/* Thao tác */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Tặng Thẻ */}
                          <button
                            type="button"
                            onClick={() => {
                              setGiftUser(u);
                              setIsGiftModalOpen(true);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 transition"
                            title="Tặng thẻ bài học giả"
                          >
                            <Gift className="h-3.5 w-3.5" />
                          </button>

                          {/* Nút Xem / Sửa */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setIsEditModalOpen(true);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200/80 dark:border-[#3a3128] bg-amber-50/60 dark:bg-[#181513] text-[#615247] dark:text-[#a89b8d] hover:bg-amber-100 dark:hover:bg-[#29231f] hover:text-[#2D241E] dark:hover:text-[#f5ede3] hover:border-amber-300 dark:hover:border-[#c3a47b]/40 transition"
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
                                ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                : "border-rose-300 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50"
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
                người dùng
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

      {/* Modal Tặng Thẻ Bài Học Giả */}
      <AdminGiftCardModal
        isOpen={isGiftModalOpen}
        onClose={() => {
          setIsGiftModalOpen(false);
          setGiftUser(null);
        }}
        user={giftUser}
        onSuccess={(msg) => {
          setFeedback({ message: msg, type: "success" });
          fetchUsers();
        }}
      />
    </div>
  );
}

export default AdminUsersTab;
