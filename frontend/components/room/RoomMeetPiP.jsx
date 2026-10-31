"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ExternalLink,
  X,
  Maximize2,
  Users,
  ScreenShare,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Track } from "livekit-client";
import {
  useTracks,
  useParticipants,
  useLocalParticipant,
  VideoTrack,
} from "@livekit/components-react";
import { cn } from "@/lib/utils";

/**
 * Bảng màu pastel/dark gradient ngẫu nhiên cho avatar các thành viên khi tắt camera
 * (Lấy cảm hứng từ Google Meet: xanh ngọc, cam đất, tím sẫm, xanh nước biển)
 */
const AVATAR_BG_COLORS = [
  "bg-amber-800/80 text-amber-200 border-amber-600/40",
  "bg-emerald-800/80 text-emerald-200 border-emerald-600/40",
  "bg-teal-800/80 text-teal-200 border-teal-600/40",
  "bg-indigo-800/80 text-indigo-200 border-indigo-600/40",
  "bg-rose-800/80 text-rose-200 border-rose-600/40",
  "bg-purple-800/80 text-purple-200 border-purple-600/40",
  "bg-cyan-800/80 text-cyan-200 border-cyan-600/40",
];

function getMemberColor(id = "", name = "") {
  const str = String(id || name || "guest");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_BG_COLORS.length;
  return AVATAR_BG_COLORS[idx];
}

