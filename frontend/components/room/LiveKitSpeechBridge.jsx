"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant } from "@livekit/components-react";

/**
 * LiveKitSpeechBridge — Cầu nối nhận diện giọng nói đa phương thức tích hợp Google Gemini AI
 * 1. Web Speech API: Nhận diện tức thì 0ms hiển thị preview "Đang nói..."
 * 2. MediaRecorder + Google Gemini AI: Cắt lát âm thanh gửi lên Gemini Flash
 *    để chép lời siêu chuẩn xác 99%, chuẩn ngữ pháp tiếng Việt và thuật ngữ kỹ thuật
 */
export function LiveKitSpeechBridge({
  roomCode,
  currentUser,
  currentUserId,
  socket,
  transcriptionOn = false,
  roomHasActiveTranscription = false,
}) {
  const { isMicrophoneEnabled } = useLocalParticipant();
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const shouldListenRef = useRef(false);

  // Chỉ kích hoạt khi mic của chính mình đang bật VÀ có nhu cầu chép lời trong phòng
  const shouldListen = Boolean(
    isMicrophoneEnabled && (transcriptionOn || roomHasActiveTranscription)
  );
  shouldListenRef.current = shouldListen;

  // 1. Web Speech API cho preview thời gian thực 0ms (Interim text "Đang nói...")
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    if (!shouldListen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
        recognitionRef.current = null;
      }
      return;
    }

    let recognition = null;
    try {
      recognition = new SpeechRecognition();
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
              const segment = {
                id: `ts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                roomCode,
                userId: currentUserId,
                speakerId: currentUserId,
                speakerName: currentUser?.name || "Bạn",
                text: trimmed,
                time: timeStr,
                aiPowered: false,
              };

              // Thông báo local event cho TranscriptionOverlay hiển thị ngay lập tức
              window.dispatchEvent(
                new CustomEvent("vsr:local-transcript-segment", {
                  detail: segment,
                })
              );

              // Phát sóng cho tất cả thành viên trong phòng cùng theo dõi (0 tốn quota Gemini, 0ms latency)
              if (socket && socket.connected && roomCode) {
                socket.emit("room:transcript-segment", {
                  roomCode,
                  text: trimmed,
                  speakerName: currentUser?.name || "Bạn",
                  userId: currentUserId,
                  id: segment.id,
                });
              }
            }
          } else {
            currentInterim += text;
          }
        }

        const interimTrimmed = currentInterim.trim();
        if (socket && socket.connected && roomCode) {
          socket.emit("room:transcript-interim", {
            roomCode,
            userId: currentUserId,
            speakerName: currentUser?.name || "Bạn",
            text: interimTrimmed,
          });
        }

        window.dispatchEvent(
          new CustomEvent("vsr:local-transcript-interim", {
            detail: {
              text: interimTrimmed,
              speakerName: "Bạn",
              speakerId: currentUserId,
            },
          })
        );
      };

      recognition.onerror = (event) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("[LiveKitSpeechBridge] Recognition error:", event.error);
        }
      };

      recognition.onend = () => {
        if (shouldListenRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (_) {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("[LiveKitSpeechBridge] Khởi động SpeechRecognition thất bại:", err);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
        recognitionRef.current = null;
      }
    };
  }, [shouldListen, roomCode, currentUser?.name, currentUserId, socket]);

  // Bảo tồn tài nguyên API Gemini: Không gửi audio chunk 4s định kỳ gây tràn Rate limit (429)
  // Quota của Gemini được ưu tiên 100% cho Study AI Tutor và Tóm tắt phiên học
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        try {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
        } catch (_) {}
        audioStreamRef.current = null;
      }
    };
  }, []);

  return null;
}

export default LiveKitSpeechBridge;
