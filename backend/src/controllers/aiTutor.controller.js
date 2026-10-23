const {
  generateTutorResponse,
  transcribeAudioWithGemini,
  summarizeTranscriptWithGemini,
} = require("../services/aiTutor.service");

/**
 * POST /api/ai/tutor
 * Nhận câu hỏi học tập và gửi tới Study AI Tutor qua Gemini API
 */
exports.askAITutor = async (req, res, next) => {
  try {
    const { message, history, contextType, roomSubject } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập câu hỏi hoặc nội dung bạn cần AI trợ giúp.",
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        success: false,
        message: "Nội dung câu hỏi quá dài (tối đa 4000 ký tự). Vui lòng tóm gọn lại.",
      });
    }

    const tutorResult = await generateTutorResponse({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      contextType: contextType || "GENERAL_QA",
      roomSubject: typeof roomSubject === "string" ? roomSubject : "",
    });

    return res.status(200).json({
      success: true,
      message: "Đã nhận phản hồi từ Study AI Tutor.",
      data: tutorResult,
    });
  } catch (error) {
    console.error("[AITutorController] Lỗi xử lý yêu cầu AI Tutor:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Đã xảy ra lỗi khi trao đổi với AI Tutor.",
    });
  }
};

/**
 * POST /api/ai/transcribe-audio
 * Chép lời đoạn âm thanh bằng Google Gemini Multimodal
 */
exports.transcribeAudio = async (req, res, next) => {
  try {
    const { audioBase64, mimeType, roomSubject } = req.body;

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({
        success: false,
        message: "Thiếu dữ liệu âm thanh base64.",
      });
    }

    const text = await transcribeAudioWithGemini({
      audioBase64,
      mimeType: mimeType || "audio/webm",
      roomSubject: roomSubject || "",
    });

    return res.status(200).json({
      success: true,
      data: { text },
    });
  } catch (error) {
    console.error("[AITutorController] Lỗi chép lời audio:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể chép lời âm thanh.",
    });
  }
};

/**
 * POST /api/ai/summarize-transcript
 * Tóm tắt toàn bộ biên bản chép lời buổi học bằng Gemini
 */
exports.summarizeTranscript = async (req, res, next) => {
  try {
    const { transcriptText, roomSubject } = req.body;

    if (!transcriptText || typeof transcriptText !== "string" || !transcriptText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nội dung biên bản chép lời không được để trống.",
      });
    }

    const summary = await summarizeTranscriptWithGemini({
      transcriptText: transcriptText.trim(),
      roomSubject: roomSubject || "",
    });

    return res.status(200).json({
      success: true,
      data: { summary },
    });
  } catch (error) {
    console.error("[AITutorController] Lỗi tóm tắt biên bản:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể tóm tắt biên bản buổi học.",
    });
  }
};
