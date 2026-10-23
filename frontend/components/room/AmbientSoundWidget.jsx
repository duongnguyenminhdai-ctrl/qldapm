"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Headphones,
  CloudRain,
  Waves,
  Coffee,
  Flame,
  Trees,
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/constants";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * 6 Âm thanh tập trung cốt lõi (Ambient Sounds)
 */
export const AMBIENT_TRACKS = [
  {
    id: "rain",
    name: "Tiếng mưa rơi",
    category: "Thiên nhiên",
    description: "Mưa rào êm dịu, dễ ngủ & tĩnh tâm",
    icon: CloudRain,
    src: "/audio/rain.mp3",
    defaultVolume: 50,
  },
  {
    id: "waves",
    name: "Tiếng sóng biển",
    category: "Biển cả",
    description: "Sóng vỗ bờ cát nhịp nhàng, giảm căng thẳng",
    icon: Waves,
    src: "/audio/waves.mp3",
    defaultVolume: 45,
  },
  {
    id: "cafe",
    name: "Quán cà phê",
    category: "Đô thị",
    description: "Rì rầm ấm cúng và tiếng ly tách quen thuộc",
    icon: Coffee,
    src: "/audio/cafe.mp3",
    defaultVolume: 35,
  },
  {
    id: "lofi",
    name: "Nhạc Lofi Beat",
    category: "Giai điệu",
    description: "Chillhop chậm rãi, giữ nhịp học tập thư giãn",
    icon: Headphones,
    src: "/audio/lofi.mp3",
    defaultVolume: 55,
  },
  {
    id: "campfire",
    name: "Tiếng lửa trại",
    category: "Ấm cúng",
    description: "Than củi nổ tí tách mộc mạc bên ánh lửa",
    icon: Flame,
    src: "/audio/campfire.mp3",
    defaultVolume: 45,
  },
  {
    id: "forest",
    name: "Rừng thông & Gió",
    category: "Thiên nhiên",
    description: "Gió thổi xào xạc luồn qua tán lá xanh",
    icon: Trees,
    src: "/audio/forest.mp3",
    defaultVolume: 50,
  },
];

/**
 * Presets phối âm một chạm (One-click Moods)
 */
const PRESETS = [
  {
    id: "rain-lofi",
    label: "Mưa & Lofi",
    description: "Combo kinh điển cho buổi học đêm",
    settings: {
      rain: { active: true, volume: 55 },
      lofi: { active: true, volume: 60 },
      waves: { active: false, volume: 45 },
      cafe: { active: false, volume: 35 },
      campfire: { active: false, volume: 45 },
      forest: { active: false, volume: 50 },
    },
  },
  {
    id: "cafe-work",
    label: "Quán Cà Phê",
    description: "Như đang ngồi góc quen quán sách",
    settings: {
      cafe: { active: true, volume: 45 },
      lofi: { active: true, volume: 35 },
      rain: { active: false, volume: 50 },
      waves: { active: false, volume: 45 },
      campfire: { active: false, volume: 45 },
      forest: { active: false, volume: 50 },
    },
  },
  {
    id: "campfire-night",
    label: "Lửa Trại & Rừng",
    description: "Ấm áp giữa thiên nhiên tĩnh mịch",
    settings: {
      campfire: { active: true, volume: 55 },
      forest: { active: true, volume: 45 },
      rain: { active: false, volume: 50 },
      waves: { active: false, volume: 45 },
      cafe: { active: false, volume: 35 },
      lofi: { active: false, volume: 55 },
    },
  },
  {
    id: "ocean-breeze",
    label: "Gió Biển Đêm",
    description: "Nhịp sóng vỗ bình yên sâu lắng",
    settings: {
      waves: { active: true, volume: 60 },
      forest: { active: true, volume: 30 },
      rain: { active: false, volume: 50 },
      cafe: { active: false, volume: 35 },
      lofi: { active: false, volume: 55 },
      campfire: { active: false, volume: 45 },
    },
  },
];

const STORAGE_KEY = "virtual_study_ambient_sounds_v1";

