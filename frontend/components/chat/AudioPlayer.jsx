"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Custom event to stop other playing audio messages
const AUDIO_PLAY_EVENT = "vsr:chat-audio-play";

/**
 * Format seconds into mm:ss (or m:ss)
 */
function formatTime(sec) {
  if (!sec || isNaN(sec) || !isFinite(sec)) return "0:00";
  const minutes = Math.floor(sec / 60);
  const remainingSeconds = Math.floor(sec % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/**
 * Dark Academia styled mini audio player for chat bubbles.
 */
export default function AudioPlayer({ audioUrl, duration: initialDuration, isMine = false, className }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const playerIdRef = useRef(`audio-${Math.random().toString(36).substring(2, 9)}`);

  // Listen for other audio players starting playback
  useEffect(() => {
    const handleOtherPlay = (e) => {
      if (e.detail?.id !== playerIdRef.current && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener(AUDIO_PLAY_EVENT, handleOtherPlay);
    return () => {
      window.removeEventListener(AUDIO_PLAY_EVENT, handleOtherPlay);
    };
  }, []);

  // Update duration if prop changes
  useEffect(() => {
    if (initialDuration && !duration) {
      setDuration(initialDuration);
    }
  }, [initialDuration, duration]);

  // Audio event listeners
  const onLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (d && !isNaN(d) && isFinite(d)) {
        setDuration(Math.round(d));
      }
      setIsReady(true);
      setHasError(false);
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const onError = () => {
    setHasError(true);
    setIsPlaying(false);
  };

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current || hasError) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Notify other players to stop
      window.dispatchEvent(
        new CustomEvent(AUDIO_PLAY_EVENT, { detail: { id: playerIdRef.current } })
      );

      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.warn("[AudioPlayer] Không thể phát âm thanh:", err);
            setIsPlaying(false);
          });
      }
    }
  }, [isPlaying, hasError]);

  // Handle clicking or dragging progress bar
  const handleSeek = (e) => {
    if (!audioRef.current || !duration || hasError) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Cleanup on unmount
  useEffect(() => {
    const audioEl = audioRef.current;
    return () => {
      if (audioEl) {
        audioEl.pause();
      }
    };
  }, []);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2.5 rounded-xl text-xs bg-red-950/40 border border-red-500/30 text-rose-300",
          className
        )}
      >
        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
        <span className="truncate">Không thể tải tin nhắn thoại</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 py-1.5 px-3 rounded-2xl min-w-[200px] max-w-[280px] select-none transition-all shadow-sm",
        isMine
          ? "bg-[#2d251d] border border-amber-500/25 text-[#f5ebd8]"
          : "bg-[#1c1815] border border-stone-700/50 text-[#e6ded1]",
        className
      )}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onError={onError}
        className="hidden"
      />

      {/* Play/Pause round button */}
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full shrink-0 shadow-md transition-transform active:scale-90 cursor-pointer focus:outline-none",
          isMine
            ? "bg-amber-500 text-stone-950 hover:bg-amber-400"
            : "bg-amber-600/90 text-stone-950 hover:bg-amber-500"
        )}
        title={isPlaying ? "Tạm dừng" : "Phát tin nhắn thoại"}
        aria-label={isPlaying ? "Tạm dừng" : "Phát"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform / Progress Slider */}
      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className="relative h-2 w-full bg-stone-800/80 rounded-full cursor-pointer overflow-hidden border border-amber-900/30 group"
          title="Tua âm thanh"
        >
          {/* Animated playback wave styling */}
          <div
            className={cn(
              "h-full rounded-full transition-all duration-75 relative",
              isMine ? "bg-amber-400" : "bg-amber-500"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Time info & icon */}
        <div className="flex items-center justify-between text-[10px] font-mono leading-none text-stone-400">
          <span>{isPlaying ? formatTime(currentTime) : formatTime(duration)}</span>
          <div className="flex items-center gap-1 text-[9px] opacity-75">
            <Volume2 className="w-2.5 h-2.5 text-amber-400/80" />
            <span>Thoại</span>
          </div>
        </div>
      </div>
    </div>
  );
}
