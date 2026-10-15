const { GoogleGenerativeAI } = require("@google/generative-ai");

// Danh sách các model tốc độ cao theo thứ tự ưu tiên (ưu tiên model ổn định không bị 503)
const CANDIDATE_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemma-4-26b-a4b-it",
  "gemini-3.8-flash",
];

const CONTEXT_INSTRUCTIONS = {
  GENERAL_QA:
    "Chế độ: Hỏi đáp & Giải thích kiến thức tổng quát. Trả lời trực quan, dễ hiểu, có ví dụ minh họa và đúc kết ngắn gọn.",
  EXPLAIN_CODE:
    "Chế độ: Phân tích và sửa lỗi lập trình. Chỉ rõ nguyên nhân lỗi (nếu có), cung cấp code sửa hoàn chỉnh trong code block có định danh ngôn ngữ và giải thích từng bước.",
  SUMMARIZE_NOTES:
    "Chế độ: Tóm tắt bài học & ghi chú học tập. Tổng hợp các luận điểm chính thành bullet points súc tích, làm nổi bật các khái niệm cốt lõi.",
  TRANSLATE:
    "Chế độ: Dịch thuật học thuật. Dịch chính xác ngữ nghĩa chuyên ngành giữa tiếng Anh và tiếng Việt, kèm bảng chú giải thuật ngữ nếu cần.",
  QUIZ_GEN:
    "Chế độ: Tạo 3 câu hỏi trắc nghiệm ôn tập. Tạo đúng 3 câu hỏi trắc nghiệm liên quan đến nội dung người dùng cung cấp (mỗi câu có 4 phương án A, B, C, D), kèm đáp án đúng và lời giải thích ngắn gọn ở cuối.",
};

/**
 * Xử lý truy vấn trợ lý học tập AI Tutor tích hợp Google Gemini API
 * @param {Object} params
 * @param {string} params.message - Tin nhắn hoặc câu hỏi từ người học
 * @param {Array} [params.history=[]] - Lịch sử hội thoại trước đó trong phiên [{ role: 'user'|'model', text: string }]
 * @param {string} [params.contextType='GENERAL_QA'] - Chế độ hỗ trợ nhanh
 * @param {string} [params.roomSubject=''] - Chủ đề phòng học hiện tại (ví dụ: Lập trình, Ngoại ngữ, Toán & KH...)
 * @returns {Promise<{ reply: string, modelUsed: string, contextType: string }>}
 */
