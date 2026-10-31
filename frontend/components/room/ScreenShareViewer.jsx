"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { VideoTrack } from "@livekit/components-react";
import {
  ScreenShare,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  PictureInPicture2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * ScreenShareViewer - Khung hiển thị màn hình chia sẻ chuẩn Google Meet
 * - Nút Toàn màn hình (Fullscreen API + phím Esc)
 * - Nút Phóng to / Thu nhỏ nội dung (Zoom 1x -> 1.5x -> 2x)
 * - Nút Cửa sổ thu nhỏ (Picture-in-Picture)
 * - Thanh công cụ capsule nổi tự động ẩn/hiện ở góc dưới bên phải
 */
export function ScreenShareViewer({
  screenShareTrack,
  sharerName = "Người dùng",
  aspectStyle,
  className,
}) {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimerRef = useRef(null);

  // Lắng nghe sự kiện thay đổi Fullscreen của trình duyệt
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(active);
      if (!active) {
        setZoomLevel(1);
        setPanPosition({ x: 0, y: 0 });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Tự động ẩn thanh điều khiển khi không di chuột
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      if (!isDragging) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Bật / tắt chế độ toàn màn hình (Fullscreen API)
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if (containerRef.current.webkitRequestFullscreen) {
          await containerRef.current.webkitRequestFullscreen();
        } else if (containerRef.current.mozRequestFullScreen) {
          await containerRef.current.mozRequestFullScreen();
        } else if (containerRef.current.msRequestFullscreen) {
          await containerRef.current.msRequestFullscreen();
        } else {
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        } else {
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.warn("[ScreenShare] Fullscreen error:", err);
      // Fallback CSS fullscreen nếu trình duyệt từ chối requestFullscreen
      setIsFullscreen((prev) => !prev);
    }
  }, [isFullscreen]);

  // Bật Picture-in-Picture cho video chia sẻ màn hình
  const togglePictureInPicture = useCallback(async () => {
    if (!containerRef.current) return;
    const videoEl = containerRef.current.querySelector("video");
    if (!videoEl) return;

    try {
      if (document.pictureInPictureElement === videoEl) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoEl.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("[ScreenShare] PiP error:", err);
    }
  }, []);

  // Chu trình Zoom: 1x -> 1.5x -> 2.0x -> 1x
  const handleToggleZoom = useCallback(() => {
    setZoomLevel((prev) => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      setPanPosition({ x: 0, y: 0 });
      return 1;
    });
  }, []);

  // Xử lý kéo thả cuộn khi phóng to (Pan when zoomed)
  const handleMouseDown = (e) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panPosition.x,
      y: e.clientY - panPosition.y,
    };
  };

  const handleDragMove = (e) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPanPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setShowControls(false)}
        className={cn(
          "group relative flex items-center justify-center overflow-hidden bg-black transition-all select-none",
          isFullscreen
            ? "fixed inset-0 z-[150] h-screen w-screen p-0 m-0 rounded-none"
            : "relative max-h-full max-w-full rounded-2xl border border-stone-300 dark:border-[#2d2620] shadow-2xl",
          className
        )}
        style={isFullscreen ? undefined : aspectStyle}
      >
        {/* Badge thông tin người đang chia sẻ góc trên trái */}
        <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-xl border border-white/10 bg-black/75 px-3 py-1.5 backdrop-blur-md shadow-lg text-xs text-white pointer-events-none">
          <ScreenShare className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-medium tracking-wide">Đang chia sẻ: {sharerName}</span>
          {zoomLevel > 1 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono border border-blue-500/30">
              {zoomLevel}x
            </span>
          )}
        </div>

        {/* Khung chứa VideoTrack có hỗ trợ Zoom & Pan */}
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleDragMove}
          onMouseUp={handleMouseUp}
          className={cn(
            "relative flex h-full w-full items-center justify-center overflow-hidden transition-transform duration-150",
            zoomLevel > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
          )}
          style={{
            transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
          }}
        >
          <VideoTrack
            trackRef={screenShareTrack}
            className="max-h-full max-w-full h-auto w-auto object-contain rounded-xl pointer-events-none"
          />
        </div>

        {/* Thanh công cụ nổi chuẩn Google Meet ở góc dưới bên phải */}
        <div
          className={cn(
            "absolute bottom-3 right-3 z-30 flex items-center gap-1.5 rounded-full bg-black/80 dark:bg-[#1e1f20]/90 backdrop-blur-md border border-white/15 p-1.5 shadow-2xl transition-all duration-200",
            showControls
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
          )}
        >
          {/* Nút Phóng to / Thu nhỏ (Zoom tool) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleToggleZoom}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-stone-200 transition-colors",
                  zoomLevel > 1
                    ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                    : "hover:bg-white/15 hover:text-white"
                )}
                aria-label={zoomLevel > 1 ? "Thu nhỏ về 100%" : "Phóng to nội dung chia sẻ"}
              >
                {zoomLevel > 1 ? (
                  <ZoomOut className="h-4 w-4" />
                ) : (
                  <ZoomIn className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-[#1e1f20] text-stone-200 border-white/10 text-xs">
              {zoomLevel > 1 ? "Thu nhỏ về 100%" : "Phóng to nội dung"}
            </TooltipContent>
          </Tooltip>

          {/* Nút Mở cửa sổ thu nhỏ (Picture-in-Picture) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={togglePictureInPicture}
                className="flex h-9 w-9 items-center justify-center rounded-full text-stone-200 hover:bg-white/15 hover:text-white transition-colors"
                aria-label="Mở trong cửa sổ thu nhỏ PiP"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-[#1e1f20] text-stone-200 border-white/10 text-xs">
              Mở trong cửa sổ thu nhỏ (PiP)
            </TooltipContent>
          </Tooltip>

          {/* Nút Toàn màn hình chuẩn Google Meet (Vào / Thoát toàn màn hình) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleFullscreen}
                id="btn-screenshare-fullscreen"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-stone-200 transition-colors",
                  isFullscreen
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "hover:bg-white/15 hover:text-white"
                )}
                aria-label={isFullscreen ? "Thoát khỏi chế độ toàn màn hình" : "Vào chế độ toàn màn hình"}
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-[#1e1f20] text-stone-200 border-white/10 text-xs">
              {isFullscreen ? "Thoát khỏi chế độ toàn màn hình (Esc)" : "Vào chế độ toàn màn hình"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
