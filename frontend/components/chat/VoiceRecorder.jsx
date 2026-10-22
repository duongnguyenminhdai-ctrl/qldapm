"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, Trash2, Send, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * VoiceRecorder Component
 * Ghi âm tin nhắn thoại bằng MediaRecorder API với bộ đếm thời gian,
 * hiệu ứng sóng âm nhấp nháy, nút Hủy (đỏ) và nút Gửi (amber).
 * Phong cách Dark Academia mạ viền vàng mờ.
 */
export default function VoiceRecorder({ onSend, onCancel, className }) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [permissionError, setPermissionError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const streamRef = useRef(null);
  const startTimeRef = useRef(0);

  // Bắt đầu ghi âm
  const startRecording = useCallback(async () => {
    try {
      setPermissionError(null);
      audioChunksRef.current = [];

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ ghi âm trực tiếp.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Xác định MIME type tối ưu được hỗ trợ
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        } else {
          mimeType = ""; // Browser default
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100); // 100ms chunks for smooth recording
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("[VoiceRecorder] Lỗi truy cập Microphone:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionError("Quyền truy cập Micro bị từ chối. Vui lòng cho phép quyền trong trình duyệt.");
      } else {
        setPermissionError(err.message || "Không thể khởi động ghi âm.");
      }
      setIsRecording(false);
    }
  }, []);

  // Cleanup tracks
  const stopStream = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    startRecording();
    return () => {
      stopStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) {}
      }
    };
  }, [startRecording, stopStream]);

  // Hủy ghi âm
  const handleCancel = () => {
    stopStream();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    if (onCancel) onCancel();
  };

  // Hoàn tất và gửi file
  const handleFinishAndSend = async () => {
    if (!mediaRecorderRef.current || isUploading) return;
    setIsUploading(true);

    const recorder = mediaRecorderRef.current;
    const finalDuration = Math.max(1, seconds);

    recorder.onstop = async () => {
      stopStream();
      try {
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size === 0) {
          handleCancel();
          return;
        }

        const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
        const audioFile = new File([audioBlob], `voice_${Date.now()}.${ext}`, {
          type: mimeType,
        });

        if (onSend) {
          await onSend({
            file: audioFile,
            blob: audioBlob,
            duration: finalDuration,
            mimeType,
          });
        }
      } catch (err) {
        console.error("[VoiceRecorder] Lỗi gửi tin nhắn thoại:", err);
      } finally {
        setIsUploading(false);
        setIsRecording(false);
      }
    };

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  // Format giây thành 00:00
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (permissionError) {
    return (
      <div className={cn("flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs", className)}>
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span className="truncate">{permissionError}</span>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-white font-medium text-xs cursor-pointer shrink-0"
        >
          Đóng
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 w-full px-3 py-1.5 rounded-xl border border-amber-500/30 bg-[#1f1a16] shadow-inner animate-in fade-in duration-200",
        className
      )}
    >
      {/* Cụm đếm giờ và icon ghi âm nhấp nháy */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping absolute" />
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 relative" />
        </div>
        <span className="font-mono text-xs font-semibold text-amber-300 tracking-wider">
          {formatTime(seconds)}
        </span>

        {/* Thanh sóng âm nhấp nháy động */}
        <div className="flex items-center gap-0.5 ml-1 h-4">
          <span className="w-0.5 h-2 bg-amber-400/80 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
          <span className="w-0.5 h-3.5 bg-amber-400 rounded-full animate-[pulse_0.4s_ease-in-out_infinite_0.1s]" />
          <span className="w-0.5 h-2 bg-amber-400/80 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.2s]" />
          <span className="w-0.5 h-4 bg-amber-300 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.15s]" />
          <span className="w-0.5 h-1.5 bg-amber-400/70 rounded-full animate-[pulse_0.8s_ease-in-out_infinite_0.3s]" />
          <span className="w-0.5 h-3 bg-amber-400 rounded-full animate-[pulse_0.45s_ease-in-out_infinite_0.05s]" />
        </div>
      </div>

      {/* Cụm nút Hủy và Gửi */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isUploading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-rose-300 bg-rose-950/50 border border-rose-500/30 hover:bg-rose-900/60 hover:text-white transition cursor-pointer disabled:opacity-50"
          title="Hủy ghi âm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Hủy</span>
        </button>

        <button
          type="button"
          onClick={handleFinishAndSend}
          disabled={isUploading || seconds === 0}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-stone-900 bg-amber-500 hover:bg-amber-400 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
          title="Gửi tin nhắn thoại"
        >
          {isUploading ? (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
              <span>Đang gửi...</span>
            </span>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Gửi</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
