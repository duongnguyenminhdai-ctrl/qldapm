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
    <div className="room-shell bg-[#FAF8F5] dark:bg-[#141210] flex flex-col min-h-[100dvh]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-[#FAF8F5] dark:border-[#3a3128] dark:bg-[#181513] px-6 py-3">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-stone-200 dark:bg-[#26201c]" />
          <div className="h-3 w-20 animate-pulse rounded bg-stone-200 dark:bg-[#26201c]" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-stone-200 dark:bg-[#26201c]" />
          <div className="h-8 w-20 animate-pulse rounded-lg bg-stone-200 dark:bg-[#26201c]" />
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-[#b3894e] dark:border-[#3a3128] dark:border-t-[#c3a47b]" />
        <p className="text-sm font-medium text-[#b3894e] dark:text-[#c3a47b]">Đang kết nối vào phòng học...</p>
        <p className="text-xs text-stone-500 dark:text-[#75695e]">Đang chuẩn bị không gian học tập</p>
      </main>
    </div>
  );
}

// Màn hình lỗi
function RoomError({ message, pendingRoomCode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#FAF8F5] dark:bg-[#141210] px-6 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-[#FAF8F5] text-[#2D241E] dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#f5ede3] p-6 space-y-3 shadow-xl">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl border border-stone-300 bg-stone-100 dark:border-[#3a3128] dark:bg-[#181513]">
          <ArrowLeft className="h-5 w-5 text-[#b3894e] dark:text-[#c3a47b]" strokeWidth={1.75} />
        </div>
        <h1 className="text-base font-serif text-[#2D241E] dark:text-[#f5ede3]">
          Phòng không khả dụng
        </h1>
        <p className="text-sm text-stone-600 dark:text-[#a89b8d]">
          {message || "Phòng học không tồn tại hoặc đã kết thúc."}
        </p>
        {pendingRoomCode ? (
          <Button asChild className="w-full bg-[#c3a47b] text-[#161311] hover:bg-[#d6b88f] font-medium">
            <Link href={`/room/${pendingRoomCode}`}>Quay lại phòng của bạn ({pendingRoomCode})</Link>
          </Button>
        ) : null}
        <Button asChild variant={pendingRoomCode ? "outline" : "default"} className={`w-full ${!pendingRoomCode ? "bg-[#c3a47b] text-[#161311] hover:bg-[#d6b88f]" : "border-stone-300 dark:border-[#3a3128]"}`} id="btn-back-to-dashboard">
          <Link href="/dashboard?book=rooms">Quay lại danh sách phòng</Link>
        </Button>
      </div>
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params?.roomCode;

  const [room, setRoom] = useState(() => {
    if (typeof window !== "undefined" && roomCode) {
      try {
        const cached = window.sessionStorage.getItem(`vsr_created_room_${roomCode}`);
        if (cached) return JSON.parse(cached);
      } catch (_) {}
    }
    return null;
  });

  const [status, setStatus] = useState(() => {
    if (typeof window !== "undefined" && roomCode) {
      try {
        const cached = window.sessionStorage.getItem(`vsr_created_room_${roomCode}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          const user = getStoredUser();
          const currentUserId = user?.id || user?._id;
          const hostId = String(parsed?.hostId?._id || parsed?.hostId || "");
          if (currentUserId && hostId && String(currentUserId) === hostId) {
            return "ready";
          }
        }
      } catch (_) {}
    }
    return "loading";
  }); // loading | waiting | error | ready
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingRoomCode, setPendingRoomCode] = useState(null);

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
        if (isHost) {
          // Chủ phòng đã có sẵn trong danh sách participants từ lúc khởi tạo phòng
          // Đồng bộ join non-blocking trong nền để không gây độ trễ hiển thị phòng
          roomsApi.join({ roomCode }).catch(() => {});
          setStatus("ready");
          return;
        }

        try {
          await roomsApi.join({ roomCode });
        } catch (joinErr) {
          if (
            joinErr.status === 403 ||
            joinErr.data?.isBanned ||
            joinErr.data?.isLocked ||
            joinErr.data?.hasPendingHostRoom
          ) {
            throw joinErr;
          }
        }
        setStatus("ready");
      } catch (err) {
        if (
          err.data?.hasPendingHostRoom ||
          err.status === 403 ||
          err.data?.isBanned ||
          err.data?.isLocked
        ) {
          setStatus("error");
          setErrorMsg(err.data?.message || err.message || "Phòng học hiện đang bị khóa bởi chủ phòng.");
          if (err.data?.pendingRoomCode) {
            setPendingRoomCode(err.data.pendingRoomCode);
          }
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
    return <RoomError message={errorMsg} pendingRoomCode={pendingRoomCode} />;
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
