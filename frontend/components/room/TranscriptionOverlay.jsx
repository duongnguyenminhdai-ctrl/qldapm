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
} from "lucide-react";

/**
 * TranscriptionOverlay — Bảng chép lời trực tiếp (Live Transcription)
 * Được đặt ở góc dưới bên phải màn hình để tiện quan sát và sao chép.
 * Bảo toàn dữ liệu bản chép lời khi cuộc họp kết thúc.
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
  const [interimText, setInterimText] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const recognitionRef = useRef(null);
  const containerRef = useRef(null);
  const historyRef = useRef([]);
  historyRef.current = history;

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

  // Khởi chạy Web Speech API
  useEffect(() => {
    // Nếu không kích hoạt hoặc phiên họp đã đóng, tắt lắng nghe mic
    if (!isActive || isSessionEnded) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setInterimText("Trình duyệt không hỗ trợ Web Speech API.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let currentInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          const trimmed = text.trim();
          if (trimmed) {
            const timeStr = new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const newEntry = {
              id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              text: trimmed,
              speakerName: userName || "Thành viên",
              time: timeStr,
            };

            setHistory((prev) => {
              const next = [...prev, newEntry];
              // Bắn socket lên server để lưu vào bộ đệm riêng của tài khoản VIP này
              if (socket && socket.connected && roomCode) {
                socket.emit("room:transcript-segment", {
                  roomCode,
                  userId,
                  text: trimmed,
                  speakerName: userName || "Bạn",
                });
              }
              return next;
            });
          }
        } else {
          currentInterim += text;
        }
      }
      setInterimText(currentInterim);
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("[Transcription] Recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      // Tự động khởi động lại nếu vẫn đang bật
      if (recognitionRef.current && !isSessionEnded) {
        try {
          recognitionRef.current.start();
        } catch (_) {}
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.warn("[Transcription] Start error:", err);
    }

    return () => {
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch (_) {}
    };
  }, [isActive, isSessionEnded, roomCode, userName, socket]);

  // Tự động cuộn xuống dòng mới nhất
  useEffect(() => {
    if (!isMinimized && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [history, interimText, isMinimized]);

  // Sao chép toàn bộ nội dung chép lời
  const handleCopyAll = useCallback(() => {
    if (history.length === 0 && !interimText) return;

    let fullText = `=== BẢN CHÉP LỜI PHÒNG HỌC ${roomCode} ===\n`;
    fullText += `Ngày tạo: ${new Date().toLocaleString("vi-VN")}\n\n`;

    history.forEach((h) => {
      fullText += `[${h.time}] ${h.speakerName}: ${h.text}\n\n`;
    });

    if (interimText) {
      fullText += `[Đang nói] ${userName}: ${interimText}\n`;
    }

    navigator.clipboard.writeText(fullText.trim()).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  }, [history, interimText, roomCode, userName]);

  // Tải file .txt bản chép lời về máy tính
  const handleDownloadTxt = useCallback(() => {
    if (history.length === 0 && !interimText) return;

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

    history.forEach((h, index) => {
      content += `[${h.time}] ${h.speakerName}:\n${h.text}\n\n`;
    });

    if (interimText) {
      content += `[Đang phát biểu] ${userName}:\n${interimText}\n\n`;
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
  }, [history, interimText, roomCode, userName]);

  // Nếu không active và không ở trạng thái kết thúc phiên họp có dữ liệu, hoặc user đã đóng
  if ((!isActive && !isSessionEnded) || isDismissed) return null;
  // Nếu phiên họp kết thúc nhưng không có nội dung chép lời nào thì ẩn đi
  if (isSessionEnded && history.length === 0 && !interimText) return null;

  return (
    <div
      className="fixed bottom-24 right-5 sm:right-6 z-40 w-[320px] sm:w-[380px] pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
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
              className="text-[#e8cca4]/70 hover:text-[#f5ede3] p-0.5 rounded"
              title="Đóng bảng chép lời"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Header bảng chép lời */}
        <div className="flex items-center justify-between border-b border-[#3a3128] px-3.5 py-2.5 bg-[#181513]/90">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1 rounded-full bg-[#c3a47b] px-2 py-0.5 text-[10px] font-bold text-[#161311] shadow-xs">
              <Crown className="h-2.5 w-2.5" />
              VIP
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-serif font-semibold text-[#f5ede3] truncate">
                Bản chép lời
              </span>
              {!isSessionEnded && (
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c3a47b] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c3a47b]" />
                </span>
              )}
            </div>
          </div>

          {/* Action buttons: Sao chép & Tải .txt */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Nút Sao chép */}
            <button
              type="button"
              onClick={handleCopyAll}
              disabled={history.length === 0 && !interimText}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                isCopied
                  ? "bg-[#c3a47b]/20 text-[#e8cca4] border border-[#c3a47b]/40"
                  : "bg-[#201b18] text-[#d8c8b4] hover:bg-[#26201c] hover:text-[#f5ede3] border border-[#3a3128]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Sao chép toàn bộ bản chép lời vào bộ nhớ tạm"
            >
              {isCopied ? (
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
            <button
              type="button"
              onClick={handleDownloadTxt}
              disabled={history.length === 0 && !interimText}
              className="flex items-center gap-1 rounded-lg bg-[#201b18] text-[#d8c8b4] hover:bg-[#26201c] hover:text-[#f5ede3] border border-[#3a3128] px-2 py-1 text-[11px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Tải bản chép lời dạng file văn bản (.txt)"
            >
              <Download className="h-3 w-3 text-[#c3a47b]" />
              <span className="hidden sm:inline">Tải .txt</span>
            </button>

            {/* Thu nhỏ / Mở rộng */}
            <button
              type="button"
              onClick={() => setIsMinimized((v) => !v)}
              className="rounded-lg p-1 text-[#a89b8d] hover:bg-[#201b18] hover:text-[#f5ede3] transition"
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

        {/* Nội dung bản chép lời (ẩn khi thu nhỏ) */}
        {!isMinimized && (
          <div
            ref={containerRef}
            className="max-h-[220px] min-h-[90px] overflow-y-auto p-3.5 space-y-2.5 text-xs"
          >
            {history.length === 0 && !interimText ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-[#75695e]">
                <Mic className="h-5 w-5 mb-1.5 opacity-40 animate-pulse text-[#c3a47b]" />
                <p className="italic text-[11px]">
                  {isSessionEnded
                    ? "Không có bản chép lời nào được ghi lại."
                    : "Đang lắng nghe... Hãy nói tiếng Việt để bắt đầu chép lời."}
                </p>
              </div>
            ) : (
              <>
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-xl bg-[#201b18] border border-[#3a3128] p-2 transition hover:bg-[#29231f]"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1 text-[10px] text-[#75695e]">
                      <span className="font-semibold text-[#c3a47b]">
                        {item.speakerName}
                      </span>
                      <span>{item.time}</span>
                    </div>
                    <p className="text-[#f5ede3] text-xs leading-relaxed select-text cursor-text">
                      {item.text}
                    </p>
                  </div>
                ))}

                {/* Đoạn thoại đang nói dở (interim) */}
                {interimText && (
                  <div className="rounded-xl bg-[#201b18] border border-[#c3a47b]/30 p-2">
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#c3a47b]">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#c3a47b] animate-ping" />
                      <span className="font-semibold">{userName} (Đang nói...)</span>
                    </div>
                    <p className="text-[#d8c8b4] text-xs italic leading-relaxed select-text cursor-text">
                      {interimText}
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
            <span className="italic">Tự động sao lưu</span>
          </div>
        )}
      </div>
    </div>
  );
}
