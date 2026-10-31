"use client";

import { useEffect, useMemo } from "react";
import { Track } from "livekit-client";
import {
  useTracks,
  useParticipants,
  VideoTrack,
} from "@livekit/components-react";
import { ScreenShare, Users, EyeOff, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoTile } from "@/components/room/VideoTile";
import { ScreenShareViewer } from "@/components/room/ScreenShareViewer";

/**
 * Tính toán class lưới CSS cân xứng tự động theo số ô (hỗ trợ tối đa tới 49 ô như Google Meet)
 */
function getGridClasses(tileCount) {
  if (tileCount <= 1) return "grid-cols-1 grid-rows-1 max-w-4xl mx-auto";
  if (tileCount === 2) return "grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1 max-w-5xl mx-auto";
  if (tileCount <= 4) return "grid-cols-2 grid-rows-2";
  if (tileCount <= 6) return "grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2";
  if (tileCount <= 9) return "grid-cols-3 grid-rows-3";
  if (tileCount <= 12) return "grid-cols-3 sm:grid-cols-4 grid-rows-4 sm:grid-rows-3";
  if (tileCount <= 16) return "grid-cols-4 grid-rows-4";
  if (tileCount <= 20) return "grid-cols-4 sm:grid-cols-5 grid-rows-5 sm:grid-rows-4";
  if (tileCount <= 25) return "grid-cols-5 grid-rows-5";
  if (tileCount <= 30) return "grid-cols-5 sm:grid-cols-6 grid-rows-6 sm:grid-rows-5";
  if (tileCount <= 36) return "grid-cols-6 grid-rows-6";
  if (tileCount <= 42) return "grid-cols-6 sm:grid-cols-7 grid-rows-7 sm:grid-rows-6";
  return "grid-cols-7 grid-rows-7";
}

/**
 * Ô tóm tắt người dùng còn lại (+X người khác) khi vượt quá số ô tối đa (Google Meet Overflow Tile)
 */
function OverflowTile({ count }) {
  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl border border-stone-300/80 bg-[#FAF8F5] dark:border-[#3a3128] dark:bg-[#1a1715] shadow-lg p-4 text-center select-none overflow-hidden h-full w-full animate-in fade-in duration-200">
      <div className="w-12 h-12 rounded-full bg-[#00897b] text-white flex items-center justify-center font-bold text-base shadow-md ring-4 ring-black/10 dark:ring-white/10 mb-2">
        <Users className="w-6 h-6" />
      </div>
      <div className="text-sm font-semibold text-stone-800 dark:text-stone-200">
        {count} người khác
      </div>
      <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
        trong cuộc họp
      </div>
    </div>
  );
}

/**
 * LiveKitVideoStage - Bố cục video phòng học chuẩn Google Meet
 * Hỗ trợ 4 chế độ:
 * 1. "auto": Tự động (linh động) ✦
 * 2. "grid": Ô (cũ)
 * 3. "spotlight": Tiêu điểm
 * 4. "sidebar": Thanh bên
 * Kèm thanh trượt "Số ô" (6 - 49) và toggle "Ẩn ô không có video".
 */
