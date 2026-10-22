"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  DollarSign,
  Video,
  Crown,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Loader2,
  Calendar,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { adminApi } from "@/lib/api";

const TIME_RANGES = [
  { id: "all", label: "Toàn thời gian" },
  { id: "week", label: "Tuần này" },
  { id: "month", label: "Tháng này" },
  { id: "year", label: "Năm nay" },
];

export function AdminOverviewTab({ stats, loading }) {
  // 1. Quản lý Mốc thời gian Doanh thu
  const [revenueRange, setRevenueRange] = useState("all");

  // 2. Quản lý Bảng Giao dịch VNPay (Search, Filter, Sort, Pagination)
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState("latest");
  const [loadingTx, setLoadingTx] = useState(true);

  // Debounce search input 400ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset về trang 1 khi tìm kiếm
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch danh sách giao dịch phân trang
  const fetchTransactions = useCallback(async () => {
    setLoadingTx(true);
    try {
      const res = await adminApi.getTransactions({
        page,
        limit: 10,
        search: debouncedSearch,
        status: statusFilter,
        sort: sortOption,
      });

      if (res?.data) {
        setTransactions(res.data.transactions || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.warn("Lỗi tải danh sách giao dịch:", err);
    } finally {
      setLoadingTx(false);
    }
  }, [page, debouncedSearch, statusFilter, sortOption]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatVnd = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount || 0);
  };

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/20 bg-amber-50/40 dark:bg-[#201b18]/60 animate-pulse"
            />
          ))}
        </div>
        <div className="h-72 rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/20 bg-amber-50/40 dark:bg-[#201b18]/60 animate-pulse" />
      </div>
    );
  }

  const {
    totalUsers = 0,
    newUsersThisWeek = 0,
    proUsersCount = 0,
    activeRooms = 0,
    revenueByRange = {},
    totalRevenue = 0,
    successTransactions = 0,
  } = stats;

  // Lấy dữ liệu doanh thu tương ứng với mốc thời gian được chọn
  const activeRevenueData = revenueByRange[revenueRange] || {
    total: totalRevenue,
    count: successTransactions,
  };

  return (
    <div className="space-y-6">
      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Tổng người dùng */}
        <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-4 transition-all duration-200 hover:border-amber-300 dark:hover:border-[#c3a47b]/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 dark:text-[#a89b8d]">
              Tổng người dùng
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:bg-[#c3a47b]/15 dark:text-[#e8cca4] border border-amber-300/60 dark:border-[#c3a47b]/30">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3]">
              {totalUsers.toLocaleString()}
            </span>
            <p className="mt-1 text-xs text-stone-500 dark:text-[#75695e]">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                +{newUsersThisWeek}
              </span>{" "}
              thành viên mới tuần này
            </p>
          </div>
        </div>

        {/* Metric 2: Doanh thu VNPay (Có bộ chọn mốc thời gian Tuần / Tháng / Năm / Toàn bộ) */}
        <div className="rounded-2xl border border-amber-300/80 dark:border-[#c3a47b]/40 bg-white/90 dark:bg-[#201b18]/85 backdrop-blur-md p-4 transition-all duration-200 hover:border-amber-400 dark:hover:border-[#c3a47b]/60 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-amber-900 dark:text-[#e8cca4] font-serif">
              Doanh thu VNPay
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Bộ chọn mốc thời gian */}
          <div className="mt-2.5 flex items-center gap-1 p-0.5 rounded-lg bg-amber-100/70 dark:bg-[#161311] border border-amber-200/80 dark:border-[#3a3128]/80 text-[10px]">
            {TIME_RANGES.map((r) => {
              const isSelected = revenueRange === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setRevenueRange(r.id)}
                  className={`flex-1 py-0.5 rounded text-center font-medium transition ${
                    isSelected
                      ? "bg-amber-600 text-white dark:bg-[#c3a47b] dark:text-[#141210] shadow-xs font-semibold"
                      : "text-stone-600 dark:text-[#a89b8d] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <span className="text-2xl font-serif font-bold tracking-tight text-amber-700 dark:text-amber-300">
              {formatVnd(activeRevenueData.total)}
            </span>
            <p className="mt-1 text-xs text-stone-500 dark:text-[#75695e]">
              <span className="text-amber-800 dark:text-[#e8cca4] font-medium font-mono">
                {activeRevenueData.count}
              </span>{" "}
              giao dịch thành công
            </p>
          </div>
        </div>

        {/* Metric 3: Phòng học trực tuyến */}
        <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-4 transition-all duration-200 hover:border-amber-300 dark:hover:border-[#c3a47b]/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 dark:text-[#a89b8d]">
              Phòng đang mở
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30">
              <Video className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3]">
              {activeRooms}
            </span>
            <p className="mt-1 text-xs text-stone-500 dark:text-[#75695e]">
              Phòng học ảo đang hoạt động
            </p>
          </div>
        </div>

        {/* Metric 4: Thành viên Pro */}
        <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-4 transition-all duration-200 hover:border-amber-300 dark:hover:border-[#c3a47b]/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 dark:text-[#a89b8d]">
              Hội viên VIP / Pro
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-800 dark:text-[#e8cca4] border border-amber-300/60 dark:border-[#c3a47b]/40">
              <Crown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif font-semibold tracking-tight text-amber-800 dark:text-[#e8cca4]">
              {proUsersCount}
            </span>
            <p className="mt-1 text-xs text-stone-500 dark:text-[#75695e]">
              Chiếm{" "}
              <span className="text-[#2D241E] dark:text-[#d8c8b4] font-medium">
                {totalUsers > 0
                  ? ((proUsersCount / totalUsers) * 100).toFixed(1)
                  : 0}
                %
              </span>{" "}
              tổng người dùng
            </p>
          </div>
        </div>
      </div>

      {/* Bảng Quản lý & Lịch sử Giao dịch VNPAY (Có Toolbar & Phân trang) */}
      <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md overflow-hidden shadow-sm">
        {/* Header & Subtitle */}
        <div className="p-4 border-b border-amber-200/60 dark:border-[#3a3128] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-serif font-semibold text-[#2D241E] dark:text-[#f5ede3] flex items-center gap-2">
              <span>Quản lý Giao dịch VNPay</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/15 text-amber-800 dark:bg-[#c3a47b]/15 dark:text-[#e8cca4] border border-amber-300/60 dark:border-[#c3a47b]/30">
                {pagination.totalItems} đơn
              </span>
            </h3>
            <p className="text-xs text-stone-600 dark:text-[#a89b8d] mt-0.5">
              Tra cứu, lọc trạng thái và kiểm soát lịch sử thanh toán nạp VIP
            </p>
          </div>

          <button
            onClick={fetchTransactions}
            disabled={loadingTx}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-100/70 hover:bg-amber-200/70 text-[#2D241E] border border-amber-300/60 dark:bg-[#1c1815] dark:hover:bg-[#25201c] dark:text-[#e8cca4] dark:border-[#3a3128] transition disabled:opacity-50"
            title="Làm mới bảng dữ liệu"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loadingTx ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Thanh công cụ (Toolbar: Search, Status Filter, Sort) */}
        <div className="p-4 bg-amber-50/50 dark:bg-[#161311]/50 border-b border-amber-200/60 dark:border-[#3a3128] grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Ô tìm kiếm */}
          <div className="sm:col-span-5 relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-[#75695e]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên khách, email, mã đơn..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#1c1815] border border-amber-200/80 dark:border-[#3a3128] text-[#2D241E] dark:text-[#f5ede3] placeholder:text-stone-400 dark:placeholder:text-[#75695e] focus:outline-none focus:border-amber-400 dark:focus:border-[#c3a47b]/60 transition"
            />
          </div>

          {/* Lọc theo Trạng thái */}
          <div className="sm:col-span-4 relative">
            <Filter className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-[#75695e] pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-7 py-1.5 text-xs rounded-xl bg-white dark:bg-[#1c1815] border border-amber-200/80 dark:border-[#3a3128] text-[#2D241E] dark:text-[#f5ede3] focus:outline-none focus:border-amber-400 dark:focus:border-[#c3a47b]/60 cursor-pointer appearance-none transition"
            >
              <option value="ALL">Tất cả trạng thái hợp lệ</option>
              <option value="SUCCESS">Thành công</option>
              <option value="PENDING">Chờ thanh toán (còn hạn)</option>
              <option value="FAILED">Thất bại / Hủy bỏ</option>
            </select>
          </div>

          {/* Sắp xếp */}
          <div className="sm:col-span-3 relative">
            <ArrowUpDown className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-[#75695e] pointer-events-none" />
            <select
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-7 py-1.5 text-xs rounded-xl bg-white dark:bg-[#1c1815] border border-amber-200/80 dark:border-[#3a3128] text-[#2D241E] dark:text-[#f5ede3] focus:outline-none focus:border-amber-400 dark:focus:border-[#c3a47b]/60 cursor-pointer appearance-none transition"
            >
              <option value="latest">Mới nhất trước</option>
              <option value="oldest">Cũ nhất trước</option>
              <option value="amount_desc">Số tiền: Cao → Thấp</option>
              <option value="amount_asc">Số tiền: Thấp → Cao</option>
            </select>
          </div>
        </div>

        {/* Nội dung Bảng */}
        {loadingTx ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-amber-700 dark:text-[#c3a47b]" />
            <p className="text-xs text-stone-500 dark:text-[#a89b8d] font-serif">
              Đang tải danh sách giao dịch...
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-stone-500 dark:text-[#75695e] text-xs font-serif space-y-1">
            <p>Không tìm thấy giao dịch nào phù hợp với bộ lọc hiện tại.</p>
            <p className="text-[11px] text-stone-400 dark:text-[#60554c]">
              Thử xóa từ khóa tìm kiếm hoặc chọn &quot;Tất cả trạng thái&quot;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-100/60 dark:bg-[#181513]/70 text-stone-700 dark:text-[#a89b8d] border-b border-amber-200/60 dark:border-[#3a3128] font-serif font-medium">
                <tr>
                  <th className="px-4 py-3">Mã đơn hàng</th>
                  <th className="px-4 py-3">Người thanh toán</th>
                  <th className="px-4 py-3">Gói nạp</th>
                  <th className="px-4 py-3">Số tiền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/80 dark:divide-[#3a3128]/50 text-[#2D241E] dark:text-[#d8c8b4]">
                {transactions.map((tx) => {
                  const statusUpper = (tx.status || "PENDING").toUpperCase();
                  const isSuccess = statusUpper === "SUCCESS";
                  const isPending = statusUpper === "PENDING";
                  const isExpired = statusUpper === "EXPIRED";
                  const userEmail = tx.userId?.email || "N/A";
                  const userName = tx.userId?.name || userEmail;
                  const dateStr = tx.createdAt
                    ? new Date(tx.createdAt).toLocaleString("vi-VN")
                    : "-";

                  return (
                    <tr
                      key={tx._id || tx.orderId}
                      className="hover:bg-amber-50/70 dark:hover:bg-[#29231f]/60 transition-colors duration-150"
                    >
                      <td className="px-4 py-3 font-mono text-[11px] text-amber-800 dark:text-[#e8cca4]">
                        {tx.orderId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {tx.userId?.avatar ? (
                            <img
                              src={tx.userId.avatar}
                              alt=""
                              className="h-6 w-6 rounded-full object-cover border border-amber-300/60 dark:border-[#c3a47b]/40 shrink-0"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-[#181513] text-amber-800 dark:text-[#e8cca4] border border-amber-300/60 dark:border-[#c3a47b]/30 text-[10px] font-bold shrink-0">
                              {(userName[0] || "U").toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-[#2D241E] dark:text-[#f5ede3] truncate max-w-[160px]">
                              {userName}
                            </div>
                            <div className="text-[10px] text-stone-500 dark:text-[#75695e] font-mono truncate max-w-[160px]">
                              {userEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-stone-200/60 dark:bg-[#1c1815] text-stone-700 dark:text-[#d8c8b4] border border-stone-300/60 dark:border-[#3a3128]">
                          {tx.packageCode || "PRO_1M"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-700 dark:text-amber-300">
                        {formatVnd(tx.amount)}
                      </td>
                      <td className="px-4 py-3">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Thành công
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Clock className="h-3 w-3" />
                            Chờ thanh toán
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-stone-500/15 text-stone-600 dark:text-stone-400 border border-stone-500/30">
                            <AlertCircle className="h-3 w-3" />
                            Hết hạn (15p)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <XCircle className="h-3 w-3" />
                            Thất bại / Hủy
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#75695e] font-mono text-[11px] whitespace-nowrap">
                        {dateStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang Server-side */}
        <div className="p-3 sm:p-4 border-t border-amber-200/60 dark:border-[#3a3128] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600 dark:text-[#a89b8d]">
          <div>
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
                đơn hàng
              </span>
            ) : (
              <span>Không có bản ghi</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={!pagination.hasPrevPage || loadingTx}
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
              disabled={!pagination.hasNextPage || loadingTx}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-amber-200/80 dark:border-[#3a3128] bg-white dark:bg-[#1c1815] text-[#2D241E] dark:text-[#f5ede3] hover:bg-amber-100/60 dark:hover:bg-[#25201c] disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium"
            >
              <span>Trang sau</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminOverviewTab;
