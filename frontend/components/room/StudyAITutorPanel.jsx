"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Trash2,
  Bot,
  User,
  Lightbulb,
  Code2,
  FileText,
  Languages,
  HelpCircle,
  Loader2,
  AlertCircle,
  RotateCcw,
  Crown,
  Lock,
  CheckCircle2,
  Zap,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aiApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  const [isProRequiredError, setIsProRequiredError] = useState(false);

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
        if (e.detail?.isProRequired) {
          setIsProRequiredError(true);
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

  // Cuộn xuống tin nhắn mới nhất
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

  // Gửi câu hỏi cho AI Tutor (Chạy ngầm độc lập với việc đóng/mở panel)
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

    // Lấy lịch sử mới nhất từ sessionStorage để tránh mất dữ liệu
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

    // Gọi API bất đồng bộ độc lập: dù click ra ngoài hoặc unmount panel thì tiến trình vẫn hoàn tất và lưu vào storage
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

        const isProReq =
          err?.response?.data?.isProRequired ||
          err?.response?.status === 403;
        const errMsg =
          err?.response?.data?.message ||
          err?.message ||
          "Đã có lỗi xảy ra khi kết nối với AI Tutor.";

        window.dispatchEvent(
          new CustomEvent("vsr:ai-reply-error", {
            detail: { roomCode, error: errMsg, isProRequired: isProReq },
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

  // GIAO DIỆN KHÓA VIP (Dành cho thành viên chưa nâng cấp gói Pro)
  if (!isPro) {
    return (
      <div
        className={cn(
          "flex h-full flex-col bg-zinc-950/70 backdrop-blur-2xl text-zinc-100",
          className
        )}
      >
        {/* Header thông báo đặc quyền */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 text-amber-400 shadow-sm">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold tracking-tight text-zinc-100">
                  Study AI Tutor
                </span>
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-bold text-amber-400 border border-amber-500/30">
                  VIP ONLY
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                {roomSubject ? `Chủ đề: ${roomSubject}` : "Trợ lý học tập thông minh"}
              </p>
            </div>
          </div>
        </div>

        {/* Thân giao diện giới thiệu tính năng VIP */}
        <div className="flex-1 overflow-y-auto px-5 py-6 scrollbar-quiet">
          <div className="mx-auto flex max-w-sm flex-col items-center text-center">
            {/* Crown Icon Glow Badge */}
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500/20 via-amber-400/20 to-yellow-500/10 border border-amber-500/40 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
              <Crown className="h-8 w-8 fill-amber-400/20" />
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 border border-zinc-900 text-[10px] text-white shadow-xs">
                <Sparkles className="h-3 w-3" />
              </span>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/20">
              Đặc quyền thành viên VIP
            </span>

            <h3 className="mt-2.5 text-base font-bold tracking-tight text-zinc-100">
              Trợ lý Học tập AI Gemini Flash
            </h3>

            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              Người bạn đồng hành 24/7 trực tiếp trong phòng học, hỗ trợ giải đáp bài tập, rà soát lỗi code và củng cố kiến thức theo thời gian thực.
            </p>

            {/* Danh sách 4 đặc quyền nổi bật */}
            <div className="mt-5 w-full space-y-2.5 text-left">
              <div className="flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 transition hover:border-violet-500/30">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">
                    Giải đáp bài tập & Khái niệm
                  </h4>
                  <p className="text-[11px] leading-tight text-zinc-400 mt-0.5">
                    Phân tích đa chiều, giải thích dễ hiểu theo ngữ cảnh môn học.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 transition hover:border-violet-500/30">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Code2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">
                    Phát hiện & Sửa lỗi Code
                  </h4>
                  <p className="text-[11px] leading-tight text-zinc-400 mt-0.5">
                    Hỗ trợ đa ngôn ngữ (JS, Python, C++...), tô màu cú pháp chuẩn.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 transition hover:border-violet-500/30">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">
                    Tóm tắt bài học & Tạo ghi chú
                  </h4>
                  <p className="text-[11px] leading-tight text-zinc-400 mt-0.5">
                    Đúc kết luận điểm cốt lõi thành bullet points ngắn gọn dễ nhớ.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 transition hover:border-violet-500/30">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-200">
                    Bộ câu hỏi trắc nghiệm phản xạ
                  </h4>
                  <p className="text-[11px] leading-tight text-zinc-400 mt-0.5">
                    Tự sinh 3 câu hỏi trắc nghiệm kèm giải thích để tự kiểm tra.
                  </p>
                </div>
              </div>
            </div>

            {/* Khối CTA nâng cấp */}
            <div className="mt-6 w-full rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-amber-500/5 p-4 shadow-inner">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                <span>Gói thành viên VIP (Pro)</span>
                <span className="font-bold text-amber-300">Từ 49.000đ / tháng</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 text-left">
                Mở khóa không giới hạn AI Tutor, Chép lời tự động (Live Transcription) và huy hiệu VIP độc quyền.
              </p>

              <Button
                type="button"
                onClick={onUpgradeClick}
                className="mt-3.5 w-full h-10 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold shadow-lg shadow-amber-500/20 text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Crown className="h-4 w-4 fill-zinc-950" />
                <span>Nâng cấp VIP ngay</span>
                <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-zinc-950/70 backdrop-blur-2xl text-zinc-100",
        className
      )}
    >
      {/* Header thanh công cụ AI */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 text-violet-400 shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold tracking-tight text-zinc-100">
                Study AI Tutor
              </span>
              <span className="rounded-full bg-violet-500/10 px-1.5 py-0.2 text-[9px] font-medium text-violet-400 border border-violet-500/20">
                Gemini
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-bold text-amber-400 border border-amber-500/30">
                <Crown className="h-2.5 w-2.5 fill-amber-400" />
                <span>VIP</span>
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">
              {roomSubject ? `Chủ đề: ${roomSubject}` : "Trợ lý học tập thông minh"}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-zinc-400 transition hover:bg-zinc-800/80 hover:text-rose-400"
            title="Xóa toàn bộ lịch sử trò chuyện"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        )}
      </div>

      {/* Danh sách tin nhắn */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-quiet"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-400 shadow-inner">
              <Bot className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-zinc-100">
              Trò chuyện cùng Gemini AI
            </h4>
            <p className="mt-1 max-w-[280px] text-xs leading-relaxed text-zinc-400">
              Trợ lý học tập thông minh luôn sẵn sàng giải đáp thắc mắc, phân tích mã nguồn và tóm tắt kiến thức.
            </p>

            <div className="mt-5 grid w-full max-w-xs grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    `Hãy gợi ý cho tôi 3 phương pháp ghi nhớ kiến thức hiệu quả nhất trong môn học này.`
                  )
                }
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5 text-left text-xs text-zinc-300 transition hover:border-violet-500/40 hover:bg-zinc-900 hover:text-zinc-100"
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
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5 text-left text-xs text-zinc-300 transition hover:border-violet-500/40 hover:bg-zinc-900 hover:text-zinc-100"
              >
                ❓ Tạo 3 câu hỏi trắc nghiệm ôn tập
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    `Hãy hướng dẫn các bước phân tích và gỡ lỗi (debug) một đoạn code hiệu quả.`
                  )
                }
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5 text-left text-xs text-zinc-300 transition hover:border-violet-500/40 hover:bg-zinc-900 hover:text-zinc-100"
              >
                💻 Cách phân tích và gỡ lỗi code hiệu quả
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
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-400 mt-0.5">
                    <Sparkles className="h-3 w-3" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs transition-all",
                    isUser
                      ? "rounded-br-xs bg-violet-600 text-white selection:bg-violet-800"
                      : "rounded-bl-xs border border-zinc-800/80 bg-zinc-900/80 text-zinc-200"
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
                      isUser ? "text-violet-200/80 justify-end" : "text-zinc-500"
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
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 mt-0.5">
                    <User className="h-3 w-3" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Hiệu ứng suy nghĩ (Typing indicator) */}
        {loading && (
          <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-400 mt-0.5">
              <Sparkles className="h-3 w-3 animate-pulse" />
            </div>
            <div className="rounded-2xl rounded-bl-xs border border-zinc-800/80 bg-zinc-900/80 px-3.5 py-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" />
                </span>
                <span className="text-[11px] font-medium text-zinc-400">
                  Study AI Tutor đang giải đáp...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Thông báo lỗi nếu có */}
        {error && (
          <div
            className={cn(
              "rounded-xl border p-3 text-xs",
              isProRequiredError
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            )}
          >
            <div className="flex items-start gap-2">
              {isProRequiredError ? (
                <Crown className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="flex-1">
                <span>{error}</span>
                {isProRequiredError && onUpgradeClick && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={onUpgradeClick}
                    className="mt-2 h-7 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-bold text-[11px] px-3 hover:brightness-110"
                  >
                    Nâng cấp lại gói VIP
                  </Button>
                )}
              </div>
              {!isProRequiredError && (
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 transition"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Thử lại</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Khung nhập tin nhắn */}
      <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-950/90 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex flex-col gap-2 rounded-xl border border-zinc-800/90 bg-zinc-900/70 p-2 focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/30 transition-all"
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi Gemini bất cứ điều gì về bài học, bài tập, code..."
            disabled={loading}
            className="w-full resize-none bg-transparent px-1.5 py-1 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50"
          />

          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/50">
            <span className="text-[10px] text-zinc-500">
              Nhấn <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.2 font-mono text-[9px] text-zinc-400">Enter</kbd> để gửi, <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.2 font-mono text-[9px] text-zinc-400">Shift+Enter</kbd> xuống dòng
            </span>

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                input.trim() && !loading
                  ? "bg-violet-600 text-white shadow-sm hover:bg-violet-500 active:scale-95"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              )}
              title="Gửi câu hỏi"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
