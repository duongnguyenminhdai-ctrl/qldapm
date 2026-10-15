"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  MessageSquare,
  UserX,
  Ban,
  Paperclip,
  UploadCloud,
  FolderOpen,
  FileText,
  Search,
  X,
  Hand,
  Sparkles,
  RotateCcw,
  Check,
  CheckCheck,
  ShieldCheck,
  UserCheck,
  MicOff,
  Pin,
  PinOff,
  BarChart2,
  CornerUpLeft,
  Crown,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StudyAITutorPanel } from "@/components/room/StudyAITutorPanel";
import { ICON_STROKE } from "@/lib/constants";
import { uploadApi } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import VipBadge from "@/components/payment/VipBadge";
import UserTitleBadge from "@/components/titles/UserTitleBadge";
import { FileItemCard } from "@/components/files/FileItemCard";
import { FileUploadBar } from "@/components/files/FileUploadBar";
import { ImageLightboxModal } from "@/components/files/ImageLightboxModal";
import { PaginationControl } from "@/components/ui/PaginationControl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PomodoroWidget } from "@/components/room/PomodoroWidget";
import { FocusStatusBadge } from "@/components/room/FocusStatusWidget";
import { CreatePollModal, PollMessageCard } from "@/components/room/PollComponents";

function initialsFrom(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Right sheet: Chat thời gian thực (hỗ trợ tệp đính kèm, trích dẫn trả lời, ghim tin nhắn, bình chọn),
 * Tab Tài liệu phòng học, thành viên và Pomodoro đồng bộ.
 */
export function RoomSidePanel({
  open,
  onOpenChange,
  members = [],
  messages = [],
  roomFiles = [],
  roomCode,
  onSendMessage,
  onRecallMessage,
  onKickMember,
  onBanMember,
  onForceMuteUser,
  onForceMuteAll,
  onTransferHost,
  pinnedItem = null,
  onPinItem,
  onUnpinItem,
  onCreatePoll,
  onVotePoll,
  currentUserId,
  roomName,
  hostId = "",
  focusMinutes = [25],
  onFocusMinutesChange,
  pomodoroMinutes = 25,
  pomodoroSeconds = 0,
  pomodoroRunning = false,
  onTogglePomodoro,
  onResetPomodoro,
  pomodoroProgress = 0,
  initialTab = "chat",
  isPro = false,
  onUpgradeClick,
  pendingMembers = [],
  onApproveJoinRequest,
  onRejectJoinRequest,
  onApproveAllJoinRequests,
}) {
  const [tab, setTab] = useState(initialTab || "chat");

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const [draft, setDraft] = useState("");
  const [actionModal, setActionModal] = useState(null); // { type: 'kick' | 'ban', member }
  const [recallTargetMsg, setRecallTargetMsg] = useState(null); // Tin nhắn được chọn để thu hồi
  const [replyingTo, setReplyingTo] = useState(null); // { messageId, senderName, contentPreview }
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [transferHostTarget, setTransferHostTarget] = useState(null);
  const messagesEndRef = useRef(null);

  // File upload state for chat
  const [chatFileUploading, setChatFileUploading] = useState(null); // { name, size, progress, error, uploading }
  const [chatStagedFile, setChatStagedFile] = useState(null); // { fileUrl, fileName, fileType, fileSize }
  const chatFileInputRef = useRef(null);

  // File upload state for Resources tab
  const [directFileUploading, setDirectFileUploading] = useState(null);
  const resourceFileInputRef = useRef(null);

  // Lightbox modal preview image
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // State cho tìm kiếm, lọc loại tệp, sắp xếp và phân trang của Tab Tài liệu
  const [fileSearch, setFileSearch] = useState("");
  const [debouncedFileSearch, setDebouncedFileSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [fileSort, setFileSort] = useState("latest");
  const [filePage, setFilePage] = useState(1);
  const [filesList, setFilesList] = useState(roomFiles || []);
  const [filesPagination, setFilesPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: roomFiles?.length || 0,
    limit: 6,
  });
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Debounce tìm kiếm tệp 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFileSearch(fileSearch.trim());
      setFilePage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [fileSearch]);

  const fetchRoomFilesData = useCallback(async () => {
    if (!roomCode) return;
    setLoadingFiles(true);
    try {
      const res = await uploadApi.getRoomFiles(roomCode, {
        page: filePage,
        limit: 6,
        search: debouncedFileSearch,
        fileType: fileTypeFilter,
        sort: fileSort,
      });
      const filesArr = Array.isArray(res?.data)
        ? res.data
        : (res?.data?.files || res?.files || []);
      const pageMeta = res?.data?.pagination || res?.pagination;
      setFilesList(filesArr);
      if (pageMeta) {
        setFilesPagination(pageMeta);
      }
    } catch (err) {
      console.warn("Error fetching room files:", err);
    } finally {
      setLoadingFiles(false);
    }
  }, [roomCode, filePage, debouncedFileSearch, fileTypeFilter, fileSort]);

  useEffect(() => {
    if (tab === "files") {
      fetchRoomFilesData();
    }
  }, [tab, fetchRoomFilesData]);

  // Đồng bộ tức thì khi có tài liệu thêm mới hoặc bị xóa/thu hồi từ socket ngoài
  useEffect(() => {
    if (roomFiles) {
      setFilesList((prev) => {
        // Luôn loại bỏ các tệp không còn tồn tại trong roomFiles
        const valid = prev.filter((f) =>
          roomFiles.some((rf) => rf.fileUrl === f.fileUrl)
        );
        return valid;
      });

      if (
        tab === "files" &&
        !debouncedFileSearch &&
        fileTypeFilter === "all" &&
        fileSort === "latest" &&
        filePage === 1
      ) {
        setFilesList(roomFiles);
        setFilesPagination((prev) => ({
          ...prev,
          totalItems: roomFiles.length,
          totalPages: Math.max(1, Math.ceil(roomFiles.length / prev.limit)),
        }));
      }
    }
  }, [roomFiles, tab, debouncedFileSearch, fileTypeFilter, fileSort, filePage]);

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, tab]);

  // Xử lý chọn tệp trong tab Chat
  const handleChatFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";

    if (file.size > 15 * 1024 * 1024) {
      setChatFileUploading({
        name: file.name,
        size: file.size,
        progress: 0,
        uploading: false,
        error: "Dung lượng tệp vượt quá 15MB tối đa.",
      });
      return;
    }

    setChatFileUploading({
      name: file.name,
      size: file.size,
      progress: 0,
      uploading: true,
      error: null,
    });

    try {
      const res = await uploadApi.uploadFile(file, (pct) => {
        setChatFileUploading((prev) => (prev ? { ...prev, progress: pct } : null));
      });
      const fileData = res?.fileUrl ? res : (res?.data?.fileUrl ? res.data : null);
      if (fileData?.fileUrl) {
        setChatStagedFile(fileData);
        setChatFileUploading((prev) =>
          prev ? { ...prev, progress: 100, uploading: false } : null
        );
      } else {
        throw new Error(res?.message || res?.data?.message || "Tải lên tệp thất bại");
      }
    } catch (err) {
      setChatFileUploading((prev) =>
        prev
          ? {
              ...prev,
              uploading: false,
              error: err?.response?.data?.message || err?.message || "Lỗi tải lên tệp",
            }
          : null
      );
    }
  };

  // Xử lý gửi tin nhắn (kèm tệp nếu có)
  const handleSend = (event) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed && !chatStagedFile) return;
    if (chatFileUploading?.uploading) return;

    if (onSendMessage) {
      onSendMessage(trimmed, chatStagedFile, replyingTo);
    }
    setDraft("");
    setChatStagedFile(null);
    setChatFileUploading(null);
    setReplyingTo(null);
  };

  // Xử lý tải lên trực tiếp trong tab Tài liệu
  const handleDirectFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (resourceFileInputRef.current) resourceFileInputRef.current.value = "";

    if (file.size > 15 * 1024 * 1024) {
      setDirectFileUploading({
        name: file.name,
        size: file.size,
        progress: 0,
        uploading: false,
        error: "Dung lượng tệp vượt quá 15MB tối đa.",
      });
      return;
    }

    setDirectFileUploading({
      name: file.name,
      size: file.size,
      progress: 0,
      uploading: true,
      error: null,
    });

    try {
      const res = await uploadApi.uploadFile(file, (pct) => {
        setDirectFileUploading((prev) => (prev ? { ...prev, progress: pct } : null));
      });
      const fileData = res?.fileUrl ? res : (res?.data?.fileUrl ? res.data : null);
      if (fileData?.fileUrl) {
        setDirectFileUploading(null);
        // Phát sự kiện chia sẻ tệp vào phòng qua onSendMessage
        if (onSendMessage) {
          onSendMessage("", fileData);
        }
      } else {
        throw new Error(res?.message || res?.data?.message || "Tải lên tệp thất bại");
      }
    } catch (err) {
      setDirectFileUploading((prev) =>
        prev
          ? {
              ...prev,
              uploading: false,
              error: err?.response?.data?.message || err?.message || "Lỗi tải lên tệp",
            }
          : null
      );
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-zinc-800/60 p-0 sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <SheetHeader className="border-b border-zinc-800/60 pb-4">
            <SheetTitle>Không gian phòng</SheetTitle>
            <SheetDescription>{roomName || "Virtual Study Room"}</SheetDescription>
          </SheetHeader>

          {/* Đồng hồ Pomodoro đồng bộ */}
          <div className="space-y-3 border-b border-zinc-800/60 px-5 py-4">
            <PomodoroWidget
              minutes={pomodoroMinutes}
              seconds={pomodoroSeconds}
              progress={pomodoroProgress}
              label="Tập trung"
              running={pomodoroRunning}
              onToggle={onTogglePomodoro}
              onReset={onResetPomodoro}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="type-meta">Thời lượng phiên</span>
                <span className="font-mono text-xs tabular-nums text-zinc-300">
                  {focusMinutes?.[0] ?? 25} phút
                </span>
              </div>
              <Slider
                value={focusMinutes}
                onValueChange={onFocusMinutesChange}
                min={5}
                max={60}
                step={5}
                disabled={pomodoroRunning}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-zinc-800/60 px-4 py-2">
            <TabButton
              active={tab === "chat"}
              onClick={() => setTab("chat")}
              id="panel-tab-chat"
            >
              Chat
              {messages.length > 0 && (
                <Badge variant="muted" className="ml-1.5 font-mono text-[10px]">
                  {messages.filter((m) => !m.system).length}
                </Badge>
              )}
            </TabButton>
            <TabButton
              active={tab === "ai"}
              onClick={() => setTab("ai")}
              id="panel-tab-ai"
              className={cn(
                "flex items-center gap-1",
                tab === "ai"
                  ? "border-b-2 border-violet-500 text-violet-300 font-semibold"
                  : "text-zinc-400 hover:text-violet-300"
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span>AI Tutor</span>
              {!isPro && (
                <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/30 leading-none">
                  VIP
                </span>
              )}
            </TabButton>
            <TabButton
              active={tab === "files"}
              onClick={() => setTab("files")}
              id="panel-tab-files"
            >
              Tài liệu
              {roomFiles.length > 0 && (
                <Badge variant="muted" className="ml-1.5 font-mono text-[10px]">
                  {roomFiles.length}
                </Badge>
              )}
            </TabButton>
            <TabButton
              active={tab === "members"}
              onClick={() => setTab("members")}
              id="panel-tab-members"
            >
              Thành viên
              <Badge variant="muted" className="ml-1.5 font-mono text-[10px]">
                {members.length}
              </Badge>
            </TabButton>
            {Boolean(hostId && currentUserId && String(hostId) === String(currentUserId)) && (
              <TabButton
                active={tab === "approval"}
                onClick={() => setTab("approval")}
                id="panel-tab-approval"
                className={cn(
                  "relative flex items-center gap-1",
                  tab === "approval" ? "text-amber-400 font-semibold" : ""
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                <span>Duyệt</span>
                {pendingMembers.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[9px] font-bold text-white shadow-sm shadow-rose-500/50 animate-pulse">
                    {pendingMembers.length}
                  </span>
                )}
              </TabButton>
            )}
          </div>

          {/* Nội dung tab thành viên */}
          {tab === "members" ? (
            (() => {
              const sortedMembers = [...members].sort((a, b) => {
                const aRaised = Boolean(a.isHandRaised);
                const bRaised = Boolean(b.isHandRaised);
                if (bRaised !== aRaised) return bRaised ? 1 : -1;
                const aHost = a.isHost || (hostId && String(a.id) === String(hostId));
                const bHost = b.isHost || (hostId && String(b.id) === String(hostId));
                if (Boolean(bHost) !== Boolean(aHost)) return bHost ? 1 : -1;
                if (Boolean(b.isYou) !== Boolean(a.isYou)) return b.isYou ? 1 : -1;
                return (a.name || "").localeCompare(b.name || "");
              });

              const isCurrentUserHost = Boolean(
                currentUserId && hostId && String(currentUserId) === String(hostId)
              );

              return (
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Thanh điều phối đầu danh sách cho Chủ phòng */}
                  {isCurrentUserHost && (
                    <div className="border-b border-zinc-800/60 bg-zinc-950/40 px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onForceMuteAll}
                        id="btn-mute-all-participants"
                        className="w-full h-8 gap-2 border-zinc-800 bg-zinc-900/80 text-xs font-medium text-zinc-300 hover:text-rose-300 hover:border-rose-500/40 hover:bg-rose-950/20 transition"
                        title="Tắt mic toàn bộ thành viên trong phòng (ngoại trừ bạn)"
                      >
                        <MicOff className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Tắt mic tất cả thành viên</span>
                      </Button>
                    </div>
                  )}

                  <ul className="scrollbar-quiet flex-1 space-y-1 overflow-y-auto px-3 py-3">
                    {sortedMembers.length === 0 ? (
                      <li className="py-6 text-center text-sm text-zinc-600">
                        Chưa có thành viên nào.
                      </li>
                    ) : (
                      sortedMembers.map((member) => {
                        const isHost =
                          member.isHost || (hostId && String(member.id) === String(hostId));
                        const canModerate = isCurrentUserHost && !member.isYou && !isHost;
                        const isHandRaised = Boolean(member.isHandRaised);

                        return (
                          <li
                            key={member.id}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-2 py-2 transition",
                              isHandRaised
                                ? "bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15"
                                : "hover:bg-zinc-900/80"
                            )}
                          >
                            <Avatar className={cn("h-8 w-8 shrink-0", isHandRaised && "ring-1 ring-amber-400/60")}>
                              <AvatarImage src={member.avatar} alt="" />
                              <AvatarFallback className="bg-zinc-800 text-xs text-zinc-300">
                                {initialsFrom(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-sm font-medium text-zinc-100">
                                  {member.name}
                                </span>
                                {member.isYou ? (
                                  <span className="text-xs font-normal text-zinc-500">
                                    (Bạn)
                                  </span>
                                ) : null}
                                {member.isPro && (
                                  <VipBadge size="sm" showLabel={false} />
                                )}
                                <UserTitleBadge
                                  title={member.equippedTitle || "Nhập môn học giả"}
                                  size="xs"
                                />
                                {member.focusStatus && (
                                  <FocusStatusBadge
                                    status={member.focusStatus}
                                    className="py-0 px-1.5 text-[10px]"
                                  />
                                )}
                              </div>
                              <p className="type-meta">
                                {member.micOn ? "Mic bật" : "Mic tắt"}
                              </p>
                            </div>

                            {isHandRaised && (
                              <Badge
                                variant="outline"
                                className="shrink-0 border-amber-500/60 bg-amber-500/20 text-amber-300 gap-1 text-[11px] font-medium py-0.5 px-2"
                              >
                                <Hand className="h-3 w-3 text-amber-400 animate-pulse" strokeWidth={2.2} />
                                Giơ tay
                              </Badge>
                            )}

                            {isHost && (
                              <Badge
                                variant="outline"
                                className="shrink-0 border-zinc-700 text-zinc-400"
                              >
                                Chủ phòng
                              </Badge>
                            )}

                            {canModerate && (
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Tắt mic thành viên từ xa */}
                                <button
                                  type="button"
                                  onClick={() => onForceMuteUser && onForceMuteUser(member.id)}
                                  title="Tắt mic thành viên này"
                                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 transition"
                                >
                                  <MicOff className="h-4 w-4" strokeWidth={1.75} />
                                </button>

                                {/* Menu quản trị 3 chấm: Chỉ định Chủ phòng, Kick, Ban */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      title="Tùy chọn quản trị"
                                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
                                    >
                                      <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52 bg-zinc-900 border-zinc-800 p-1 shadow-xl">
                                    <DropdownMenuItem
                                      onClick={() => setTransferHostTarget(member)}
                                      className="gap-2 text-xs text-amber-300 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-amber-200"
                                    >
                                      <Crown className="h-3.5 w-3.5 text-amber-400" />
                                      <span>Chỉ định làm Chủ phòng</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setActionModal({ type: "kick", member })}
                                      className="gap-2 text-xs text-zinc-300 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-zinc-100"
                                    >
                                      <UserX className="h-3.5 w-3.5 text-zinc-400" />
                                      <span>Mời ra khỏi phòng</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setActionModal({ type: "ban", member })}
                                      className="gap-2 text-xs text-rose-400 cursor-pointer hover:bg-rose-950/40 focus:bg-rose-950/40 focus:text-rose-300"
                                    >
                                      <Ban className="h-3.5 w-3.5 text-rose-400" />
                                      <span>Cấm vào phòng này</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              );
            })()
          ) : tab === "approval" ? (
            /* Nội dung tab Phê duyệt thành viên (Host Approval Panel) */
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950/30 px-4 py-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Hàng đợi xét duyệt</span>
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    {pendingMembers.length > 0
                      ? `${pendingMembers.length} người đang chờ duyệt`
                      : "Không có ai đang chờ"}
                  </p>
                </div>

                {pendingMembers.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onApproveAllJoinRequests}
                    className="h-8 gap-1.5 border-emerald-500/30 bg-emerald-950/20 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40 hover:text-emerald-200"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Duyệt tất cả</span>
                  </Button>
                )}
              </div>

              <div className="scrollbar-quiet flex-1 space-y-2 overflow-y-auto p-3">
                {pendingMembers.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-16 text-center text-zinc-500">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-900/60 mb-3 text-zinc-600">
                      <ShieldCheck className="h-6 w-6" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-medium text-zinc-300">Không có yêu cầu chờ duyệt</p>
                    <p className="text-xs text-zinc-500 max-w-[240px] mt-1 leading-relaxed">
                      Người tham gia mới khi vào phòng sẽ hiển thị tại đây để bạn phê duyệt.
                    </p>
                  </div>
                ) : (
                  pendingMembers.map((p) => {
                    const pId = p.userId || p._id || p.id;
                    return (
                      <div
                        key={pId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 transition hover:border-zinc-700/80"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 shrink-0 rounded-xl border border-zinc-700/60">
                            {p.avatar ? (
                              <AvatarImage src={p.avatar} alt={p.name} />
                            ) : null}
                            <AvatarFallback className="rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300">
                              {initialsFrom(p.name || "U")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {p.name || "Người dùng"}
                            </p>
                            <p className="truncate text-xs text-zinc-500 font-mono">
                              {p.email || "Đang chờ duyệt vào phòng"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => onApproveJoinRequest && onApproveJoinRequest(pId)}
                            className="h-8 gap-1 bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-500 shadow-sm shadow-emerald-950"
                            title="Đồng ý cho vào phòng"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Đồng ý</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onRejectJoinRequest && onRejectJoinRequest(pId)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:bg-rose-950/40 hover:text-rose-400"
                            title="Từ chối"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : tab === "ai" ? (
            /* Nội dung tab Study AI Tutor */
            <StudyAITutorPanel
              roomCode={roomCode}
              roomSubject={roomName}
              isPro={isPro}
              onUpgradeClick={onUpgradeClick}
              className="flex-1 min-h-0"
            />
          ) : tab === "files" ? (
            /* Nội dung tab Tài liệu phòng học */
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950/30 px-4 py-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Tài liệu phòng học
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    {filesPagination.totalItems > 0
                      ? `${filesPagination.totalItems} tệp đã chia sẻ`
                      : "Chưa có tài liệu"}
                  </p>
                </div>

                <input
                  type="file"
                  ref={resourceFileInputRef}
                  onChange={handleDirectFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar,.tar,.gz,.json,.js,.jsx,.ts,.tsx,.py,.c,.cpp"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => resourceFileInputRef.current?.click()}
                  disabled={directFileUploading?.uploading}
                  className="h-8 gap-1.5 border-zinc-800 bg-zinc-900/80 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Chia sẻ tệp
                </Button>
              </div>

              {/* Toolbar: Tìm kiếm & Sắp xếp tệp */}
              <div className="border-b border-zinc-800/60 bg-zinc-950/20 px-3 py-2 space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500"
                      strokeWidth={1.5}
                    />
                    <input
                      type="text"
                      value={fileSearch}
                      onChange={(e) => setFileSearch(e.target.value)}
                      placeholder="Tìm theo tên tệp..."
                      className="h-7 w-full rounded-md border border-zinc-800 bg-zinc-900/80 pl-7 pr-6 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                    {fileSearch && (
                      <button
                        type="button"
                        onClick={() => setFileSearch("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>

                  <select
                    value={fileSort}
                    onChange={(e) => {
                      setFileSort(e.target.value);
                      setFilePage(1);
                    }}
                    className="h-7 rounded-md border border-zinc-800 bg-zinc-900/80 px-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer"
                  >
                    <option value="latest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="size_desc">Dung lượng</option>
                    <option value="name_asc">Tên A-Z</option>
                  </select>
                </div>

                {/* Phân loại loại tệp (Type filters) */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { id: "all", label: "Tất cả" },
                    { id: "document", label: "Tài liệu" },
                    { id: "image", label: "Ảnh" },
                    { id: "code", label: "Mã nguồn" },
                    { id: "archive", label: "Nén" },
                  ].map((filter) => {
                    const isSelected = fileTypeFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => {
                          setFileTypeFilter(filter.id);
                          setFilePage(1);
                        }}
                        className={`whitespace-nowrap px-2 py-0.5 text-[10px] rounded-md transition ${
                          isSelected
                            ? "bg-zinc-200 text-zinc-950 font-semibold"
                            : "bg-zinc-900/60 text-zinc-400 border border-zinc-800/80 hover:bg-zinc-800 hover:text-zinc-200"
                        }`}
                      >
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Progress bar khi tải trực tiếp trong tab Tài liệu */}
              {directFileUploading && (
                <div className="border-b border-zinc-800/60 bg-zinc-900/40 px-4 py-2.5">
                  <FileUploadBar
                    fileName={directFileUploading.name}
                    fileSize={directFileUploading.size}
                    progress={directFileUploading.progress}
                    uploading={directFileUploading.uploading}
                    error={directFileUploading.error}
                    onCancel={() => setDirectFileUploading(null)}
                  />
                </div>
              )}

              {/* Danh sách tệp đã chia sẻ */}
              <div className="scrollbar-quiet flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {loadingFiles ? (
                  <div className="space-y-2 py-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="animate-pulse rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-3"
                      >
                        <div className="mb-2 h-4 w-32 rounded bg-zinc-800/50" />
                        <div className="h-10 w-full rounded bg-zinc-800/30" />
                      </div>
                    ))}
                  </div>
                ) : filesList.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-center text-zinc-500">
                    <FolderOpen className="mb-2.5 h-8 w-8 text-zinc-700" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-zinc-400">
                      {fileSearch || fileTypeFilter !== "all"
                        ? "Không tìm thấy tệp phù hợp"
                        : "Chưa có tài liệu nào"}
                    </p>
                    <p className="mt-1 max-w-[240px] text-xs text-zinc-600">
                      {fileSearch || fileTypeFilter !== "all"
                        ? "Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn lọc loại tệp."
                        : "Chia sẻ tài liệu, giáo trình hoặc ảnh để các thành viên cùng tham khảo."}
                    </p>
                  </div>
                ) : (
                  filesList.map((f, idx) => {
                    const senderName = f.senderName || f.senderId?.name || "Thành viên";
                    const senderAvatar = f.senderAvatar || f.senderId?.avatar;
                    const createdAtStr = f.createdAt
                      ? new Date(f.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div
                        key={f._id || idx}
                        className="group rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3 transition hover:border-zinc-700/60 hover:bg-zinc-900/70"
                      >
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-5 w-5 shrink-0">
                              <AvatarImage src={senderAvatar} alt="" />
                              <AvatarFallback className="bg-zinc-800 text-[9px] text-zinc-400">
                                {initialsFrom(senderName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate text-xs font-medium text-zinc-300">
                              {senderName}
                            </span>
                          </div>
                          {createdAtStr && (
                            <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                              {createdAtStr}
                            </span>
                          )}
                        </div>

                        <FileItemCard
                          file={f}
                          onImageClick={(url) => setLightboxUrl(url)}
                          showDetails={true}
                        />
                      </div>
                    );
                  })
                )}
              </div>

              {/* Phân trang tài liệu */}
              <div className="border-t border-zinc-800/60 px-3 py-2 bg-zinc-950/30">
                <PaginationControl
                  currentPage={filesPagination.currentPage}
                  totalPages={filesPagination.totalPages}
                  totalItems={filesPagination.totalItems}
                  limit={filesPagination.limit}
                  onPageChange={(p) => setFilePage(p)}
                  compact={true}
                />
              </div>
            </div>
          ) : (
            /* Nội dung tab Chat */
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Thanh Banner ghim tin nhắn / tài liệu */}
              {pinnedItem && (
                <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-3.5 py-2 backdrop-blur-md">
                  <div
                    onClick={() => {
                      const targetEl = document.getElementById(`msg-${pinnedItem.id}`);
                      if (targetEl) {
                        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        targetEl.classList.add("ring-2", "ring-amber-400/50");
                        setTimeout(() => targetEl.classList.remove("ring-2", "ring-amber-400/50"), 1500);
                      }
                    }}
                    className="flex items-center gap-2 min-w-0 cursor-pointer group flex-1"
                    title="Bấm để cuộn tới tin nhắn được ghim"
                  >
                    <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0 -rotate-45" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                          Tin nhắn đã ghim
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate">
                          · {pinnedItem.senderName}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 truncate group-hover:text-amber-200 transition">
                        {pinnedItem.type === "file"
                          ? `📎 ${pinnedItem.fileName || "Tài liệu"}`
                          : pinnedItem.text}
                      </p>
                    </div>
                  </div>
                  {Boolean(
                    isCurrentUserHost ||
                    (pinnedItem.pinnedBy && pinnedItem.pinnedBy === "Bạn")
                  ) && onUnpinItem && (
                    <button
                      type="button"
                      onClick={onUnpinItem}
                      title="Bỏ ghim"
                      className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition shrink-0 ml-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="scrollbar-quiet flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-center text-zinc-500">
                    <MessageSquare className="mb-2 h-7 w-7 text-zinc-700" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-zinc-400">Chưa có tin nhắn</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Gửi tin nhắn hoặc tài liệu để cùng thảo luận
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    if (msg.system) {
                      return (
                        <div key={msg.id || idx} className="flex justify-center py-1">
                          <span className="rounded-full border border-zinc-800/60 bg-zinc-900/80 px-3 py-1 text-[11px] text-zinc-400">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    // Nếu là tin nhắn dạng Poll (Bình chọn nhanh)
                    if (msg.type === "poll" || msg.poll) {
                      return (
                        <div
                          key={msg.id || idx}
                          id={`msg-${msg.id}`}
                          className="flex justify-center py-1.5 w-full"
                        >
                          <PollMessageCard
                            poll={msg.poll}
                            currentUserId={currentUserId}
                            onVote={onVotePoll}
                          />
                        </div>
                      );
                    }

                    const isHost = Boolean(
                      currentUserId && hostId && String(currentUserId) === String(hostId)
                    );
                    const senderId = msg.sender?.id || msg.sender?._id || msg.senderId;
                    const isMe =
                      (currentUserId && String(senderId) === String(currentUserId)) ||
                      msg.isYou;
                    const canRecall = !msg.isRecalled && (isMe || isHost);
                    const canPin = Boolean(isHost || isMe);

                    // Giao diện tinh tế chuẩn Messenger khi tin nhắn đã bị thu hồi
                    if (msg.isRecalled) {
                      if (isMe) {
                        return (
                          <div key={msg.id || idx} id={`msg-${msg.id}`} className="flex flex-col items-end gap-1">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-mono text-[10px] text-zinc-600">
                                {msg.time}
                              </span>
                              <span className="text-xs font-medium text-zinc-500">
                                Bạn
                              </span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-dashed border-zinc-700/60 bg-transparent px-3 py-1.5 text-xs italic text-zinc-500 select-none">
                              <RotateCcw className="h-3 w-3 shrink-0 text-zinc-600" />
                              <span>Bạn đã thu hồi một tin nhắn</span>
                            </div>
                          </div>
                        );
                      }

                      const senderName = msg.sender?.name || msg.author || "Người dùng";
                      return (
                        <div key={msg.id || idx} id={`msg-${msg.id}`} className="flex items-start gap-2.5">
                          <Avatar className="mt-0.5 h-7 w-7 shrink-0 opacity-50">
                            <AvatarImage src={msg.sender?.avatar} alt="" />
                            <AvatarFallback className="bg-zinc-800 text-[10px] text-zinc-500">
                              {initialsFrom(senderName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 max-w-[85%] flex-col gap-1">
                            <div className="flex items-baseline gap-1.5">
                              <span className="truncate text-xs font-medium text-zinc-500">
                                {senderName}
                              </span>
                              <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                                {msg.time}
                              </span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-dashed border-zinc-700/60 bg-transparent px-3 py-1.5 text-xs italic text-zinc-500 select-none">
                              <RotateCcw className="h-3 w-3 shrink-0 text-zinc-600" />
                              <span>{senderName} đã thu hồi một tin nhắn</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const fileData =
                      msg.file ||
                      (msg.fileUrl
                        ? {
                            fileUrl: msg.fileUrl,
                            fileName: msg.fileName,
                            fileType: msg.fileType,
                            fileSize: msg.fileSize,
                          }
                        : null);

                    if (isMe) {
                      return (
                        <div key={msg.id || idx} id={`msg-${msg.id}`} className="group relative flex flex-col items-end gap-1.5">
                          {/* Trích dẫn trả lời nếu có */}
                          {msg.replyTo && (
                            <div
                              onClick={() => {
                                const targetEl = document.getElementById(`msg-${msg.replyTo.messageId}`);
                                if (targetEl) {
                                  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                                  targetEl.classList.add("ring-2", "ring-amber-400/50");
                                  setTimeout(() => targetEl.classList.remove("ring-2", "ring-amber-400/50"), 1500);
                                }
                              }}
                              className="cursor-pointer mb-0.5 flex items-center gap-1.5 rounded-xl border-l-2 border-amber-500 bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-800 max-w-[85%]"
                              title="Bấm để cuộn tới tin nhắn gốc"
                            >
                              <CornerUpLeft className="h-3 w-3 text-amber-400 shrink-0" />
                              <span className="font-semibold text-amber-300 shrink-0">
                                {msg.replyTo.senderName}:
                              </span>
                              <span className="truncate text-zinc-400">
                                {msg.replyTo.contentPreview}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            {/* Nút Trả lời */}
                            <button
                              type="button"
                              onClick={() =>
                                setReplyingTo({
                                  messageId: msg.id,
                                  senderName: "Bạn",
                                  contentPreview: msg.text || (fileData ? fileData.fileName : "Tệp đính kèm"),
                                })
                              }
                              title="Trả lời tin nhắn"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-zinc-500 hover:text-amber-300 hover:bg-zinc-800/80 focus:opacity-100"
                            >
                              <CornerUpLeft className="h-3 w-3" />
                            </button>

                            {/* Nút Ghim */}
                            {onPinItem && (
                              <button
                                type="button"
                                onClick={() =>
                                  onPinItem({
                                    id: msg.id,
                                    type: fileData ? "file" : "message",
                                    text: msg.text,
                                    fileName: fileData?.fileName,
                                    fileUrl: fileData?.fileUrl,
                                    senderName: "Bạn",
                                  })
                                }
                                title="Ghim tin nhắn này"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-zinc-500 hover:text-amber-300 hover:bg-zinc-800/80 focus:opacity-100"
                              >
                                <Pin className="h-3 w-3 -rotate-45" />
                              </button>
                            )}

                            {/* Nút Thu hồi */}
                            {canRecall && (
                              <button
                                type="button"
                                onClick={() => setRecallTargetMsg(msg)}
                                title="Thu hồi với mọi người"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/80 focus:opacity-100"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            )}
                            <span className="font-mono text-[10px] text-zinc-500">
                              {msg.time}
                            </span>
                            <span className="text-xs font-medium text-zinc-400">
                              Bạn
                            </span>
                          </div>

                          {fileData && (
                            <div className="max-w-[85%]">
                              <FileItemCard
                                file={fileData}
                                onImageClick={(url) => setLightboxUrl(url)}
                                isSenderMe={true}
                              />
                            </div>
                          )}

                          {msg.text ? (
                            <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-zinc-800 px-3.5 py-2 text-sm leading-relaxed text-zinc-100 shadow-sm break-words">
                              {msg.text}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    const senderName = msg.sender?.name || msg.author || "Người dùng";
                    return (
                      <div key={msg.id || idx} id={`msg-${msg.id}`} className="group relative flex items-start gap-2.5">
                        <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                          <AvatarImage src={msg.sender?.avatar} alt="" />
                          <AvatarFallback className="bg-zinc-800 text-[10px] text-zinc-300">
                            {initialsFrom(senderName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 max-w-[85%] flex-col gap-1.5">
                          {/* Trích dẫn trả lời nếu có */}
                          {msg.replyTo && (
                            <div
                              onClick={() => {
                                const targetEl = document.getElementById(`msg-${msg.replyTo.messageId}`);
                                if (targetEl) {
                                  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                                  targetEl.classList.add("ring-2", "ring-amber-400/50");
                                  setTimeout(() => targetEl.classList.remove("ring-2", "ring-amber-400/50"), 1500);
                                }
                              }}
                              className="cursor-pointer mb-0.5 flex items-center gap-1.5 rounded-xl border-l-2 border-amber-500 bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-800 max-w-full"
                              title="Bấm để cuộn tới tin nhắn gốc"
                            >
                              <CornerUpLeft className="h-3 w-3 text-amber-400 shrink-0" />
                              <span className="font-semibold text-amber-300 shrink-0">
                                {msg.replyTo.senderName}:
                              </span>
                              <span className="truncate text-zinc-400">
                                {msg.replyTo.contentPreview}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium text-zinc-300">
                              {senderName}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                              {msg.time}
                            </span>

                            {/* Nút Trả lời */}
                            <button
                              type="button"
                              onClick={() =>
                                setReplyingTo({
                                  messageId: msg.id,
                                  senderName,
                                  contentPreview: msg.text || (fileData ? fileData.fileName : "Tệp đính kèm"),
                                })
                              }
                              title="Trả lời tin nhắn này"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-zinc-500 hover:text-amber-300 hover:bg-zinc-800/80 focus:opacity-100"
                            >
                              <CornerUpLeft className="h-3 w-3" />
                            </button>

                            {/* Nút Ghim (Host hoặc người gửi) */}
                            {canPin && onPinItem && (
                              <button
                                type="button"
                                onClick={() =>
                                  onPinItem({
                                    id: msg.id,
                                    type: fileData ? "file" : "message",
                                    text: msg.text,
                                    fileName: fileData?.fileName,
                                    fileUrl: fileData?.fileUrl,
                                    senderName,
                                  })
                                }
                                title="Ghim tin nhắn này"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-zinc-500 hover:text-amber-300 hover:bg-zinc-800/80 focus:opacity-100"
                              >
                                <Pin className="h-3 w-3 -rotate-45" />
                              </button>
                            )}

                            {/* Nút Thu hồi (Chủ phòng) */}
                            {canRecall && (
                              <button
                                type="button"
                                onClick={() => setRecallTargetMsg(msg)}
                                title="Chủ phòng: Thu hồi tin nhắn này"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/80 focus:opacity-100"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          {fileData && (
                            <div className="w-full">
                              <FileItemCard
                                file={fileData}
                                onImageClick={(url) => setLightboxUrl(url)}
                                isSenderMe={false}
                              />
                            </div>
                          )}

                          {msg.text ? (
                            <div className="rounded-2xl rounded-tl-xs border border-zinc-800/60 bg-zinc-900 px-3.5 py-2 text-sm leading-relaxed text-zinc-200 break-words">
                              {msg.text}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Form chat & đính kèm file */}
              <form
                onSubmit={handleSend}
                className="flex flex-col border-t border-zinc-800/60 bg-zinc-950/40 p-3 sm:p-4 gap-2"
              >
                {/* Thanh preview Đang trả lời */}
                {replyingTo && (
                  <div className="flex items-center justify-between rounded-xl border border-zinc-800/90 bg-zinc-900/95 px-3 py-1.5 text-xs text-zinc-300 shadow-sm backdrop-blur animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CornerUpLeft className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="font-semibold text-amber-300 shrink-0">
                        Đang trả lời {replyingTo.senderName}:
                      </span>
                      <span className="truncate text-zinc-400 text-[11px] italic">
                        {replyingTo.contentPreview}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
                      title="Hủy trả lời"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {(chatFileUploading || chatStagedFile) && (
                  <FileUploadBar
                    fileName={chatFileUploading?.name || chatStagedFile?.fileName}
                    fileSize={chatFileUploading?.size || chatStagedFile?.fileSize}
                    progress={chatFileUploading?.progress ?? 100}
                    uploading={chatFileUploading?.uploading}
                    error={chatFileUploading?.error}
                    onCancel={() => {
                      setChatFileUploading(null);
                      setChatStagedFile(null);
                    }}
                  />
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={chatFileInputRef}
                    onChange={handleChatFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar,.tar,.gz,.json,.js,.jsx,.ts,.tsx,.py,.c,.cpp"
                  />
                  <button
                    type="button"
                    onClick={() => chatFileInputRef.current?.click()}
                    title="Đính kèm tệp (ảnh, tài liệu tối đa 15MB)"
                    disabled={chatFileUploading?.uploading}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition disabled:opacity-50"
                  >
                    <Paperclip className="h-4 w-4" strokeWidth={1.75} />
                  </button>

                  {/* Nút Tạo bình chọn nhanh (Quick Poll) */}
                  <button
                    type="button"
                    onClick={() => setPollModalOpen(true)}
                    title="Tạo bình chọn nhanh (Quick Poll)"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 transition"
                  >
                    <BarChart2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>

                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      chatStagedFile
                        ? "Thêm ghi chú cho tệp đính kèm..."
                        : replyingTo
                        ? `Nhập câu trả lời cho ${replyingTo.senderName}...`
                        : "Nhập tin nhắn..."
                    }
                    maxLength={500}
                    className="h-10 flex-1 rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    aria-label="Tin nhắn"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      (!draft.trim() && !chatStagedFile) || chatFileUploading?.uploading
                    }
                    aria-label="Gửi tin nhắn"
                    id="btn-send-message"
                  >
                    <Send className="h-4 w-4" strokeWidth={ICON_STROKE} />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Dialog xác nhận Kick / Ban thành viên */}
          <Dialog
            open={Boolean(actionModal)}
            onOpenChange={(isOpen) => !isOpen && setActionModal(null)}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {actionModal?.type === "kick"
                    ? "Mời thành viên rời phòng"
                    : "Cấm thành viên vào phòng"}
                </DialogTitle>
                <DialogDescription>
                  {actionModal?.type === "kick"
                    ? `Bạn có chắc muốn mời "${actionModal?.member?.name}" rời khỏi phòng học? Thành viên này vẫn có thể tham gia lại sau nếu muốn.`
                    : `Bạn có chắc muốn cấm "${actionModal?.member?.name}" vào phòng học này? Thành viên sẽ bị mời ra ngay và không thể tham gia lại phòng này cho đến khi phòng đóng.`}
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionModal(null)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant={actionModal?.type === "kick" ? "secondary" : "destructive"}
                  onClick={() => {
                    if (actionModal?.type === "kick" && onKickMember) {
                      onKickMember(actionModal.member.id);
                    } else if (actionModal?.type === "ban" && onBanMember) {
                      onBanMember(actionModal.member.id);
                    }
                    setActionModal(null);
                  }}
                >
                  {actionModal?.type === "kick"
                    ? "Xác nhận mời ra"
                    : "Xác nhận cấm vào"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal xác nhận thu hồi tin nhắn với mọi người */}
          <Dialog
            open={Boolean(recallTargetMsg)}
            onOpenChange={(open) => !open && setRecallTargetMsg(null)}
          >
            <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                  <RotateCcw className="h-4 w-4 text-amber-400" />
                  Thu hồi tin nhắn với mọi người?
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 leading-relaxed pt-1">
                  Tin nhắn này (bao gồm văn bản, hình ảnh hoặc tệp đính kèm) sẽ bị gỡ bỏ với tất cả thành viên trong phòng học. Tệp gốc trên hệ thống đám mây sẽ được dọn dẹp sạch sẽ.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRecallTargetMsg(null)}
                  className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (recallTargetMsg?.id) {
                      onRecallMessage?.(recallTargetMsg.id);
                    }
                    setRecallTargetMsg(null);
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Thu hồi với mọi người
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal xác nhận chuyển quyền Chủ phòng (Transfer Host) */}
          <Dialog
            open={Boolean(transferHostTarget)}
            onOpenChange={(open) => !open && setTransferHostTarget(null)}
          >
            <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                  <Crown className="h-4 w-4 text-amber-400" />
                  Chuyển giao quyền Chủ phòng
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 leading-relaxed pt-1">
                  Bạn có chắc muốn chỉ định <span className="font-semibold text-zinc-200">&quot;{transferHostTarget?.name}&quot;</span> làm Chủ phòng học mới? Toàn bộ quyền điều phối và quản trị sẽ được chuyển giao ngay lập tức.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTransferHostTarget(null)}
                  className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (transferHostTarget?.id && onTransferHost) {
                      onTransferHost(transferHostTarget.id);
                    }
                    setTransferHostTarget(null);
                  }}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs gap-1.5"
                >
                  <Crown className="h-3.5 w-3.5" />
                  Xác nhận chỉ định
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal tạo bình chọn nhanh (Quick Poll) */}
          <CreatePollModal
            isOpen={pollModalOpen}
            onClose={() => setPollModalOpen(false)}
            onCreatePoll={(pollData) => {
              onCreatePoll?.(pollData);
              setPollModalOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Lightbox modal xem ảnh phóng to */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxUrl)}
        imageUrl={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
      />
    </>
  );
}

function TabButton({ active, onClick, children, id }) {
  return (
    <button
      type="button"
      onClick={onClick}
      id={id}
      className={cn(
        "inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition duration-150 ease-out",
        active
          ? "bg-zinc-900 text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
      )}
    >
      {children}
    </button>
  );
}
