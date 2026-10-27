"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Send,
  RotateCcw,
  Crown,
  ChevronLeft,
  Bot,
  Lightbulb,
  Code2,
  FileText,
  Languages,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aiApi } from "@/lib/api";
import { MarkdownContent } from "@/components/room/MarkdownContent";

// Các gợi ý câu hỏi nhanh ban đầu (Quick Prompts)
const QUICK_PROMPTS = [
  {
    icon: Lightbulb,
    title: "Giải thích khái niệm",
    prompt: "Giải thích ngắn gọn và dễ hiểu cho mình về nguyên lý hoạt động của thuật toán tìm kiếm nhị phân (Binary Search).",
  },
  {
    icon: Code2,
    title: "Tìm & sửa lỗi Code",
    prompt: "Hãy giúp mình phân tích và tối ưu đoạn mã sau, chỉ ra lỗi và viết lại bản hoàn chỉnh giúp mình nhé.",
  },
  {
    icon: FileText,
    title: "Tóm tắt bài học",
    prompt: "Hãy tóm tắt cho mình các luận điểm cốt lõi và công thức quan trọng của bài học này thành các bullet points súc tích.",
  },
  {
    icon: Languages,
    title: "Dịch thuật học thuật",
    prompt: "Dịch đoạn văn này sang tiếng Việt chuyên ngành chuẩn xác và giải thích các thuật ngữ khó giúp mình.",
  },
];

