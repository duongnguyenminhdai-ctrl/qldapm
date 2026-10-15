"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
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
} from "lucide-react";
import { getStoredUser, clearAuthSession, adminApi } from "@/lib/api";
import { AdminOverviewTab } from "./AdminOverviewTab";
import { AdminUsersTab } from "./AdminUsersTab";
import { AdminServicesTab } from "./AdminServicesTab";
import { AdminTeamTab } from "./AdminTeamTab";

export function AdminClient() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'users' | 'services' | 'admins'
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
    if (currentUser && currentUser.role === "ADMIN") {
      fetchStats();
    }
  }, [currentUser, fetchStats]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-200" />
          <p className="text-xs">Đang kiểm tra quyền quản trị...</p>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-950 p-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            Truy cập bị từ chối
          </h2>
          <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
            Bạn không có quyền Quản trị viên (ADMIN) để truy cập cổng quản trị
            này. Đang chuyển hướng bạn về trang chủ...
          </p>
          <div className="mt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition"
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
      desc: "Chỉ số doanh thu & phòng học",
    },
    {
      id: "users",
      label: "Quản lý Người dùng",
      icon: Users,
      desc: "Phân quyền, trạng thái & khóa tài khoản",
    },
    {
      id: "services",
      label: "Quản lý Gói dịch vụ",
      icon: Package,
      desc: "Cấu hình gói VIP & giá tiền",
    },
    {
      id: "admins",
      label: "Quản trị viên",
      icon: ShieldCheck,
      desc: "Tài khoản ban quản trị hệ thống",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex h-14 items-center justify-between border-b border-zinc-800/80 px-4 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-950 text-purple-400 border border-purple-800/60 font-mono text-xs font-bold">
            VSR
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Admin Portal
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-900 transition"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Backdrop overlay trên thiết bị di động */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Bật / Tắt tùy ý sang bên trái */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between bg-zinc-950 transition-all duration-300 ease-in-out md:static md:sticky md:top-0 md:h-screen md:shrink-0 ${
          // Trạng thái trên Mobile
          mobileMenuOpen
            ? "translate-x-0 w-64 p-4 border-r border-zinc-800/80 shadow-2xl"
            : "-translate-x-full md:translate-x-0"
        } ${
          // Trạng thái trên Desktop (Bật / Tắt theo sidebarOpen)
          sidebarOpen
            ? "md:w-64 md:p-4 md:border-r md:border-zinc-800/80 md:opacity-100"
            : "md:w-0 md:p-0 md:border-r-0 md:opacity-0 md:overflow-hidden md:pointer-events-none"
        }`}
      >
        <div className="w-56 h-full flex flex-col justify-between shrink-0">
          {/* Top brand & Toggle close */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <Link href="/admin" className="flex items-center gap-2.5 group">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 group-hover:bg-purple-600/30 transition">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold tracking-tight text-zinc-100 block">
                    Virtual Study Room
                  </span>
                  <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest font-semibold">
                    Admin Portal
                  </span>
                </div>
              </Link>

              {/* Nút thu gọn sidebar sang trái */}
              <button
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setMobileMenuOpen(false);
                  } else {
                    toggleSidebar();
                  }
                }}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition"
                title="Thu gọn thanh điều hướng sang trái"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                      if (item.id === "overview") fetchStats();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition text-left ${
                      isActive
                        ? "bg-zinc-900 text-zinc-100 border border-zinc-800 shadow-xs"
                        : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-purple-400" : "text-zinc-500"
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="pt-4 border-t border-zinc-800/80 space-y-3">
            {/* Back to App */}
            <Link
              href="/"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-zinc-800/60 transition"
            >
              <span className="flex items-center gap-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Về trang chủ</span>
              </span>
              <ExternalLink className="h-3 w-3 text-zinc-600" />
            </Link>

            {/* Current Admin user profile */}
            <div className="flex items-center justify-between px-2 pt-2">
              <div className="flex items-center gap-2 min-w-0">
                {currentUser?.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover border border-purple-500/40 shrink-0"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-950 text-purple-300 text-[10px] font-bold shrink-0">
                    A
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">
                    {currentUser?.name}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500 truncate">
                    {currentUser?.email}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg transition"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Bar with Sidebar Toggle */}
        <header className="h-14 border-b border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between bg-zinc-950/60 backdrop-blur-xs sticky top-0 z-30">
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition shadow-xs group"
              title={sidebarOpen ? "Thu gọn sidebar sang trái" : "Mở rộng sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4 transition group-hover:-translate-x-0.5 text-zinc-400 group-hover:text-zinc-200" />
              ) : (
                <PanelLeftOpen className="h-4 w-4 text-purple-400 transition group-hover:translate-x-0.5" />
              )}
              <span className="text-xs font-medium text-zinc-300 hidden sm:inline">
                {sidebarOpen ? "Thu gọn" : "Menu"}
              </span>
            </button>

            <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

            <h1 className="text-sm font-semibold text-zinc-100">
              {NAV_ITEMS.find((item) => item.id === activeTab)?.label}
            </h1>
            <span className="hidden sm:inline-block text-zinc-600 text-xs">/</span>
            <span className="hidden sm:inline-block text-xs text-zinc-500">
              {NAV_ITEMS.find((item) => item.id === activeTab)?.desc}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* System Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Hệ thống</span> trực tuyến
            </div>
          </div>
        </header>

        {/* Tab View Content */}
        <div className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeTab === "overview" && (
            <AdminOverviewTab stats={stats} loading={loadingStats} />
          )}
          {activeTab === "users" && <AdminUsersTab />}
          {activeTab === "services" && <AdminServicesTab />}
          {activeTab === "admins" && <AdminTeamTab />}
        </div>
      </main>
    </div>
  );
}