function getInitials(name = "") {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Sao chép toàn bộ stylesheets từ document chính sang PiP Window document
 */
function copyStylesheets(sourceDoc, targetDoc) {
  try {
    Array.from(sourceDoc.styleSheets).forEach((styleSheet) => {
      try {
        if (styleSheet.href) {
          const link = targetDoc.createElement("link");
          link.rel = "stylesheet";
          link.type = styleSheet.type || "text/css";
          link.media = styleSheet.media?.mediaText || "all";
          link.href = styleSheet.href;
          targetDoc.head.appendChild(link);
        } else if (styleSheet.cssRules) {
          const style = targetDoc.createElement("style");
          Array.from(styleSheet.cssRules).forEach((rule) => {
            style.appendChild(targetDoc.createTextNode(rule.cssText));
          });
          targetDoc.head.appendChild(style);
        }
      } catch (_) {
        // Fallback CORS
        if (styleSheet.href) {
          const link = targetDoc.createElement("link");
          link.rel = "stylesheet";
          link.href = styleSheet.href;
          targetDoc.head.appendChild(link);
        }
      }
    });

    const baseStyle = targetDoc.createElement("style");
    baseStyle.textContent = `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: #12100e !important;
        color: #f5ede3 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        overflow: hidden !important;
        user-select: none !important;
        -webkit-font-smoothing: antialiased;
      }
      * {
        box-sizing: border-box !important;
      }
      ::-webkit-scrollbar {
        width: 4px;
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(195, 164, 123, 0.3);
        border-radius: 4px;
      }
    `;
    targetDoc.head.appendChild(baseStyle);
  } catch (err) {
    console.warn("[MeetPiP] Lỗi copy stylesheet:", err);
  }
}

/**
 * Nội dung hiển thị bên trong cửa sổ thanh dọc Meet PiP
 */
function MeetPiPView({
  roomTitle,
  roomCode,
  members = [],
  speakingId = null,
  screenSharing = false,
  onLeave,
  onClosePip,
  onFocusTab,
}) {
  const participants = useParticipants();
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    localParticipant,
  } = useLocalParticipant();

  const trackReferences = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false }
  );

  // Tìm màn hình chia sẻ (Screen Share)
  const screenShareTrack = trackReferences.find(
    (t) =>
      t.source === Track.Source.ScreenShare &&
      t.publication &&
      !t.publication.isMuted
  );

  const cameraTracks = trackReferences.filter(
    (t) => t.source === Track.Source.Camera
  );

  // Người đang nói hoặc đang chia sẻ màn hình
  const activePresenter = screenShareTrack
    ? screenShareTrack.participant?.name || "Thành viên"
    : null;

  const activeSpeakerMember = members.find((m) => {
    const lk = participants.find((p) => String(p.identity) === String(m.id));
    return Boolean(lk?.isSpeaking || m.isSpeaking || speakingId === m.id);
  });

  // Hợp nhất dữ liệu thành viên
  const enrichedMembers = members.map((member) => {
    const lk = participants.find(
      (p) =>
        String(p.identity) === String(member.id) ||
        (p.name && member.name && p.name.trim() === member.name.trim())
    );

    const camTrack = cameraTracks.find(
      (t) =>
        String(t.participant.identity) === String(member.id) ||
        (lk && t.participant.identity === lk.identity)
    );

    const micOn =
      lk !== undefined ? lk.isMicrophoneEnabled : member.micOn;
    const cameraOn =
      lk !== undefined ? lk.isCameraEnabled : member.cameraOn;
    const isSpeaking = Boolean(
      lk?.isSpeaking || member.isSpeaking || speakingId === member.id
    );

    return {
      ...member,
      micOn,
      cameraOn,
      trackRef: camTrack,
      isSpeaking,
    };
  });

  // Lọc trùng thành viên
  const uniqueMembers = [];
  const seenIds = new Set();
  for (const m of enrichedMembers) {
    const idKey = String(m.id || m.name);
    if (!seenIds.has(idKey)) {
      seenIds.add(idKey);
      uniqueMembers.push(m);
    }
  }

  // Tách danh sách hiển thị (tối đa 4 - 6 ô như Meet, còn lại gom vào "+N người khác")
  const maxDisplay = 6;
  const displayMembers = uniqueMembers.slice(0, maxDisplay);
  const overflowCount = Math.max(0, uniqueMembers.length - maxDisplay);

  // Xử lý bật/tắt Mic
  const handleToggleMic = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (e) {
      console.warn("[MeetPiP] Toggle mic error:", e);
    }
  };

  // Xử lý bật/tắt Camera
  const handleToggleCamera = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (e) {
      console.warn("[MeetPiP] Toggle camera error:", e);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#14110e] text-[#f5ede3] select-none overflow-hidden border border-[#3a3128]/40">
      {/* ── HEADER CỬA SỔ (Meet Titlebar) ──────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1c1815] border-b border-[#2d2620] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold tracking-tight text-amber-200 truncate font-serif">
              {roomTitle || "Phòng học VSR"}
            </span>
            <span className="text-[10px] text-stone-400 font-mono">
              {roomCode ? `#${roomCode}` : "Trực tiếp"} • {uniqueMembers.length} người
            </span>
          </div>
        </div>

        {/* Nút phóng to quay lại tab & nút đóng PiP */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onFocusTab}
            className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 hover:bg-[#2a2420] transition-colors cursor-pointer"
            title="Quay lại tab phòng học chính"
            aria-label="Quay lại tab phòng học"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClosePip}
            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-[#2a2420] transition-colors cursor-pointer"
            title="Đóng cửa sổ thu nhỏ"
            aria-label="Đóng cửa sổ thu nhỏ"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── BANNER NGƯỜI ĐANG NÓI / TRÌNH BÀY (Giống Meet) ──────────────── */}
      {(activePresenter || activeSpeakerMember) && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#201b18] border-b border-[#2d2620]/60 shrink-0 text-xs">
          {activePresenter ? (
            <>
              <ScreenShare className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
              <span className="truncate text-stone-200 text-[11px]">
                <strong className="text-amber-200 font-medium">{activePresenter}</strong> (Đang chia sẻ màn hình)
              </span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
              <span className="truncate text-stone-200 text-[11px]">
                <strong className="text-emerald-200 font-medium">{activeSpeakerMember.name}</strong> đang phát biểu...
              </span>
            </>
          )}
        </div>
      )}

      {/* ── KHUNG CHIA SẺ MÀN HÌNH (NẾU CÓ) ────────────────────────────── */}
      {screenShareTrack && (
        <div className="relative w-full bg-black shrink-0 border-b border-[#2d2620] overflow-hidden max-h-[190px] flex items-center justify-center">
          <VideoTrack
            trackRef={screenShareTrack}
            className="w-full h-full object-contain max-h-[190px]"
          />
          <div className="absolute bottom-1 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-amber-300 font-medium flex items-center gap-1">
            <ScreenShare className="w-3 h-3" />
            <span>Màn hình trình chiếu</span>
          </div>
        </div>
      )}

      {/* ── LƯỚI THÀNH VIÊN DẠNG 2 CỘT DỌC (Google Meet Style) ──────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <div
          className={cn(
            "grid gap-2 h-full auto-rows-fr",
            uniqueMembers.length <= 1
              ? "grid-cols-1"
              : uniqueMembers.length <= 2 && !screenShareTrack
              ? "grid-cols-1 grid-rows-2"
              : "grid-cols-2"
          )}
        >
          {displayMembers.map((m, idx) => {
            const hasCam =
              m.cameraOn &&
              m.trackRef &&
              m.trackRef.publication &&
              !m.trackRef.publication.isMuted;

            const isSpeaking = m.isSpeaking;

            return (
              <div
                key={`pip-member-${m.id || idx}`}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-xl overflow-hidden bg-[#1f1a17] border border-[#342b24] transition-all min-h-[90px]",
                  isSpeaking && "ring-2 ring-emerald-400 border-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                )}
              >
                {/* Video camera nếu bật */}
                {hasCam ? (
                  <VideoTrack
                    trackRef={m.trackRef}
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover",
                      m.isYou && "-scale-x-100"
                    )}
                  />
                ) : (
                  /* Avatar chữ cái kiểu Google Meet */
                  <div
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border shadow-md",
                      getMemberColor(m.id, m.name)
                    )}
                  >
                    {m.avatar ? (
                      <img
                        src={m.avatar}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      getInitials(m.name)
                    )}
                  </div>
                )}

                {/* Tên thành viên và trạng thái mic ở dưới đáy ô */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 py-1 flex items-center justify-between gap-1">
                  <span className="truncate text-[10px] font-medium text-stone-200 drop-shadow-sm">
                    {m.name} {m.isYou && "(Bạn)"}
                  </span>
                  <span
                    className={cn(
                      "p-0.5 rounded-full shrink-0",
                      m.micOn
                        ? "text-emerald-400 bg-emerald-950/60"
                        : "text-rose-400 bg-rose-950/60"
                    )}
                    title={m.micOn ? "Mic đang bật" : "Mic đã tắt"}
                  >
                    {m.micOn ? (
                      <Mic className="w-2.5 h-2.5" />
                    ) : (
                      <MicOff className="w-2.5 h-2.5" />
                    )}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Ô gom thành viên vượt quá (+N người khác giống Meet) */}
          {overflowCount > 0 && (
            <div className="relative flex flex-col items-center justify-center rounded-xl bg-[#251f1a] border border-[#3a3128] min-h-[90px] text-stone-300">
              <div className="flex items-center -space-x-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-indigo-700/80 border border-indigo-500/50 flex items-center justify-center text-[10px] font-bold">
                  +
                </div>
                <div className="w-7 h-7 rounded-full bg-amber-700/80 border border-amber-500/50 flex items-center justify-center text-[10px] font-bold">
                  {overflowCount}
                </div>
              </div>
              <span className="text-[10px] font-medium text-stone-400">
                +{overflowCount} người khác
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── THANH ĐIỀU KHIỂN DƯỚI ĐÁY (Meet Bottom Dock) ────────────────── */}
      <div className="flex items-center justify-center gap-3 px-3 py-2.5 bg-[#181412] border-t border-[#2d2620] shrink-0">
        {/* Nút Mic */}
        <button
          type="button"
          onClick={handleToggleMic}
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full transition-transform active:scale-95 cursor-pointer",
            isMicrophoneEnabled
              ? "bg-[#2d2620] text-stone-200 hover:bg-[#3a3128] border border-stone-600/30"
              : "bg-rose-600/90 text-white hover:bg-rose-600 border border-rose-500/50 shadow-md shadow-rose-900/30"
          )}
          title={isMicrophoneEnabled ? "Tắt micro" : "Bật micro"}
          aria-label={isMicrophoneEnabled ? "Tắt micro" : "Bật micro"}
        >
          {isMicrophoneEnabled ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </button>

        {/* Nút Camera */}
        <button
          type="button"
          onClick={handleToggleCamera}
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full transition-transform active:scale-95 cursor-pointer",
            isCameraEnabled
              ? "bg-[#2d2620] text-stone-200 hover:bg-[#3a3128] border border-stone-600/30"
              : "bg-stone-700/80 text-stone-300 hover:bg-stone-700 border border-stone-600/30"
          )}
          title={isCameraEnabled ? "Tắt camera" : "Bật camera"}
          aria-label={isCameraEnabled ? "Tắt camera" : "Bật camera"}
        >
          {isCameraEnabled ? (
            <Video className="w-4 h-4" />
          ) : (
            <VideoOff className="w-4 h-4" />
          )}
        </button>

        {/* Nút Phóng to về tab chính */}
        <button
          type="button"
          onClick={onFocusTab}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#2d2620] text-amber-300 hover:bg-[#3a3128] border border-amber-500/30 transition-transform active:scale-95 cursor-pointer"
          title="Quay lại tab phòng học"
          aria-label="Quay lại tab phòng học"
        >
          <ExternalLink className="w-4 h-4" />
        </button>

        {/* Nút Rời phòng (Màu đỏ Google Meet) */}
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center justify-center w-11 h-10 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-700/40 transition-transform active:scale-95 cursor-pointer ml-1"
          title="Rời phòng học"
          aria-label="Rời phòng học"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Component chính quản lý Document Picture-in-Picture & Auto-PiP khi chuyển tab/app
 */
