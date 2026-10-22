"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  X,
  Lock,
  Check,
  Flame,
  Clock,
  Crown,
  Sparkles,
  Shield,
  Star,
  Award,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { titlesApi, getStoredUser, setStoredUser, setAuthSession } from "@/lib/api";
import { TITLE_STYLE_MAP, TITLE_MILESTONES } from "@/lib/titlesConfig";
import { cn } from "@/lib/utils";

// Cache dữ liệu danh hiệu tại client để mở modal lập tức 0ms không phải chờ mạng
let cachedTitlesData = null;

function buildFallbackTitlesData(storedUser) {
  const userStreak = storedUser?.streak || 1;
  const studyHours = (storedUser?.totalStudySeconds || 0) / 3600;
  const isPro = Boolean(storedUser?.isPro);
  const proMonths = storedUser?.proMonths || (isPro ? 1 : 0);
  const equippedTitle =
    storedUser?.equippedTitle || storedUser?.title || "Nhập môn học giả";
  const unlockedSet = new Set(
    storedUser?.unlockedTitleIds && storedUser.unlockedTitleIds.length > 0
      ? storedUser.unlockedTitleIds
      : ["nhap-mon-hoc-gia", "thieu-uy"]
  );

  const milestonesData = TITLE_MILESTONES.map((m) => {
    let currentVal = 0;
    let targetVal = 0;
    let unit = "";
    let isMilestoneUnlocked = false;

    if (m.category === "STREAK") {
      currentVal = userStreak;
      targetVal = m.minStreak;
      unit = "ngày";
      isMilestoneUnlocked = userStreak >= targetVal;
    } else if (m.category === "HOURS") {
      currentVal = parseFloat(studyHours.toFixed(1));
      targetVal = m.minHours;
      unit = "giờ";
      isMilestoneUnlocked = studyHours >= targetVal;
    } else if (m.category === "PRO") {
      currentVal = proMonths;
      targetVal = 1;
      unit = "tháng";
      isMilestoneUnlocked = isPro;
    }

    const percent =
      targetVal > 0
        ? Math.min(100, Math.round((currentVal / targetVal) * 100))
        : 100;

    const titles = m.titles.map((t) => {
      let isTitleUnlocked = unlockedSet.has(t.id);
      if (m.category === "PRO") {
        isTitleUnlocked = isPro && proMonths >= (t.minProMonths || 1);
      }
      return {
        id: t.id,
        name: t.name,
        tag: t.tag,
        color: t.color,
        minProMonths: t.minProMonths,
        isUnlocked: isTitleUnlocked,
        isEquipped: equippedTitle === t.name,
      };
    });

    return {
      milestoneId: m.milestoneId,
      category: m.category,
      minStreak: m.minStreak,
      minHours: m.minHours,
      description: m.description,
      isUnlocked: isMilestoneUnlocked,
      progress: {
        current: currentVal,
        target: targetVal,
        unit,
        percent,
      },
      titles,
    };
  });

  return {
    equippedTitle,
    unlockedTitleIds: Array.from(unlockedSet),
    stats: {
      streak: userStreak,
      totalStudySeconds: storedUser?.totalStudySeconds || 0,
      studyHours: parseFloat(studyHours.toFixed(1)),
      isPro,
      proMonths,
    },
    milestones: milestonesData,
  };
}

// Helper lấy màu chữ chuẩn cho danh hiệu theo nhận diện hệ thống
function getTitleColorClass(title) {
  const tag = title?.tag || "";
  const name = title?.name || "";
  if (
    tag === "Tu tiên" ||
    tag === "Học viện" ||
    tag === "Bá đạo" ||
    tag === "Vũ trụ" ||
    name === "Kẻ khờ" ||
    name === "Tịnh tâm thành thánh" ||
    name === "Vũ hóa đăng tiên"
  ) {
    return "text-purple-700 dark:text-purple-300 font-semibold";
  }
  if (tag === "Hải quân" || tag.includes("Pro") || tag === "Gói Pro") {
    return "text-amber-700 dark:text-amber-300 font-semibold";
  }
  // Quân hàm, Lục quân, Ngũ sao
  return "text-stone-900 dark:text-stone-100 font-semibold";
}

