"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  PanelLeftClose,
  Sparkles,
  ArrowLeft,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AdminSidebar Component
 * Tích hợp animation Rubber Segment (phong cách React Bits) cho menu điều hướng dọc:
 * - Khối Active Thumb trượt mượt mà giữa các mục với hiệu ứng co giãn đàn hồi (Rubber Stretch & Squash)
 * - Đồng bộ Dark Academia với viền amber, gradient hổ phách và thanh chỉ báo ánh sáng
 */
export function AdminSidebar({
  sidebarOpen,
  toggleSidebar,
  mobileMenuOpen,
  setMobileMenuOpen,
  activeTab,
  setActiveTab,
  fetchStats,
  currentUser,
  handleLogout,
  navItems = [],
}) {
  return (
    <aside
      className={cn(
        "admin-sidebar-box fixed inset-y-0 left-0 z-50 flex flex-col justify-between bg-[#F2ECE1] dark:bg-[#161311]/95 backdrop-blur-xl transition-all duration-300 ease-in-out md:static md:sticky md:top-0 md:h-screen md:shrink-0",
        // Trạng thái trên Mobile
        mobileMenuOpen
          ? "translate-x-0 w-64 p-4 border-r border-amber-200/60 dark:border-[#c3a47b]/25 shadow-2xl"
          : "-translate-x-full md:translate-x-0",
        // Trạng thái trên Desktop (Bật / Tắt theo sidebarOpen)
        sidebarOpen
          ? "md:w-64 md:p-4 md:border-r md:border-amber-200/60 dark:md:border-[#c3a47b]/25 md:opacity-100"
          : "md:w-0 md:p-0 md:border-r-0 md:opacity-0 md:overflow-hidden md:pointer-events-none"
      )}
    >
      <div className="w-56 h-full flex flex-col justify-between shrink-0">
        {/* Top brand & Toggle close */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <Link href="/admin" className="flex items-center gap-2.5 group">
              <img
                src="/image/logo.png"
                alt="Virtual Study Room Logo"
                className="h-8 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-200"
              />
              <div>
                <span className="text-xs font-serif font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3] block">
                  Virtual Study Room
                </span>
                <span className="text-[10px] font-mono text-amber-700 dark:text-[#c3a47b] uppercase tracking-widest font-semibold flex items-center gap-1">
                  <span>ADMIN PORTAL</span>
                  <Sparkles className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />
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
              className="p-1.5 rounded-lg text-stone-600 hover:text-[#2D241E] hover:bg-amber-200/60 border border-transparent hover:border-amber-300/60 dark:text-[#a89b8d] dark:hover:text-[#f5ede3] dark:hover:bg-[#201b18] dark:hover:border-[#3a3128] transition"
              title="Thu gọn thanh điều hướng sang trái"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links with Rubber Segment Animation */}
          <nav className="relative space-y-1.5 isolate" role="tablist">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                    if (item.id === "overview" && fetchStats) fetchStats();
                  }}
                  className={cn(
                    "group relative z-10 flex w-full items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-medium cursor-pointer select-none transition-colors duration-200 text-left outline-none",
                    isActive
                      ? "text-amber-950 dark:text-amber-300 font-semibold"
                      : "text-stone-600 hover:text-[#2D241E] dark:text-[#a89b8d] dark:hover:text-[#f5ede3] hover:bg-amber-100/40 dark:hover:bg-[#201b18]/40"
                  )}
                >
                  {/* Khối Active Rubber Segment Thumb */}
                  {isActive && (
                    <motion.div
                      layoutId="adminSidebarRubberThumb"
                      className="absolute inset-0 z-0 rounded-2xl border border-amber-400/50 dark:border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-amber-600/10 dark:from-amber-500/20 dark:to-amber-600/10 shadow-lg shadow-amber-950/15 pointer-events-none"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 26,
                        mass: 0.8,
                      }}
                    >
                      {/* Vạch ánh sáng hổ phách ở cạnh trái */}
                      <span className="absolute left-1.5 top-2.5 bottom-2.5 w-1 rounded-full bg-amber-500 dark:bg-[#c3a47b] shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
                    </motion.div>
                  )}

                  {/* Icon & Label */}
                  <span className="relative z-10 flex items-center gap-3 min-w-0">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-200",
                        isActive
                          ? "text-amber-700 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.35)]"
                          : "text-stone-500 dark:text-[#75695e] group-hover:text-stone-700 dark:group-hover:text-[#c3a47b]"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-amber-200/60 dark:border-[#3a3128] space-y-3">
          {/* Back to App */}
          <Link
            href="/"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-stone-600 hover:text-[#2D241E] hover:bg-amber-100/70 border border-amber-200/60 dark:text-[#a89b8d] dark:hover:text-[#f5ede3] dark:hover:bg-[#201b18] dark:border-[#3a3128] transition"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Về trang chủ</span>
            </span>
            <ExternalLink className="h-3 w-3 text-stone-400 dark:text-[#75695e]" />
          </Link>

          {/* Current Admin user profile */}
          <div className="flex items-center justify-between px-2 pt-2">
            <div className="flex items-center gap-2 min-w-0">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover border border-amber-300/60 dark:border-[#c3a47b]/40 shrink-0"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-[#181513] text-amber-800 dark:text-[#e8cca4] border border-amber-300/60 dark:border-[#c3a47b]/30 text-[10px] font-serif font-bold shrink-0">
                  A
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-serif font-medium text-[#2D241E] dark:text-[#f5ede3] truncate">
                  {currentUser?.name}
                </p>
                <p className="text-[10px] font-mono text-stone-500 dark:text-[#75695e] truncate">
                  {currentUser?.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-100/60 dark:text-[#a89b8d] dark:hover:text-rose-400 dark:hover:bg-[#201b18] rounded-lg transition"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default AdminSidebar;
