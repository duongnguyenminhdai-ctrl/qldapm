"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Video,
  Package,
  ShieldCheck,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Loader2,
  Activity,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import { getStoredUser, clearAuthSession, adminApi } from "@/lib/api";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AdminDustBackground } from "./AdminDustBackground";
import { AdminSidebar } from "./AdminSidebar";
import { AdminOverviewTab } from "./AdminOverviewTab";
import { AdminRoomsTab } from "./AdminRoomsTab";
import { AdminUsersTab } from "./AdminUsersTab";
import { AdminServicesTab } from "./AdminServicesTab";
import { AdminTeamTab } from "./AdminTeamTab";

export function AdminClient() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'rooms' | 'users' | 'services' | 'admins'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Khôi phục trạng thái sidebar từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin_sidebar_open");
      if (saved !== null) {
        setSidebarOpen(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("admin_sidebar_open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Stats data for overview tab
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // 1. Route Protection: Kiểm tra xem user có phải ADMIN không
  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      setUnauthorized(true);
      setCheckingAuth(false);
      setTimeout(() => {
        router.push("/login?redirect=/admin");
      }, 1500);
      return;
    }

    if (user.role !== "ADMIN") {
      setUnauthorized(true);
      setCheckingAuth(false);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
      return;
    }

    setCurrentUser(user);
    setCheckingAuth(false);
  }, [router]);

  // 2. Fetch stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await adminApi.getStats();
      if (res?.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.warn("Lỗi tải thống kê admin:", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === "ADMIN") {
      fetchStats();
    }
  }, [currentUser, fetchStats]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  // Loading Screen khi đang kiểm tra quyền
  if (checkingAuth) {
    return (
      <div className="min-h-[100dvh] bg-[#141210] flex flex-col items-center justify-center text-[#f5ede3]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#c3a47b]" />
          <p className="text-xs text-[#a89b8d] tracking-wide font-serif">
            Đang xác thực quyền truy cập Quản trị viên...
          </p>
        </div>
      </div>
    );
  }

  // Màn hình từ chối truy cập (nếu không phải ADMIN)
  if (unauthorized) {
    return (
      <div className="min-h-[100dvh] bg-[#141210] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-900/40 bg-[#1c1815] p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-serif font-semibold text-[#f5ede3]">
            Từ chối quyền truy cập
          </h2>
          <p className="mt-2 text-xs text-[#a89b8d]">
            Tài khoản của bạn không có đặc quyền Quản trị viên (ADMIN) để truy cập cổng
            này. Đang chuyển hướng bạn về trang chủ...
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-[#201b18] border border-[#c3a47b]/30 text-[#e8cca4] hover:bg-[#c3a47b] hover:text-[#161311] transition shadow-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Quay lại Dashboard ngay</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const NAV_ITEMS = [
    {
      id: "overview",
      label: "Tổng quan & Thống kê",
      icon: LayoutDashboard,
      desc: "Chỉ số doanh thu, người dùng & KPI tổng thể",
    },
    {
      id: "rooms",
      label: "Quản lý Phòng học",
      icon: Video,
      desc: "Giám sát phòng trực tuyến, môn học & học viên",
    },
    {
      id: "users",
      label: "Quản lý Người dùng",
      icon: Users,
      desc: "Phân quyền, trạng thái hoạt động & khóa tài khoản",
    },
    {
      id: "services",
      label: "Quản lý Gói dịch vụ",
      icon: Package,
      desc: "Cấu hình gói VIP / Pro & định giá tiền",
    },
    {
      id: "admins",
      label: "Đội ngũ Quản trị",
      icon: ShieldCheck,
      desc: "Tài khoản ban quản trị hệ thống Virtual Study Room",
    },
  ];

  return (
    <div className="admin-portal-wrapper relative min-h-[100dvh] bg-[#F7F4EB] dark:bg-[#141210] text-[#2D241E] dark:text-[#f5ede3] flex flex-col md:flex-row overflow-x-hidden selection:bg-[#c3a47b]/30 selection:text-[#f5ede3] transition-colors duration-300">
      {/* 3D Ambient Dust Particles Canvas */}
      <AdminDustBackground />

      {/* Mobile Top Header */}
      <div className="md:hidden flex h-14 items-center justify-between border-b border-amber-200/60 dark:border-[#3a3128] px-4 bg-[#F2ECE1]/95 dark:bg-[#181513]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:bg-[#c3a47b]/20 dark:text-[#e8cca4] border border-amber-300/60 dark:border-[#c3a47b]/40 font-serif text-xs font-bold">
            ◆
          </div>
          <span className="text-sm font-serif font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3]">
            Admin Portal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle size="sm" />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-stone-600 hover:text-[#2D241E] dark:text-[#a89b8d] dark:hover:text-[#f5ede3] rounded-lg hover:bg-amber-100/70 dark:hover:bg-[#201b18] transition"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Backdrop overlay trên thiết bị di động */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Bật / Tắt tùy ý sang bên trái với Rubber Segment Navigation */}
      <AdminSidebar
        sidebarOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fetchStats={fetchStats}
        currentUser={currentUser}
        handleLogout={handleLogout}
        navItems={NAV_ITEMS}
      />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 min-w-0 flex flex-col min-h-[100dvh]">
        {/* Top Bar with Sidebar Toggle & ThemeToggle */}
        <header className="admin-header-glass h-14 border-b border-amber-200/60 dark:border-[#3a3128] px-4 sm:px-6 flex items-center justify-between bg-[#F2ECE1]/90 dark:bg-[#161311]/85 backdrop-blur-md sticky top-0 z-30 transition-colors duration-300">
          <div className="flex items-center gap-3">
            {/* Nút bật/tắt Sidebar tùy ý */}
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 768) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  toggleSidebar();
                }
              }}
              id="btn-toggle-admin-sidebar"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-stone-600 hover:text-[#2D241E] hover:bg-amber-200/60 border border-amber-200/60 hover:border-amber-300/80 dark:text-[#a89b8d] dark:hover:text-[#f5ede3] dark:hover:bg-[#201b18] dark:border-[#3a3128] dark:hover:border-[#c3a47b]/40 transition shadow-xs group"
              title={sidebarOpen ? "Thu gọn sidebar sang trái" : "Mở rộng sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4 transition group-hover:-translate-x-0.5 text-stone-500 group-hover:text-[#2D241E] dark:text-[#a89b8d] dark:group-hover:text-[#f5ede3]" />
              ) : (
                <PanelLeftOpen className="h-4 w-4 text-amber-800 dark:text-[#e8cca4] transition group-hover:translate-x-0.5" />
              )}
              <span className="text-xs font-medium text-[#2D241E] dark:text-[#d8c8b4] hidden sm:inline">
                {sidebarOpen ? "Thu gọn" : "Menu"}
              </span>
            </button>

            <div className="h-4 w-px bg-amber-200/70 dark:bg-[#3a3128] hidden sm:block" />

            <h1 className="text-sm font-serif font-semibold text-[#2D241E] dark:text-[#f5ede3]">
              {NAV_ITEMS.find((item) => item.id === activeTab)?.label}
            </h1>
            <span className="hidden sm:inline-block text-stone-400 dark:text-[#75695e] text-xs">/</span>
            <span className="hidden sm:inline-block text-xs text-stone-600 dark:text-[#a89b8d] truncate max-w-[280px]">
              {NAV_ITEMS.find((item) => item.id === activeTab)?.desc}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* ThemeToggle chuyển đổi giao diện Dark/Light */}
            <ThemeToggle size="sm" />

            {/* System Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Hệ thống</span> online
            </div>
          </div>
        </header>

        {/* Tab View Content */}
        <div className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeTab === "overview" && (
            <AdminOverviewTab stats={stats} loading={loadingStats} />
          )}
          {activeTab === "rooms" && <AdminRoomsTab />}
          {activeTab === "users" && <AdminUsersTab />}
          {activeTab === "services" && <AdminServicesTab />}
          {activeTab === "admins" && <AdminTeamTab />}
        </div>
      </main>
    </div>
  );
}

export default AdminClient;