export function RoomMeetPiP({
  roomTitle = "Phòng học",
  roomCode = "",
  members = [],
  speakingId = null,
  screenSharing = false,
  onLeave,
  autoPipEnabled = true,
  onPipStateChange,
}) {
  const [pipWindow, setPipWindow] = useState(null);
  const [isFallbackOpen, setIsFallbackOpen] = useState(false);
  const isOpeningRef = useRef(false);

  // Mở cửa sổ Document Picture-in-Picture
  const openPip = useCallback(async () => {
    if (isOpeningRef.current || pipWindow) return;

    // Kiểm tra trình duyệt có hỗ trợ Document Picture-in-Picture API không
    if (typeof window !== "undefined" && "documentPictureInPicture" in window) {
      isOpeningRef.current = true;
      try {
        const pip = await window.documentPictureInPicture.requestWindow({
          width: 340,
          height: 560,
        });

        copyStylesheets(document, pip.document);
        pip.document.title = roomTitle ? `${roomTitle} • VSR Meet` : "Virtual Study Room";

        pip.addEventListener("pagehide", () => {
          setPipWindow(null);
          onPipStateChange?.(false);
        });

        setPipWindow(pip);
        onPipStateChange?.(true);
      } catch (err) {
        console.warn("[MeetPiP] Trình duyệt chặn hoặc lỗi mở Document PiP:", err);
        // Fallback: Mở thanh dọc in-page nếu PiP bị lỗi
        setIsFallbackOpen(true);
        onPipStateChange?.(true);
      } finally {
        isOpeningRef.current = false;
      }
    } else {
      // Trình duyệt không hỗ trợ Document PiP (Firefox, Safari cũ): Dùng In-page floating dock
      setIsFallbackOpen(true);
      onPipStateChange?.(true);
    }
  }, [pipWindow, roomTitle, onPipStateChange]);

  // Đóng cửa sổ PiP
  const closePip = useCallback(() => {
    if (pipWindow) {
      try {
        pipWindow.close();
      } catch (_) {}
      setPipWindow(null);
    }
    setIsFallbackOpen(false);
    onPipStateChange?.(false);
  }, [pipWindow, onPipStateChange]);

  // Focus về tab chính
  const handleFocusTab = useCallback(() => {
    if (typeof window !== "undefined") {
      window.focus();
    }
  }, []);

  // Xử lý tự động thu nhỏ khi chuyển tab hoặc chuyển sang ứng dụng khác (Zalo, VS Code, v.v.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Tab bị ẩn do người dùng chuyển tab hoặc mở app khác
        if (autoPipEnabled && !pipWindow && !isFallbackOpen) {
          openPip();
        }
      } else if (document.visibilityState === "visible") {
        // Người dùng đã quay lại tab chính -> nếu muốn tự động đóng khi quay lại
        // Meet thường giữ PiP mở hoặc người dùng bấm đóng / quay lại tab.
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoPipEnabled, pipWindow, isFallbackOpen, openPip]);

  // Lắng nghe MediaSession để Chrome tự động kích hoạt PiP khi chuyển tab
  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.setActionHandler("enterpictureinpicture", () => {
          openPip();
        });
      } catch (_) {}

      return () => {
        try {
          navigator.mediaSession.setActionHandler("enterpictureinpicture", null);
        } catch (_) {}
      };
    }
  }, [openPip]);

  // Lắng nghe Custom Event để các nút ngoài (FloatingDock, Header) có thể gọi mở PiP
  useEffect(() => {
    const handleTogglePipEvent = (e) => {
      if (pipWindow || isFallbackOpen) {
        closePip();
      } else {
        openPip();
      }
    };

    window.addEventListener("vsr:toggle-meet-pip", handleTogglePipEvent);
    return () => {
      window.removeEventListener("vsr:toggle-meet-pip", handleTogglePipEvent);
    };
  }, [pipWindow, isFallbackOpen, openPip, closePip]);

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      if (pipWindow) {
        try {
          pipWindow.close();
        } catch (_) {}
      }
    };
  }, [pipWindow]);

  const pipContent = (
    <MeetPiPView
      roomTitle={roomTitle}
      roomCode={roomCode}
      members={members}
      speakingId={speakingId}
      screenSharing={screenSharing}
      onLeave={() => {
        closePip();
        onLeave?.();
      }}
      onClosePip={closePip}
      onFocusTab={handleFocusTab}
    />
  );

  // 1. Trường hợp: Document Picture-in-Picture của trình duyệt đã mở
  if (pipWindow && pipWindow.document) {
    return createPortal(pipContent, pipWindow.document.body);
  }

  // 2. Trường hợp: Fallback In-page Floating Mini Bar (cho trình duyệt không hỗ trợ Document PiP)
  if (isFallbackOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] w-80 h-[520px] rounded-2xl shadow-2xl overflow-hidden border border-amber-500/40 animate-in fade-in zoom-in-95 duration-200">
        {pipContent}
      </div>
    );
  }

  return null;
}