export function LiveKitVideoStage({
  members = [],
  speakingId = null,
  onScreenShareStateChange,
  layoutMode = "auto",
  maxTiles = 16,
  hideNonVideo = false,
  pinnedMemberId = null,
  onPinMember,
}) {
  const participants = useParticipants();

  // Lắng nghe tất cả các tracks camera và chia sẻ màn hình
  const trackReferences = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false }
  );

  // Tìm track chia sẻ màn hình nếu có
  const screenShareTrack = trackReferences.find(
    (trackRef) =>
      trackRef.source === Track.Source.ScreenShare &&
      trackRef.publication &&
      !trackRef.publication.isMuted
  );

  const hasScreenShare = Boolean(screenShareTrack);

  useEffect(() => {
    if (onScreenShareStateChange) {
      onScreenShareStateChange(hasScreenShare);
    }
  }, [hasScreenShare, onScreenShareStateChange]);

  // Lọc riêng các tracks camera
  const cameraTracks = trackReferences.filter(
    (trackRef) => trackRef.source === Track.Source.Camera
  );

  // Hợp nhất dữ liệu giữa Socket.io members và LiveKit participants
  const enrichedMembers = members.map((member) => {
    const lkParticipant = participants.find(
      (p) =>
        String(p.identity) === String(member.id) ||
        String(p.identity).startsWith(`${member.id}_dev_`) ||
        (p.name && member.name && p.name.trim() === member.name.trim())
    );

    const camTrack = cameraTracks.find(
      (t) =>
        String(t.participant.identity) === String(member.id) ||
        String(t.participant.identity).startsWith(`${member.id}_dev_`) ||
        (lkParticipant && t.participant.identity === lkParticipant.identity)
    );

    const isSpeaking = Boolean(
      lkParticipant?.isSpeaking ||
        member.isSpeaking ||
        speakingId === member.id
    );

    let lkMetadata = null;
    if (lkParticipant?.metadata) {
      try {
        lkMetadata = JSON.parse(lkParticipant.metadata);
      } catch (_) {}
    }

    const micOn =
      lkParticipant !== undefined
        ? lkParticipant.isMicrophoneEnabled
        : member.micOn;

    const cameraOn =
      lkParticipant !== undefined
        ? lkParticipant.isCameraEnabled
        : member.cameraOn;

    const isTitleVisible =
      member.isTitleVisible !== undefined
        ? member.isTitleVisible
        : lkMetadata?.isTitleVisible !== undefined
          ? lkMetadata.isTitleVisible
          : true;

    return {
      ...member,
      isTitleVisible,
      equippedTitle:
        member.equippedTitle ||
        lkMetadata?.equippedTitle ||
        "Nhập môn học giả",
      micOn,
      cameraOn,
      trackRef: camTrack,
      isSpeaking,
    };
  });

  // Khử trùng triệt để các member trước khi render
  const uniqueEnrichedMembers = useMemo(() => {
    const list = [];
    const seenIds = new Set();
    const seenTracks = new Set();
    const seenNames = new Set();

    const sortedForDedupe = [...enrichedMembers].sort((a, b) => {
      if (a.isYou && !b.isYou) return -1;
      if (!a.isYou && b.isYou) return 1;
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return 0;
    });

    for (const m of sortedForDedupe) {
      const idKey = m.id ? String(m.id) : "";
      const nameKey = m.name ? String(m.name).trim().toLowerCase() : "";
      const trackSid = m.trackRef?.publication?.trackSid || m.trackRef?.track?.sid || null;

      if (idKey && seenIds.has(idKey)) continue;
      if (trackSid && seenTracks.has(trackSid)) continue;
      if (nameKey && seenNames.has(nameKey) && !m.isYou) continue;

      if (idKey) seenIds.add(idKey);
      if (trackSid) seenTracks.add(trackSid);
      if (nameKey && !m.isYou) seenNames.add(nameKey);
      list.push(m);
    }
    return list;
  }, [enrichedMembers]);

  // Áp dụng tính năng: "Ẩn ô không có video" (Hide Non-Video Tiles)
  const { displayMembers, hiddenCount } = useMemo(() => {
    if (!hideNonVideo) {
      return { displayMembers: uniqueEnrichedMembers, hiddenCount: 0 };
    }
    const filtered = uniqueEnrichedMembers.filter(
      (m) =>
        m.cameraOn ||
        m.isSpeaking ||
        m.isYou ||
        (pinnedMemberId && String(m.id) === String(pinnedMemberId))
    );

    if (filtered.length > 0) {
      return {
        displayMembers: filtered,
        hiddenCount: uniqueEnrichedMembers.length - filtered.length,
      };
    }
    // Nếu tất cả đều tắt camera, giữ lại danh sách gốc để không bị trống màn hình
    return { displayMembers: uniqueEnrichedMembers, hiddenCount: 0 };
  }, [uniqueEnrichedMembers, hideNonVideo, pinnedMemberId]);

  // Tìm thành viên tiêu điểm (Spotlight Target)
  const spotlightMember = useMemo(() => {
    if (pinnedMemberId) {
      const pinned = displayMembers.find((m) => String(m.id) === String(pinnedMemberId));
      if (pinned) return pinned;
    }
    const speaker = displayMembers.find((m) => m.isSpeaking);
    if (speaker) return speaker;
    return displayMembers[0] || null;
  }, [displayMembers, pinnedMemberId]);

  // =========================================================================
  // CHẾ ĐỘ 1: TIÊU ĐIỂM (SPOTLIGHT)
  // Chỉ hiển thị 1 ô lớn duy nhất cho người phát biểu hoặc màn hình chia sẻ
  // =========================================================================
  if (layoutMode === "spotlight") {
    return (
      <div className="relative flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden p-1">
        {/* Banner thông báo khi đang ẩn ô không có video */}
        {hiddenCount > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 text-stone-200 text-xs backdrop-blur border border-white/10 shadow-lg">
            <EyeOff className="w-3.5 h-3.5 text-stone-400" />
            <span>Đang ẩn {hiddenCount} ô không có video</span>
          </div>
        )}

        {/* Nội dung tiêu điểm */}
        {hasScreenShare ? (
          <ScreenShareViewer
            screenShareTrack={screenShareTrack}
            sharerName={screenShareTrack.participant?.name || "Người dùng"}
            className="h-full w-full"
          />
        ) : spotlightMember ? (
          <div className="h-full w-full max-w-5xl">
            <VideoTile
              member={spotlightMember}
              isSpeaking={spotlightMember.isSpeaking}
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="text-sm text-stone-400">Không có thành viên nào trong phòng</div>
        )}

        {/* Badge số người khác thu nhỏ góc dưới chuẩn Meet */}
        {displayMembers.length > 1 && (
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur border border-white/10 text-xs text-stone-300 shadow-md">
            <Users className="w-3.5 h-3.5 text-stone-400" />
            <span>+{displayMembers.length - 1} người khác</span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // CHẾ ĐỘ 2: THANH BÊN (SIDEBAR)
  // Khung chính lớn bên trái, cột dọc các thành viên khác bên phải
  // =========================================================================
  if (layoutMode === "sidebar") {
    const sidebarOthers = displayMembers.filter(
      (m) => !spotlightMember || String(m.id) !== String(spotlightMember.id)
    );
    const maxSidebar = Math.max(1, maxTiles - 1);
    const visibleSidebar = sidebarOthers.slice(0, maxSidebar);
    const sidebarOverflow = Math.max(0, sidebarOthers.length - maxSidebar);

    return (
      <div className="relative flex h-full min-h-0 w-full flex-col sm:flex-row gap-3 overflow-hidden">
        {/* Banner ẩn ô không có video */}
        {hiddenCount > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 text-stone-200 text-xs backdrop-blur border border-white/10 shadow-lg">
            <EyeOff className="w-3.5 h-3.5 text-stone-400" />
            <span>Đang ẩn {hiddenCount} ô không có video</span>
          </div>
        )}

        {/* Khung chính lớn bên trái */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1">
          {hasScreenShare ? (
            <ScreenShareViewer
              screenShareTrack={screenShareTrack}
              sharerName={screenShareTrack.participant?.name || "Người dùng"}
              className="h-full w-full"
            />
          ) : spotlightMember ? (
            <VideoTile
              member={spotlightMember}
              isSpeaking={spotlightMember.isSpeaking}
              className="h-full w-full"
            />
          ) : null}
        </div>

        {/* Cột dọc thanh bên phải chứa các thành viên khác */}
        {visibleSidebar.length > 0 && (
          <div className="scrollbar-quiet flex sm:flex-col shrink-0 gap-2.5 overflow-x-auto sm:overflow-y-auto w-full sm:w-56 md:w-64 max-h-36 sm:max-h-full pb-1 sm:pb-0 pr-1">
            {visibleSidebar.map((member) => (
              <div key={member.id} className="h-28 sm:h-36 w-44 sm:w-full shrink-0">
                <VideoTile
                  member={member}
                  isSpeaking={member.isSpeaking}
                  className="h-full w-full"
                />
              </div>
            ))}

            {sidebarOverflow > 0 && (
              <div className="h-28 sm:h-36 w-44 sm:w-full shrink-0">
                <OverflowTile count={sidebarOverflow} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // CHẾ ĐỘ 3 & 4: TỰ ĐỘNG (AUTO) HOẶC Ô (GRID)
  // =========================================================================

  // Nếu ở chế độ TỰ ĐỘNG (Auto) và có người chia sẻ màn hình -> Kích hoạt Theater Layout
  if (layoutMode === "auto" && hasScreenShare) {
    const sharerName =
      screenShareTrack.participant?.name ||
      screenShareTrack.participant?.identity ||
      "Người dùng";

    const dimensions =
      screenShareTrack.publication?.dimensions ||
      screenShareTrack.publication?.track?.dimensions;
    const aspectStyle =
      dimensions?.width && dimensions?.height
        ? { aspectRatio: `${dimensions.width} / ${dimensions.height}` }
        : undefined;

    return (
      <div className="relative flex h-full min-h-0 w-full flex-col gap-3">
        {hiddenCount > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 text-stone-200 text-xs backdrop-blur border border-white/10 shadow-lg">
            <EyeOff className="w-3.5 h-3.5 text-stone-400" />
            <span>Đang ẩn {hiddenCount} ô không có video</span>
          </div>
        )}

        {/* Vùng hiển thị màn hình chia sẻ */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1">
          <ScreenShareViewer
            screenShareTrack={screenShareTrack}
            sharerName={sharerName}
            aspectStyle={aspectStyle}
            className="w-full h-full"
          />
        </div>

        {/* Dải camera phụ bên dưới */}
        <div className="scrollbar-quiet flex h-28 shrink-0 gap-3 overflow-x-auto pb-1 sm:h-32">
          {displayMembers.map((member) => (
            <div key={member.id} className="h-full w-44 shrink-0 sm:w-52">
              <VideoTile
                member={member}
                isSpeaking={member.isSpeaking}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // BỐ CỤC LƯỚI Ô ĐỀU NHAU (GRID TILED LAYOUT)
  const totalCount = displayMembers.length;
  const isOverflow = totalCount > maxTiles;
  const renderLimit = isOverflow ? maxTiles - 1 : maxTiles;
  const visibleMembers = displayMembers.slice(0, renderLimit);
  const overflowCount = isOverflow ? totalCount - renderLimit : 0;
  const totalTilesToRender = visibleMembers.length + (overflowCount > 0 ? 1 : 0);
  const gridClass = getGridClasses(totalTilesToRender);

  return (
    <div className="relative h-full min-h-0 w-full flex flex-col justify-center">
      {/* Banner thông báo ẩn ô không có video */}
      {hiddenCount > 0 && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 text-stone-200 text-xs backdrop-blur border border-white/10 shadow-lg">
          <EyeOff className="w-3.5 h-3.5 text-stone-400" />
          <span>Đang ẩn {hiddenCount} ô không có video</span>
        </div>
      )}

      <div className={cn("grid h-full min-h-0 w-full gap-2.5 sm:gap-3", gridClass)}>
        {visibleMembers.map((member) => (
          <VideoTile
            key={member.id}
            member={member}
            isSpeaking={member.isSpeaking}
            className="min-h-0"
          />
        ))}

        {overflowCount > 0 && (
          <div className="min-h-0">
            <OverflowTile count={overflowCount} />
          </div>
        )}
      </div>
    </div>
  );
}
