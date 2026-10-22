"use client";

import React, { useState } from "react";
import {
  BarChart2,
  Check,
  Lock,
  Plus,
  Users,
  CheckSquare,
  CircleDot,
  Send,
  X,
  AlertCircle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useConfirm } from "@/context/ConfirmContext";

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/**
 * Thẻ hiển thị bình chọn phong cách Zalo trong phòng học (PollMessageItem)
 * Hỗ trợ Khóa bình chọn và Thu hồi bình chọn (Recall Poll)
 */
export default function PollMessageItem({
  poll,
  messageId,
  currentUserId,
  onVote,
  onLock,
  onRecall,
  onRecallPoll,
  onAddOption,
  isHost = false,
  isRecalled = false,
  className,
}) {
  const confirm = useConfirm();
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const [addOptionError, setAddOptionError] = useState("");
  const [isSubmittingOption, setIsSubmittingOption] = useState(false);

  // Hiển thị trạng thái đã bị thu hồi
  const isPollRecalled = Boolean(isRecalled || poll?.isRecalled);
  if (isPollRecalled) {
    return (
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-dashed border-stone-800/80 bg-[#161311]/60 px-4 py-3 text-stone-500 shadow-sm flex items-center justify-center gap-2 text-xs italic select-none",
          className
        )}
      >
        <RotateCcw className="h-3.5 w-3.5 shrink-0 text-stone-600" />
        <span>Bình chọn này đã được thu hồi</span>
      </div>
    );
  }

  if (!poll || !Array.isArray(poll.options)) return null;

  const uIdStr = String(currentUserId || "");
  const creatorId = String(poll.createdBy?.id || poll.createdBy?._id || "");
  const isCreator = Boolean(uIdStr && creatorId && uIdStr === creatorId);
  const canLock = Boolean(!poll.isClosed && (isHost || isCreator) && onLock);
  const canRecall = Boolean((isHost || isCreator) && (onRecall || onRecallPoll));

  // Tính toán tổng số lượt vote
  const totalVotes =
    typeof poll.totalVotes === "number"
      ? poll.totalVotes
      : poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);

  // Đếm tổng số người biểu quyết (unique voters)
  const uniqueVoterSet = new Set();
  poll.options.forEach((opt) => {
    (opt.votes || []).forEach((v) => {
      const vId = typeof v === "object" ? String(v?.userId || v?.id) : String(v);
      if (vId) uniqueVoterSet.add(vId);
    });
  });
  const totalUniqueVoters = uniqueVoterSet.size;

  const handleVoteClick = (idx) => {
    if (poll.isClosed) return;
    if (onVote) {
      onVote(poll.id, idx);
    }
  };

  const handleLockClick = async () => {
    if (poll.isClosed || !onLock) return;
    const isConfirmed = await confirm({
      title: "Khóa bình chọn",
      message: "Bạn có chắc chắn muốn khóa bình chọn này không? Sau khi khóa, không ai có thể biểu quyết thêm.",
      confirmText: "Khóa bình chọn",
      cancelText: "Hủy bỏ",
      variant: "warning",
      icon: "lock",
    });
    if (isConfirmed) {
      onLock(poll.id);
    }
  };

  const handleRecallClick = async () => {
    if (!canRecall) return;
    const isConfirmed = await confirm({
      title: "Thu hồi bình chọn",
      message:
        "Bạn có chắc chắn muốn thu hồi bình chọn này không? Toàn bộ kết quả biểu quyết sẽ bị hủy bỏ với tất cả thành viên trong phòng.",
      confirmText: "Xác nhận thu hồi",
      cancelText: "Hủy bỏ",
      variant: "danger",
      icon: "trash",
    });
    if (isConfirmed) {
      const msgId = messageId || poll.id;
      if (onRecallPoll) {
        onRecallPoll(msgId, poll.id);
      } else if (onRecall) {
        onRecall(msgId);
      }
    }
  };

  const handleAddOptionSubmit = async (e) => {
    e?.preventDefault();
    setAddOptionError("");
    const trimmed = newOptionText.trim();
    if (!trimmed) {
      setAddOptionError("Vui lòng nhập phương án mới.");
      return;
    }
    if (poll.options.some((o) => o.text.trim().toLowerCase() === trimmed.toLowerCase())) {
      setAddOptionError("Phương án này đã tồn tại.");
      return;
    }
    if (poll.options.length >= 10) {
      setAddOptionError("Đã đạt giới hạn tối đa 10 phương án.");
      return;
    }

    try {
      setIsSubmittingOption(true);
      if (onAddOption) {
        await onAddOption(poll.id, trimmed);
      }
      setNewOptionText("");
      setIsAddingOption(false);
    } catch (err) {
      setAddOptionError(err.message || "Không thể thêm phương án.");
    } finally {
      setIsSubmittingOption(false);
    }
  };

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border border-[#382f26] bg-[#1a1613] p-4 text-[#f5ede3] shadow-xl space-y-3.5 transition-all select-none",
        poll.isClosed && "opacity-95 border-stone-800 bg-[#161311]",
        className
      )}
    >
      {/* 1. Header thẻ bình chọn */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#c3a47b]/40 bg-[#c3a47b]/15 text-[#c3a47b] shadow-inner mt-0.5">
              <BarChart2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-[#f5ede3] leading-snug break-words">
                {poll.question}
              </h4>
            </div>
          </div>

          {/* Cụm nút hành động quản lý (Khóa & Thu hồi) */}
          <div className="shrink-0 flex items-center gap-1.5">
            {canLock && (
              <button
                type="button"
                onClick={handleLockClick}
                className="flex items-center gap-1 rounded-lg border border-[#4a3d31] bg-[#241e1a] px-2 py-1 text-[11px] font-medium text-amber-300 hover:border-amber-500/50 hover:bg-amber-950/30 transition cursor-pointer"
                title="Khóa cuộc bình chọn này"
              >
                <Lock className="h-3 w-3" />
                <span>Khóa</span>
              </button>
            )}

            {canRecall && (
              <button
                type="button"
                onClick={handleRecallClick}
                className="flex items-center gap-1 rounded-lg border border-rose-900/50 bg-rose-950/30 px-2 py-1 text-[11px] font-medium text-rose-300 hover:border-rose-700/60 hover:bg-rose-950/60 transition cursor-pointer"
                title="Thu hồi cuộc bình chọn này"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Thu hồi</span>
              </button>
            )}
          </div>
        </div>

        {/* Nhãn tag phân loại & Trạng thái */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] pl-10.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium border",
              poll.allowMultiple
                ? "border-sky-800/60 bg-sky-950/40 text-sky-300"
                : "border-amber-800/60 bg-amber-950/40 text-amber-300"
            )}
          >
            {poll.allowMultiple ? (
              <>
                <CheckSquare className="h-3 w-3" /> Chọn nhiều đáp án
              </>
            ) : (
              <>
                <CircleDot className="h-3 w-3" /> Chọn 1 đáp án
              </>
            )}
          </span>

          {poll.isClosed ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-900/60 bg-rose-950/40 px-2 py-0.5 text-rose-300 font-medium">
              <Lock className="h-3 w-3" /> Bình chọn đã kết thúc
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-stone-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Đang diễn ra
            </span>
          )}
        </div>
      </div>

      {/* 2. Danh sách các phương án */}
      <div className="space-y-2 pt-0.5">
        {poll.options.map((opt, idx) => {
          const voteCount = opt.votes?.length || 0;
          const percentage =
            totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

          // Kiểm tra xem current user đã vote cho option này chưa
          const hasVoted = Boolean(
            uIdStr &&
              opt.votes?.some((v) => {
                const vId = typeof v === "object" ? String(v?.userId || v?.id) : String(v);
                return vId === uIdStr;
              })
          );

          // Lấy danh sách voter profiles để hiển thị avatar
          const voterProfiles = (opt.votes || []).map((v) => {
            if (typeof v === "object" && v !== null) {
              return {
                id: String(v.userId || v.id || ""),
                name: v.name || "Thành viên",
                avatar: v.avatar || "",
              };
            }
            return {
              id: String(v),
              name: "Thành viên",
              avatar: "",
            };
          });

          return (
            <div key={opt.id ?? idx} className="space-y-1">
              <button
                type="button"
                disabled={poll.isClosed}
                onClick={() => handleVoteClick(idx)}
                className={cn(
                  "group relative w-full overflow-hidden rounded-xl border p-2.5 text-left transition-all select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c3a47b]",
                  poll.isClosed && "cursor-default",
                  hasVoted
                    ? "border-[#c3a47b] bg-[#221c17] shadow-md shadow-[#c3a47b]/5"
                    : "border-[#382f26] bg-[#14110f] hover:border-[#524436] hover:bg-[#1c1815]"
                )}
              >
                {/* Thanh tiến trình phần trăm (Progress bar) */}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all duration-500 ease-out",
                    hasVoted ? "bg-[#c3a47b]/25" : "bg-[#251f1a]/80"
                  )}
                  style={{ width: `${percentage}%` }}
                />

                {/* Nội dung thanh lựa chọn */}
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Checkbox / Radio indicator */}
                    <div
                      className={cn(
                        "flex shrink-0 items-center justify-center transition border",
                        poll.allowMultiple ? "h-4 w-4 rounded-md" : "h-4 w-4 rounded-full",
                        hasVoted
                          ? "border-[#c3a47b] bg-[#c3a47b] text-[#14110f]"
                          : "border-[#4a3d31] bg-[#1a1613] group-hover:border-[#6d5b4a]"
                      )}
                    >
                      {hasVoted && (
                        poll.allowMultiple ? (
                          <Check className="h-3 w-3 stroke-[3]" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-[#14110f]" />
                        )
                      )}
                    </div>

                    <span
                      className={cn(
                        "text-xs font-medium break-words leading-snug",
                        hasVoted ? "text-[#f5ede3] font-semibold" : "text-[#d8c8b4]"
                      )}
                    >
                      {opt.text}
                    </span>
                  </div>

                  {/* Hiển thị tỷ lệ % và số lượt vote */}
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                    <span
                      className={cn(
                        "font-semibold",
                        hasVoted ? "text-[#e8cca4]" : "text-[#a89b8d]"
                      )}
                    >
                      {percentage}%
                    </span>
                    <span className="text-[11px] text-[#786b5e]">
                      ({voteCount})
                    </span>
                  </div>
                </div>
              </button>

              {/* Voter Avatars Cluster */}
              {voterProfiles.length > 0 && (
                <div className="flex items-center gap-1 pl-7 pt-0.5">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {voterProfiles.slice(0, 5).map((voter, vIdx) => (
                      <Avatar
                        key={voter.id || vIdx}
                        className="h-5 w-5 border border-[#1a1613] ring-1 ring-[#382f26]"
                        title={voter.name}
                      >
                        <AvatarImage src={voter.avatar} alt={voter.name} />
                        <AvatarFallback className="bg-[#2a231c] text-[#d8c8b4] text-[9px] font-bold">
                          {getInitials(voter.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  {voterProfiles.length > 5 && (
                    <span className="text-[10px] text-[#8e8174] font-medium pl-1">
                      +{voterProfiles.length - 5}
                    </span>
                  )}
                  <span className="text-[10px] text-[#786b5e] truncate ml-1">
                    {voterProfiles.map((v) => v.name).slice(0, 2).join(", ")}
                    {voterProfiles.length > 2 ? ` và ${voterProfiles.length - 2} người khác` : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Thêm phương án mới (Nếu cho phép và chưa khóa) */}
      {poll.allowAddOptions && !poll.isClosed && (
        <div className="pt-1">
          {!isAddingOption ? (
            <button
              type="button"
              disabled={poll.options.length >= 10}
              onClick={() => setIsAddingOption(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#c3a47b] hover:text-[#d6b88f] transition cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm phương án</span>
            </button>
          ) : (
            <form onSubmit={handleAddOptionSubmit} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newOptionText}
                  onChange={(e) => setNewOptionText(e.target.value)}
                  placeholder="Nhập phương án mới..."
                  maxLength={100}
                  className="flex-1 rounded-xl border border-[#382f26] bg-[#12100e] px-3 py-1.5 text-xs text-[#f5ede3] placeholder:text-stone-500 focus:border-[#c3a47b] focus:outline-none focus:ring-1 focus:ring-[#c3a47b] transition"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSubmittingOption || !newOptionText.trim()}
                  className="rounded-xl bg-[#c3a47b] px-3 py-1.5 text-xs font-semibold text-[#161311] hover:bg-[#d6b88f] disabled:opacity-50 transition cursor-pointer shrink-0"
                >
                  {isSubmittingOption ? "..." : "Thêm"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingOption(false);
                    setNewOptionText("");
                    setAddOptionError("");
                  }}
                  className="rounded-xl border border-[#382f26] p-1.5 text-stone-400 hover:text-stone-200 transition cursor-pointer shrink-0"
                  title="Hủy"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {addOptionError && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {addOptionError}
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {/* 4. Footer tổng kết */}
      <div className="flex items-center justify-between border-t border-[#382f26]/80 pt-2 text-[11px] text-[#8e8174]">
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-[#c3a47b]" />
          <span>
            {totalUniqueVoters} người đã biểu quyết ({totalVotes} phiếu)
          </span>
        </div>
        <div className="truncate max-w-[150px]">
          Tạo bởi: {poll.createdBy?.name || "Thành viên"}
        </div>
      </div>
    </div>
  );
}
