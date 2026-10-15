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
import { titlesApi, getStoredUser, setAuthSession } from "@/lib/api";
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
        // Cập nhật local state
        setData((prev) => {
          if (!prev) return prev;
          const updatedMilestones = prev.milestones.map((m) => ({
            ...m,
            titles: m.titles.map((t) => ({
              ...t,
              isEquipped: t.id === title.id,
            })),
          }));
          const nextData = {
            ...prev,
            equippedTitle: res.data.equippedTitle,
            milestones: updatedMilestones,
          };
          cachedTitlesData = nextData;
          return nextData;
        });

        // Cập nhật localStorage
        const stored = getStoredUser();
        const updatedUser = {
          ...(stored || {}),
          equippedTitle: res.data.equippedTitle,
          title: res.data.equippedTitle,
        };
        setAuthSession({
          user: updatedUser,
        });

        // Phát event toàn cục để Header, BentoGrid, Dashboard đều nhận ngay lập tức
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("vsr:title-updated", {
              detail: {
                equippedTitle: res.data.equippedTitle,
                title: res.data.equippedTitle,
                user: updatedUser,
              },
            })
          );
        }

        setMessage({
          type: "success",
          text: `Đã trang bị danh hiệu "${res.data.equippedTitle}"`,
        });

        if (onEquippedChange) {
          onEquippedChange(res.data.equippedTitle);
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
        backgroundColor: "rgba(9, 9, 11, 0.8)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-zinc-900 border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: "fadeInScale 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-zinc-800/70 bg-zinc-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                Bộ sưu tập Danh hiệu & Quân hàm
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 flex items-center gap-1.5">
                  {unlockedCount}/{totalTitlesCount}
                  {loading && (
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                  )}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Mỗi mốc thành tích mở khóa đồng thời 2–3 danh hiệu riêng biệt. Hãy chọn danh xưng xứng tầm.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Equipped Highlight & Stats Banner */}
        {data && (
          <div className="px-6 py-3.5 bg-zinc-950/60 border-b border-zinc-800/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Đang trang bị:</span>
              <span
                className={cn(
                  "font-semibold px-2.5 py-0.5 rounded-full border shadow-sm",
                  TITLE_STYLE_MAP[data.equippedTitle]?.color ||
                    "text-zinc-200 border-zinc-700 bg-zinc-800/60"
                )}
              >
                {data.equippedTitle}
              </span>
            </div>

            <div className="flex items-center gap-4 text-zinc-400">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                Streak:{" "}
                <strong className="text-zinc-200">{data.stats?.streak} ngày</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Học:{" "}
                <strong className="text-zinc-200">
                  {data.stats?.studyHours} giờ
                </strong>
              </span>
              <span className="flex items-center gap-1">
                <Crown
                  className={cn(
                    "w-3.5 h-3.5",
                    userRank === "Ultra" && "text-amber-400",
                    userRank === "Pro" && "text-violet-400",
                    userRank === "Plus" && "text-sky-400",
                    userRank === "Miễn phí" && "text-zinc-500"
                  )}
                />
                Hạng:{" "}
                <strong
                  className={cn(
                    "font-semibold",
                    userRank === "Ultra" && "text-amber-400",
                    userRank === "Pro" && "text-violet-400",
                    userRank === "Plus" && "text-sky-400",
                    userRank === "Miễn phí" && "text-zinc-300"
                  )}
                >
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
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-red-500/10 border-red-500/20 text-red-300"
            )}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-zinc-400 hover:text-zinc-200 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Category Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-zinc-800/40 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
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
                    ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/80"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                )}
              >
                <Icon
                  className={cn(
                    "w-3.5 h-3.5",
                    isActive
                      ? "text-amber-400"
                      : "text-zinc-500"
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
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <p className="text-xs">Đang tải bộ sưu tập danh hiệu...</p>
            </div>
          ) : filteredMilestones.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-xs">
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
                      ? "bg-zinc-800/30 border-zinc-700/60"
                      : "bg-zinc-950/40 border-zinc-800/40 opacity-75"
                  )}
                >
                  {/* Milestone Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                          isUnlocked
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-zinc-800/80 text-zinc-500 border border-zinc-700/40"
                        )}
                      >
                        <CategoryIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3
                            className={cn(
                              "text-sm font-semibold",
                              isUnlocked ? "text-zinc-100" : "text-zinc-400"
                            )}
                          >
                            {m.category === "STREAK" && `Mốc Streak ${m.minStreak} ngày`}
                            {m.category === "HOURS" && `Mốc Học ${m.minHours} giờ`}
                            {m.category === "PRO" && "Cấp Hội viên Pro"}
                          </h3>

                          {isUnlocked ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Đã đạt mốc
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> Chưa mở
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-400 italic mt-0.5 line-clamp-2">
                          &ldquo;{m.description}&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {!isUnlocked && m.progress && (
                      <div className="sm:text-right shrink-0">
                        <div className="text-[11px] font-medium text-zinc-400 mb-1">
                          Tiến độ:{" "}
                          <span className="text-amber-400">
                            {m.progress.current}/{m.progress.target} {m.progress.unit}
                          </span>
                        </div>
                        <div className="w-32 sm:w-28 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-300"
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
                              ? "bg-violet-950/20 border-violet-500/50 ring-1 ring-violet-500/30"
                              : isTitleUnlocked
                              ? "bg-zinc-800/50 border-zinc-700/60 hover:border-zinc-600"
                              : "bg-zinc-900/40 border-zinc-800/40 opacity-60"
                          )}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              {!isTitleUnlocked && (
                                <Lock className="w-3 h-3 text-zinc-500 shrink-0" />
                              )}
                              <span
                                className={cn(
                                  "text-xs font-semibold truncate",
                                  isTitleUnlocked ? title.color : "text-zinc-400"
                                )}
                              >
                                {title.name}
                              </span>
                            </div>

                            <span className="text-[10px] text-zinc-500 font-normal">
                              {title.tag}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {isEquipped ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shadow-xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                                Đang dùng
                              </span>
                            ) : isTitleUnlocked ? (
                              <button
                                type="button"
                                onClick={() => handleEquip(title)}
                                disabled={isEquipping}
                                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-700/80 hover:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600/60 transition-all flex items-center gap-1"
                              >
                                {isEquipping ? (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  "Trang bị"
                                )}
                              </button>
                            ) : (
                              <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-800/40">
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
        <div className="px-6 py-3.5 border-t border-zinc-800/70 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <span>
            💡 Hãy giữ chuỗi Streak & học tập mỗi ngày để thu thập trọn bộ quân hàm.
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors font-medium"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
