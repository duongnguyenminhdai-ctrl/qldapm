"use client";

import { useEffect } from "react";
import { Track } from "livekit-client";
import {
  useTracks,
  useParticipants,
  VideoTrack,
} from "@livekit/components-react";
import { ScreenShare } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoTile } from "@/components/room/VideoTile";

/**
 * LiveKitVideoStage - Quản lý bố cục hiển thị video trực tiếp từ LiveKit Cloud
 * Tự động chuyển đổi giữa Grid Layout (bình thường) và Theater Layout (khi có người chia sẻ màn hình).
 */
export function LiveKitVideoStage({
  members = [],
  speakingId = null,
  onScreenShareStateChange,
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
        (p.name && member.name && p.name.trim() === member.name.trim())
    );

    const camTrack = cameraTracks.find(
      (t) =>
        String(t.participant.identity) === String(member.id) ||
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

  // BỐ CỤC 1: THEATER LAYOUT (Khi có màn hình chia sẻ)
  if (hasScreenShare) {
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
      <div className="flex h-full min-h-0 w-full flex-col gap-3">
        {/* Vùng hiển thị màn hình chia sẻ (căn giữa trong không gian khả dụng) */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1">
          {/* Khung viền ôm sát vừa đủ theo tỷ lệ và kích thước thực tế của màn hình được chia sẻ */}
          <div
            className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-2xl border border-[#2d2620] bg-[#1c1815] shadow-2xl transition-all duration-200"
            style={aspectStyle}
          >
            <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-[#3a3128] bg-[#1e1916]/90 px-2.5 py-1 backdrop-blur shadow-sm">
              <ScreenShare className="h-3.5 w-3.5 text-[#c3a47b]" />
              <span className="text-xs font-medium text-[#f5ede3]">
                Đang chia sẻ: {sharerName}
              </span>
            </div>

            <VideoTrack
              trackRef={screenShareTrack}
              className="max-h-full max-w-full h-auto w-auto object-contain rounded-2xl"
            />
          </div>
        </div>

        {/* Dải camera phụ của các thành viên bên dưới */}
        <div className="scrollbar-quiet flex h-28 shrink-0 gap-3 overflow-x-auto pb-1 sm:h-32">
          {enrichedMembers.map((member) => (
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

  // BỐ CỤC 2: GRID LAYOUT (Khi không có màn hình chia sẻ)
  const count = Math.min(Math.max(enrichedMembers.length, 1), 6);
  const visible = enrichedMembers.slice(0, 6);

  const gridClass =
    count === 1
      ? "mx-auto max-w-3xl grid-cols-1 grid-rows-1"
      : count === 2
        ? "mx-auto max-w-5xl grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1"
        : count <= 4
          ? "grid-cols-2 grid-rows-2 sm:grid-cols-2 sm:grid-rows-2"
          : "grid-cols-2 grid-rows-3 sm:grid-cols-2 sm:grid-rows-3 lg:grid-cols-3 lg:grid-rows-2";

  return (
    <div className={cn("grid h-full min-h-0 w-full gap-3", gridClass)}>
      {visible.map((member) => (
        <VideoTile
          key={member.id}
          member={member}
          isSpeaking={member.isSpeaking}
          className="min-h-0"
        />
      ))}
    </div>
  );
}
