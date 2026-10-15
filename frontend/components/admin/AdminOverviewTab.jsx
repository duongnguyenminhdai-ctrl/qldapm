"use client";

import { Users, DollarSign, Video, Crown, Clock, ArrowUpRight, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export function AdminOverviewTab({ stats, loading }) {
  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 animate-pulse" />
      </div>
    );
  }

  const {
    totalUsers = 0,
    newUsersThisWeek = 0,
    proUsersCount = 0,
    activeRooms = 0,
    totalRevenue = 0,
    successTransactions = 0,
    recentTransactions = [],
  } = stats;

  const formatVnd = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Tổng người dùng */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition hover:border-zinc-700/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Tổng người dùng
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold tracking-tight text-zinc-100 font-mono">
              {totalUsers.toLocaleString()}
            </span>
            <p className="mt-1 text-xs text-zinc-500">
              <span className="text-emerald-400 font-medium">
                +{newUsersThisWeek}
              </span>{" "}
              thành viên mới trong tuần
            </p>
          </div>
        </div>

        {/* Metric 2: Doanh thu VNPay */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition hover:border-zinc-700/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Doanh thu VNPay
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold tracking-tight text-emerald-400 font-mono">
              {formatVnd(totalRevenue)}
            </span>
            <p className="mt-1 text-xs text-zinc-500">
              <span className="text-zinc-300 font-medium font-mono">
                {successTransactions}
              </span>{" "}
              giao dịch thành công
            </p>
          </div>
        </div>

        {/* Metric 3: Phòng học trực tuyến */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition hover:border-zinc-700/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Phòng đang mở
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Video className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold tracking-tight text-zinc-100 font-mono">
              {activeRooms}
            </span>
            <p className="mt-1 text-xs text-zinc-500">
              Phòng học ảo đang hoạt động
            </p>
          </div>
        </div>

        {/* Metric 4: Thành viên Pro */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition hover:border-zinc-700/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Hội viên VIP / Pro
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Crown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-semibold tracking-tight text-amber-400 font-mono">
              {proUsersCount}
            </span>
            <p className="mt-1 text-xs text-zinc-500">
              Chiếm{" "}
              <span className="text-zinc-300 font-medium">
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

      {/* Bảng giao dịch gần đây */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/80">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              Giao dịch VNPay gần đây
            </h3>
            <p className="text-xs text-zinc-500">
              Các đơn nạp VIP và gia hạn gói dịch vụ mới nhất
            </p>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            Chưa có giao dịch nào được ghi nhận.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/40 text-zinc-400 border-b border-zinc-800/60 font-medium">
                <tr>
                  <th className="px-4 py-3">Mã đơn hàng</th>
                  <th className="px-4 py-3">Người thanh toán</th>
                  <th className="px-4 py-3">Số tiền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {recentTransactions.map((tx) => {
                  const isSuccess = tx.status === "SUCCESS";
                  const isPending = tx.status === "PENDING";
                  const userEmail = tx.userId?.email || "N/A";
                  const userName = tx.userId?.name || userEmail;
                  const dateStr = tx.createdAt
                    ? new Date(tx.createdAt).toLocaleString("vi-VN")
                    : "-";

                  return (
                    <tr
                      key={tx._id || tx.orderId}
                      className="hover:bg-zinc-800/30 transition"
                    >
                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">
                        {tx.orderId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-200">
                          {userName}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {userEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-zinc-100">
                        {formatVnd(tx.amount)}
                      </td>
                      <td className="px-4 py-3">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Thành công
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="h-3 w-3" />
                            Chờ thanh toán
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="h-3 w-3" />
                            Thất bại
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-[11px]">
                        {dateStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
