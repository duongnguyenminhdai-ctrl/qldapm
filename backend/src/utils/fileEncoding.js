/**
 * Utility giải mã chuẩn UTF-8 cho tên file tiếng Việt bị Multer / HTTP Header parse thành Latin1 (ISO-8859-1).
 */
function fixUtf8FileName(str) {
  if (!str || typeof str !== "string") return "";
  try {
    const converted = Buffer.from(str, "latin1").toString("utf8");
    if (converted !== str) {
      const cleaned = converted.replace(/\ufffd+$/, "");
      if (cleaned && !cleaned.includes("\ufffd")) {
        return cleaned;
      }
      if (!converted.includes("\ufffd")) {
        return converted;
      }
    }
  } catch (e) {
    // Không chuyển đổi được thì giữ nguyên chuỗi ban đầu
  }
  return str;
}

module.exports = {
  fixUtf8FileName,
};
