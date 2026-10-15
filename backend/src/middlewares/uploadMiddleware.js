const multer = require("multer");
const path = require("path");
const cloudinary = require("../config/cloudinary");

// Multer lưu trữ trong memory để upload trực tiếp lên Cloudinary dạng stream
const storage = multer.memoryStorage();

// Giới hạn 15MB
const MAX_FILE_SIZE = 15 * 1024 * 1024;

// Danh sách định dạng cho phép: ảnh, pdf, docx, txt, zip, code,...
const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".rar",
  ".json",
  ".md",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".cpp",
  ".java",
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext) || file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Định dạng file không được hỗ trợ (${ext}). Cho phép: ảnh, pdf, docx, txt, zip, code.`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/**
 * Upload buffer lên Cloudinary qua upload_stream
 * @param {Buffer} buffer - File buffer từ req.file.buffer
 * @param {String} originalname - Tên file gốc
 * @param {String} mimetype - MIME type của file
 * @returns {Promise<Object>} { fileUrl, fileName, fileType, fileSize }
 */
const uploadBufferToCloudinary = (buffer, originalname, mimetype) => {
  return new Promise((resolve, reject) => {
    const isImage = mimetype.startsWith("image/");
    const ext = path.extname(originalname).toLowerCase();

    // Làm sạch tên file không dấu/ký tự đặc biệt cho public_id
    const baseName = path
      .basename(originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);

    const publicId = `${Date.now()}_${baseName}`;

    // Cloudinary options
    const options = {
      folder: "virtual_study_room",
      public_id: publicId,
      resource_type: isImage ? "image" : "raw",
      use_filename: true,
      unique_filename: true,
    };

    // Với raw file (PDF, docx,...), thêm extension vào public_id để khi tải về giữ đúng đuôi file
    if (!isImage) {
      options.public_id = `${publicId}${ext}`;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve({
          fileUrl: result.secure_url,
          fileName: originalname,
          fileType: isImage ? "image" : ext.replace(".", "") || "document",
          fileSize: result.bytes || buffer.length,
          format: result.format || ext.replace(".", ""),
          publicId: result.public_id,
          resourceType: result.resource_type || (isImage ? "image" : "raw"),
        });
      }
    );

    uploadStream.end(buffer);
  });
};

module.exports = {
  upload,
  uploadBufferToCloudinary,
  MAX_FILE_SIZE,
};
