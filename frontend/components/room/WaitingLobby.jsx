"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Hourglass, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectSocket } from "@/lib/socket";

/**
 * WaitingLobby - Màn hình phòng chờ xét duyệt (Google Meet style)
 * Thiết kế chuẩn Taste-skill: Minimalist Dark-Tech, Glassmorphic card, Micro-animations
 */
export function WaitingLobby({ room, roomCode, user, onApproved }) {
  const router = useRouter();
  const socketRef = useRef(null);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [isRejected, setIsRejected] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState("");

  const displayTitle = room?.title || room?.name || `Phòng ${roomCode}`;
  const userId = user?.id || user?._id;
  const hasRequestedRef = useRef(false);

  // Đếm thời gian đã chờ
  useEffect(() => {
    const timer = setInterval(() => {
      setWaitingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatWaitingTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    if (!socket || !userId || !roomCode) return;

    // Xác thực danh tính trước
    socket.emit("user:authenticate", { userId });

    // Chỉ phát tín hiệu yêu cầu vào phòng chờ 1 lần duy nhất trong phiên chờ
    if (!hasRequestedRef.current) {
      hasRequestedRef.current = true;
      socket.emit("room:request-join", {
        roomCode,
        roomId: roomCode,
        user: {
          id: userId,
          _id: userId,
          name: user?.name || "Người dùng",
          email: user?.email || "",
          avatar: user?.avatar || "",
        },
      });
    }

    // Lắng nghe khi được chủ phòng duyệt
    const handleApproved = ({ roomCode: approvedCode } = {}) => {
      if (
        !approvedCode ||
        String(approvedCode).trim().toUpperCase() === String(roomCode).trim().toUpperCase()
      ) {
        if (onApproved) {
          onApproved();
        }
      }
    };

    const handleCheckApproval = ({ approvedUserId, roomCode: approvedCode }) => {
      if (
        String(approvedUserId) === String(userId) &&
        (!approvedCode || String(approvedCode).trim().toUpperCase() === String(roomCode).trim().toUpperCase())
      ) {
        if (onApproved) {
          onApproved();
        }
      }
    };

    // Lắng nghe khi bị chủ phòng từ chối
    const handleRejected = ({ message } = {}) => {
      setIsRejected(true);
      setRejectionMessage(message || "Yêu cầu tham gia phòng của bạn đã bị từ chối.");
      setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    };

    const handleCheckRejection = ({ rejectedUserId, message }) => {
      if (String(rejectedUserId) === String(userId)) {
        setIsRejected(true);
        setRejectionMessage(message || "Yêu cầu tham gia phòng của bạn đã bị từ chối.");
        setTimeout(() => {
          router.push("/dashboard");
        }, 3000);
      }
    };

    socket.on("room:join-approved", handleApproved);
    socket.on("room:check-approval", handleCheckApproval);
    socket.on("room:join-rejected", handleRejected);
    socket.on("room:check-rejection", handleCheckRejection);

    return () => {
      socket.off("room:join-approved", handleApproved);
      socket.off("room:check-approval", handleCheckApproval);
      socket.off("room:join-rejected", handleRejected);
      socket.off("room:check-rejection", handleCheckRejection);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, userId, onApproved, router]);

  const handleCancel = () => {
    const socket = socketRef.current;
    if (socket && socket.connected && roomCode && userId) {
      socket.emit("room:cancel-join-request", { roomCode, userId });
    }
    router.push("/dashboard");
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 py-12 text-zinc-100">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Main Glassmorphic Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-2xl">
        {/* Animated Icon Header */}
        <div className="mx-auto mb-6 flex flex-col items-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-500/30 bg-amber-500/10 shadow-lg shadow-amber-500/5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-3xl bg-amber-400/10 opacity-75" />
            {isRejected ? (
              <ShieldCheck className="h-10 w-10 text-rose-400" strokeWidth={1.75} />
            ) : (
              <Hourglass className="h-10 w-10 text-amber-400 animate-[spin_10s_linear_infinite]" strokeWidth={1.75} />
            )}
          </div>

          <div className="mt-4 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Phòng chờ xét duyệt</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-3 text-center">
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
            {displayTitle}
          </h1>

          <p className="font-mono text-xs text-zinc-500">Mã phòng: {roomCode}</p>

          {isRejected ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-300 animate-in fade-in">
              <p className="font-medium">{rejectionMessage}</p>
              <p className="mt-1 text-xs text-rose-400/80">
                Đang chuyển hướng về sảnh chính...
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed text-zinc-300">
                Đang chờ chủ phòng phê duyệt... Bạn sẽ tự động được đưa vào phòng ngay khi chủ phòng đồng ý.
              </p>

              {/* Waiting Timer indicator */}
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-1.5 font-mono text-xs text-zinc-400">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                <span>Thời gian chờ: {formatWaitingTimer(waitingSeconds)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-8 pt-4 border-t border-zinc-800/60">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            id="btn-cancel-waiting-room"
            className="w-full gap-2 border-zinc-700/80 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            <span>Hủy và quay lại Dashboard</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
