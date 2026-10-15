"use client";

import { useState } from "react";
import { BarChart2, Plus, Trash2, Check, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Modal tạo bình chọn nhanh (Quick Poll Modal)
 */
export function CreatePollModal({ open, onOpenChange, onCreatePoll }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["Có", "Không"]);
  const [error, setError] = useState("");

  const handleAddOption = () => {
    if (options.length < 4) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const handlePreset = (presetOptions) => {
    setOptions([...presetOptions]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError("Vui lòng nhập câu hỏi bình chọn.");
      return;
    }

    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (trimmedOptions.length < 2) {
      setError("Bình chọn cần ít nhất 2 lựa chọn.");
      return;
    }

    onCreatePoll({
      question: trimmedQuestion,
      options: trimmedOptions,
    });

    // Reset form & close
    setQuestion("");
    setOptions(["Có", "Không"]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-zinc-100">
            <BarChart2 className="h-4 w-4 text-amber-400" />
            <span>Tạo bình chọn nhanh</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Tạo câu hỏi bình chọn để mọi người trong phòng học cùng biểu quyết thời gian thực.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Câu hỏi */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Câu hỏi <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="VD: Chúng ta nghỉ giải lao 5 phút nhé?"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              maxLength={150}
              autoFocus
            />
          </div>

          {/* Preset nhanh */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">Mẫu gợi ý:</span>
            <button
              type="button"
              onClick={() => handlePreset(["Có", "Không"])}
              className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition"
            >
              Có / Không
            </button>
            <button
              type="button"
              onClick={() => handlePreset(["Đồng ý", "Phản đối"])}
              className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition"
            >
              Đồng ý / Phản đối
            </button>
          </div>

          {/* Các lựa chọn */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Các lựa chọn (từ 2 đến 4)
              </label>
              {options.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition"
                >
                  <Plus className="h-3 w-3" />
                  <span>Thêm lựa chọn</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-mono text-zinc-400">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Lựa chọn ${idx + 1}`}
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    maxLength={60}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400 transition"
                      title="Xóa lựa chọn"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs font-medium text-rose-400">{error}</p>}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-800 text-zinc-400 hover:text-zinc-200"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400"
            >
              Tạo bình chọn
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Card hiển thị bình chọn trong luồng chat (Poll Card)
 */
export function PollMessageCard({
  poll,
  currentUserId,
  onVote,
  className,
}) {
  if (!poll || !Array.isArray(poll.options)) return null;

  const totalVotes =
    poll.totalVotes !== undefined
      ? poll.totalVotes
      : poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);

  const uIdStr = String(currentUserId || "");

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-800/90 bg-zinc-900/95 p-3.5 shadow-md space-y-3 transition w-full max-w-sm",
        className
      )}
    >
      {/* Header câu hỏi */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
          <BarChart2 className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-zinc-100 leading-snug break-words">
            {poll.question}
          </h4>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Bình chọn nhanh · {totalVotes} lượt biểu quyết
          </p>
        </div>
      </div>

      {/* Danh sách lựa chọn biểu quyết */}
      <div className="space-y-2 pt-1">
        {poll.options.map((opt, idx) => {
          const voteCount = opt.votes?.length || 0;
          const percentage =
            totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const hasVoted = Boolean(
            uIdStr && opt.votes?.some((id) => String(id) === uIdStr)
          );

          return (
            <button
              key={opt.id ?? idx}
              type="button"
              onClick={() => onVote && onVote(poll.id, idx)}
              className={cn(
                "group relative w-full overflow-hidden rounded-xl border p-2.5 text-left transition select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
                hasVoted
                  ? "border-amber-500/60 bg-amber-500/10 shadow-sm"
                  : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900"
              )}
            >
              {/* Progress bar nền mượt mà */}
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-all duration-500 ease-out",
                  hasVoted ? "bg-amber-500/25" : "bg-zinc-800/60"
                )}
                style={{ width: `${percentage}%` }}
              />

              {/* Nội dung thanh lựa chọn */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition",
                      hasVoted
                        ? "border-amber-400 bg-amber-400 text-zinc-950"
                        : "border-zinc-700 bg-zinc-900 group-hover:border-zinc-500"
                    )}
                  >
                    {hasVoted && (
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium truncate",
                      hasVoted ? "text-amber-200" : "text-zinc-200"
                    )}
                  >
                    {opt.text}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                  <span
                    className={cn(
                      "font-semibold",
                      hasVoted ? "text-amber-300" : "text-zinc-400"
                    )}
                  >
                    {percentage}%
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    ({voteCount})
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/60">
        <span>Bởi: {poll.createdBy?.name || "Người dùng"}</span>
        <span>Bấm vào để bình chọn / đổi ý</span>
      </div>
    </div>
  );
}