export function VAIChatSection({
  user,
  onOpenPricing,
  onBack,
  onClose,
  headerActions,
  className = "",
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const userId = user?._id || user?.id || "anonymous";
  const storageKey = `vsr_v_ai_chat_${userId}`;

  const isVip = Boolean(
    user?.role === "ADMIN" ||
    ((user?.isVip || user?.isPro) &&
      (!user?.proExpiresAt || new Date() <= new Date(user.proExpiresAt)))
  );

  // Tải lịch sử hội thoại từ localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          }
        }
      }
    } catch (e) {
      console.warn("[V_AI] Không thể đọc lịch sử chat từ localStorage:", e);
    }
  }, [storageKey]);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, loading, scrollToBottom]);

  // Lưu tin nhắn vào localStorage mỗi khi thay đổi
  const saveMessages = useCallback(
    (newMsgs) => {
      setMessages(newMsgs);
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(newMsgs));
        }
      } catch (e) {
        console.warn("[V_AI] Không thể lưu lịch sử chat vào localStorage:", e);
      }
    },
    [storageKey]
  );

  // Bắt đầu cuộc trò chuyện mới (Làm mới lịch sử)
  const handleResetChat = () => {
    if (loading) return;
    saveMessages([]);
    setError(null);
    setInput("");
    if (inputRef.current) inputRef.current.focus();
  };

  const handleTriggerOpenPricing = () => {
    if (onOpenPricing) {
      onOpenPricing();
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vsr:open-pricing-modal"));
    }
  };

  // Gửi tin nhắn cho V AI
  const handleSendMessage = async (customPrompt) => {
    const textToSend = (typeof customPrompt === "string" ? customPrompt : input).trim();
    if (!textToSend || loading) return;

    if (!isVip) {
      handleTriggerOpenPricing();
      return;
    }

    setError(null);
    setInput("");

    const userMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];
    saveMessages(nextMessages);
    setLoading(true);

    // Chuẩn bị 8 tin nhắn gần nhất làm context history
    const historyPayload = nextMessages.slice(-8).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      content: m.content,
    }));

    try {
      const res = await aiApi.askTutor({
        message: textToSend,
        history: historyPayload,
        contextType: "GENERAL_QA",
        roomSubject: "Tự học cá nhân & Giải đáp thắc mắc 24/7 ngoài phòng học",
      });

      const replyText = res?.data?.reply || res?.reply;
      if (!replyText) {
        throw new Error("Không nhận được phản hồi từ V AI. Vui lòng thử lại.");
      }

      const aiMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: replyText,
        model: res?.data?.modelUsed,
        timestamp: new Date().toISOString(),
      };

      saveMessages([...nextMessages, aiMessage]);
    } catch (err) {
      console.error("[V_AI] Lỗi nhận phản hồi AI:", err);
      const errMsg =
        err?.message || "Đã xảy ra lỗi khi trao đổi với V AI. Vui lòng thử lại sau.";
      setError(errMsg);
    } finally {
      setLoading(false);
      setTimeout(() => scrollToBottom(true), 60);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full bg-[#16120f] text-[#f5ede3] select-text relative overflow-hidden",
        className
      )}
    >
      {/* ── HEADER V AI — Phong cách Meta AI Hoàng Kim ────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 bg-[#1e1814]/90 border-b border-amber-900/30 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Nút quay lại (nếu có trên mobile) */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 text-stone-400 hover:text-amber-200 transition-colors cursor-pointer"
              title="Quay lại danh sách"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Avatar Meta AI Hologram đa sắc */}
          <div className="relative shrink-0">
            <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-cyan-400 shadow-[0_0_14px_rgba(245,158,11,0.4)]">
              <div className="w-full h-full rounded-full bg-[#181310] flex items-center justify-center">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse" />
              </div>
            </div>
            {/* Chấm trực tuyến AI luôn sáng */}
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#181310] shadow-[0_0_6px_rgba(52,211,153,0.8)]"
              title="V AI luôn sẵn sàng 24/7"
            />
          </div>

          {/* Tên & Trạng thái */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-serif font-bold text-sm sm:text-base text-amber-200 tracking-wide truncate">
                V AI
              </h3>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-400/40 shrink-0">
                AI Agent
              </span>
            </div>
            <span className="text-[11px] text-emerald-400/90 font-sans truncate">
              Trợ lý học tập thông minh 24/7
            </span>
          </div>
        </div>

        {/* Cụm Action Buttons góc phải */}
        <div className="flex items-center gap-1.5 shrink-0">
          {messages.length > 0 && isVip && (
            <button
              type="button"
              onClick={handleResetChat}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-stone-300 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              title="Bắt đầu cuộc trò chuyện mới với V AI"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Hội thoại mới</span>
            </button>
          )}
          {headerActions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
              aria-label="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── NỘI DUNG CUỘC TRÒ CHUYỆN ─────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Trường hợp: Người dùng CHƯA là VIP */}
        {!isVip ? (
          <div className="flex flex-col items-center justify-center min-h-[360px] text-center p-6 rounded-2xl bg-gradient-to-b from-amber-500/10 via-[#1f1915] to-[#16120f] border border-amber-500/30 shadow-xl my-auto max-w-md mx-auto">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 via-amber-600/25 to-amber-950/70 border border-amber-400/60 shadow-[0_0_28px_rgba(245,158,11,0.4)] mb-4">
              <Crown className="w-8 h-8 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse" />
            </div>
            <h4 className="font-serif text-lg sm:text-xl font-bold text-amber-200 mb-2">
              Mở Khóa Người Bạn Trợ Lý V AI
            </h4>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed mb-5">
              <strong>V AI</strong> là đặc quyền AI thông minh phong cách Meta AI dành riêng cho <strong>Học Giả VIP</strong>. Đồng hành giải đáp bài tập, gỡ lỗi code, tóm tắt bài giảng và dịch thuật 24/7 bất cứ lúc nào ngoài phòng học!
            </p>
            <button
              type="button"
              onClick={handleTriggerOpenPricing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-400/80 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-stone-950 font-serif font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              <span>Nâng Cấp VIP Để Trò Chuyện</span>
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : messages.length === 0 ? (
          /* Trường hợp: Đã là VIP nhưng chưa có tin nhắn nào -> Hiện Welcome Screen */
          <div className="flex flex-col items-center justify-center min-h-[380px] max-w-lg mx-auto text-center py-6">
            {/* Hologram lớn */}
            <div className="relative mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[3px] bg-gradient-to-tr from-amber-400 via-rose-500 to-cyan-400 shadow-[0_0_30px_rgba(245,158,11,0.35)] flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-[#1a1410] flex items-center justify-center">
                  <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                </div>
              </div>
            </div>

            <h3 className="font-serif text-xl sm:text-2xl font-bold text-amber-200 mb-2">
              Xin chào, {user?.name || "Học Giả"}! Mình là V AI
            </h3>
            <p className="text-xs sm:text-sm text-stone-300 max-w-md mx-auto leading-relaxed mb-6">
              Người bạn đồng hành AI thông minh của riêng bạn tại <strong>Virtual Study Room</strong>. Hãy gửi câu hỏi, đoạn mã hoặc bài tập bạn cần trợ giúp nhé!
            </p>

            {/* 4 Quick Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {QUICK_PROMPTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-3 rounded-xl bg-[#1f1915]/80 hover:bg-[#28211b] border border-amber-500/20 hover:border-amber-400/50 transition-all text-left group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 group-hover:scale-110 transition-transform">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-serif font-bold text-amber-200 group-hover:text-amber-100">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 line-clamp-2 leading-snug">
                      {item.prompt}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Trường hợp: Hiển thị các tin nhắn đã trao đổi */
          <>
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2.5 max-w-[88%] sm:max-w-[82%]",
                    isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  {/* Avatar cạnh tin nhắn */}
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-400 via-rose-500 to-cyan-400 shrink-0 self-end mb-1">
                      <div className="w-full h-full rounded-full bg-[#181310] flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      </div>
                    </div>
                  )}

                  {/* Bubble Tin nhắn */}
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm transition-all",
                      isUser
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-medium rounded-br-xs shadow-amber-500/20"
                        : "bg-[#211a15] text-[#f5ede3] border border-amber-500/20 rounded-bl-xs"
                    )}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    ) : (
                      <div className="prose-invert text-xs sm:text-sm">
                        <MarkdownContent content={msg.content} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Trạng thái V AI đang suy nghĩ */}
            {loading && (
              <div className="flex items-center gap-2.5 mr-auto max-w-[80%] animate-in fade-in">
                <div className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-400 via-rose-500 to-cyan-400 shrink-0">
                  <div className="w-full h-full rounded-full bg-[#181310] flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                  </div>
                </div>
                <div className="px-3.5 py-2 rounded-2xl bg-[#211a15] border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span className="font-serif">V AI đang suy nghĩ câu trả lời...</span>
                </div>
              </div>
            )}

            {/* Thông báo lỗi nếu có */}
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mx-auto max-w-md">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="flex-1">{error}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── THANH NHẬP LIỆU GỬI CÂU HỎI ────────────────────────────────────────── */}
      {isVip && (
        <div className="p-2.5 sm:p-3 bg-[#1a1410]/95 border-t border-amber-900/30 backdrop-blur-md shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 relative"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Nhắn tin với V AI (Hỏi bài, giải thích code, tóm tắt...)..."
              className="flex-1 bg-[#231b16] border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#f5ede3] placeholder:text-stone-400/80 focus:outline-none focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/40 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-amber-400/70 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-stone-950 font-bold hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-amber-500/20 cursor-pointer shrink-0"
              title="Gửi câu hỏi cho V AI"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
              ) : (
                <Send className="w-4 h-4 text-stone-950" />
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default VAIChatSection;
