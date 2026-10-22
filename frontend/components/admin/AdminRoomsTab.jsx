"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  Search,
  Users,
  Eye,
  Lock,
  Globe,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { connectSocket } from "@/lib/socket";

const CATEGORIES = [
  { id: "all", label: "Tất cả môn" },
  { id: "it", label: "Công nghệ / Lập trình" },
  { id: "language", label: "Ngoại ngữ" },
  { id: "math", label: "Toán học" },
  { id: "science", label: "Khoa học Tự nhiên" },
  { id: "general", label: "Tổng hợp / Tự học" },
];

export function AdminRoomsTab() {
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [copiedCode, setCopiedCode] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [stats, setStats] = useState({
    totalActiveRooms: 0,
    totalMembersOnline: 0,
    publicRoomsCount: 0,
  });

  const fetchRooms = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const res = await adminApi.getRooms({
          page,
          limit: 10,
          search: search.trim() || undefined,
          category: category === "all" ? undefined : category,
        });

        if (res?.data) {
          setRooms(res.data.rooms || []);
          if (res.data.stats) {
            setStats(res.data.stats);
          }
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          }
        } else {
          setRooms([]);
        }
      } catch (err) {
        console.warn("Lỗi tải danh sách phòng admin:", err);
        setRooms([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [page, search, category]
  );

  // Gọi lần đầu & khi thay đổi trang / bộ lọc
  useEffect(() => {
    fetchRooms(true);
  }, [fetchRooms]);

  // Lắng nghe Socket realtime để cập nhật danh sách phòng
  useEffect(() => {
    let socket = null;
    try {
      socket = connectSocket();
    } catch (_) {}

    if (!socket) return;

    const handleRealtimeUpdate = () => {
      fetchRooms(false);
    };

    socket.on("dashboard:room-created", handleRealtimeUpdate);
    socket.on("dashboard:room-deleted", handleRealtimeUpdate);
    socket.on("room_list_updated", handleRealtimeUpdate);
    socket.on("room:closed", handleRealtimeUpdate);
    socket.on("room:deleted", handleRealtimeUpdate);
    socket.on("room:members-sync", handleRealtimeUpdate);
    socket.on("room_terminated", handleRealtimeUpdate);

    // Polling dự phòng mỗi 5 giây
    const interval = setInterval(() => {
      fetchRooms(false);
    }, 5000);

    return () => {
      socket.off("dashboard:room-created", handleRealtimeUpdate);
      socket.off("dashboard:room-deleted", handleRealtimeUpdate);
      socket.off("room_list_updated", handleRealtimeUpdate);
      socket.off("room:closed", handleRealtimeUpdate);
      socket.off("room:deleted", handleRealtimeUpdate);
      socket.off("room:members-sync", handleRealtimeUpdate);
      socket.off("room_terminated", handleRealtimeUpdate);
      clearInterval(interval);
    };
  }, [fetchRooms]);

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 3 Metric Cards cho Phòng học đồng bộ từ API */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-4 transition-all duration-200 hover:border-amber-400 dark:hover:border-[#c3a47b]/45 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#615247] dark:text-[#a89b8d]">Phòng đang mở</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/70 dark:bg-[#c3a47b]/15 text-amber-900 dark:text-[#e8cca4] border border-amber-300/60 dark:border-[#c3a47b]/30">
              <Video className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3]">
              {stats.totalActiveRooms}
            </span>
            <p className="mt-1 text-xs text-[#8C7E72] dark:text-[#75695e]">Phòng học ảo trực tuyến</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-4 transition-all duration-200 hover:border-amber-400 dark:hover:border-[#c3a47b]/45 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#615247] dark:text-[#a89b8d]">Học viên trong phòng</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif font-semibold tracking-tight text-amber-700 dark:text-amber-300">
              {stats.totalMembersOnline}
            </span>
            <p className="mt-1 text-xs text-[#8C7E72] dark:text-[#75695e]">Thành viên đang học tập trung</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-4 transition-all duration-200 hover:border-amber-400 dark:hover:border-[#c3a47b]/45 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#615247] dark:text-[#a89b8d]">Phòng công khai</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
              {stats.publicRoomsCount}
            </span>
            <p className="mt-1 text-xs text-[#8C7E72] dark:text-[#75695e]">Cho phép mọi người tự do tham gia</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/20 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md p-3.5 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7E72] dark:text-[#a89b8d]" />
          <input
            type="text"
            placeholder="Tìm theo tên phòng, chủ phòng, mã phòng..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-amber-50/50 dark:bg-[#181513] border border-amber-200/70 dark:border-[#3a3128] text-[#2D241E] dark:text-[#f5ede3] placeholder-[#8C7E72] dark:placeholder-[#75695e] focus:outline-none focus:border-amber-500 dark:focus:border-[#c3a47b] transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 rounded-xl bg-amber-50/50 dark:bg-[#181513] border border-amber-200/70 dark:border-[#3a3128] text-[#2D241E] dark:text-[#d8c8b4] focus:outline-none focus:border-amber-500 dark:focus:border-[#c3a47b] transition cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchRooms(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-amber-100/70 dark:bg-[#29231f] text-amber-900 dark:text-[#e8cca4] border border-amber-300/60 dark:border-[#c3a47b]/30 hover:bg-amber-200/70 dark:hover:bg-[#c3a47b]/20 hover:border-amber-400 dark:hover:border-[#c3a47b] transition"
            title="Làm mới danh sách phòng"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Table danh sách phòng */}
      <div className="rounded-2xl border border-amber-200/60 dark:border-[#c3a47b]/25 bg-white/85 dark:bg-[#201b18]/80 backdrop-blur-md overflow-hidden shadow-sm">
        <div className="p-4 border-b border-amber-200/60 dark:border-[#3a3128] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-serif font-semibold text-[#2D241E] dark:text-[#f5ede3]">
              Danh sách phòng học trực tuyến ({pagination.totalItems})
            </h3>
            <p className="text-xs text-[#615247] dark:text-[#a89b8d]">
              Giám sát trạng thái hoạt động, số lượng học viên và điều phối phòng học
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#8C7E72] dark:text-[#a89b8d] text-xs">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-600 dark:text-[#c3a47b]" />
            Đang tải dữ liệu phòng học...
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-16 text-center text-[#8C7E72] dark:text-[#75695e] text-xs">
            Không tìm thấy phòng học nào đang mở phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-100/60 dark:bg-[#181513]/70 text-[#615247] dark:text-[#a89b8d] border-b border-amber-200/60 dark:border-[#3a3128] font-medium font-serif">
                <tr>
                  <th className="px-4 py-3">Mã phòng</th>
                  <th className="px-4 py-3">Tên phòng & Môn học</th>
                  <th className="px-4 py-3">Chủ phòng (Host)</th>
                  <th className="px-4 py-3">Thành viên</th>
                  <th className="px-4 py-3">Chế độ</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 dark:divide-[#3a3128]/50 text-[#3E3228] dark:text-[#d8c8b4]">
                {rooms.map((room) => {
                  const code = room.roomCode || room.inviteCode || room._id;
                  const membersCount =
                    room.participantCount || room.participants?.length || 0;
                  const hostName =
                    room.hostId?.name || room.hostName || "Chủ phòng";
                  const hostEmail = room.hostId?.email || "";

                  return (
                    <tr
                      key={room._id || code}
                      className="hover:bg-amber-50/70 dark:hover:bg-[#29231f]/60 transition-colors duration-150"
                    >
                      {/* Mã phòng */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-amber-900 dark:text-[#e8cca4] font-semibold bg-amber-100/70 dark:bg-[#181513] px-2 py-1 rounded-lg border border-amber-300/60 dark:border-[#c3a47b]/25 w-fit">
                          <span>{code}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(code)}
                            className="text-[#8C7E72] dark:text-[#a89b8d] hover:text-[#2D241E] dark:hover:text-[#f5ede3] transition"
                            title="Sao chép mã phòng"
                          >
                            {copiedCode === code ? (
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Tên phòng & môn */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#2D241E] dark:text-[#f5ede3] line-clamp-1">
                          {room.name || "Phòng tự học"}
                        </div>
                        <div className="text-[11px] text-[#615247] dark:text-[#a89b8d] flex items-center gap-1 mt-0.5">
                          <BookOpen className="h-3 w-3 text-amber-600 dark:text-[#c3a47b]" />
                          <span>{room.subject || "Tự do"}</span>
                        </div>
                      </td>

                      {/* Host */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-[#2D241E] dark:text-[#d8c8b4]">{hostName}</div>
                        {hostEmail && (
                          <div className="text-[10px] text-[#8C7E72] dark:text-[#75695e] font-mono">
                            {hostEmail}
                          </div>
                        )}
                      </td>

                      {/* Thành viên */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100/60 dark:bg-[#181513] border border-amber-300/60 dark:border-[#c3a47b]/30 text-amber-900 dark:text-[#e8cca4]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                          {membersCount} học viên
                        </span>
                      </td>

                      {/* Chế độ */}
                      <td className="px-4 py-3.5">
                        {room.isPrivate ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Lock className="h-3 w-3" />
                            Riêng tư
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <Globe className="h-3 w-3" />
                            Công khai
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => router.push(`/room/${code}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100/80 dark:bg-[#c3a47b]/15 text-amber-900 dark:text-[#e8cca4] border border-amber-300/80 dark:border-[#c3a47b]/40 hover:bg-amber-500 hover:text-white dark:hover:bg-[#c3a47b] dark:hover:text-[#161311] transition shadow-xs"
                          title="Tham gia vào phòng học này"
                        >
                          <span>Vào phòng</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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
                phòng học
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
    </div>
  );
}

export default AdminRoomsTab;
