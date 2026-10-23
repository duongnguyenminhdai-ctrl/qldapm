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
  LogOut,
  Users,
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
  // Host status
  isHost = false,
  participantsCount = 1,
}) {
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
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
    // Tự động đóng popover emoji sau khi chọn
    setReactionMenuOpen(false);
    // Chống spam: Giới hạn tần suất 0.5s giữa mỗi lần thả reaction
    setCooldown(true);
    setTimeout(() => setCooldown(false), 500);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-[40] flex justify-center pb-0 sm:pb-5",
          className
        )}
      >
        <nav
          className="pointer-events-auto relative flex items-center justify-around sm:justify-center gap-1 sm:gap-1.5 w-full sm:w-auto max-w-full overflow-visible rounded-t-2xl sm:rounded-full border-t border-x-0 sm:border border-stone-300/80 bg-[#FAF8F5]/95 dark:border-[#3a3128] dark:bg-[#1e1916]/95 backdrop-blur-md px-2.5 sm:px-3 py-2 sm:py-1.5 shadow-2xl"
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

          <span className="mx-1 hidden h-5 w-px bg-stone-300 dark:bg-[#3a3128] sm:block" aria-hidden />

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
                    ? "bg-[#c3a47b]/20 text-[#c3a47b] border border-[#c3a47b]/50 shadow-sm shadow-[#c3a47b]/20 ring-1 ring-[#c3a47b]/30"
                    : "text-[#a89b8d] hover:text-[#c3a47b] hover:bg-[#26201c]"
                )}
              >
                <Hand className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
                {isHandRaised && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c3a47b] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#c3a47b]" />
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
                      ? "dock-control-on text-[#c3a47b]"
                      : "text-[#a89b8d] hover:text-[#c3a47b] hover:bg-[#26201c]"
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
                className="absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 flex items-center gap-1 rounded-full p-1.5 shadow-2xl border border-stone-300 bg-[#FAF8F5]/95 text-[#2D241E] dark:border-[#3a3128] dark:bg-[#1e1916]/95 dark:text-[#f5ede3] backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    disabled={cooldown}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform duration-100 active:scale-90 hover:scale-125 hover:bg-stone-200/60 dark:hover:bg-white/10",
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

          <span className="mx-1 hidden h-5 w-px bg-stone-300 dark:bg-[#3a3128] sm:block" aria-hidden />

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
                ? "bg-[#b3894e]/20 text-[#2D241E] border border-[#b3894e]/50 dark:bg-[#c3a47b]/25 dark:text-[#f5ede3] dark:border-[#c3a47b]/50 shadow-[0_0_12px_rgba(195,164,123,0.3)]"
                : "hover:text-[#b3894e] dark:hover:text-[#c3a47b] hover:border-[#b3894e]/40 dark:hover:border-[#c3a47b]/40"
            )}
          >
            <Sparkles className="h-[18px] w-[18px] text-[#b3894e] dark:text-[#c3a47b]" strokeWidth={ICON_STROKE} />
            {!isPro && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-[#c3a47b] px-1 py-0.2 text-[8px] font-black uppercase tracking-wider text-[#161311] shadow-sm shadow-[#c3a47b]/50 ring-1 ring-[#e8cca4]/50">
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

          <span className="mx-1 hidden h-5 w-px bg-stone-300 dark:bg-[#3a3128] sm:block" aria-hidden />

          <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
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

            {participantsCount <= 1 ? (
              /* Khi chỉ có 1 người duy nhất trong phòng (dù là Host hay Thành viên còn lại): Ẩn 'Chỉ rời cuộc gọi', hiển thị ĐÚNG 1 lựa chọn 'Kết thúc phiên học' */
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg font-serif">
                    Kết thúc phiên học?
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-stone-500 dark:text-[#a89887]">
                    Bạn là người duy nhất trong phòng. Khi bạn rời đi, phiên học sẽ kết thúc và giải phóng tài nguyên.
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter className="mt-4 gap-2 sm:gap-0 sm:justify-end">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setLeaveDialogOpen(false)}
                    className="text-stone-600 dark:text-[#d8c8b4] text-xs sm:text-sm"
                  >
                    Ở lại phòng
                  </Button>
                  <Button
                    variant="destructive"
                    type="button"
                    onClick={() => {
                      setLeaveDialogOpen(false);
                      onLeave?.({ terminate: true, action: "terminate" });
                    }}
                    className="text-xs sm:text-sm"
                  >
                    Kết thúc phiên học
                  </Button>
                </DialogFooter>
              </DialogContent>
            ) : isHost ? (
              /* Khi phòng có > 1 người: Hiển thị 2 lựa chọn theo chuẩn Google Meet */
              <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg font-serif">
                    Rời khỏi cuộc gọi
                  </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm text-stone-500 dark:text-[#a89887]">
                      Bạn là chủ phòng. Hãy chọn cách bạn muốn rời phiên học:
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col gap-2.5 my-3">
                    {/* Lựa chọn 1: Chỉ rời cuộc gọi */}
                    <button
                      type="button"
                      onClick={() => {
                        setLeaveDialogOpen(false);
                        onLeave?.({ terminate: false, action: "leave_only" });
                      }}
                      className="w-full text-left p-3.5 rounded-xl border border-stone-200 dark:border-[#3a3128] hover:bg-stone-100 dark:hover:bg-[#26201c] transition flex items-start gap-3 group"
                    >
                      <div className="p-2 rounded-lg bg-stone-200/70 dark:bg-[#322a24] text-stone-700 dark:text-[#d8c8b4] group-hover:text-[#2D241E] dark:group-hover:text-[#f5ede3] shrink-0 mt-0.5">
                        <LogOut className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#2D241E] dark:text-[#f5ede3]">
                          Chỉ rời cuộc gọi
                        </div>
                        <div className="text-xs text-stone-500 dark:text-[#a89887] mt-0.5 leading-relaxed">
                          Chủ phòng rời đi nhưng phòng học vẫn tiếp tục. Phòng sẽ tự đóng sau 10 phút nếu bạn không quay lại.
                        </div>
                      </div>
                    </button>

                    {/* Lựa chọn 2: Kết thúc cuộc gọi cho mọi người */}
                    <button
                      type="button"
                      onClick={() => {
                        setLeaveDialogOpen(false);
                        onLeave?.({ terminate: true, action: "terminate" });
                      }}
                      className="w-full text-left p-3.5 rounded-xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/70 dark:hover:bg-rose-950/40 transition flex items-start gap-3 group"
                    >
                      <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                        <PhoneOff className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                          Kết thúc cuộc gọi cho mọi người
                        </div>
                        <div className="text-xs text-rose-500/90 dark:text-rose-300/80 mt-0.5 leading-relaxed">
                          Đóng phòng học ngay lập tức, chuyển toàn bộ học viên về trang chủ và giải phóng tài nguyên.
                        </div>
                      </div>
                    </button>
                  </div>

                  <DialogFooter className="sm:justify-end">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setLeaveDialogOpen(false)}
                      className="text-stone-600 dark:text-[#d8c8b4] text-xs sm:text-sm"
                    >
                      Ở lại phòng
                    </Button>
                  </DialogFooter>
                </DialogContent>
              ) : (
                <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg font-serif">Rời phòng học?</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Bạn sẽ rời khỏi phòng hiện tại. Có thể tham gia lại bất cứ lúc nào bằng mã phòng.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4 gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setLeaveDialogOpen(false)}
                  >
                    Ở lại
                  </Button>
                  <Button
                    variant="destructive"
                    type="button"
                    onClick={() => {
                      setLeaveDialogOpen(false);
                      onLeave?.({ terminate: false, action: "leave_only" });
                    }}
                  >
                    Rời phòng
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
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
