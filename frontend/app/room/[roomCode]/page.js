"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import RoomLayout from "@/components/room/RoomLayout";
import { WaitingLobby } from "@/components/room/WaitingLobby";
import { roomsApi, getStoredUser } from "@/lib/api";

// Skeleton loader theo đúng hình dạng của giao diện phòng
function RoomSkeleton() {
  return (
    <div className="room-shell">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/60 bg-zinc-950 px-6 py-3">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-800/60" />
          <div className="h-3 w-20 animate-pulse rounded bg-zinc-800/40" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-zinc-800/40" />
          <div className="h-8 w-20 animate-pulse rounded-lg bg-zinc-800/40" />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-600">Đang tải phòng học...</p>
      </main>
    </div>
  );
}

// Màn hình lỗi
function RoomError({ message }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-full max-w-sm space-y-3">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl border border-zinc-800/60 bg-zinc-900">
          <ArrowLeft className="h-5 w-5 text-zinc-500" strokeWidth={1.75} />
        </div>
        <h1 className="text-base font-semibold text-zinc-100">
          Phòng không khả dụng
        </h1>
        <p className="text-sm text-zinc-500">
          {message || "Phòng học không tồn tại hoặc đã kết thúc."}
        </p>
        <Button asChild className="w-full" id="btn-back-to-dashboard">
          <Link href="/dashboard">Quay lại Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params?.roomCode;

  const [status, setStatus] = useState("loading"); // loading | waiting | error | ready
  const [room, setRoom] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!roomCode) {
      setStatus("error");
      setErrorMsg("Mã phòng không hợp lệ.");
      return;
    }

    // Kiểm tra phiên đăng nhập
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("vsr_token")
        : null;
    const user = getStoredUser();

    if (!token || !user) {
      const callbackUrl = encodeURIComponent(`/room/${roomCode}`);
      router.replace(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    // Validate và kiểm tra quyền vào phòng
    const validateAndJoinRoom = async () => {
      try {
        const getResult = await roomsApi.getByCode(roomCode);
        const fetchedRoom = getResult?.data?.room;

        if (!fetchedRoom) {
          setStatus("error");
          setErrorMsg("Không nhận được dữ liệu phòng từ server.");
          return;
        }

        setRoom(fetchedRoom);

        const currentUserId = user?.id || user?._id;
        const hostId = String(fetchedRoom.hostId?._id || fetchedRoom.hostId || "");
        const isHost = String(currentUserId) === hostId;

        // Nếu phòng bị khóa tạm thời bởi chủ phòng và không phải Host -> Chặn truy cập
        if (fetchedRoom.isLocked && !isHost) {
          setStatus("error");
          setErrorMsg("Phòng học hiện đang bị khóa bởi chủ phòng.");
          return;
        }

        const isApproved =
          fetchedRoom.accessType === "OPEN" ||
          (fetchedRoom.approvedUsers &&
            fetchedRoom.approvedUsers.some(
              (aId) => String(aId) === String(currentUserId)
            ));

        // Nếu phòng yêu cầu xét duyệt và người dùng chưa được duyệt -> Hiện phòng chờ
        if (!isHost && !isApproved) {
          setStatus("waiting");
          return;
        }

        // Đã được duyệt hoặc là Host -> Tham gia phòng
        try {
          await roomsApi.join({ roomCode });
        } catch (joinErr) {
          if (joinErr.status === 403 || joinErr.data?.isBanned || joinErr.data?.isLocked) {
            throw joinErr;
          }
        }
        setStatus("ready");
      } catch (err) {
        if (err.status === 403 || err.data?.isBanned || err.data?.isLocked) {
          setStatus("error");
          setErrorMsg(err.data?.message || err.message || "Phòng học hiện đang bị khóa bởi chủ phòng.");
          return;
        }
        setStatus("error");
        setErrorMsg(
          err.message || "Phòng học không tồn tại hoặc đã kết thúc."
        );
      }
    };

    validateAndJoinRoom();
  }, [roomCode, router]);

  // Callback khi chủ phòng duyệt vào phòng
  const handleApproved = async () => {
    try {
      await roomsApi.join({ roomCode });
    } catch (_) {}
    setStatus("ready");
  };

  if (status === "loading") {
    return <RoomSkeleton />;
  }

  if (status === "error") {
    return <RoomError message={errorMsg} />;
  }

  if (status === "waiting") {
    return (
      <WaitingLobby
        room={room}
        roomCode={roomCode}
        user={getStoredUser()}
        onApproved={handleApproved}
      />
    );
  }

  return <RoomLayout roomCode={roomCode} initialRoom={room} />;
}
