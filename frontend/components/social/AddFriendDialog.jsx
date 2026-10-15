"use client";

import { useState } from "react";
import { UserPlus, Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendsApi } from "@/lib/api";
import { ICON_STROKE } from "@/lib/constants";

export function AddFriendDialog({ trigger }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await friendsApi.sendRequest(email.trim());
      setFeedback({
        type: "success",
        message: res?.message || "Đã gửi lời mời kết bạn thành công!",
      });
      setEmail("");
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Không thể gửi lời mời kết bạn. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
    if (!newOpen) {
      setEmail("");
      setFeedback(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-zinc-200/80 bg-white/80 text-xs text-zinc-700 backdrop-blur-md hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <UserPlus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" strokeWidth={ICON_STROKE} />
            <span className="hidden sm:inline">Thêm bạn</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200">
              <UserPlus className="h-4 w-4" strokeWidth={ICON_STROKE} />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Thêm bạn học mới
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                Gửi lời mời kết bạn qua địa chỉ email đã đăng ký của bạn bè.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSendRequest} className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="friend-email">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={ICON_STROKE} />
              <input
                id="friend-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@studyroom.com"
                required
                className="w-full rounded-xl border border-zinc-200/90 bg-white pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>
          </div>

          {feedback && (
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" strokeWidth={ICON_STROKE} />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" strokeWidth={ICON_STROKE} />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !email.trim()}
              className="gap-2"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Gửi lời mời
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
