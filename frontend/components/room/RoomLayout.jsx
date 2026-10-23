"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Check, Copy, Link2, Users, AlertCircle, X, Award, QrCode, ShieldCheck, Lock, Unlock, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
} from "@livekit/components-react";
import { LiveKitVideoStage } from "@/components/room/LiveKitVideoStage";

const ChessStage = dynamic(
  () => import("@/components/chess/ChessStage").then((mod) => mod.ChessStage || mod.default || mod),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 text-amber-500 font-medium">
        Đang tải bàn cờ...
      </div>
    ),
  }
);
import { FloatingDock } from "@/components/room/FloatingDock";
import { RoomSidePanel } from "@/components/room/RoomSidePanel";
import { RoomToastContainer, useRoomToast } from "@/components/room/RoomToast";
import { Whiteboard } from "@/components/room/Whiteboard";
import { connectSocket } from "@/lib/socket";
import { getStoredUser, getAuthToken, livekitApi, uploadApi } from "@/lib/api";
import PricingModal from "@/components/payment/PricingModal";
import TitlesModal from "@/components/titles/TitlesModal";
import { TranscriptionOverlay } from "@/components/room/TranscriptionOverlay";
import { LiveKitSpeechBridge } from "@/components/room/LiveKitSpeechBridge";
import { FloatingReactions, useFloatingReactions } from "@/components/room/FloatingReactions";
import { RoomNotificationBell } from "@/components/room/RoomNotificationBell";
import { RoomQRCodeModal } from "@/components/room/RoomQRCodeModal";
import { FocusStatusSelector } from "@/components/room/FocusStatusWidget";

/**
 * Âm báo nhẹ hai âm sắc khi có người xin vào phòng (Web Audio API synth)
 */
function playJoinRequestChime() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.0, now + 0.12); // A5

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch (_) {}
}

/**
 * Chuyển dữ liệu participant từ API sang định dạng member cho UI
 */
function participantToMember(p, hostId, currentUserId, raisedHands, focusStatuses) {
  const u = p.userId || p;
  const id = String(u._id || u.id || p.userId || (typeof p === "string" ? p : ""));
  const hostIdStr = String(hostId?._id || hostId?.id || hostId || "");
  const currentUserIdStr = String(currentUserId || "");

  const isHandRaised = Boolean(
    p.isHandRaised !== undefined
      ? p.isHandRaised
      : raisedHands && (raisedHands[id]?.isHandRaised ?? raisedHands[id])
  );

  const focusStatus =
    p.focusStatus !== undefined
      ? p.focusStatus
      : focusStatuses && focusStatuses[id]
      ? focusStatuses[id]
      : null;

  return {
    id,
    name: u.name || (id === currentUserIdStr ? "Bạn" : "Người dùng"),
    email: u.email || "",
    avatar: u.avatar || "",
    isHost: Boolean(id && hostIdStr && id === hostIdStr),
    isYou: Boolean(id && currentUserIdStr && id === currentUserIdStr),
    isPro: Boolean(u.isPro || false),
    equippedTitle: u.equippedTitle || u.title || "Nhập môn học giả",
    isTitleVisible:
      p.isTitleVisible !== undefined
        ? p.isTitleVisible
        : u.isTitleVisible !== undefined
          ? u.isTitleVisible
          : true,
    isHandRaised,
    focusStatus,
    micOn: false,
    cameraOn: false,
    isSpeaking: false,
  };
}

/**
 * Khử trùng danh sách thành viên theo ID, giữ lại phần tử đầu tiên gặp
 * Merge micOn/cameraOn/isHandRaised/focusStatus từ bản có sẵn nếu xuất hiện bản sao
 */
function dedupeMembers(list) {
  const seen = new Map();
  for (const m of list) {
    if (!m.id) continue;
    if (seen.has(m.id)) {
      // Giữ lại micOn/cameraOn/isHandRaised/focusStatus từ bản cũ nếu bản mới không có
      const existing = seen.get(m.id);
      seen.set(m.id, {
        ...existing,
        ...m,
        isTitleVisible:
          m.isTitleVisible !== undefined
            ? m.isTitleVisible
            : existing.isTitleVisible,
        isHandRaised:
          m.isHandRaised !== undefined
            ? m.isHandRaised
            : existing.isHandRaised,
        focusStatus: m.focusStatus || existing.focusStatus,
        micOn: m.micOn || existing.micOn,
        cameraOn: m.cameraOn || existing.cameraOn,
      });
    } else {
      seen.set(m.id, m);
    }
  }
  return Array.from(seen.values());
}

/**
 * LiveKitRemoteMuteController lắng nghe lệnh tắt mic từ Host và tắt microphone track của WebRTC
 */
function LiveKitRemoteMuteController({ onRegisterMuteHandler }) {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (onRegisterMuteHandler) {
      onRegisterMuteHandler(async () => {
        if (localParticipant) {
          try {
            await localParticipant.setMicrophoneEnabled(false);
          } catch (err) {
            console.warn("[LiveKit] Lỗi khi tắt mic từ xa:", err);
          }
        }
      });
    }
  }, [localParticipant, onRegisterMuteHandler]);

  return null;
}

/**
 * LiveKitDockBridge kết nối các nút trên FloatingDock trực tiếp với LiveKit WebRTC tracks
 */
function LiveKitDockBridge({
  panelOpen,
  onTogglePanel,
  onToggleAITutor,
  isAITutorOpen,
  whiteboardOpen,
  onToggleWhiteboard,
  onLeave,
  screenSharing,
  onToggleScreenState,
  onPermissionError,
  transcriptionOn,
  onToggleTranscription,
  isPro,
  onUpgradeClick,
  isHandRaised,
  onToggleHand,
  onSendReaction,
  isHost = false,
  participantsCount = 1,
}) {
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();

  const handleToggleMic = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.warn("[LiveKit] Mic error:", err.name, err.message);
      if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
        if (onPermissionError) {
          onPermissionError(
            "Microphone bị chặn quyền truy cập. Vui lòng bấm vào biểu tượng camera/ổ khóa trên thanh địa chỉ trình duyệt và chọn 'Cho phép'."
          );
        }
      }
    }
  };

  const handleToggleCamera = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.warn("[LiveKit] Camera error:", err.name, err.message);
      if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
        if (onPermissionError) {
          onPermissionError(
            "Camera bị chặn quyền truy cập. Vui lòng bấm vào biểu tượng camera/ổ khóa trên thanh địa chỉ trình duyệt và chọn 'Cho phép'."
          );
        }
      }
    }
  };

  const handleToggleScreen = async () => {
    if (!localParticipant) return;
    try {
      const next = !isScreenShareEnabled;
      await localParticipant.setScreenShareEnabled(next);
      if (onToggleScreenState) onToggleScreenState(next);
    } catch (err) {
      console.warn("[LiveKit] Screen share error:", err.name, err.message);
      // Khi người dùng bấm Cancel trong dialog chia sẻ màn hình thì không coi là lỗi
      if (err.name !== "NotAllowedError") {
        if (onPermissionError) {
          onPermissionError("Không thể kích hoạt chia sẻ màn hình.");
        }
      }
    }
  };

  return (
    <FloatingDock
      micOn={isMicrophoneEnabled}
      cameraOn={isCameraEnabled}
      screenSharing={isScreenShareEnabled || screenSharing}
      panelOpen={panelOpen}
      onToggleMic={handleToggleMic}
      onToggleCamera={handleToggleCamera}
      onToggleScreen={handleToggleScreen}
      onTogglePanel={onTogglePanel}
      onToggleAITutor={onToggleAITutor}
      isAITutorOpen={isAITutorOpen}
      whiteboardOpen={whiteboardOpen}
      onToggleWhiteboard={onToggleWhiteboard}
      onLeave={onLeave}
      transcriptionOn={transcriptionOn}
      onToggleTranscription={onToggleTranscription}
      isPro={isPro}
      onUpgradeClick={onUpgradeClick}
      isHandRaised={isHandRaised}
      onToggleHand={onToggleHand}
      onSendReaction={onSendReaction}
      isHost={isHost}
      participantsCount={participantsCount}
    />
  );
}

/**
 * RoomLayout tích hợp Socket.io realtime và LiveKit Cloud audio/video/screen call
 * Dials: DESIGN_VARIANCE 5 / MOTION_INTENSITY 3 / VISUAL_DENSITY 4
 */