export default function TitlesModal({ isOpen, onClose, onEquippedChange }) {
  const [activeTab, setActiveTab] = useState("ALL"); // ALL | STREAK | HOURS | PRO
  const [data, setData] = useState(() => {
    return cachedTitlesData || buildFallbackTitlesData(getStoredUser());
  });
  const [loading, setLoading] = useState(false);
  const [equippingId, setEquippingId] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchTitles = useCallback(() => {
    setLoading(true);

    titlesApi
      .getTitles()
      .then((res) => {
        if (res && res.success && res.data) {
          setData(res.data);
          cachedTitlesData = res.data;
        }
      })
      .catch((err) => {
        console.warn("[TitlesModal] Fetch titles fallback to local:", err.message);
        // Không xóa data hiện có, giữ nguyên giao diện đã render
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Đảm bảo data luôn sẵn sàng ngay lập tức từ storedUser nếu chưa có cache
    if (!cachedTitlesData) {
      setData(buildFallbackTitlesData(getStoredUser()));
    } else {
      setData(cachedTitlesData);
    }

    // Refresh ngầm dữ liệu mới nhất từ server
    fetchTitles();
  }, [isOpen, fetchTitles]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleEquip = async (title) => {
    if (equippingId || title.isEquipped) return;
    setEquippingId(title.id);
    setMessage(null);

    try {
      const res = await titlesApi.equip(title.id);
      if (res.success) {
        const equippedTitleName = res.data?.equippedTitle || title.name;

        // Cập nhật local state
        setData((prev) => {
          if (!prev) return prev;
          const updatedMilestones = prev.milestones.map((m) => ({
            ...m,
            titles: m.titles.map((t) => ({
              ...t,
              isEquipped: t.id === title.id || t.name === equippedTitleName,
            })),
          }));
          const nextData = {
            ...prev,
            equippedTitle: equippedTitleName,
            milestones: updatedMilestones,
          };
          cachedTitlesData = nextData;
          return nextData;
        });

        // Cập nhật localStorage
        const stored = getStoredUser();
        const updatedUser = {
          ...(stored || {}),
          equippedTitle: equippedTitleName,
          activeTitle: equippedTitleName,
          title: equippedTitleName,
        };
        setStoredUser(updatedUser);
        setAuthSession({
          user: updatedUser,
        });

        // Phát event toàn cục để Header, BentoGrid, Dashboard đều nhận ngay lập tức
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("vsr:title-updated", {
              detail: {
                equippedTitle: equippedTitleName,
                activeTitle: equippedTitleName,
                title: equippedTitleName,
                titleId: title.id,
                user: updatedUser,
              },
            })
          );
        }

        setMessage({
          type: "success",
          text: `Đã trang bị danh hiệu "${res.data?.equippedTitle || title.name}"`,
        });

        if (onEquippedChange) {
          onEquippedChange(res.data?.equippedTitle || title.name);
        }
      } else {
        setMessage({
          type: "error",
          text: res.message || "Không thể trang bị danh hiệu.",
        });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || "Lỗi khi trang bị danh hiệu.",
      });
    } finally {
      setEquippingId(null);
    }
  };

  const filteredMilestones = useMemo(() => {
    if (!data?.milestones) return [];
    if (activeTab === "ALL") return data.milestones;
    return data.milestones.filter((m) => m.category === activeTab);
  }, [data, activeTab]);

  const totalTitlesCount = useMemo(() => {
    if (!data?.milestones) {
      return TITLE_MILESTONES.reduce((acc, m) => acc + m.titles.length, 0);
    }
    return data.milestones.reduce((acc, m) => acc + m.titles.length, 0);
  }, [data]);

  const unlockedCount = useMemo(() => {
    return data?.unlockedTitleIds?.length || 2;
  }, [data]);

  const userRank = useMemo(() => {
    if (!data?.stats?.isPro) return "Miễn phí";
    const months = data?.stats?.proMonths || 1;
    if (months >= 6) return "Ultra";
    if (months >= 3) return "Pro";
    return "Plus";
  }, [data?.stats]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      style={{
        backgroundColor: "rgba(20, 18, 16, 0.85)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-[#FAF6F0] text-stone-900 border border-amber-900/15 dark:bg-[#1A1410] dark:text-stone-100 dark:border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: "fadeInScale 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-amber-900/10 bg-[#F4EFE6] dark:border-amber-500/20 dark:bg-[#15100c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-600/15 border border-amber-600/30 text-amber-700 dark:text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Bộ sưu tập Danh hiệu & Quân hàm
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-stone-200/80 text-stone-700 border border-stone-300/80 dark:bg-[#251D16] dark:text-stone-300 dark:border-amber-500/20 flex items-center gap-1.5">
                  {unlockedCount}/{totalTitlesCount}
                  {loading && (
                    <Loader2 className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                </span>
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Mỗi mốc thành tích mở khóa đồng thời 2–3 danh hiệu riêng biệt. Hãy chọn danh xưng xứng tầm.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-[#251D16] transition-colors"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Equipped Highlight & Stats Banner */}
        {data && (
          <div className="px-6 py-3.5 bg-stone-200/50 border-b border-amber-900/10 text-stone-700 dark:bg-[#15100c]/80 dark:border-amber-500/20 dark:text-stone-300 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-600 dark:text-stone-400">Đang trang bị:</span>
              <span
                className={cn(
                  "font-semibold px-2.5 py-0.5 rounded-full border shadow-xs bg-stone-100/90 border-stone-300/80 text-stone-800 dark:bg-[#251D16] dark:border-amber-500/20 dark:text-stone-200",
                  getTitleColorClass({
                    name: data.equippedTitle,
                    tag: TITLE_STYLE_MAP[data.equippedTitle]?.tag,
                  })
                )}
              >
                {data.equippedTitle}
              </span>
            </div>

            <div className="flex items-center gap-4 text-stone-700 dark:text-stone-300">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Streak:{" "}
                <strong className="text-stone-900 dark:text-stone-100">{data.stats?.streak} ngày</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Học:{" "}
                <strong className="text-stone-900 dark:text-stone-100">
                  {data.stats?.studyHours} giờ
                </strong>
              </span>
              <span className="flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Hạng:{" "}
                <strong className="font-semibold text-amber-700 dark:text-amber-300">
                  {userRank}
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* Notification message */}
        {message && (
          <div
            className={cn(
              "mx-6 mt-3 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between border",
              message.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-300"
            )}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-stone-400 hover:text-stone-600 dark:text-zinc-400 dark:hover:text-zinc-200 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Category Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-amber-900/10 dark:border-amber-500/20 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          {[
            { id: "ALL", label: "Tất cả", icon: Sparkles },
            { id: "STREAK", label: "Chuỗi ngày", icon: Flame },
            { id: "HOURS", label: "Tổng giờ học", icon: Clock },
            { id: "PRO", label: "Gói Pro", icon: Crown },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
                  isActive
                    ? "bg-amber-100/90 text-amber-900 border border-amber-600/40 shadow-xs dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500/40"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-[#251D16]"
                )}
              >
                <Icon
                  className={cn(
                    "w-3.5 h-3.5",
                    isActive
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-stone-500 dark:text-stone-400"
                  )}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Milestones Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading && !data ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-500 dark:text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600 dark:text-amber-400" />
              <p className="text-xs">Đang tải bộ sưu tập danh hiệu...</p>
            </div>
          ) : filteredMilestones.length === 0 ? (
            <div className="py-16 text-center text-stone-500 dark:text-stone-400 text-xs">
              Chưa có danh hiệu nào trong danh mục này.
            </div>
          ) : (
            filteredMilestones.map((m) => {
              const isUnlocked = m.isUnlocked;
              const CategoryIcon =
                m.category === "STREAK"
                  ? Flame
                  : m.category === "HOURS"
                  ? Clock
                  : Crown;

              return (
                <div
                  key={m.milestoneId}
                  className={cn(
                    "rounded-xl border p-4 transition-all duration-200 space-y-3.5",
                    isUnlocked
                      ? "bg-[#FAF6F0] border-amber-900/15 dark:bg-[#201b18] dark:border-amber-500/20 shadow-xs"
                      : "bg-stone-100/60 border-stone-300/50 dark:bg-[#181412]/60 dark:border-[#2d2620] opacity-80"
                  )}
                >
                  {/* Milestone Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                          isUnlocked
                            ? "bg-amber-600/15 text-amber-700 border border-amber-600/30 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                            : "bg-stone-200/80 text-stone-500 border border-stone-300 dark:bg-[#201b18] dark:text-stone-500 dark:border-stone-700"
                        )}
                      >
                        <CategoryIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3
                            className={cn(
                              "text-sm font-semibold",
                              isUnlocked ? "text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"
                            )}
                          >
                            {m.category === "STREAK" && `Mốc Streak ${m.minStreak} ngày`}
                            {m.category === "HOURS" && `Mốc Học ${m.minHours} giờ`}
                            {m.category === "PRO" && "Cấp Hội viên Pro"}
                          </h3>

                          {isUnlocked ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-600/15 text-amber-800 border border-amber-600/30 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30">
                              Đã đạt mốc
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-200/80 text-stone-600 border border-stone-300 dark:bg-[#201b18] dark:text-stone-400 dark:border-stone-700 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> Chưa mở
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-stone-600 dark:text-stone-400 italic mt-0.5 line-clamp-2">
                          &ldquo;{m.description}&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {!isUnlocked && m.progress && (
                      <div className="sm:text-right shrink-0">
                        <div className="text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Tiến độ:{" "}
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">
                            {m.progress.current}/{m.progress.target} {m.progress.unit}
                          </span>
                        </div>
                        <div className="w-32 sm:w-28 h-1.5 bg-stone-200 rounded-full overflow-hidden border border-stone-300 dark:bg-[#141210] dark:border-[#2d2620]">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-500 rounded-full transition-all duration-300"
                            style={{ width: `${m.progress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Child Titles Grid (2-3 distinct titles per milestone) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                    {m.titles.map((title) => {
                      const isTitleUnlocked = title.isUnlocked;
                      const isEquipped = title.isEquipped;
                      const isEquipping = equippingId === title.id;

                      return (
                        <div
                          key={title.id}
                          className={cn(
                            "relative flex items-center justify-between p-2.5 rounded-lg border transition-all duration-150",
                            isEquipped
                              ? "bg-amber-100/90 border-amber-600 ring-1 ring-amber-500/40 shadow-xs dark:bg-[#2d241d] dark:border-amber-500 dark:ring-amber-500/40 text-stone-900 dark:text-stone-100"
                              : isTitleUnlocked
                              ? "bg-stone-100/90 border-stone-300/80 text-stone-800 dark:bg-[#251D16] dark:border-amber-500/20 dark:text-stone-200 hover:border-amber-600/40"
                              : "bg-stone-100/50 border-stone-300/50 text-stone-400 dark:bg-[#181412]/60 dark:border-stone-800 dark:text-stone-500 opacity-60"
                          )}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              {!isTitleUnlocked && (
                                <Lock className="w-3 h-3 text-stone-400 dark:text-stone-500 shrink-0" />
                              )}
                              <span
                                className={cn(
                                  "text-xs truncate",
                                  isTitleUnlocked
                                    ? getTitleColorClass(title)
                                    : "text-stone-400 dark:text-stone-500 font-medium"
                                )}
                              >
                                {title.name}
                              </span>
                            </div>

                            <span className="text-[10px] text-stone-500 dark:text-stone-400 font-normal">
                              {title.tag}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {isEquipped ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 dark:text-amber-200 dark:bg-amber-950/40 dark:border-amber-500/40 px-2.5 py-1 rounded-md shadow-xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                                Đang dùng
                              </span>
                            ) : isTitleUnlocked ? (
                              <button
                                type="button"
                                onClick={() => handleEquip(title)}
                                disabled={isEquipping}
                                className="bg-amber-700 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-500 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {isEquipping ? (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  "Trang bị"
                                )}
                              </button>
                            ) : (
                              <span className="text-[10px] text-stone-500 dark:text-stone-400 px-2 py-0.5 rounded bg-stone-200/80 dark:bg-[#181412] border border-stone-300/60 dark:border-stone-800">
                                Khóa
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-amber-900/10 bg-[#F4EFE6] dark:border-amber-500/20 dark:bg-[#15100c] flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 shrink-0">
          <span>
            💡 Hãy giữ chuỗi Streak & học tập mỗi ngày để thu thập trọn bộ quân hàm.
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-stone-200/80 hover:bg-stone-300/80 text-stone-900 border border-stone-300/80 dark:bg-[#251D16] dark:hover:bg-[#2d241d] dark:text-stone-100 dark:border-amber-500/20 transition-colors font-medium"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
