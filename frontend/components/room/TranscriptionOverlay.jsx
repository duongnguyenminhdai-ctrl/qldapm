"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Crown,
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  Mic,
  ShieldCheck,
  FileText,
  Sparkles,
  Loader2,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aiApi } from "@/lib/api";
import { MarkdownContent } from "./MarkdownContent";

/**
 * TranscriptionOverlay — Bảng chép lời trực tiếp (Live Transcription)
 * Tích hợp Google Gemini Multimodal AI:
 * 1. Chép lời đa người nói (Bản thân và các thành viên khác trong phòng).
 * 2. Phân loại đoạn chép lời bởi Gemini AI chuẩn xác ngữ pháp tiếng Việt.
 * 3. Nút "Tóm tắt AI" tích hợp Gemini tổng hợp nhanh nội dung buổi học & Action items.
 */
export function TranscriptionOverlay({
  isActive,
  roomCode = "",
  userName = "Bạn",
  userId = "",
  socket = null,
  isSessionEnded = false,
  onClose,
}) {
  const [history, setHistory] = useState([]);
  const [interimData, setInterimData] = useState(null); // { speakerId, speakerName, text }
  const [isCopied, setIsCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Trạng thái tóm tắt buổi học bằng Gemini AI
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [isSummaryCopied, setIsSummaryCopied] = useState(false);

  const containerRef = useRef(null);
  const storageKey = `vsr_transcript_${roomCode || "general"}`;

  // Phục hồi lịch sử đã lưu trong LocalStorage khi mount (chống mất dữ liệu khi F5)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistory(parsed);
        }
      }
    } catch (_) {}
  }, [storageKey]);

  // Lưu vào LocalStorage mỗi khi history thay đổi
  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(history));
      } catch (_) {}
    }
  }, [history, storageKey]);

  // Lắng nghe bản chép lời realtime từ Socket.io và Local Event (cả bản thân lẫn người khác)
  useEffect(() => {
    // Nhận đoạn chép lời hoàn chỉnh (Final Segment) từ bất kỳ ai trong phòng
    const handleReceiveTranscript = (segment) => {
      if (!segment || !segment.text) return;
      const isMe =
        String(segment.userId || segment.speakerId || "") === String(userId || "") ||
        segment.speakerName === "Bạn";

      const formatted = {
        id: segment.id || `ts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        text: segment.text,
        speakerName: isMe ? "Bạn" : segment.speakerName || "Thành viên",
        speakerId: segment.userId || segment.speakerId,
        aiPowered: Boolean(segment.aiPowered),
        time:
          segment.time ||
          new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
      };

      setHistory((prev) => {
        // Nếu đã có item trùng ID thì bỏ qua
        if (prev.some((h) => h.id === formatted.id)) return prev;

        // Nếu đây là segment Gemini chuẩn xác và trước đó có 1 segment chưa qua AI của cùng 1 người trong vòng 6s:
        // Cập nhật nâng cấp segment đó để tránh trùng lắp
        if (formatted.aiPowered) {
          const recentIndex = prev.findIndex(
            (h) =>
              !h.aiPowered &&
              String(h.speakerId) === String(formatted.speakerId)
          );
          if (recentIndex !== -1 && prev.length - recentIndex <= 2) {
            const copy = [...prev];
            copy[recentIndex] = formatted;
            return copy;
          }
        }

        return [...prev, formatted];
      });

      // Xóa preview đang nói nếu người này vừa hoàn thành câu
      setInterimData((prev) => {
        if (prev && String(prev.speakerId) === String(formatted.speakerId)) {
          return null;
        }
        return prev;
      });
    };

    // Nhận đoạn thoại đang nói dở (Interim Text)
    const handleReceiveInterim = (data) => {
      if (!data || !data.text || !data.text.trim()) {
        setInterimData((prev) => {
          if (prev && String(prev.speakerId) === String(data?.speakerId || data?.userId)) {
            return null;
          }
          return prev;
        });
        return;
      }
      const isMe = String(data.speakerId || data.userId || "") === String(userId || "");
      setInterimData({
        speakerId: data.speakerId || data.userId,
        speakerName: isMe ? "Bạn" : data.speakerName || "Thành viên",
        text: data.text.trim(),
      });
    };

    // Nhận local event tức thì khi chính mình nói (0ms)
    const handleLocalSegment = (e) => {
      if (e.detail) {
        handleReceiveTranscript(e.detail);
      }
    };

    const handleLocalInterim = (e) => {
      if (e.detail) {
        if (!e.detail.text) {
          setInterimData((prev) => (prev?.speakerId === userId ? null : prev));
        } else {
          setInterimData({
            speakerId: userId,
            speakerName: "Bạn",
            text: e.detail.text,
          });
        }
      }
    };

    if (socket) {
      socket.off("room:receive-transcript", handleReceiveTranscript);
      socket.on("room:receive-transcript", handleReceiveTranscript);

      socket.off("room:receive-transcript-interim", handleReceiveInterim);
      socket.on("room:receive-transcript-interim", handleReceiveInterim);
    }

    window.addEventListener("vsr:local-transcript-segment", handleLocalSegment);
    window.addEventListener("vsr:local-transcript-interim", handleLocalInterim);

    return () => {
      if (socket) {
        socket.off("room:receive-transcript", handleReceiveTranscript);
        socket.off("room:receive-transcript-interim", handleReceiveInterim);
      }
      window.removeEventListener("vsr:local-transcript-segment", handleLocalSegment);
      window.removeEventListener("vsr:local-transcript-interim", handleLocalInterim);
    };
  }, [socket, userId]);

  // Tự động cuộn xuống dòng mới nhất
  useEffect(() => {
    if (!isMinimized && containerRef.current && !summaryData) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [history, interimData, isMinimized, summaryData]);

  // Sao chép toàn bộ nội dung chép lời
  const handleCopyAll = useCallback(() => {
    if (history.length === 0 && !interimData?.text) return;

    let fullText = `=== BẢN CHÉP LỜI PHÒNG HỌC ${roomCode} ===\n`;
    fullText += `Ngày tạo: ${new Date().toLocaleString("vi-VN")}\n\n`;

    history.forEach((h) => {
      const isMe = String(h.speakerId || "") === String(userId || "") || h.speakerName === "Bạn";
      const name = isMe ? "Bạn" : h.speakerName || "Thành viên";
      const badge = h.aiPowered ? " [Gemini AI]" : "";
      fullText += `[${h.time}] ${name}${badge}: ${h.text}\n\n`;
    });

    if (interimData?.text) {
      fullText += `[Đang nói] ${interimData.speakerName}: ${interimData.text}\n`;
    }

    navigator.clipboard.writeText(fullText.trim()).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  }, [history, interimData, roomCode, userId]);

  // Tải file .txt bản chép lời về máy tính
  const handleDownloadTxt = useCallback(() => {
    if (history.length === 0 && !interimData?.text) return;

    const now = new Date();
    const dateFormatted = now.toLocaleDateString("vi-VN").replace(/\//g, "-");
    const timeFormatted = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    let content = `=================================================================\n`;
    content += `BẢN CHÉP LỜI PHÒNG HỌC: ${roomCode || "VIRTUAL_STUDY_ROOM"}\n`;
    content += `Thời gian xuất: ${timeFormatted} ngày ${dateFormatted}\n`;
    content += `Tổng số câu đã chép: ${history.length}\n`;
    content += `=================================================================\n\n`;

    history.forEach((h) => {
      const isMe = String(h.speakerId || "") === String(userId || "") || h.speakerName === "Bạn";
      const name = isMe ? "Bạn" : h.speakerName || "Thành viên";
      const badge = h.aiPowered ? " (Gemini AI)" : "";
      content += `[${h.time}] ${name}${badge}:\n${h.text}\n\n`;
    });

    if (interimData?.text) {
      content += `[Đang phát biểu] ${interimData.speakerName}:\n${interimData.text}\n\n`;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ban-chep-loi-${roomCode || "phong-hoc"}-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [history, interimData, roomCode, userId]);

  // Kích hoạt tóm tắt biên bản bằng Google Gemini AI
  const handleSummarizeWithGemini = useCallback(async () => {
    if (history.length === 0 || isSummarizing) return;

    try {
      setIsSummarizing(true);
      let fullTranscript = "";
      history.forEach((h) => {
        const isMe = String(h.speakerId || "") === String(userId || "") || h.speakerName === "Bạn";
        const name = isMe ? "Bạn" : h.speakerName || "Thành viên";
        fullTranscript += `[${h.time}] ${name}: ${h.text}\n`;
      });

      const res = await aiApi.summarizeTranscript({
        transcriptText: fullTranscript,
        roomSubject: roomCode,
      });

      if (res?.data?.summary) {
        setSummaryData(res.data.summary);
      }
    } catch (err) {
      console.error("[Transcription] Lỗi tóm tắt Gemini:", err);
      alert("Không thể tạo tóm tắt bằng Gemini: " + (err.message || "Lỗi máy chủ"));
    } finally {
      setIsSummarizing(false);
    }
  }, [history, isSummarizing, roomCode, userId]);

  // Nếu không active và không ở trạng thái kết thúc phiên họp có dữ liệu, hoặc user đã đóng
  if ((!isActive && !isSessionEnded) || isDismissed) return null;
  // Nếu phiên họp kết thúc nhưng không có nội dung chép lời nào thì ẩn đi
  if (isSessionEnded && history.length === 0 && !interimData?.text) return null;

  return (
    <div
      className={cn(
        "fixed bottom-24 right-5 sm:right-6 z-40 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-5",
        summaryData ? "w-[360px] sm:w-[460px]" : "w-[330px] sm:w-[400px]"
      )}
    >
      <div className="relative flex flex-col rounded-2xl border border-[#3a3128] bg-[#1c1815]/95 shadow-2xl backdrop-blur-sm overflow-hidden">
        {/* Banner cảnh báo an toàn khi phiên họp kết thúc */}
        {isSessionEnded && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-[#c3a47b]/20 via-[#c3a47b]/10 to-transparent border-b border-[#3a3128] px-3.5 py-2 text-xs text-[#e8cca4]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#c3a47b]" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold">Phiên họp đã kết thúc!</span>
              <p className="text-[11px] text-[#d8c8b4] truncate">
                Bản chép lời được bảo toàn để bạn sao chép hoặc tải .txt
              </p>
            </div>
            <button
              onClick={() => {
                setIsDismissed(true);
                if (onClose) onClose();
              }}
              className="text-[#e8cca4]/70 hover:text-[#f5ede3] p-0.5 rounded cursor-pointer"
              title="Đóng bảng chép lời"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Header bảng chép lời */}
        <div className="flex items-center justify-between border-b border-[#3a3128] px-3 py-2 bg-[#181513]/90">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-1 rounded-full bg-[#c3a47b] px-1.5 py-0.5 text-[9px] font-bold text-[#161311] shadow-xs">
              <Crown className="h-2.5 w-2.5" />
              VIP
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs font-serif font-semibold text-[#f5ede3] truncate">
                {summaryData ? "Tóm tắt buổi học" : "Bản chép lời"}
              </span>
              {!isSessionEnded && !summaryData && (
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c3a47b] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c3a47b]" />
                </span>
              )}
            </div>
          </div>

          {/* Action buttons: Tóm tắt AI, Sao chép & Tải .txt */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Nút Tóm tắt Gemini AI */}
            {!summaryData && (
              <button
                type="button"
                onClick={handleSummarizeWithGemini}
                disabled={history.length === 0 || isSummarizing}
                className="flex items-center gap-1 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/40 px-2 py-1 text-[11px] font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Dùng Google Gemini AI tóm tắt buổi học & lập kế hoạch hành động"
              >
                {isSummarizing ? (
                  <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                ) : (
                  <Sparkles className="h-3 w-3 text-amber-400" />
                )}
                <span>Tóm tắt AI</span>
              </button>
            )}

            {/* Nút Sao chép */}
            <button
              type="button"
              onClick={summaryData ? () => {
                navigator.clipboard.writeText(summaryData).then(() => {
                  setIsSummaryCopied(true);
                  setTimeout(() => setIsSummaryCopied(false), 2000);
                });
              } : handleCopyAll}
              disabled={history.length === 0 && !interimData?.text}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                (isCopied || isSummaryCopied)
                  ? "bg-[#c3a47b]/20 text-[#e8cca4] border border-[#c3a47b]/40"
                  : "bg-[#201b18] text-[#d8c8b4] hover:bg-[#26201c] hover:text-[#f5ede3] border border-[#3a3128]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Sao chép vào bộ nhớ tạm"
            >
              {(isCopied || isSummaryCopied) ? (
                <>
                  <Check className="h-3 w-3 text-[#c3a47b]" />
                  <span>Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-[#a89b8d]" />
                  <span className="hidden sm:inline">Sao chép</span>
                </>
              )}
            </button>

            {/* Nút Tải .txt */}
            {!summaryData && (
              <button
                type="button"
                onClick={handleDownloadTxt}
                disabled={history.length === 0 && !interimData?.text}
                className="flex items-center gap-1 rounded-lg bg-[#201b18] text-[#d8c8b4] hover:bg-[#26201c] hover:text-[#f5ede3] border border-[#3a3128] px-2 py-1 text-[11px] font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Tải bản chép lời dạng file văn bản (.txt)"
              >
                <Download className="h-3 w-3 text-[#c3a47b]" />
                <span className="hidden sm:inline">Tải .txt</span>
              </button>
            )}

            {/* Nút Quay lại xem chép lời nếu đang ở chế độ xem tóm tắt */}
            {summaryData && (
              <button
                type="button"
                onClick={() => setSummaryData(null)}
                className="rounded-lg bg-[#201b18] border border-[#3a3128] px-2 py-1 text-[11px] text-[#d8c8b4] hover:text-[#f5ede3] transition cursor-pointer"
              >
                Xem chép lời
              </button>
            )}

            {/* Thu nhỏ / Mở rộng */}
            <button
              type="button"
              onClick={() => setIsMinimized((v) => !v)}
              className="rounded-lg p-1 text-[#a89b8d] hover:bg-[#201b18] hover:text-[#f5ede3] transition cursor-pointer"
              title={isMinimized ? "Mở rộng" : "Thu nhỏ"}
            >
              {isMinimized ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Nội dung bản chép lời hoặc Bản tóm tắt Gemini AI */}
        {!isMinimized && (
          <div
            ref={containerRef}
            className="max-h-[260px] min-h-[90px] overflow-y-auto p-3 space-y-2 text-xs scrollbar-quiet"
          >
            {summaryData ? (
              <div className="rounded-xl border border-amber-500/30 bg-[#201b18] p-3 text-xs leading-relaxed text-[#f5ede3] select-text">
                <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-amber-500/20 text-amber-300 font-semibold text-[11px]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Báo cáo tóm tắt bởi Gemini Flash</span>
                </div>
                <MarkdownContent content={summaryData} />
              </div>
            ) : history.length === 0 && !interimData?.text ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-[#75695e]">
                <Mic className="h-5 w-5 mb-1.5 opacity-40 animate-pulse text-[#c3a47b]" />
                <p className="italic text-[11px]">
                  {isSessionEnded
                    ? "Không có bản chép lời nào được ghi lại."
                    : "Đang lắng nghe phòng học... Bản thân hoặc người khác nói sẽ tự động chép tại đây."}
                </p>
              </div>
            ) : (
              <>
                {history.map((item) => {
                  const isMe =
                    String(item.speakerId || "") === String(userId || "") ||
                    item.speakerName === "Bạn";

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "group rounded-xl border p-2 transition",
                        isMe
                          ? "bg-[#29231f] border-[#c3a47b]/40 text-[#f5ede3]"
                          : "bg-[#201b18] border-[#3a3128] text-[#e8e0d5]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1 text-[10px]">
                        <span
                          className={cn(
                            "font-semibold flex items-center gap-1.5",
                            isMe ? "text-[#e8cca4]" : "text-[#c3a47b]"
                          )}
                        >
                          <span>{isMe ? "Bạn" : item.speakerName}</span>
                          {item.aiPowered && (
                            <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[8px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Sparkles className="h-2 w-2" />
                              Gemini
                            </span>
                          )}
                        </span>
                        <span className="text-[#75695e]">{item.time}</span>
                      </div>
                      <p className="text-xs leading-relaxed select-text cursor-text break-words">
                        {item.text}
                      </p>
                    </div>
                  );
                })}

                {/* Đoạn thoại đang nói dở (interim preview) */}
                {interimData?.text && (
                  <div className="rounded-xl bg-[#201b18] border border-[#c3a47b]/40 p-2 animate-pulse">
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#c3a47b]">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#c3a47b] animate-ping" />
                      <span className="font-semibold">
                        {interimData.speakerName} (Đang nói...)
                      </span>
                    </div>
                    <p className="text-[#d8c8b4] text-xs italic leading-relaxed select-text cursor-text break-words">
                      {interimData.text}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer nhỏ gọn */}
        {!isMinimized && (
          <div className="flex items-center justify-between border-t border-[#3a3128] bg-[#181513] px-3 py-1.5 text-[10px] text-[#75695e]">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-[#75695e]" />
              <span>{history.length} đoạn phát biểu</span>
            </span>
            <span className="flex items-center gap-1 text-amber-400/80">
              <Sparkles className="h-2.5 w-2.5" />
              <span>Tích hợp Gemini Flash AI</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default TranscriptionOverlay;
