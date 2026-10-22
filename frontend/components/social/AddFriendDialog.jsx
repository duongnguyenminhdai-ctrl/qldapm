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
            className="gap-1.5 border-stone-200 bg-[#ECE5DA] text-xs text-[#2D241E] hover:bg-[#DCD4C4] hover:text-[#1c1815] dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#d8c8b4] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
          >
            <UserPlus className="h-3.5 w-3.5 text-[#966f38] dark:text-[#d8c8b4]" strokeWidth={ICON_STROKE} />
            <span className="hidden sm:inline">+ Thêm bạn</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-[#ECE5DA] text-[#966f38] dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#c3a47b]">
              <UserPlus className="h-4 w-4" strokeWidth={ICON_STROKE} />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3]">
                Thêm bạn học mới
              </DialogTitle>
              <DialogDescription className="text-xs text-[#615247] dark:text-[#a89b8d]">
                Gửi lời mời kết bạn qua địa chỉ email đã đăng ký của bạn bè.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSendRequest} className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#2D241E] dark:text-[#f5ede3]" htmlFor="friend-email">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7E72] dark:text-[#75695e]" strokeWidth={ICON_STROKE} />
              <input
                id="friend-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@studyroom.com"
                required
                className="w-full rounded-xl border border-stone-200 bg-[#ECE5DA]/70 pl-9 pr-3 py-2 text-sm text-[#2D241E] placeholder:text-[#8C7E72] focus:border-[#b3894e] focus:outline-none focus:ring-1 focus:ring-[#b3894e] dark:border-[#3a3128] dark:bg-[#141210] dark:text-[#f5ede3] dark:placeholder:text-[#75695e] dark:focus:border-[#c3a47b] dark:focus:ring-[#c3a47b]"
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
