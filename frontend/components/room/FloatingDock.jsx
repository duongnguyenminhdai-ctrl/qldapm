"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  Timer,
  PenLine,
  MessageSquare,
  PhoneOff,
  Hand,
  Smile,
  Sparkles,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AmbientSoundWidget } from "@/components/room/AmbientSoundWidget";
import { REACTION_EMOJIS } from "@/components/room/FloatingReactions";

/**
 * Floating control dock — minimal, clear on/off, thin tooltips.
 */
export function FloatingDock({
  micOn,
  cameraOn,
  screenSharing,
  panelOpen,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
  onTogglePanel,
  whiteboardOpen,
  onToggleWhiteboard,
  onLeave,
  className,
  // AI Tutor props
  onToggleAITutor,
  isAITutorOpen = false,
  // Transcription / Pro props
  transcriptionOn = false,
  onToggleTranscription,
  isPro = false,
  onUpgradeClick,
  // Hand raise & Reactions props
  isHandRaised = false,
  onToggleHand,
  onSendReaction,
}) {
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const reactionMenuRef = useRef(null);

  // Đóng capsule menu khi bấm ra ngoài
  useEffect(() => {
    if (!reactionMenuOpen) return;
    const handleClickOutside = (e) => {
      if (reactionMenuRef.current && !reactionMenuRef.current.contains(e.target)) {
        setReactionMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [reactionMenuOpen]);

  const handleEmojiClick = (emoji) => {
    if (cooldown) return;
    if (onSendReaction) {
      onSendReaction(emoji);
    }
    // Chống spam: Giới hạn tần suất 0.5s giữa mỗi lần thả reaction
    setCooldown(true);
    setTimeout(() => setCooldown(false), 500);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-[40] flex justify-center pb-4 pt-2 sm:pb-5",
          className
        )}
      >
        <nav
          className="surface-blur pointer-events-auto flex items-center gap-0.5 rounded-2xl p-1.5"
          aria-label="Công cụ phòng học"
        >
          <DockButton
            label={micOn ? "Tắt mic" : "Bật mic"}
            pressed={!micOn}
            off={!micOn}
            onClick={onToggleMic}
          >
            {micOn ? (
              <Mic className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
            ) : (
              <MicOff className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
            )}
          </DockButton>

          <DockButton
            label={cameraOn ? "Tắt camera" : "Bật camera"}
            pressed={!cameraOn}
            off={!cameraOn}
            onClick={onToggleCamera}
          >
            {cameraOn ? (
              <Video className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
            ) : (
              <VideoOff className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
            )}
          </DockButton>

          <DockButton
            label={screenSharing ? "Dừng chia sẻ" : "Chia sẻ màn hình"}
            pressed={screenSharing}
            onClick={onToggleScreen}
          >
            <ScreenShare className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
          </DockButton>

          <span className="mx-1 hidden h-5 w-px bg-zinc-800/60 sm:block" aria-hidden />

          {/* Nút Giơ tay phát biểu (Raise Hand) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id="btn-toggle-hand"
                onClick={onToggleHand}
                aria-label={isHandRaised ? "Hạ tay" : "Giơ tay phát biểu"}
                aria-pressed={isHandRaised}
                className={cn(
                  "dock-control transition-all",
                  isHandRaised
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/30"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80"
                )}
              >
                <Hand className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
                {isHandRaised && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isHandRaised ? "Hạ tay" : "Giơ tay phát biểu"}
            </TooltipContent>
          </Tooltip>

          {/* Nút Thả cảm xúc & Thanh Capsule Menu */}
          <div className="relative" ref={reactionMenuRef}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  id="btn-reaction-menu"
                  onClick={() => setReactionMenuOpen((v) => !v)}
                  aria-label="Thả cảm xúc"
                  aria-expanded={reactionMenuOpen}
                  className={cn(
                    "dock-control transition-all",
                    reactionMenuOpen
                      ? "dock-control-on text-amber-300"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80"
                  )}
                >
                  <Smile className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Thả cảm xúc</TooltipContent>
            </Tooltip>

            {/* Menu Capsule cảm xúc nhanh dạng nổi */}
            {reactionMenuOpen && (
              <div
                role="menu"
                aria-label="Chọn cảm xúc"
                className="surface-blur absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 flex items-center gap-1 rounded-full p-1.5 shadow-2xl border border-zinc-800/80 bg-zinc-950/90 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    disabled={cooldown}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform duration-100 active:scale-90 hover:scale-125 hover:bg-white/10",
                      cooldown && "opacity-50 cursor-not-allowed"
                    )}
                    title={`Thả ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="mx-1 hidden h-5 w-px bg-zinc-800/60 sm:block" aria-hidden />

          <DockButton
            label={panelOpen ? "Đóng panel" : "Chat và Pomodoro"}
            pressed={panelOpen}
            onClick={onTogglePanel}
          >
            <MessageSquare className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
          </DockButton>

          {/* Nút Trợ lý học tập AI Tutor (VIP) */}
          <DockButton
            label={isPro ? "Study AI Tutor" : "Study AI Tutor (VIP)"}
            id="btn-dock-ai-tutor"
            pressed={isAITutorOpen}
            onClick={onToggleAITutor}
            className={cn(
              "relative transition-all duration-200",
              isAITutorOpen
                ? "bg-violet-600/30 text-violet-300 border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                : "hover:text-violet-300 hover:border-violet-500/40"
            )}
          >
            <Sparkles className="h-[18px] w-[18px] text-violet-400" strokeWidth={ICON_STROKE} />
            {!isPro && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-1 py-0.2 text-[8px] font-black uppercase tracking-wider text-zinc-950 shadow-sm shadow-amber-500/50 ring-1 ring-amber-400/50">
                VIP
              </span>
            )}
          </DockButton>

          <DockButton label="Pomodoro" onClick={onTogglePanel}>
            <Timer className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
          </DockButton>

          <DockButton
            label={whiteboardOpen ? "Đóng bảng vẽ" : "Bảng vẽ"}
            pressed={whiteboardOpen}
            onClick={onToggleWhiteboard}
          >
            <PenLine className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
          </DockButton>

          {/* Nút Chép lời — chỉ dành cho VIP */}
          <TranscriptionButton
            isPro={isPro}
            transcriptionOn={transcriptionOn}
            onToggle={onToggleTranscription}
            onUpgradeClick={onUpgradeClick}
          />

          {/* Widget Không gian âm thanh tập trung (Ambient Sounds) */}
          <AmbientSoundWidget />

          <span className="mx-1 hidden h-5 w-px bg-zinc-800/60 sm:block" aria-hidden />

          <Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="dock-control dock-control-danger"
                    aria-label="Rời phòng"
                  >
                    <PhoneOff className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
                  </button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">Rời phòng</TooltipContent>
            </Tooltip>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rời phòng học?</DialogTitle>
                <DialogDescription>
                  Bạn sẽ rời khỏi phòng hiện tại. Có thể tham gia lại bằng mã mời.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    Ở lại
                  </Button>
                </DialogClose>
                <Button variant="destructive" type="button" onClick={onLeave}>
                  Rời phòng
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </nav>
      </div>
    </TooltipProvider>
  );
}

/** Icon chép lời dạng inline SVG (Captions) */
function CaptionsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="14" x="3" y="5" rx="2" ry="2" />
      <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
    </svg>
  );
}

/** Nút Chép lời với Pro gating */
function TranscriptionButton({ isPro, transcriptionOn, onToggle, onUpgradeClick }) {
  if (!isPro) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onUpgradeClick}
            aria-label="Chép lời — Chỉ dành cho VIP"
            className="dock-control relative opacity-50 hover:opacity-80"
            id="btn-transcription-locked"
          >
            <CaptionsIcon />
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] leading-none">
              ✦
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[140px] text-center text-xs leading-snug">
          Chép lời cuộc họp<br />
          <span className="text-amber-400 font-medium">Chỉ dành cho VIP</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DockButton
      label={transcriptionOn ? "Tắt chép lời" : "Bật chép lời"}
      pressed={transcriptionOn}
      onClick={onToggle}
    >
      <CaptionsIcon />
    </DockButton>
  );
}

function DockButton({ children, label, onClick, pressed = false, off = false, className, id }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          id={id}
          onClick={onClick}
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            "dock-control",
            pressed && !off && "dock-control-on",
            off && "dock-control-off",
            className
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
