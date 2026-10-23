"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Trash2,
  Bot,
  User,
  Loader2,
  AlertCircle,
  RotateCcw,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aiApi } from "@/lib/api";
import { MarkdownContent } from "./MarkdownContent";

// Quản lý các request AI đang chạy ngầm độc lập với vòng đời component
const activeAiRequests = new Map(); // roomKey -> boolean

export function StudyAITutorPanel({
  roomCode,
  roomSubject = "",
  isPro = false,
  onUpgradeClick,
  className,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const roomKey = roomCode || "default";
  const storageKey = `vsr_ai_history_${roomKey}`;
  const pendingKey = `vsr_ai_pending_${roomKey}`;

  // Tự động tải lịch sử và đồng bộ trạng thái đang xử lý từ sessionStorage
  const syncFromStorage = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          }
        }
        const isPending =
          sessionStorage.getItem(pendingKey) === "true" ||
          activeAiRequests.get(roomKey) === true;
        setLoading(Boolean(isPending));
      }
    } catch (e) {
      console.warn("[StudyAITutor] Không thể đọc lịch sử từ sessionStorage:", e);
    }
  }, [storageKey, pendingKey, roomKey]);

  useEffect(() => {
    syncFromStorage();

    const handleReplyDone = (e) => {
      if (!e.detail?.roomCode || e.detail.roomCode === roomCode) {
        syncFromStorage();
        setLoading(false);
      }
    };

    const handleReplyError = (e) => {
      if (!e.detail?.roomCode || e.detail.roomCode === roomCode) {
        setLoading(false);
        if (e.detail?.error) {
          setError(e.detail.error);
        }
      }
    };

    window.addEventListener("vsr:ai-reply-done", handleReplyDone);
    window.addEventListener("vsr:ai-reply-error", handleReplyError);

    return () => {
      window.removeEventListener("vsr:ai-reply-done", handleReplyDone);
      window.removeEventListener("vsr:ai-reply-error", handleReplyError);
    };
  }, [syncFromStorage, roomCode]);

  // Tự động cuộn xuống tin nhắn mới nhất
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Xóa sạch lịch sử hội thoại
  const handleClearHistory = () => {
    setMessages([]);
    setError(null);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(storageKey);
        sessionStorage.removeItem(pendingKey);
      }
      activeAiRequests.delete(roomKey);
    } catch (_) {}
  };

  // Gửi câu hỏi cho AI Tutor
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setError(null);
    setInput("");

    const userMessage = {
      id: `msg_u_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    let current = [];
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) current = JSON.parse(saved);
    } catch (_) {}
    if (!Array.isArray(current)) current = messages;

    const nextMessages = [...current, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    // Lưu ngay tin nhắn của user và đánh dấu trạng thái pending
    if (typeof window !== "undefined") {
      sessionStorage.setItem(storageKey, JSON.stringify(nextMessages));
      sessionStorage.setItem(pendingKey, "true");
    }
    activeAiRequests.set(roomKey, true);

    const historyPayload = nextMessages.slice(-8).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      content: m.content,
    }));

    // Gọi API Gemini Tutor
    aiApi
      .askTutor({
        message: text,
        history: historyPayload,
        contextType: "GENERAL_QA",
        roomSubject: roomSubject || "Tự học",
      })
      .then((res) => {
        const replyText = res?.data?.reply || res?.reply;
        if (!replyText) {
          throw new Error("Không nhận được câu trả lời từ AI Tutor.");
        }

        const aiMessage = {
          id: `msg_a_${Date.now()}`,
          role: "assistant",
          content: replyText,
          model: res?.data?.modelUsed,
          timestamp: new Date().toISOString(),
        };

        // Lưu câu trả lời của AI vào sessionStorage
        let latest = [];
        try {
          const raw = sessionStorage.getItem(storageKey);
          if (raw) latest = JSON.parse(raw);
        } catch (_) {}
        if (!latest.some((m) => m.id === aiMessage.id)) {
          latest.push(aiMessage);
          sessionStorage.setItem(storageKey, JSON.stringify(latest));
        }

        sessionStorage.removeItem(pendingKey);
        activeAiRequests.delete(roomKey);

        window.dispatchEvent(
          new CustomEvent("vsr:ai-reply-done", {
            detail: { roomCode, aiMessage },
          })
        );
      })
      .catch((err) => {
        console.error("[StudyAITutor] Lỗi gọi API:", err);
        sessionStorage.removeItem(pendingKey);
        activeAiRequests.delete(roomKey);

        const errMsg =
          err?.response?.data?.message ||
          err?.message ||
          "Đã có lỗi xảy ra khi kết nối với AI Tutor.";

        window.dispatchEvent(
          new CustomEvent("vsr:ai-reply-error", {
            detail: { roomCode, error: errMsg },
          })
        );
      });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0 bg-[#141210] text-[#f5ede3] select-none overflow-hidden",
        className
      )}
    >
      {/* Header thanh công cụ AI Tutor */}
      <div className="flex shrink-0 items-center justify-between border-b border-amber-900/30 bg-[#161311] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/40 text-amber-400 shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#f5ede3]">
                Study AI Tutor
              </span>
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-medium text-amber-300 border border-amber-500/20">
                Gemini
              </span>
              {isPro && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/40">
                  <Crown className="h-2.5 w-2.5 fill-amber-400" />
                  <span>VIP</span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#8C7E72]">
              {roomSubject ? `Chủ đề: ${roomSubject}` : "Trợ lý học tập thông minh"}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-[#8C7E72] hover:bg-stone-800/80 hover:text-rose-400 transition cursor-pointer"
            title="Xóa toàn bộ lịch sử trò chuyện"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        )}
      </div>

      {/* VÙNG LỊCH SỬ CHAT: flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-quiet"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center px-2 my-auto">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-inner">
              <Bot className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h4 className="mt-2 text-xs font-semibold text-[#f5ede3]">
              Trò chuyện cùng Study AI Tutor
            </h4>
            <p className="mt-1 max-w-[280px] text-[11px] leading-relaxed text-[#a89b8d]">
              Trợ lý học tập luôn sẵn sàng giải đáp thắc mắc, phân tích tài liệu và tóm tắt kiến thức.
            </p>

            <div className="mt-3 grid w-full max-w-xs grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    `Hãy gợi ý cho tôi 3 phương pháp ghi nhớ kiến thức hiệu quả nhất trong môn học này.`
                  )
                }
                className="rounded-xl border border-stone-800 bg-[#1c1815] p-2 text-left text-xs text-[#d8c8b4] hover:border-amber-500/40 hover:bg-[#25201c] hover:text-[#f5ede3] transition cursor-pointer"
              >
                💡 Gợi ý 3 phương pháp ghi nhớ hiệu quả
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    `Tạo 3 câu hỏi trắc nghiệm ôn tập nhanh về chủ đề: ${roomSubject || "Tổng quan"}`
                  )
                }
                className="rounded-xl border border-stone-800 bg-[#1c1815] p-2 text-left text-xs text-[#d8c8b4] hover:border-amber-500/40 hover:bg-[#25201c] hover:text-[#f5ede3] transition cursor-pointer"
              >
                ❓ Tạo 3 câu hỏi trắc nghiệm ôn tập
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    `Hãy hướng dẫn các bước phân tích và giải quyết bài tập hiệu quả.`
                  )
                }
                className="rounded-xl border border-stone-800 bg-[#1c1815] p-2 text-left text-xs text-[#d8c8b4] hover:border-amber-500/40 hover:bg-[#25201c] hover:text-[#f5ede3] transition cursor-pointer"
              >
                📝 Các bước giải bài tập hiệu quả
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2.5 text-xs",
                  isUser ? "justify-end" : "justify-start"
                )}
              >
                {!isUser && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 mt-0.5">
                    <Sparkles className="h-3 w-3" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs transition-all",
                    isUser
                      ? "rounded-br-xs bg-gradient-to-r from-amber-600 to-amber-700 text-[#fff7df]"
                      : "rounded-bl-xs border border-stone-800 bg-[#1c1815] text-[#f5ede3]"
                  )}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-xs">
                      {msg.content}
                    </p>
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )}

                  <div
                    className={cn(
                      "mt-1.5 flex items-center gap-1.5 text-[9px]",
                      isUser ? "text-amber-200/80 justify-end" : "text-[#8C7E72]"
                    )}
                  >
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {!isUser && msg.model && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{msg.model.replace("models/", "")}</span>
                      </>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-stone-700 bg-stone-800 text-[#d8c8b4] mt-0.5">
                    <User className="h-3 w-3" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Hiệu ứng AI đang suy nghĩ */}
        {loading && (
          <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 mt-0.5">
              <Sparkles className="h-3 w-3 animate-pulse" />
            </div>
            <div className="rounded-2xl rounded-bl-xs border border-amber-900/40 bg-[#1c1815] px-3.5 py-2.5 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" />
                </span>
                <span className="text-[11px] font-medium text-amber-200/90">
                  Study AI Tutor đang suy nghĩ...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Thông báo lỗi nếu có */}
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => handleSendMessage()}
                className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Thử lại</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BỔ SUNG KHỐI NHẬP LIỆU Ở ĐÁY: p-3 border-t border-amber-900/30 bg-[#161311] */}
      <div className="shrink-0 p-3 border-t border-amber-900/30 bg-[#161311]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center gap-2 rounded-xl border border-amber-900/40 bg-[#1c1815] p-2 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/40 transition-all"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi Study AI Tutor bất kỳ điều gì... (Nhấn Enter để gửi)"
            disabled={loading}
            className="flex-1 resize-none bg-transparent px-2 py-1 text-xs leading-relaxed text-[#f5ede3] placeholder:text-[#8C7E72] focus:outline-none disabled:opacity-50 max-h-24 scrollbar-quiet"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-medium transition-all",
              input.trim() && !loading
                ? "bg-amber-500 text-stone-950 hover:bg-amber-400 active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
                : "bg-stone-800 text-stone-500 cursor-not-allowed"
            )}
            title="Gửi câu hỏi"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-stone-950" />
            ) : (
              <Send className="h-4 w-4 text-stone-950 fill-stone-950" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default StudyAITutorPanel;