const DEFAULT_STATE = {
  isMutedAll: false,
  masterVolume: 85,
  tracks: AMBIENT_TRACKS.reduce((acc, t) => {
    acc[t.id] = { active: false, volume: t.defaultVolume };
    return acc;
  }, {}),
};

export function AmbientSoundWidget({ className }) {
  const [open, setOpen] = useState(false);
  const [soundState, setSoundState] = useState(DEFAULT_STATE);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef(null);
  const audioRefs = useRef({});

  // 1. Khôi phục cài đặt từ localStorage khi mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSoundState((prev) => ({
          isMutedAll: parsed.isMutedAll ?? prev.isMutedAll,
          masterVolume: parsed.masterVolume ?? prev.masterVolume,
          tracks: {
            ...prev.tracks,
            ...(parsed.tracks || {}),
          },
        }));
      }
    } catch (e) {
      console.warn("[AmbientSound] Failed to read localStorage:", e);
    }
  }, []);

  // 2. Lưu trạng thái vào localStorage khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          isMutedAll: soundState.isMutedAll,
          masterVolume: soundState.masterVolume,
          tracks: soundState.tracks,
        })
      );
    } catch (e) {
      console.warn("[AmbientSound] Failed to save to localStorage:", e);
    }
  }, [soundState]);

  // 3. Khởi tạo & đồng bộ các HTML5 Audio objects
  useEffect(() => {
    // Khởi tạo audio elements nếu chưa có
    AMBIENT_TRACKS.forEach((track) => {
      if (!audioRefs.current[track.id]) {
        const audio = new Audio(track.src);
        audio.loop = true;
        audio.preload = "auto";
        audioRefs.current[track.id] = audio;
      }
    });

    // Cập nhật âm lượng & trạng thái phát của từng track
    AMBIENT_TRACKS.forEach((track) => {
      const audio = audioRefs.current[track.id];
      if (!audio) return;

      const trackInfo = soundState.tracks[track.id] || {
        active: false,
        volume: track.defaultVolume,
      };
      const effectiveVolume = soundState.isMutedAll
        ? 0
        : (trackInfo.volume / 100) * (soundState.masterVolume / 100);

      audio.volume = Math.max(0, Math.min(1, effectiveVolume));

      if (trackInfo.active && !soundState.isMutedAll) {
        // Chỉ phát nếu người dùng đã tương tác (click) để tuân thủ Autoplay Policy
        if (hasInteracted) {
          audio.play().catch((err) => {
            // Autoplay bị chặn bởi trình duyệt nếu chưa có tương tác
            console.debug(`[AmbientSound] Autoplay blocked for ${track.id}:`, err?.message);
          });
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    });

    // Cleanup khi component unmount (ví dụ khi rời phòng học)
    return () => {
      // Khi component unmount hoàn toàn
    };
  }, [soundState, hasInteracted]);

  // Cleanup toàn bộ âm thanh khi rời trang/unmount
  useEffect(() => {
    const currentAudios = audioRefs.current;
    return () => {
      Object.values(currentAudios).forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
    };
  }, []);

  // 4. Đóng popover khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && open) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Đếm số lượng âm thanh đang hoạt động
  const activeCount = useMemo(() => {
    return Object.values(soundState.tracks).filter((t) => t.active).length;
  }, [soundState.tracks]);

  const isAnyActive = activeCount > 0;
  const isActuallyPlaying = isAnyActive && !soundState.isMutedAll;

  // Bật/tắt 1 âm thanh
  const handleToggleTrack = useCallback((trackId) => {
    setHasInteracted(true);
    const audio = audioRefs.current[trackId];
    setSoundState((prev) => {
      const current = prev.tracks[trackId] || { active: false, volume: 50 };
      const nextActive = !current.active;

      // Trực tiếp phát/dừng audio trong sự kiện click của user để tuân thủ Autoplay Policy
      if (audio) {
        if (nextActive) {
          const effectiveVolume = (current.volume / 100) * (prev.masterVolume / 100);
          audio.volume = Math.max(0, Math.min(1, effectiveVolume));
          audio.play().catch((err) => console.debug("[AmbientSound] Play error:", err?.message));
        } else {
          audio.pause();
        }
      }

      // Nếu đang Mute All mà user bật track mới, tự động mở Mute để nghe được
      return {
        ...prev,
        isMutedAll: prev.isMutedAll && nextActive ? false : prev.isMutedAll,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...current,
            active: nextActive,
          },
        },
      };
    });
  }, []);

  // Thay đổi âm lượng 1 track
  const handleChangeTrackVolume = useCallback((trackId, newVol) => {
    setHasInteracted(true);
    const audio = audioRefs.current[trackId];
    setSoundState((prev) => {
      const current = prev.tracks[trackId] || { active: false, volume: 50 };
      if (audio && current.active && !prev.isMutedAll) {
        audio.volume = Math.max(0, Math.min(1, (newVol / 100) * (prev.masterVolume / 100)));
        if (audio.paused) {
          audio.play().catch(() => {});
        }
      }
      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackId]: {
            ...current,
            volume: newVol,
          },
        },
      };
    });
  }, []);

  // Bật / tắt Mute toàn bộ
  const handleToggleMasterMute = useCallback(() => {
    setHasInteracted(true);
    setSoundState((prev) => ({
      ...prev,
      isMutedAll: !prev.isMutedAll,
    }));
  }, []);

  // Thay đổi Master Volume
  const handleChangeMasterVolume = useCallback((newVol) => {
    setHasInteracted(true);
    setSoundState((prev) => ({
      ...prev,
      masterVolume: newVol,
    }));
  }, []);

  // Tắt toàn bộ âm thanh (Mute All / Stop All)
  const handleStopAll = useCallback(() => {
    setHasInteracted(true);
    setSoundState((prev) => {
      const updated = {};
      Object.keys(prev.tracks).forEach((k) => {
        updated[k] = { ...prev.tracks[k], active: false };
      });
      return {
        ...prev,
        tracks: updated,
      };
    });
  }, []);

  // Áp dụng Preset
  const handleApplyPreset = useCallback((preset) => {
    setHasInteracted(true);
    setSoundState((prev) => ({
      ...prev,
      isMutedAll: false,
      tracks: {
        ...prev.tracks,
        ...preset.settings,
      },
    }));
  }, []);

  // Reset về cài đặt mặc định
  const handleResetDefaults = useCallback(() => {
    setHasInteracted(true);
    setSoundState(DEFAULT_STATE);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative inline-flex items-center", className)}>
      {/* Nút bấm trên Floating Toolbar */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            id="btn-ambient-sounds"
            onClick={() => {
              setHasInteracted(true);
              setOpen((prev) => !prev);
            }}
            aria-label="Không gian âm thanh tập trung"
            aria-expanded={open}
            className={cn(
              "dock-control relative transition duration-taste ease-taste",
              (open || isActuallyPlaying) && "dock-control-on text-zinc-100",
              isActuallyPlaying && "border border-emerald-500/30"
            )}
          >
            <Headphones className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />

            {/* Micro Badge / Equalizer khi đang phát */}
            {isActuallyPlaying && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-semibold text-zinc-950 shadow-sm shadow-emerald-500/40"
                aria-label={`Đang phát ${activeCount} âm thanh`}
              >
                {activeCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-center">
          <div className="font-medium">Âm thanh tập trung</div>
          <div className="text-[11px] text-zinc-400">
            {isActuallyPlaying
              ? `Đang phát ${activeCount} âm thanh`
              : "Mưa, Lofi, Cà phê, Gió..."}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Popover Card tinh tế tông màu Zinc/Dark */}
      {open && (
        <div
          role="dialog"
          aria-label="Không gian âm thanh tập trung"
          className={cn(
            "surface-blur absolute bottom-full mb-3 z-[60] flex flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-[#FAF8F5]/98 text-[#2D241E] p-0 shadow-2xl backdrop-blur-sm ring-1 ring-stone-200/50 dark:border-zinc-800/90 dark:bg-zinc-950/95 dark:text-zinc-100 dark:ring-white/5",
            // Canh lề thông minh cho mobile / desktop
            "-right-16 sm:-right-8 md:left-1/2 md:-translate-x-1/2",
            "w-[340px] xs:w-[375px] sm:w-[410px] max-w-[calc(100vw-24px)]",
            "animate-in fade-in-0 zoom-in-95 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800/80 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-200 border border-stone-300 text-stone-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200">
                <Headphones className="h-4 w-4" strokeWidth={ICON_STROKE} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-[#2D241E] dark:text-zinc-100">
                    Âm thanh tập trung
                  </h3>
                  {isActuallyPlaying ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {activeCount} đang phát
                    </span>
                  ) : (
                    <span className="rounded-full bg-stone-200 text-stone-600 dark:bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium dark:text-zinc-400">
                      Sẵn sàng
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                  Phát cục bộ trên thiết bị của bạn
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Nút Master Mute */}
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleToggleMasterMute}
                    aria-label={soundState.isMutedAll ? "Bật âm lượng tổng" : "Tắt âm lượng tổng"}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-200 hover:text-[#2D241E] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                      soundState.isMutedAll && "bg-rose-500/15 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20"
                    )}
                  >
                    {soundState.isMutedAll ? (
                      <VolumeX className="h-4 w-4" strokeWidth={ICON_STROKE} />
                    ) : (
                      <Volume2 className="h-4 w-4" strokeWidth={ICON_STROKE} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {soundState.isMutedAll ? "Bật âm thanh (Unmute)" : "Tắt âm thanh (Mute)"}
                </TooltipContent>
              </Tooltip>

              {/* Nút Đóng */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng bảng âm thanh"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-200 hover:text-[#2D241E] dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" strokeWidth={ICON_STROKE} />
              </button>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-b border-stone-200 bg-stone-100/60 dark:border-zinc-800/50 dark:bg-zinc-900/40 scrollbar-quiet">
            <span className="flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-zinc-500 shrink-0 mr-0.5">
              <Sparkles className="h-3 w-3 text-amber-500" strokeWidth={ICON_STROKE} />
              Gợi ý:
            </span>
            {PRESETS.map((p) => {
              // Kiểm tra xem preset này có đang active không
              const isPresetActive = Object.entries(p.settings).every(([key, conf]) => {
                const current = soundState.tracks[key];
                return current && current.active === conf.active;
              });

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition active:scale-[0.98]",
                    isPresetActive
                      ? "bg-[#b3894e] text-white dark:bg-zinc-200 dark:text-zinc-950 shadow-sm font-semibold"
                      : "bg-stone-200/70 text-stone-700 hover:bg-stone-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700/80 dark:hover:text-zinc-100"
                  )}
                  title={p.description}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Sounds List Scrollable Container */}
          <div className="max-h-[340px] overflow-y-auto px-4 py-3 space-y-2.5 scrollbar-quiet">
            {AMBIENT_TRACKS.map((track) => {
              const IconComp = track.icon;
              const state = soundState.tracks[track.id] || {
                active: false,
                volume: track.defaultVolume,
              };
              const isPlayingThis = state.active && !soundState.isMutedAll;

              return (
                <div
                  key={track.id}
                  className={cn(
                    "group relative rounded-xl border p-2.5 transition duration-taste ease-taste",
                    isPlayingThis
                      ? "border-[#b3894e]/50 bg-amber-50/70 dark:border-zinc-700/80 dark:bg-zinc-900/90 shadow-sm"
                      : "border-stone-200/80 bg-stone-100/40 hover:border-stone-300 hover:bg-stone-100/80 dark:border-zinc-800/50 dark:bg-zinc-900/30 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Icon & Sound Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition",
                          isPlayingThis
                            ? "border-emerald-500/40 bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "border-stone-200 bg-stone-200/60 text-stone-500 group-hover:text-stone-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200"
                        )}
                      >
                        <IconComp className="h-4 w-4" strokeWidth={ICON_STROKE} />

                        {/* Equalizer animation mini bars */}
                        {isPlayingThis && (
                          <div className="absolute inset-0 flex items-end justify-center gap-[2px] pb-1.5 opacity-60">
                            <span className="w-[2px] bg-emerald-500 rounded-full animate-eq-1" />
                            <span className="w-[2px] bg-emerald-500 rounded-full animate-eq-2" />
                            <span className="w-[2px] bg-emerald-500 rounded-full animate-eq-3" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-semibold truncate",
                              isPlayingThis ? "text-[#2D241E] dark:text-zinc-100" : "text-stone-700 dark:text-zinc-300"
                            )}
                          >
                            {track.name}
                          </span>
                          <span className="text-[10px] text-stone-500 dark:text-zinc-400">
                            {state.volume}%
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate">
                          {track.description}
                        </p>
                      </div>
                    </div>

                    {/* Right: Nút Bật/Tắt riêng biệt */}
                    <button
                      type="button"
                      onClick={() => handleToggleTrack(track.id)}
                      aria-label={`${state.active ? "Tắt" : "Bật"} ${track.name}`}
                      aria-pressed={state.active}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition active:scale-[0.96]",
                        isPlayingThis
                          ? "border-zinc-200 bg-zinc-100 text-zinc-950 hover:bg-white shadow-sm"
                          : "border-zinc-800 bg-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-700/80 hover:text-zinc-200"
                      )}
                    >
                      {isPlayingThis ? (
                        <Pause className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <Play className="h-3.5 w-3.5 ml-0.5 fill-current" />
                      )}
                    </button>
                  </div>

                  {/* Thanh trượt âm lượng độc lập */}
                  <div className="mt-2.5 flex items-center gap-2.5 px-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleChangeTrackVolume(
                          track.id,
                          state.volume > 0 ? 0 : track.defaultVolume
                        )
                      }
                      aria-label="Tắt/bật âm lượng nhanh"
                      className="text-zinc-500 hover:text-zinc-300 transition"
                    >
                      {state.volume === 0 ? (
                        <VolumeX className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
                      ) : state.volume < 50 ? (
                        <Volume1 className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
                      )}
                    </button>

                    <div className="flex-1">
                      <Slider
                        value={[state.volume]}
                        min={0}
                        max={100}
                        step={1}
                        aria-label={`Âm lượng ${track.name}`}
                        onValueChange={(val) => {
                          const newV = val[0] ?? 0;
                          handleChangeTrackVolume(track.id, newV);
                          // Nếu đang kéo volume lên mà track đang tắt, tự động bật track
                          if (!state.active && newV > 0) {
                            handleToggleTrack(track.id);
                          }
                        }}
                        className="py-1"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Master Control Footer */}
          <div className="border-t border-zinc-800/80 bg-zinc-950 px-4 py-3">
            {/* Master Volume Slider */}
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <Volume2 className="h-3.5 w-3.5 text-zinc-400" strokeWidth={ICON_STROKE} />
                <span>Âm lượng tổng</span>
              </div>
              <span className="text-[11px] font-semibold text-zinc-300">
                {soundState.isMutedAll ? "Đã tắt" : `${soundState.masterVolume}%`}
              </span>
            </div>

            <Slider
              value={[soundState.masterVolume]}
              min={0}
              max={100}
              step={1}
              disabled={soundState.isMutedAll}
              aria-label="Âm lượng tổng"
              onValueChange={(val) => handleChangeMasterVolume(val[0] ?? 0)}
              className="py-1 mb-3"
            />

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/40">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 transition hover:text-zinc-200"
              >
                <RotateCcw className="h-3 w-3" strokeWidth={ICON_STROKE} />
                Mặc định
              </button>

              {isAnyActive && (
                <button
                  type="button"
                  onClick={handleStopAll}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 transition active:scale-[0.98]"
                >
                  <VolumeX className="h-3 w-3" strokeWidth={ICON_STROKE} />
                  Tắt toàn bộ ({activeCount})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
