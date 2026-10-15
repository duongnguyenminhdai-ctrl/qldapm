"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { roomsApi } from "@/lib/api";

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleChange = (e) => {
    // Tự động uppercase và giới hạn 6 ký tự
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(val);
    if (error) setError("");
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
    startTransition(async () => {
      try {
        const result = await roomsApi.join({ roomCode: trimmed });
        const roomCode = result?.data?.room?.roomCode;
        if (!roomCode) throw new Error("Không nhận được thông tin phòng.");
        router.push(`/room/${roomCode}`);
      } catch (err) {
        setError(err.message || "Không thể tham gia phòng. Kiểm tra lại mã phòng.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="join-room-code"
          className="text-sm font-medium text-zinc-300"
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
          className="h-11 w-full rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 font-mono text-base tracking-[0.25em] text-zinc-100 placeholder:font-mono placeholder:tracking-normal placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Nhập mã phòng 6 ký tự"
          aria-describedby={error ? "join-room-error" : undefined}
        />
        {error ? (
          <p id="join-room-error" className="text-xs text-rose-400" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-xs text-zinc-600">
            Nhập mã 6 ký tự để tham gia phòng hiện có.
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="secondary"
        className="w-full"
        disabled={isPending || code.length !== 6}
        id="btn-join-room-submit"
      >
        {isPending ? "Đang tham gia..." : "Vào phòng"}
      </Button>
    </form>
  );
}
