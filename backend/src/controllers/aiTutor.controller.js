const { generateTutorResponse } = require("../services/aiTutor.service");

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
