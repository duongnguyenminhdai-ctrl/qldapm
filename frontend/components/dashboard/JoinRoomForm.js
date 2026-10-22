"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { roomsApi } from "@/lib/api";

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pendingCode, setPendingCode] = useState(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e) => {
    // Tự động uppercase và giới hạn 6 ký tự
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(val);
    if (error) {
      setError("");
      setPendingCode(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = code.trim();

    if (!trimmed) {
      setError("Vui lòng nhập mã phòng.");
      return;
    }
    if (trimmed.length !== 6) {
      setError("Mã phòng phải có đúng 6 ký tự.");
      return;
    }

    setError("");
    setPendingCode(null);
    startTransition(async () => {
      try {
        const result = await roomsApi.join({ roomCode: trimmed });
        const roomCode = result?.data?.room?.roomCode;
        if (!roomCode) throw new Error("Không nhận được thông tin phòng.");
        router.push(`/room/${roomCode}`);
      } catch (err) {
        setError(err.data?.message || err.message || "Không thể tham gia phòng. Kiểm tra lại mã phòng.");
        if (err.data?.pendingRoomCode) {
          setPendingCode(err.data.pendingRoomCode);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="join-room-code"
          className="text-sm font-medium text-[#615247] dark:text-[#d8c8b4]"
        >
          Mã phòng
        </label>
        <input
          id="join-room-code"
          name="code"
          type="text"
          inputMode="text"
          value={code}
          onChange={handleChange}
          placeholder="ABCD12"
          maxLength={6}
          autoComplete="off"
          spellCheck={false}
          disabled={isPending}
          className="h-11 w-full rounded-lg border border-stone-200 bg-[#ECE5DA]/70 px-3 font-mono text-base tracking-[0.25em] text-[#2D241E] placeholder:font-mono placeholder:tracking-normal placeholder:text-[#8C7E72] focus:outline-none focus:ring-1 focus:ring-[#b3894e] dark:border-[#3a3128] dark:bg-[#141210] dark:text-[#f5ede3] dark:placeholder:text-[#75695e] dark:focus:ring-[#c3a47b] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Nhập mã phòng 6 ký tự"
          aria-describedby={error ? "join-room-error" : undefined}
        />
        {error ? (
          <div className="space-y-1">
            <p id="join-room-error" className="text-xs text-rose-500 dark:text-rose-400" role="alert">
              {error}
            </p>
            {pendingCode && (
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto text-xs text-amber-600 dark:text-amber-400 underline font-medium"
                onClick={() => router.push(`/room/${pendingCode}`)}
              >
                Bấm vào đây để quay lại phòng {pendingCode}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#8C7E72] dark:text-[#75695e]">
            Nhập mã 6 ký tự để tham gia phòng hiện có.
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="outline"
        className="w-full border-stone-200 bg-[#ECE5DA] text-[#2D241E] hover:bg-[#DCD4C4] hover:text-[#1c1815] hover:border-[#b3894e]/50 dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#d8c8b4] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3] dark:hover:border-[#c3a47b]/50"
        disabled={isPending || code.length !== 6}
        id="btn-join-room-submit"
      >
        {isPending ? "Đang tham gia..." : "Vào phòng"}
      </Button>
    </form>
  );
}