export default function RoomLayout({ roomCode, initialRoom }) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || "dark";
  const isDark = isMounted ? currentTheme === "dark" : true;

  const [room, setRoom] = useState(initialRoom);

  // Hook quản lý thông báo Toast và Ref socket phòng học (khai báo sớm để tránh TDZ)
  const { toasts, addToast, dismissToast } = useRoomToast();
  const socketRef = useRef(null);

  // Lấy thông tin user hiện tại từ localStorage
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id || currentUser?._id;
  const hostId = String(
    room?.hostId?._id || room?.hostId || initialRoom?.hostId?._id || initialRoom?.hostId || ""
  );
  const isHost = Boolean(hostId && currentUserId && String(hostId) === String(currentUserId));

  // State kết nối LiveKit Cloud
  const [livekitToken, setLivekitToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(
    process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://qldapm-pc4nrudr.livekit.cloud"
  );

  const [members, setMembers] = useState(() => {
    let list = [];
    if (initialRoom?.participants && Array.isArray(initialRoom.participants)) {
      list = initialRoom.participants.map((p) =>
        participantToMember(p, hostId, currentUserId)
      );
    }

    // Luôn đảm bảo user hiện tại có mặt trong danh sách hiển thị của chính họ
    if (currentUser && currentUserId) {
      const savedTitleVis =
        typeof window !== "undefined"
          ? (window.localStorage.getItem("vsr_show_title") ??
            window.localStorage.getItem("vsr_show_nickname"))
          : null;
      const isSelfTitleVisible =
        savedTitleVis !== null ? savedTitleVis === "true" : true;

      const selfEntry = {
        id: String(currentUserId),
        name: currentUser.name || "Bạn",
        email: currentUser.email || "",
        avatar: currentUser.avatar || "",
        isHost: String(currentUserId) === String(hostId),
        isYou: true,
        isPro: Boolean(currentUser.isPro || false),
        equippedTitle:
          currentUser.equippedTitle || currentUser.title || "Nhập môn học giả",
        isTitleVisible: isSelfTitleVisible,
        micOn: false,
        cameraOn: false,
        isSpeaking: false,
      };
      list.push(selfEntry);
    }
    // Khử trùng ngay từ đầu (initialRoom.participants có thể đã chứa user hiện tại)
    return dedupeMembers(list);
  });

  const [screenSharing, setScreenSharing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState("chat");
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState([25]);
  const [pomodoro, setPomodoro] = useState({
    duration: 1500,
    remaining: 1500,
    isRunning: false,
    mode: "focus",
  });
  const [messages, setMessages] = useState([]);
  const [roomFiles, setRoomFiles] = useState([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [transcriptionOn, setTranscriptionOn] = useState(false);
  const [roomHasActiveTranscription, setRoomHasActiveTranscription] = useState(false);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [aloneCountdown, setAloneCountdown] = useState(null); // { remainingSeconds, expiresAt }
  const transcriptionOnRef = useRef(transcriptionOn);
  useEffect(() => {
    transcriptionOnRef.current = transcriptionOn;
  }, [transcriptionOn]);

  // Bộ đếm ngược khi phòng chỉ còn đúng 1 người duy nhất (Empty Room Timeout)
  useEffect(() => {
    if (!aloneCountdown || aloneCountdown.remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setAloneCountdown((prev) => {
        if (!prev) return null;
        if (prev.remainingSeconds <= 1) {
          clearInterval(interval);
          return { ...prev, remainingSeconds: 0 };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aloneCountdown?.expiresAt, aloneCountdown === null]);

  const handleStayAlone = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.connected && roomCode) {
      socket.emit("room:stay-alone", { roomCode });
    }
    setAloneCountdown({
      remainingSeconds: 600,
      expiresAt: Date.now() + 600 * 1000,
    });
    addToast({
      type: "focus",
      title: "Đã gia hạn phiên học",
      body: "Bộ đếm thời gian phòng 1 người đã được làm mới lại 10:00.",
    });
  }, [roomCode, addToast]);

  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isTitlesModalOpen, setIsTitlesModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [isLocked, setIsLocked] = useState(Boolean(initialRoom?.isLocked));
  const [myFocusStatus, setMyFocusStatus] = useState(null);
  const [pinnedItem, setPinnedItem] = useState(null);
  const forceMuteActionRef = useRef(null);
  const isPro = Boolean(currentUser?.isPro);

  // Quản lý trạng thái Giơ tay phát biểu & Thả cảm xúc nổi
  const [isHandRaised, setIsHandRaised] = useState(false);
  const { reactions, triggerReaction } = useFloatingReactions();

  // Tải danh sách tài liệu phòng học ban đầu
  useEffect(() => {
    if (!roomCode) return;
    uploadApi
      .getRoomFiles(roomCode)
      .then((res) => {
        if (res?.data?.files) {
          setRoomFiles(res.data.files);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch initial room files:", err);
      });
  }, [roomCode]);

  // Quản lý trạng thái bật/tắt hiển thị danh hiệu (lưu vào localStorage)
  const [showTitle, setShowTitle] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved =
      window.localStorage.getItem("vsr_show_title") ??
      window.localStorage.getItem("vsr_show_nickname");
    return saved !== null ? saved === "true" : true;
  });

  const handleToggleTitle = useCallback(() => {
    setShowTitle((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("vsr_show_title", String(next));
      }
      setMembers((prevMembers) =>
        prevMembers.map((m) =>
          m.isYou || String(m.id) === String(currentUserId)
            ? { ...m, isTitleVisible: next }
            : m
        )
      );
      if (socketRef.current) {
        socketRef.current.emit("room:toggle-title-visibility", {
          roomCode,
          isVisible: next,
          userId: currentUserId,
        });
      }
      return next;
    });
  }, [roomCode, currentUserId]);

  // Bật / tắt giơ tay phát biểu (Raise Hand)
  const handleToggleHand = useCallback(() => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);

    setMembers((prevMembers) =>
      prevMembers.map((m) =>
        m.isYou || String(m.id) === String(currentUserId)
          ? { ...m, isHandRaised: nextState }
          : m
      )
    );

    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("room:toggle-hand", {
        roomId: roomCode,
        roomCode,
        isHandRaised: nextState,
        userId: currentUserId,
        userName: currentUser?.name,
      });
    }
  }, [isHandRaised, roomCode, currentUserId, currentUser?.name]);

  // Thả cảm xúc nổi (Floating Emoji Reactions)
  const handleSendReaction = useCallback(
    (emoji) => {
      const socket = socketRef.current;
      const senderName = currentUser?.name || "Bạn";
      if (socket && socket.connected) {
        socket.emit("room:send-reaction", {
          roomId: roomCode,
          roomCode,
          emoji,
          senderName,
          senderSocketId: socket.id,
        });
      }
      // Kích hoạt ngay trên client mình để tạo cảm giác phản hồi mượt mà zero-latency
      triggerReaction({ emoji, senderName: "Bạn" });
    },
    [roomCode, currentUser?.name, triggerReaction]
  );

  const handlePermissionError = useCallback((msg) => {
    setPermissionError(msg);
  }, []);

  // Bật/tắt chép lời trực tiếp (đồng bộ cho cả phòng biết có người đang bật chép lời)
  const handleToggleTranscription = useCallback(() => {
    setTranscriptionOn((prev) => {
      const next = !prev;
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit("room:transcription-toggle", {
          roomCode,
          isEnabled: next,
        });
      }
      return next;
    });
  }, [roomCode]);

  const handleCloseTranscription = useCallback(() => {
    setTranscriptionOn(false);
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("room:transcription-toggle", {
        roomCode,
        isEnabled: false,
      });
    }
  }, [roomCode]);

  const handleToggleAITutor = useCallback(() => {
    if (panelOpen && panelTab === "ai") {
      setPanelOpen(false);
    } else {
      setPanelTab("ai");
      setPanelOpen(true);
    }
  }, [panelOpen, panelTab]);

  // Tự động ẩn thông báo lỗi quyền sau 7 giây
  useEffect(() => {
    if (!permissionError) return;
    const timer = setTimeout(() => setPermissionError(""), 7000);
    return () => clearTimeout(timer);
  }, [permissionError]);

  const copyLinkTimerRef = useRef(null);
  const copyCodeTimerRef = useRef(null);
  // Ref theo dõi trạng thái panel trong socket closure
  const panelOpenRef = useRef(panelOpen);
  useEffect(() => { panelOpenRef.current = panelOpen; }, [panelOpen]);
  // Ref chống gửi rời phòng nhiều lần (idempotent leave guard)
  const hasLeftRef = useRef(false);
  // Ref xác nhận người dùng thực sự chủ động bấm rời phòng (chống StrictMode / effect remount)
  const isExplicitlyLeavingRef = useRef(false);
  // Ref ghi nhận thời điểm mount để tránh gọi leave sớm khi đang tải phòng
  const mountTimeRef = useRef(Date.now());
  const leaveRoomNowRef = useRef(null);
  // Ref chống trùng lặp toast giơ tay
  const lastHandToastRef = useRef({ userId: null, time: 0 });
  // Ref chống trùng lặp toast rời phòng và đóng phòng
  const lastLeaveToastRef = useRef({ id: null, time: 0 });
  const hasHostClosedToastRef = useRef(false);

  const speakingId = members.find((m) => m.isSpeaking)?.id ?? null;

  // Lấy LiveKit Token từ backend khi vào phòng
  useEffect(() => {
    let isMounted = true;
    const fetchToken = async () => {
      try {
        const res = await livekitApi.getToken(roomCode, currentUser?.name);
        if (isMounted && res?.token) {
          setLivekitToken(res.token);
          if (res.livekitUrl) setLivekitUrl(res.livekitUrl);
        }
      } catch (err) {
        console.warn("[LiveKit] Khong the lay token truy cap:", err.message);
      }
    };

    if (roomCode) {
      fetchToken();
    }
    return () => {
      isMounted = false;
    };
  }, [roomCode, currentUser?.name]);

  // Thiết lập kết nối Socket.io và lắng nghe events
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    if (!socket || !currentUser) return;

    // Helper xử lý đồng bộ danh sách members từ server
    const handleSync = (participants, syncHostId, titleVisibility, raisedHands, focusStatuses) => {
      if (!Array.isArray(participants)) return;
      const host = syncHostId || room?.hostId?._id || room?.hostId;
      setMembers((prev) => {
        const synced = participants.map((p) => {
          const m = participantToMember(p, host, currentUserId, raisedHands, focusStatuses);
          const existing = prev.find((x) => x.id === m.id);
          const currentVis =
            titleVisibility && titleVisibility[m.id] !== undefined
              ? titleVisibility[m.id]
              : existing?.isTitleVisible !== undefined
              ? existing.isTitleVisible
              : m.isTitleVisible;

          const currentHand =
            raisedHands && raisedHands[m.id] !== undefined
              ? Boolean(raisedHands[m.id]?.isHandRaised ?? raisedHands[m.id])
              : existing?.isHandRaised !== undefined
              ? existing.isHandRaised
              : m.isHandRaised;

          const currentFocus =
            focusStatuses && focusStatuses[m.id] !== undefined
              ? focusStatuses[m.id]
              : existing?.focusStatus !== undefined
              ? existing.focusStatus
              : m.focusStatus;

          if (existing) {
            return {
              ...m,
              isTitleVisible: currentVis,
              isHandRaised: currentHand,
              focusStatus: currentFocus,
              micOn: existing.micOn,
              cameraOn: existing.cameraOn,
            };
          }
          return { ...m, isTitleVisible: currentVis, isHandRaised: currentHand, focusStatus: currentFocus };
        });

        // Đảm bảo user hiện tại luôn có trong danh sách
        if (currentUser && currentUserId) {
          const selfVis =
            titleVisibility && titleVisibility[String(currentUserId)] !== undefined
              ? titleVisibility[String(currentUserId)]
              : showTitle;

          const selfHand =
            raisedHands && raisedHands[String(currentUserId)] !== undefined
              ? Boolean(raisedHands[String(currentUserId)]?.isHandRaised ?? raisedHands[String(currentUserId)])
              : isHandRaised;

          const selfFocus =
            focusStatuses && focusStatuses[String(currentUserId)] !== undefined
              ? focusStatuses[String(currentUserId)]
              : myFocusStatus;

          synced.push({
            id: String(currentUserId),
            name: currentUser.name || "Bạn",
            email: currentUser.email || "",
            avatar: currentUser.avatar || "",
            isHost: String(currentUserId) === String(host),
            isYou: true,
            isPro: Boolean(currentUser.isPro || false),
            equippedTitle:
              currentUser.equippedTitle || currentUser.title || "Nhập môn học giả",
            isTitleVisible: selfVis,
            isHandRaised: selfHand,
            focusStatus: selfFocus,
            micOn: false,
            cameraOn: false,
            isSpeaking: false,
          });
        }
        // Khử trùng - lần push trên có thể tạo bản sao nếu server đã trả về user hiện tại
        return dedupeMembers(synced);
      });

      if (raisedHands && currentUserId && raisedHands[String(currentUserId)] !== undefined) {
        setIsHandRaised(Boolean(raisedHands[String(currentUserId)]?.isHandRaised ?? raisedHands[String(currentUserId)]));
      }
      if (focusStatuses && currentUserId && focusStatuses[String(currentUserId)] !== undefined) {
        setMyFocusStatus(focusStatuses[String(currentUserId)]);
      }
    };

    // Emit join-room ngay sau khi connect
    const emitJoin = () => {
      const uId = currentUser?.id || currentUser?._id;
      if (uId) {
        socket.emit("user:authenticate", { userId: uId });
      }

      socket.emit(
        "join-room",
        {
          roomCode,
          user: {
            id: uId,
            name: currentUser?.name,
            email: currentUser?.email,
            avatar: currentUser?.avatar || "",
            isPro: Boolean(currentUser?.isPro),
            equippedTitle:
              currentUser?.equippedTitle || currentUser?.title || "Nhập môn học giả",
            title: currentUser?.title || "Học viên",
            isTitleVisible: showTitle,
          },
        },
        (res) => {
          if (res?.success && res?.participants) {
            handleSync(res.participants, res.hostId, res.titleVisibility, res.raisedHands, res.focusStatuses);
            if (res.pendingList) {
              setPendingMembers(res.pendingList);
            }
            if (res.isLocked !== undefined) {
              setIsLocked(Boolean(res.isLocked));
            }
            if (res.pinnedItem !== undefined) {
              setPinnedItem(res.pinnedItem);
            }
          }
        }
      );
    };

    if (socket.connected) {
      emitJoin();
    }
    socket.on("connect", emitJoin);

    // Heartbeat tích lũy thời gian học tập mỗi 60 giây để nhận Thẻ Bài Học Giả
    const studyHeartbeatInterval = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit("room:study-heartbeat");
      }
    }, 60000);

    // Đồng bộ danh sách người đang chờ duyệt (dành cho Chủ phòng)
    socket.on("room:pending-updated", ({ roomCode: pCode, pendingList }) => {
      if (
        !pCode ||
        String(pCode).trim().toUpperCase() === String(roomCode).trim().toUpperCase()
      ) {
        setPendingMembers(pendingList || []);
      }
    });

    // Thông báo có người yêu cầu vào phòng học (âm báo nhẹ + nút duyệt nhanh)
    socket.on("room:join-requested", ({ roomCode: jCode, pendingUser, pendingList }) => {
      if (
        !jCode ||
        String(jCode).trim().toUpperCase() === String(roomCode).trim().toUpperCase()
      ) {
        setPendingMembers(pendingList || []);
        playJoinRequestChime();

        const count = pendingList?.length || 1;
        const isSingle = count <= 1;

        addToast({
          key: "toast_join_request",
          type: "join_request",
          title: "Yêu cầu vào phòng",
          body: isSingle
            ? `${pendingUser?.name || "Người dùng"} đang yêu cầu vào phòng.`
            : `${pendingUser?.name || "Người dùng"} và ${count - 1} người khác đang chờ duyệt.`,
          actionLabel: isSingle ? "Duyệt ngay" : "Xem danh sách",
          onAction: () => {
            const s = socketRef.current;
            if (isSingle && s && s.connected && pendingUser?.userId) {
              s.emit("room:handle-join-request", {
                roomCode,
                targetUserId: pendingUser.userId,
                action: "APPROVE",
              });
            } else {
              setPanelTab("approval");
              setPanelOpen(true);
            }
          },
        });
      }
    });

    // Sự kiện đồng bộ toàn bộ danh sách thành viên từ server
    socket.on(
      "room:members-sync",
      ({ roomCode: syncRoomCode, participants, hostId: syncHostId, titleVisibility, raisedHands, focusStatuses, isLocked: syncLocked, pinnedItem: syncPinned }) => {
        // Chỉ xử lý nếu khớp mã phòng hiện tại (hoặc không truyền syncRoomCode để tương thích)
        if (
          syncRoomCode &&
          roomCode &&
          String(syncRoomCode).trim().toUpperCase() !== String(roomCode).trim().toUpperCase()
        ) {
          return;
        }
        if (syncLocked !== undefined) setIsLocked(Boolean(syncLocked));
        if (syncPinned !== undefined) setPinnedItem(syncPinned);
        handleSync(participants, syncHostId, titleVisibility, raisedHands, focusStatuses);
      }
    );

    // Đồng bộ lại danh sách thành viên khi tab/cửa sổ được người dùng focus lại
    const handleWindowFocus = () => {
      if (socket && socket.connected && roomCode) {
        socket.emit("room:request-members-sync", { roomCode });
      }
    };
    window.addEventListener("focus", handleWindowFocus);

    // Cập nhật trạng thái giơ tay phát biểu realtime
    socket.off("room:hand-updated");
    socket.on("room:hand-updated", ({ userId, userName, isHandRaised: nextHandState }) => {
      const uIdStr = String(userId || "");
      const selfId = String(currentUserId || "");

      setMembers((prev) =>
        prev.map((m) =>
          String(m.id) === uIdStr
            ? { ...m, isHandRaised: Boolean(nextHandState) }
            : m
        )
      );

      if (selfId && uIdStr === selfId) {
        setIsHandRaised(Boolean(nextHandState));
      } else if (nextHandState) {
        // Chống lặp thông báo toast trong vòng 2 giây cho cùng 1 user
        const now = Date.now();
        if (
          lastHandToastRef.current.userId === uIdStr &&
          now - lastHandToastRef.current.time < 2000
        ) {
          return;
        }
        lastHandToastRef.current = { userId: uIdStr, time: now };

        // Hiển thị thông báo toast nhỏ kín đáo khi có thành viên giơ tay
        addToast({
          type: "hand",
          title: "Giơ tay phát biểu",
          body: `${userName || "Một thành viên"} đã giơ tay phát biểu.`,
        });
      }
    });

    // Nhận cảm xúc nổi realtime từ các thành viên trong phòng
    socket.off("room:receive-reaction");
    socket.on("room:receive-reaction", ({ emoji, senderName, senderSocketId }) => {
      // Bỏ qua nếu tin phản ứng đến từ chính mình (đã kích hoạt local "Bạn")
      if (senderSocketId && socket.id && senderSocketId === socket.id) return;
      triggerReaction({ emoji, senderName });
    });

    // Lắng nghe trạng thái có người đang theo dõi chép lời trong phòng
    socket.off("room:transcription-status-changed");
    socket.on("room:transcription-status-changed", ({ hasActiveListener }) => {
      setRoomHasActiveTranscription(Boolean(hasActiveListener));
    });

    // Cập nhật trạng thái hiển thị danh hiệu realtime
    socket.on("room:user-title-visibility", ({ userId, isVisible }) => {
      setMembers((prev) =>
        prev.map((m) =>
          String(m.id) === String(userId)
            ? { ...m, isTitleVisible: isVisible }
            : m
        )
      );
    });

    // Cập nhật danh hiệu người dùng realtime
    socket.on("user:title-updated", ({ userId, equippedTitle, title }) => {
      setMembers((prev) =>
        prev.map((m) =>
          String(m.id) === String(userId)
            ? { ...m, equippedTitle: equippedTitle || title || m.equippedTitle }
            : m
        )
      );
    });

    // Thành viên mới tham gia
    socket.on("room:user-joined", (user) => {
      if (!user) return;
      const incomingId = String(user.id || user._id || "");
      if (!incomingId) return;

      setMembers((prev) => {
        const hostId = room?.hostId?._id || room?.hostId;
        const newMember = participantToMember(
          {
            userId: {
              _id: incomingId,
              id: incomingId,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
              isPro: Boolean(user.isPro),
              equippedTitle: user.equippedTitle || user.title || "Nhập môn học giả",
              title: user.title,
            },
            isTitleVisible:
              user.isTitleVisible !== undefined ? user.isTitleVisible : true,
          },
          hostId,
          currentUserId
        );
        // Dùng dedupeMembers thay vì kiểm tra thủ công để bắt mọi trường hợp trùng ID
        return dedupeMembers([...prev, newMember]);
      });
    });

    // Thành viên rời phòng
    socket.on("room:user-left", ({ userId, socketId, name }) => {
      if (!userId && !socketId) return;
      const selfId = String(currentUserId || "");
      // Tuyệt đối không xóa chính mình khỏi danh sách hiển thị
      if (userId && String(userId) === selfId) return;

      setMembers((prev) =>
        prev.filter((m) => {
          if (m.isYou) return true;
          if (userId && String(m.id) === String(userId)) return false;
          return true;
        })
      );
      // Toast thông báo (có debounce chống lặp 3s)
      if (name) {
        const now = Date.now();
        const uKey = String(userId || socketId || name);
        if (lastLeaveToastRef.current.id === uKey && now - lastLeaveToastRef.current.time < 3000) {
          return;
        }
        lastLeaveToastRef.current = { id: uKey, time: now };
        addToast({
          key: `leave_${uKey}`,
          type: "leave",
          title: "Thành viên rời phòng",
          body: `${name} đã rời cuộc học.`,
        });
      }
    });

    // Cảnh báo người dùng là người duy nhất trong phòng (10 phút)
    socket.on("room:alone-warning", ({ message, remainingSeconds, expiresAt }) => {
      const sec = typeof remainingSeconds === "number" ? remainingSeconds : 600;
      setAloneCountdown({
        remainingSeconds: sec,
        expiresAt: expiresAt || Date.now() + sec * 1000,
      });
    });

    // Khi có thêm người tham gia phòng -> Hủy đếm ngược 10 phút một mình
    socket.on("room:alone-cancelled", () => {
      setAloneCountdown(null);
    });

    // Host rời cuộc gọi tạm thời
    socket.on("room:host-left-temporary", ({ message }) => {
      addToast({
        type: "warning",
        title: "Chủ phòng đã rời cuộc gọi",
        body: message || "Chủ phòng đã rời cuộc gọi. Phiên học sẽ tự đóng sau 10 phút nếu chủ phòng không quay lại.",
      });
    });

    // Host quay trở lại cuộc gọi
    socket.on("room:host-returned", ({ message }) => {
      addToast({
        type: "join",
        title: "Chủ phòng đã quay lại",
        body: message || "Chủ phòng đã quay trở lại cuộc gọi.",
      });
    });


    // Sự kiện phòng kết thúc / bị giải tán (Google Meet style)
    const handleRoomTerminated = ({ message, reason }) => {
      setIsSessionEnded(true);
      setAloneCountdown(null);

      let title = "Chủ phòng đã kết thúc phiên học";
      let bodyText = message || "Chủ phòng đã kết thúc phiên học.";

      if (reason === "alone_timeout") {
        title = "Phiên học đã đóng";
        bodyText = message || "Bạn là người duy nhất trong phòng và phiên học đã tự động đóng sau 10 phút.";
      } else if (reason === "max_duration") {
        title = "Phiên học đạt giới hạn 24 giờ";
        bodyText = message || "Phiên học đã đạt thời lượng tối đa 24 giờ và tự động kết thúc.";
      } else if (reason === "host_timeout") {
        title = "Chủ phòng không quay lại";
        bodyText = message || "Phiên học tự động đóng do chủ phòng đã rời cuộc gọi quá 10 phút.";
      }

      // Nếu chính user này chủ động bấm nút rời phòng, không hiển thị toast
      if (!isExplicitlyLeavingRef.current && !hasHostClosedToastRef.current) {
        hasHostClosedToastRef.current = true;
        addToast({
          key: "room_terminated",
          type: "host_closed",
          title,
          body: bodyText,
        });
      }

      // Nếu không bật chép lời thì redirect về trang chủ sau 2.5 giây
      // Nếu ĐANG BẬT chép lời, không tự động chuyển trang để người dùng thoải mái sao chép hoặc tải .txt
      if (!transcriptionOnRef.current) {
        setTimeout(() => {
          router.push("/dashboard?book=rooms");
        }, 2500);
      }
    };

    socket.on("room_terminated", handleRoomTerminated);
    socket.on("room:host-closed", handleRoomTerminated);

    // Thành viên bị mời rời phòng (kick)
    socket.on("room:user-kicked", ({ targetUserId, targetName, hostName, reason }) => {
      const selfId = String(currentUserId || "");
      if (selfId && String(targetUserId) === selfId) {
        addToast({
          type: "warning",
          title: "Bạn đã được mời rời phòng",
          body: reason || `${hostName} đã mời bạn rời khỏi phòng học.`,
        });
        setTimeout(() => {
          router.push("/dashboard?book=rooms");
        }, 2500);
      } else {
        setMembers((prev) => prev.filter((m) => String(m.id) !== String(targetUserId)));
        addToast({
          type: "leave",
          title: "Thành viên rời phòng",
          body: `${targetName} đã được chủ phòng mời rời khỏi phòng.`,
        });
      }
    });

    // Thành viên bị cấm vào phòng (ban)
    socket.on("room:user-banned", ({ targetUserId, targetName, hostName, reason }) => {
      const selfId = String(currentUserId || "");
      if (selfId && String(targetUserId) === selfId) {
        addToast({
          type: "error",
          title: "Bạn đã bị cấm vào phòng",
          body: reason || `${hostName} đã cấm bạn vào phòng học này.`,
        });
        setTimeout(() => {
          router.push("/dashboard?book=rooms");
        }, 2500);
      } else {
        setMembers((prev) => prev.filter((m) => String(m.id) !== String(targetUserId)));
        addToast({
          type: "leave",
          title: "Thành viên bị cấm",
          body: `${targetName} đã bị cấm tham gia phòng học này.`,
        });
      }
    });

    // Lắng nghe tin nhắn chat realtime
    socket.on("chat:new-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      // Toast chỉ khi panel đang đóng và không phải tin nhắn của mình
      if (!panelOpenRef.current && !msg.system) {
        const senderId = msg.sender?.id || msg.sender?._id;
        const selfId = String(currentUserId || "");
        if (!selfId || String(senderId) !== selfId) {
          const bodyText =
            msg.text ||
            (msg.file?.fileName ? `Đã chia sẻ: ${msg.file.fileName}` : "Tin nhắn mới");
          addToast({
            type: "message",
            title: msg.sender?.name || "Tin nhắn mới",
            body: bodyText,
          });
        }
      }
    });

    // Lắng nghe đồng bộ lịch sử tin nhắn khi join / reconnect
    socket.on("chat:sync-messages", (synced) => {
      if (Array.isArray(synced)) {
        setMessages(synced);
      }
    });

    // Lắng nghe đồng bộ danh sách tài liệu phòng học
    socket.on("room:sync-files", (files) => {
      if (Array.isArray(files)) {
        setRoomFiles(files);
      }
    });

    // Lắng nghe tài liệu mới được chia sẻ realtime
    socket.on("room:file-shared", (newFile) => {
      if (newFile) {
        setRoomFiles((prev) => {
          const exists = prev.some(
            (f) =>
              (f._id && newFile._id && String(f._id) === String(newFile._id)) ||
              (f.fileUrl && newFile.fileUrl && f.fileUrl === newFile.fileUrl)
          );
          if (exists) return prev;
          return [newFile, ...prev];
        });
        if (!panelOpenRef.current) {
          const senderId = newFile.senderId?._id || newFile.senderId;
          const selfId = String(currentUserId || "");
          if (!selfId || String(senderId) !== selfId) {
            addToast({
              type: "message",
              title: "Tài liệu mới trong phòng",
              body: `${newFile.senderName || "Thành viên"} đã chia sẻ "${newFile.fileName || "tài liệu"}"`,
            });
          }
        }
      }
    });

    // Lắng nghe tài liệu bị xóa realtime (ví dụ khi thu hồi tin nhắn)
    socket.on("room:file-deleted", ({ fileUrl }) => {
      if (fileUrl) {
        setRoomFiles((prev) => prev.filter((f) => f.fileUrl !== fileUrl));
      }
    });

    // Lắng nghe tin nhắn / bình chọn bị thu hồi realtime
    const handleMessageRecalled = ({ messageId, pollId, recalledBy, recalledAt, fileUrl, isPoll }) => {
      setMessages((prev) =>
        prev.map((m) => {
          const isTarget =
            m.id === messageId ||
            (pollId && (m.id === pollId || m.poll?.id === pollId)) ||
            (messageId && m.poll?.id === messageId);
          if (isTarget) {
            return {
              ...m,
              isRecalled: true,
              recalledBy,
              recalledAt,
              text: isPoll || m.type === "poll" || m.poll ? "Bình chọn này đã được thu hồi" : "",
              file: null,
              fileUrl: null,
              fileName: null,
              poll: m.poll ? { ...m.poll, isRecalled: true } : null,
            };
          }
          return m;
        })
      );
      if (fileUrl) {
        setRoomFiles((prev) => prev.filter((f) => f.fileUrl !== fileUrl));
      }
    };

    socket.on("chat:message-recalled", handleMessageRecalled);
    socket.on("message_recalled", handleMessageRecalled);
    socket.on("poll_recalled", handleMessageRecalled);
    socket.on("poll:recalled", handleMessageRecalled);

    // Lắng nghe đồng bộ Pomodoro authoritative từ server
    socket.on("pomodoro:sync", (data) => {
      if (data) {
        setPomodoro(data);
        if (data.duration) {
          setFocusMinutes([Math.round(data.duration / 60)]);
        }
      }
    });

    // Lắng nghe trạng thái khóa phòng realtime
    socket.on("room:lock-updated", ({ isLocked: nextLocked }) => {
      setIsLocked(Boolean(nextLocked));
      addToast({
        type: nextLocked ? "warning" : "info",
        title: nextLocked ? "Phòng học đã khóa" : "Phòng học đã mở",
        body: nextLocked
          ? "Chủ phòng đã khóa phòng học. Thành viên bên ngoài tạm thời không thể vào."
          : "Chủ phòng đã mở khóa phòng học.",
      });
    });

    // Lắng nghe lệnh tắt mic từ xa cho chính mình
    socket.on("room:user-force-muted", async ({ targetUserId, hostName }) => {
      const selfId = String(currentUserId || "");
      if (selfId && String(targetUserId) === selfId) {
        if (forceMuteActionRef.current) {
          await forceMuteActionRef.current();
        }
        setMembers((prev) =>
          prev.map((m) => (m.isYou || String(m.id) === selfId ? { ...m, micOn: false } : m))
        );
        addToast({
          type: "warning",
          title: "Microphone đã tắt",
          body: `${hostName || "Chủ phòng"} đã tắt mic của bạn.`,
        });
      }
    });

    // Lắng nghe lệnh tắt mic toàn bộ thành viên
    socket.on("room:all-force-muted", async ({ hostName, hostId: hId }) => {
      const selfId = String(currentUserId || "");
      const isCurrentUserHost = Boolean(hId && selfId && String(hId) === selfId);
      if (!isCurrentUserHost) {
        if (forceMuteActionRef.current) {
          await forceMuteActionRef.current();
        }
        setMembers((prev) =>
          prev.map((m) => (m.isYou || String(m.id) === selfId ? { ...m, micOn: false } : m))
        );
        addToast({
          type: "warning",
          title: "Microphone đã tắt",
          body: `${hostName || "Chủ phòng"} đã tắt mic của tất cả thành viên.`,
        });
      }
    });

    // Lắng nghe chuyển giao quyền Chủ phòng
    socket.on("room:host-transferred", ({ previousHostId, newHostId, newHostName, previousHostName }) => {
      setRoom((prev) => (prev ? { ...prev, hostId: newHostId } : prev));
      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          isHost: String(m.id) === String(newHostId),
        }))
      );
      const selfId = String(currentUserId || "");
      const amINewHost = Boolean(selfId && String(newHostId) === selfId);
      addToast({
        type: amINewHost ? "success" : "info",
        title: "Chủ phòng mới",
        body: amINewHost
          ? "Bạn đã được chỉ định làm Chủ phòng học. Toàn bộ quyền điều phối đã được kích hoạt!"
          : `${newHostName || "Thành viên"} đã trở thành Chủ phòng học mới.`,
      });
    });

    // Lắng nghe cập nhật trạng thái tập trung
    socket.on("room:focus-status-updated", ({ userId, status }) => {
      setMembers((prev) =>
        prev.map((m) =>
          String(m.id) === String(userId)
            ? { ...m, focusStatus: status }
            : m
        )
      );
      if (String(userId) === String(currentUserId)) {
        setMyFocusStatus(status);
      }
    });

    // Lắng nghe ghim tin nhắn / tài liệu
    socket.on("chat:item-pinned", ({ pinnedItem: item, pinnedBy }) => {
      setPinnedItem(item);
      addToast({
        type: "info",
        title: "Tin nhắn được ghim",
        body: `${pinnedBy || "Một thành viên"} đã ghim một tin nhắn trong phòng chat.`,
      });
    });

    // Lắng nghe bỏ ghim
    socket.on("chat:item-unpinned", () => {
      setPinnedItem(null);
    });

    // Lắng nghe cập nhật bình chọn nhanh (Quick Poll)
    const handlePollUpdate = ({ pollId, poll, options, totalVotes, isClosed }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if ((m.type === "poll" || m.poll) && (m.id === pollId || m.poll?.id === pollId)) {
            const updatedPoll = poll || (m.poll ? { ...m.poll } : {});
            if (options) updatedPoll.options = options;
            if (totalVotes !== undefined) updatedPoll.totalVotes = totalVotes;
            if (isClosed !== undefined) updatedPoll.isClosed = isClosed;
            return {
              ...m,
              poll: updatedPoll,
            };
          }
          return m;
        })
      );
    };

    socket.on("poll:vote-updated", handlePollUpdate);
    socket.on("poll_updated", handlePollUpdate);
    socket.on("poll:locked", handlePollUpdate);

    return () => {
      socket.off("room:members-sync");
      socket.off("room:user-joined");
      socket.off("room:user-left");
      socket.off("room:host-closed");
      socket.off("room:host-left-temporary");
      socket.off("room:host-returned");
      socket.off("room:user-kicked");
      socket.off("room:user-banned");
      socket.off("room:lock-updated");
      socket.off("room:user-force-muted");
      socket.off("room:all-force-muted");
      socket.off("room:host-transferred");
      socket.off("room:focus-status-updated");
      socket.off("chat:item-pinned");
      socket.off("chat:item-unpinned");
      socket.off("poll:vote-updated", handlePollUpdate);
      socket.off("poll_updated", handlePollUpdate);
      socket.off("poll:locked", handlePollUpdate);
      socket.off("chat:new-message");
      socket.off("chat:sync-messages");
      socket.off("chat:message-recalled", handleMessageRecalled);
      socket.off("message_recalled", handleMessageRecalled);
      socket.off("poll_recalled", handleMessageRecalled);
      socket.off("poll:recalled", handleMessageRecalled);
      socket.off("room:sync-files");
      socket.off("room:file-shared");
      socket.off("room:file-deleted");
      socket.off("room:hand-updated");
      socket.off("room:receive-reaction");
      socket.off("room:transcription-status-changed");
      socket.off("pomodoro:sync");
      socket.off("connect", emitJoin);
      socket.off("room:user-title-visibility");
      socket.off("user:title-updated");
      socket.off("room:pending-updated");
      socket.off("room:join-requested");
      socket.off("room:alone-warning");
      socket.off("room:alone-cancelled");
      socket.off("room_terminated", handleRoomTerminated);
      socket.off("room:terminated", handleRoomTerminated);
      clearInterval(studyHeartbeatInterval);
      window.removeEventListener("focus", handleWindowFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, currentUserId]);

  // Handlers gửi chat và điều khiển Pomodoro qua Socket.io
  const handleSendMessage = useCallback(
    (text, file = null, replyTo = null) => {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit("chat:send-message", {
          roomCode,
          text: text || "",
          file: file || null,
          replyTo: replyTo || null,
        });
      }
    },
    [roomCode]
  );

  // Thu hồi tin nhắn theo thời gian thực (Messenger unsend)
  const handleRecallMessage = useCallback(
    (messageId) => {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit(
          "chat:recall-message",
          {
            roomCode,
            messageId,
          },
          (res) => {
            if (res?.success) {
              addToast({
                type: "success",
                title: "Thu hồi tin nhắn",
                body: "Tin nhắn đã được thu hồi với mọi người.",
              });
            } else if (res?.message) {
              addToast({
                type: "error",
                title: "Không thể thu hồi",
                body: res.message,
              });
            }
          }
        );
      }
    },
    [roomCode, addToast]
  );

  // Khóa / Mở khóa phòng học (Lock Room)
  const handleToggleLock = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("room:toggle-lock", {
        roomCode,
        isLocked: !isLocked,
      });
    }
  }, [roomCode, isLocked]);

  // Tắt mic từ xa 1 thành viên (Remote Mute)
  const handleForceMuteUser = useCallback((targetUserId) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("room:force-mute-user", {
        roomCode,
        targetUserId,
      });
    }
  }, [roomCode]);

  // Tắt mic tất cả thành viên (Mute All)
  const handleForceMuteAll = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("room:force-mute-all", {
        roomCode,
      });
    }
  }, [roomCode]);

  // Chuyển giao quyền Chủ phòng (Transfer Host)
  const handleTransferHost = useCallback((newHostId) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("room:transfer-host", {
        roomCode,
        newHostId,
      });
    }
  }, [roomCode]);

  // Cập nhật trạng thái tập trung cá nhân (Focus Status)
  const handleUpdateFocusStatus = useCallback((status) => {
    setMyFocusStatus(status);
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("room:update-focus-status", {
        roomCode,
        status,
      });
    }
  }, [roomCode]);

  // Ghim tin nhắn / tài liệu (Pin Item)
  const handlePinItem = useCallback((item) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("chat:pin-item", {
        roomCode,
        item,
      });
    }
  }, [roomCode]);

  // Bỏ ghim tin nhắn / tài liệu (Unpin Item)
  const handleUnpinItem = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("chat:unpin-item", {
        roomCode,
      });
    }
  }, [roomCode]);

  // Tạo bình chọn nhanh (Quick Poll)
  const handleCreatePoll = useCallback((pollData) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("chat:create-poll", {
        roomCode,
        ...pollData,
      });
    }
  }, [roomCode]);

  // Bình chọn Poll (Vote Poll)
  const handleVotePoll = useCallback((pollId, optionIndex) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("poll:vote", {
        roomCode,
        pollId,
        optionIndex,
      });
    }
  }, [roomCode]);

  // Khóa bình chọn (Lock Poll)
  const handleLockPoll = useCallback((pollId) => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("poll:lock", {
        roomCode,
        pollId,
      });
    }
  }, [roomCode]);

  // Thêm phương án bình chọn (Add Option Poll)
  const handleAddOptionPoll = useCallback((pollId, optionText) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit(
          "poll:add-option",
          { roomCode, pollId, optionText },
          (res) => {
            if (res?.success) {
              resolve(res);
            } else {
              reject(new Error(res?.message || "Không thể thêm phương án"));
            }
          }
        );
      } else {
        reject(new Error("Mất kết nối máy chủ"));
      }
    });
  }, [roomCode]);

  // Thu hồi bình chọn (Recall Poll)
  const handleRecallPoll = useCallback(
    (messageId, pollId) => {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit(
          "chat:recall-poll",
          {
            roomCode,
            messageId,
            pollId,
          },
          (res) => {
            if (res?.success) {
              addToast({
                type: "success",
                title: "Thu hồi bình chọn",
                body: "Cuộc bình chọn đã được thu hồi với mọi người trong phòng.",
              });
            } else if (res?.message) {
              addToast({
                type: "error",
                title: "Không thể thu hồi",
                body: res.message,
              });
            }
          }
        );
      }
    },
    [roomCode, addToast]
  );

  const handleTogglePomodoro = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    if (pomodoro.isRunning) {
      socket.emit("pomodoro:pause", { roomCode });
    } else {
      socket.emit("pomodoro:start", { roomCode });
    }
  }, [roomCode, pomodoro.isRunning]);

  const handleResetPomodoro = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("pomodoro:reset", { roomCode });
    }
  }, [roomCode]);

  const handleFocusMinutesChange = useCallback(
    (vals) => {
      const val = vals?.[0] || 25;
      setFocusMinutes(vals);
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit("pomodoro:set-duration", {
          roomCode,
          minutes: val,
        });
      }
    },
    [roomCode]
  );

  // Xử lý Host mời thành viên rời phòng (Kick)
  const handleKickMember = useCallback(
    (targetUserId, reason = "") => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;
      const token = getAuthToken();
      socket.emit(
        "room:kick-member",
        {
          roomCode,
          targetUserId,
          reason,
          hostUserId: currentUserId,
          userId: currentUserId,
          token,
        },
        (res) => {
          if (res?.success) {
            addToast({
              type: "success",
              title: "Thao tác thành công",
              body: res.message || "Đã mời thành viên rời phòng.",
            });
          } else {
            addToast({
              type: "error",
              title: "Lỗi",
              body: res?.message || "Không thể mời thành viên rời phòng.",
            });
          }
        }
      );
    },
    [roomCode, currentUserId, addToast]
  );

  // Xử lý Host cấm thành viên vào phòng (Ban)
  const handleBanMember = useCallback(
    (targetUserId, reason = "") => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;
      const token = getAuthToken();
      socket.emit(
        "room:ban-member",
        {
          roomCode,
          targetUserId,
          reason,
          hostUserId: currentUserId,
          userId: currentUserId,
          token,
        },
        (res) => {
          if (res?.success) {
            addToast({
              type: "success",
              title: "Thao tác thành công",
              body: res.message || "Đã cấm thành viên vào phòng.",
            });
          } else {
            addToast({
              type: "error",
              title: "Lỗi",
              body: res?.message || "Không thể cấm thành viên vào phòng.",
            });
          }
        }
      );
    },
    [roomCode, currentUserId, addToast]
  );

  // Phê duyệt thành viên vào phòng
  const handleApproveJoin = useCallback(
    (targetUserId) => {
      const socket = socketRef.current;
      if (socket && socket.connected && roomCode && targetUserId) {
        socket.emit("room:handle-join-request", {
          roomCode,
          targetUserId,
          action: "APPROVE",
        });
      }
    },
    [roomCode]
  );

  // Từ chối yêu cầu vào phòng
  const handleRejectJoin = useCallback(
    (targetUserId) => {
      const socket = socketRef.current;
      if (socket && socket.connected && roomCode && targetUserId) {
        socket.emit("room:handle-join-request", {
          roomCode,
          targetUserId,
          action: "REJECT",
        });
      }
    },
    [roomCode]
  );

  // Duyệt tất cả yêu cầu đang chờ
  const handleApproveAllJoin = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.connected && roomCode) {
      socket.emit("room:handle-join-request", {
        roomCode,
        action: "APPROVE_ALL",
      });
    }
  }, [roomCode]);

  // Hàm thực hiện rời phòng tức thì: phát socket event và gọi API /rooms/leave (beacon / keepalive fetch)
  const leaveRoomNow = useCallback((isExplicit = false, options = {}) => {
    // Nếu không phải là hành động bấm rời phòng trực tiếp và phòng vừa mount < 4s -> Bỏ qua (chống StrictMode / remount)
    if (!isExplicit && Date.now() - mountTimeRef.current < 4000) {
      console.warn("[Room] Bỏ qua rời phòng tự động trong 4 giây khởi tạo đầu tiên.");
      return;
    }

    if (hasLeftRef.current) return;
    hasLeftRef.current = true;

    const code = roomCode || room?.roomCode;
    const rId = room?._id || code;
    const uId = currentUserId;
    const terminate = Boolean(options?.terminate);
    const action = options?.action || (terminate ? "terminate" : "leave_only");

    // 1. Gửi socket event tức thì (hỗ trợ cả terminate_room, leave_room và leave-room)
    const socket = socketRef.current;
    if (socket && socket.connected && uId) {
      try {
        if (terminate) {
          socket.emit("terminate_room", { roomCode: code, roomId: rId, userId: uId });
          socket.emit("room:terminate", { roomCode: code, roomId: rId, userId: uId });
        } else {
          socket.emit("leave_room", { roomCode: code, roomId: rId, userId: uId, action, terminate: false });
          socket.emit("leave-room", { roomCode: code, roomId: rId, userId: uId, action, terminate: false });
        }
      } catch (_) {}
    }

    // 2. Gọi API rời phòng qua navigator.sendBeacon hoặc fetch keepalive
    if (code && uId) {
      try {
        const token = getAuthToken();
        const payload = JSON.stringify({
          roomCode: code,
          roomId: rId,
          userId: uId,
          token,
          terminate,
          action,
        });

        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
        const leaveUrl = `${API_BASE}/rooms/leave`;

        let beaconSent = false;
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          try {
            const blob = new Blob([payload], { type: "application/json" });
            beaconSent = navigator.sendBeacon(leaveUrl, blob);
          } catch (_) {}
        }

        if (!beaconSent && typeof fetch !== "undefined") {
          fetch(leaveUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch (_) {}
    }
  }, [roomCode, room, currentUserId]);

  useEffect(() => {
    leaveRoomNowRef.current = leaveRoomNow;
  }, [leaveRoomNow]);

  // Xử lý khi người dùng chủ động bấm nút "Rời phòng" trên giao diện
  const handleLeave = useCallback((options = {}) => {
    isExplicitlyLeavingRef.current = true;
    leaveRoomNow(true, options);
    router.push("/dashboard?book=rooms");
  }, [leaveRoomNow, router]);

  // Sao chép liên kết phòng
  const handleCopyLink = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(window.location.href)
        .catch(() => {});
    }
    setCopiedLink(true);
    clearTimeout(copyLinkTimerRef.current);
    copyLinkTimerRef.current = setTimeout(() => setCopiedLink(false), 2000);
  }, []);

  // Sao chép mã phòng
  const handleCopyCode = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(room?.roomCode || roomCode)
        .catch(() => {});
    }
    setCopiedCode(true);
    clearTimeout(copyCodeTimerRef.current);
    copyCodeTimerRef.current = setTimeout(() => setCopiedCode(false), 2000);
  }, [room?.roomCode, roomCode]);

  // Bắt sự kiện người dùng rời phòng: đóng tab, F5, bấm nút Back trình duyệt
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (leaveRoomNowRef.current) {
        leaveRoomNowRef.current(false);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      clearTimeout(copyLinkTimerRef.current);
      clearTimeout(copyCodeTimerRef.current);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);

      // CHỈ gọi leaveRoomNow khi người dùng THỰC SỰ chủ động bấm rời phòng
      // Tuyệt đối KHÔNG gọi khi mount -> unmount tự động trong StrictMode
      if (isExplicitlyLeavingRef.current && leaveRoomNowRef.current) {
        leaveRoomNowRef.current(true);
      }
    };
  }, []);

  const displayCode = room?.roomCode || roomCode || "";
  const displayTitle = room?.title || room?.name || `Phòng ${displayCode}`;

  const pomodoroProgress =
    pomodoro.duration > 0
      ? Math.min(
          Math.max(
            ((pomodoro.duration - pomodoro.remaining) / pomodoro.duration) * 100,
            0
          ),
          100
        )
      : 0;

  if (!isMounted) {
    return (
      <div
        className="room-shell bg-[#FAF8F5] dark:bg-[#141210] flex flex-col min-h-[100dvh]"
        suppressHydrationWarning={true}
      >
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-[#b3894e] dark:border-[#3a3128] dark:border-t-[#c3a47b]" />
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={livekitToken}
      serverUrl={livekitUrl}
      connect={Boolean(livekitToken && livekitUrl)}
      onDisconnected={(reason) => {
        console.log("[LiveKit] Ngat ket noi:", reason);
      }}
      onError={(err) => console.warn("[LiveKit] Room error:", err)}
      className="room-shell"
      data-lk-theme="default"
      suppressHydrationWarning={true}
    >
      <RoomAudioRenderer />
      <LiveKitRemoteMuteController
        onRegisterMuteHandler={(fn) => {
          forceMuteActionRef.current = fn;
        }}
      />
      {/* LiveKitSpeechBridge — Cầu nối nhận diện giọng nói khi mic bật và phát sóng cho người bật chép lời */}
      <LiveKitSpeechBridge
        roomCode={roomCode}
        currentUser={currentUser}
        currentUserId={currentUserId}
        socket={socketRef.current}
        transcriptionOn={transcriptionOn}
        roomHasActiveTranscription={roomHasActiveTranscription}
      />

      {/* Header phòng */}
      <header className="relative z-[30] flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-[#FAF8F5]/90 dark:border-[#3a3128] dark:bg-[#181513]/90 backdrop-blur-sm px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/?book=rooms"
            title="Về sảnh sách phòng học"
            className="shrink-0 hover:opacity-85 transition-opacity"
          >
            <img
              src="/image/logo.png"
              alt="Virtual Study Room Logo"
              className="h-7 w-auto object-contain drop-shadow-sm"
            />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-serif text-base font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3] sm:text-lg">
                {displayTitle}
              </h1>
              <Badge variant="muted" className="gap-1 font-normal">
                <Users className="h-3 w-3" strokeWidth={ICON_STROKE} />
                {members.length}
              </Badge>

              {/* Trạng thái phòng bị khóa đối với thành viên thông thường */}
              {!isHost && isLocked && (
                <Badge
                  variant="outline"
                  className="border-[#8b2626]/40 bg-[#8b2626]/20 text-[#f5ede3] gap-1 text-[11px] font-normal py-0.5 px-2"
                  title="Phòng đang bị khóa bởi chủ phòng"
                >
                  <Lock className="h-3 w-3 text-[#c3a47b]" />
                  <span className="hidden sm:inline">Phòng bị khóa</span>
                </Badge>
              )}
            </div>

            {displayCode && (
              <button
                type="button"
                onClick={handleCopyCode}
                title="Sao chép mã phòng"
                aria-label="Sao chép mã phòng"
                id="btn-copy-room-code"
                className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-stone-500 hover:text-[#b3894e] dark:text-[#a89b8d] dark:hover:text-[#c3a47b] transition"
              >
                <span className="tracking-widest">{displayCode}</span>
                {copiedCode ? (
                  <Check className="h-3 w-3 text-[#c3a47b]" strokeWidth={2} />
                ) : (
                  <Copy className="h-3 w-3" strokeWidth={1.75} />
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Nút Khóa / Mở khóa phòng học (dành riêng cho Chủ phòng) */}
          {isHost && (
            <Button
              variant={isLocked ? "destructive" : "outline"}
              size="sm"
              type="button"
              onClick={handleToggleLock}
              id="btn-toggle-room-lock"
              className={cn(
                "gap-1.5 text-xs transition-colors",
                isLocked
                  ? "border-[#8b2626]/50 bg-[#8b2626]/25 text-[#f5ede3] hover:bg-[#8b2626]/40"
                  : "border-stone-300 text-[#2D241E] hover:bg-stone-200 dark:border-[#3a3128] dark:text-[#d8c8b4] dark:hover:text-[#f5ede3] dark:hover:bg-[#201b18]"
              )}
              title={
                isLocked
                  ? "Phòng đang bị khóa. Người ngoài không thể vào. Bấm để mở khóa"
                  : "Khóa phòng học để ngăn thành viên bên ngoài truy cập"
              }
            >
              {isLocked ? (
                <>
                  <Lock className="h-3.5 w-3.5 text-[#f5ede3]" />
                  <span className="hidden sm:inline">Phòng đã khóa</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 text-[#c3a47b]" />
                  <span className="hidden sm:inline">Khóa phòng</span>
                </>
              )}
            </Button>
          )}

          {/* Bộ chọn trạng thái tập trung cá nhân (Focus Status Widget) */}
          <FocusStatusSelector
            currentStatus={myFocusStatus}
            onSelectStatus={handleUpdateFocusStatus}
          />
          {/* Nút bật/tắt hiển thị danh hiệu ở Header (góc phải) */}
          <Button
            variant={showTitle ? "secondary" : "outline"}
            size="sm"
            type="button"
            onClick={handleToggleTitle}
            id="btn-toggle-title-header"
            className="gap-1.5 text-xs border-[#3a3128] transition-colors"
            title={showTitle ? "Tắt hiển thị danh hiệu của bạn" : "Bật hiển thị danh hiệu của bạn"}
          >
            <Award className={cn("h-3.5 w-3.5", showTitle ? "text-[#c3a47b]" : "text-[#75695e]")} />
            <span className="hidden sm:inline">
              {showTitle ? "Danh hiệu: Bật" : "Danh hiệu: Tắt"}
            </span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleCopyLink}
            id="btn-copy-room-link"
            className="hidden gap-1.5 sm:inline-flex border-[#3a3128] text-[#d8c8b4] hover:text-[#f5ede3] hover:bg-[#201b18]"
            aria-label="Sao chép liên kết phòng"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#c3a47b]" strokeWidth={2} />
                Đã sao chép
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5 text-[#c3a47b]" strokeWidth={ICON_STROKE} />
                Sao chép liên kết
              </>
            )}
          </Button>

          {/* Nút mã QR mời vào phòng */}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setIsQRModalOpen(true)}
            id="btn-room-qr-code"
            className="gap-1.5 text-xs border-[#3a3128] text-[#d8c8b4] hover:text-[#f5ede3] hover:bg-[#201b18]"
            title="Mã QR mời vào phòng"
          >
            <QrCode className="h-3.5 w-3.5 text-[#c3a47b]" strokeWidth={1.75} />
            <span className="hidden sm:inline">Mã QR</span>
          </Button>

          {/* Nút chuyển đổi giao diện Sáng / Tối */}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            id="btn-toggle-room-theme"
            className="gap-1.5 text-xs border-stone-300 text-stone-700 hover:bg-stone-200 dark:border-[#3a3128] dark:text-[#d8c8b4] dark:hover:text-[#f5ede3] dark:hover:bg-[#201b18] transition-colors"
            title={isDark ? "Chuyển sang chế độ Sáng" : "Chuyển sang chế độ Tối"}
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Sáng</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Tối</span>
              </>
            )}
          </Button>

          {/* Chuông thông báo hoạt động phòng học (tin nhắn, file, giơ tay, yêu cầu vào phòng) */}
          <RoomNotificationBell
            roomCode={roomCode}
            currentUserId={currentUserId}
            isHost={isHost}
            onAddToast={addToast}
            onOpenChat={() => {
              setPanelTab("chat");
              setPanelOpen(true);
            }}
            onOpenFiles={() => {
              setPanelTab("files");
              setPanelOpen(true);
            }}
            onOpenMembers={() => {
              setPanelTab("members");
              setPanelOpen(true);
            }}
            onOpenApproval={() => {
              setPanelTab("approval");
              setPanelOpen(true);
            }}
          />

          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setPanelOpen(true)}
            id="btn-open-panel"
            className="border border-stone-300 bg-[#EAE3D5] text-[#2D241E] hover:bg-stone-200 dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#d8c8b4] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
          >
            Panel
          </Button>
        </div>
      </header>

      {/* Banner thông báo quyền thiết bị */}
      {permissionError && (
        <div className="relative z-30 mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/80 px-4 py-2.5 text-xs text-rose-200 backdrop-blur sm:mx-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{permissionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPermissionError("")}
            className="rounded p-0.5 text-rose-400 transition hover:text-rose-200"
            aria-label="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Vùng video chính */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col p-3 pb-20 sm:p-4 sm:pb-24">
          {room?.category === "chess" || room?.type === "chess" ? (
            <ChessStage
              room={room}
              members={members}
              currentUser={currentUser}
              socket={socketRef.current}
              speakingId={speakingId}
              isHost={isHost}
              onAddToast={addToast}
            />
          ) : (
            <LiveKitVideoStage
              members={members}
              speakingId={speakingId}
              onScreenShareStateChange={setScreenSharing}
            />
          )}
        </div>
      </main>

      {/* Thanh công cụ nổi LiveKit */}
      <LiveKitDockBridge
        panelOpen={panelOpen}
        onTogglePanel={() => {
          if (panelOpen && panelTab === "ai") {
            setPanelTab("chat");
          } else {
            setPanelOpen((v) => !v);
          }
        }}
        onToggleAITutor={handleToggleAITutor}
        isAITutorOpen={panelOpen && panelTab === "ai"}
        whiteboardOpen={whiteboardOpen}
        onToggleWhiteboard={() => setWhiteboardOpen((v) => !v)}
        onLeave={handleLeave}
        screenSharing={screenSharing}
        onToggleScreenState={setScreenSharing}
        onPermissionError={handlePermissionError}
        transcriptionOn={transcriptionOn}
        onToggleTranscription={handleToggleTranscription}
        isPro={isPro}
        onUpgradeClick={() => setIsPricingOpen(true)}
        isHandRaised={isHandRaised}
        onToggleHand={handleToggleHand}
        onSendReaction={handleSendReaction}
        isHost={isHost}
        participantsCount={members.length}
      />

      {/* Bảng vẽ chung (Whiteboard Overlay Modal) */}
      <Whiteboard
        open={whiteboardOpen}
        onClose={() => setWhiteboardOpen(false)}
        roomCode={roomCode}
        socket={socketRef.current}
      />

      {/* Panel bên */}
      <RoomSidePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        initialTab={panelTab}
        members={members}
        messages={messages}
        onSendMessage={handleSendMessage}
        onRecallMessage={handleRecallMessage}
        roomFiles={roomFiles}
        roomCode={roomCode}
        onKickMember={handleKickMember}
        onBanMember={handleBanMember}
        currentUserId={currentUserId}
        roomName={displayTitle}
        hostId={String(room?.hostId?._id || room?.hostId || "")}
        focusMinutes={focusMinutes}
        onFocusMinutesChange={handleFocusMinutesChange}
        pomodoroMinutes={Math.floor(pomodoro.remaining / 60)}
        pomodoroSeconds={pomodoro.remaining % 60}
        pomodoroRunning={pomodoro.isRunning}
        onTogglePomodoro={handleTogglePomodoro}
        onResetPomodoro={handleResetPomodoro}
        pomodoroProgress={pomodoroProgress}
        isPro={isPro}
        onUpgradeClick={() => setIsPricingOpen(true)}
        pendingMembers={pendingMembers}
        onApproveJoinRequest={handleApproveJoin}
        onRejectJoinRequest={handleRejectJoin}
        onApproveAllJoinRequests={handleApproveAllJoin}
        onForceMuteUser={handleForceMuteUser}
        onForceMuteAll={handleForceMuteAll}
        onTransferHost={handleTransferHost}
        pinnedItem={pinnedItem}
        onPinItem={handlePinItem}
        onUnpinItem={handleUnpinItem}
        onCreatePoll={handleCreatePoll}
        onVotePoll={handleVotePoll}
        onLockPoll={handleLockPoll}
        onRecallPoll={handleRecallPoll}
        onAddOptionPoll={handleAddOptionPoll}
        onAddToast={addToast}
      />

      {/* Hiệu ứng thả cảm xúc bay lượn trên màn hình (Floating Emoji Reactions) */}
      <FloatingReactions reactions={reactions} />

      {/* Toast thông báo góc dưới trái */}
      <RoomToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Live Transcription Overlay — hiển thị khi Pro bật hoặc bảo toàn khi phiên học vừa kết thúc */}
      <TranscriptionOverlay
        isActive={isPro && transcriptionOn}
        roomCode={roomCode}
        userName={currentUser?.name || "Bạn"}
        userId={currentUserId}
        socket={socketRef.current}
        isSessionEnded={isSessionEnded}
        onClose={handleCloseTranscription}
      />

      {/* Banner thông báo kết thúc phiên họp khi người dùng đang giữ bảng chép lời */}
      {isSessionEnded && transcriptionOn && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-amber-500/40 bg-zinc-950/92 px-4 py-2 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
          <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-zinc-200">
            Phiên học đã kết thúc. Bản chép lời của bạn đã được bảo toàn ở góc phải.
          </span>
          <button
            onClick={() => router.push("/dashboard?book=rooms")}
            className="rounded-full bg-amber-500 hover:bg-amber-400 px-3 py-1 text-xs font-semibold text-zinc-950 transition"
          >
            Về sảnh chính
          </button>
        </div>
      )}

      {/* Pricing Modal cho nâng cấp Pro */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        user={currentUser}
      />

      {/* Bộ sưu tập Danh hiệu & Quân hàm Modal */}
      <TitlesModal
        isOpen={isTitlesModalOpen}
        onClose={() => setIsTitlesModalOpen(false)}
        onEquippedChange={(newTitle) => {
          setMembers((prev) =>
            prev.map((m) =>
              m.isYou ? { ...m, equippedTitle: newTitle } : m
            )
          );
        }}
      />

      {/* Modal hiển thị mã QR mời vào phòng học */}
      <RoomQRCodeModal
        open={isQRModalOpen}
        onOpenChange={setIsQRModalOpen}
        roomCode={displayCode}
        roomTitle={displayTitle}
        accessType={room?.accessType || "OPEN"}
      />
    </LiveKitRoom>
  );
}