async function generateTutorResponse({
  message,
  history = [],
  contextType = "GENERAL_QA",
  roomSubject = "",
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "dien_key_AIzaSy_cua_ban_vao_day") {
    throw new Error(
      "Chưa cấu hình GEMINI_API_KEY trên máy chủ hoặc khóa API không hợp lệ. Vui lòng kiểm tra file backend/.env."
    );
  }

  const promptText = (message || "").trim();
  if (!promptText) {
    throw new Error("Nội dung câu hỏi không được để trống.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const systemInstruction = `
Bạn là "Study AI Tutor" — Trợ lý học tập AI thông minh tích hợp Google Gemini trong nền tảng Virtual Study Room.
Bạn đồng hành cùng người học trong phòng học chủ đề: "${roomSubject || "Tự học & Tổng hợp"}".

Khả năng toàn diện của bạn:
1. 💡 **Giải thích khái niệm & kiến thức**: Trả lời trực quan, dễ hiểu, dùng ẩn dụ đời thực và ví dụ cụ thể, không hàn lâm lan man.
2. 💻 **Lập trình & Sửa lỗi Code**: Khi người dùng hỏi về code hoặc dán đoạn code, hãy đóng vai Senior Engineer:
   - Chỉ rõ nguyên nhân lỗi (nếu có).
   - Đưa ra đoạn code sửa hoàn chỉnh, tối ưu trong markdown code block có định danh ngôn ngữ (ví dụ: \`\`\`javascript, \`\`\`python, \`\`\`cpp).
   - Giải thích ngắn gọn cách hoạt động.
3. 📝 **Tóm tắt bài giảng & Take Note**: Khi được yêu cầu tóm tắt, tự động đúc kết thành các bullet points súc tích, làm nổi bật công thức và luận điểm cốt lõi.
4. ❓ **Ôn tập & Trắc nghiệm**: Khi người học muốn ôn tập hoặc kiểm tra kiến thức, tự động tạo câu hỏi trắc nghiệm phản xạ kèm 4 lựa chọn (A, B, C, D) và lời giải thích đáp án.
5. 🌐 **Dịch thuật & Học ngữ**: Dịch chính xác ngữ nghĩa chuyên ngành, kèm chú giải từ vựng quan trọng.

Quy tắc phản hồi:
- Luôn trả lời bằng tiếng Việt thân thiện, chuẩn mực, khích lệ tinh thần học tập.
- Định dạng Markdown đẹp mắt: dùng tiêu đề (###), danh sách, **in đậm** từ khóa quan trọng và blockquote (>) cho mẹo học tập (Study Tip).
- Đi thẳng vào câu trả lời trọng tâm, súc tích và có chiều sâu.
`.trim();

  // Chuẩn hóa lịch sử hội thoại gần nhất (tối đa 8 lượt trao đổi gần nhất để giữ token gọn)
  const recentHistory = Array.isArray(history)
    ? history
        .slice(-8)
        .map((h) => ({
          role: h.role === "assistant" || h.role === "model" ? "model" : "user",
          parts: [{ text: String(h.content || h.text || h.message || "") }],
        }))
        .filter((h) => h.parts[0].text.trim().length > 0)
    : [];

  let lastError = null;

  // Thử lần lượt các model Flash để đảm bảo dịch vụ luôn thông suốt
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        },
      });

      let responseText = "";

      const generatePromise =
        recentHistory.length > 0
          ? model.startChat({ history: recentHistory }).sendMessage(promptText)
          : model.generateContent(promptText);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Model ${modelName} phản hồi quá 20 giây`)),
          20000
        )
      );

      const result = await Promise.race([generatePromise, timeoutPromise]);
      responseText = result.response.text();

      if (responseText && responseText.trim()) {
        return {
          reply: responseText.trim(),
          modelUsed: modelName,
          contextType,
        };
      }
    } catch (err) {
      lastError = err;
      const errMsg = err?.message || "";
      console.warn(
        `[AITutorService] Model [${modelName}] gặp lỗi: ${errMsg.slice(0, 120)}. Đang thử model dự phòng tiếp theo...`
      );
      // Nếu là lỗi cấu hình API key không hợp lệ thì không cần lặp qua các model khác
      if (
        errMsg.includes("API_KEY_INVALID") ||
        errMsg.includes("API key not valid")
      ) {
        throw new Error(
          "Khóa GEMINI_API_KEY không hợp lệ hoặc đã bị vô hiệu hóa. Vui lòng kiểm tra lại API Key."
        );
      }
    }
  }

  // Nếu tất cả các model đều gặp lỗi
  console.error("[AITutorService] Tất cả các model đều không phản hồi:", lastError);
  if (lastError?.message?.includes("503") || lastError?.message?.includes("high demand")) {
    throw new Error(
      "Dịch vụ AI hiện đang có lượng truy cập cao đột biến. Vui lòng gửi lại câu hỏi sau vài giây."
    );
  }
  if (lastError?.message?.includes("429") || lastError?.message?.includes("RESOURCE_EXHAUSTED")) {
    throw new Error(
      "Đã đạt giới hạn hạn mức (Rate limit) của Gemini API. Vui lòng chờ 30 giây rồi thử lại."
    );
  }

  throw new Error(
    "Không thể nhận phản hồi từ Study AI Tutor. Vui lòng thử lại sau giây lát."
  );
}

module.exports = {
  generateTutorResponse,
  CONTEXT_INSTRUCTIONS,
};
