"use client";

import {
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File as FileGeneric,
  Download,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Giải mã chuẩn UTF-8 tên file tiếng Việt nếu bị lỗi font / mojibake (Latin1 -> UTF8)
 */
export function cleanFileName(name = "") {
  if (!name || typeof name !== "string") return "Tài liệu";
  try {
    const converted = decodeURIComponent(escape(name));
    if (converted && !converted.includes("\ufffd") && converted !== name) {
      return converted;
    }
  } catch (_) {
    try {
      const sanitized = name.replace(/[^\x00-\x7F]/g, (c) => {
        const code = c.charCodeAt(0);
        return code <= 255 ? "%" + code.toString(16).padStart(2, "0") : c;
      });
      const decoded = decodeURIComponent(sanitized);
      if (decoded && decoded !== name) return decoded;
    } catch (__) {}
  }
  return name;
}

/**
 * Format bytes thành định dạng đọc được (KB, MB)
 */
export function formatFileSize(bytes = 0) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Lấy Icon và màu sắc tương ứng theo phần mở rộng của file
 */
export function getFileMeta(fileName = "", fileType = "") {
  const safeName = cleanFileName(fileName);
  const ext = (safeName.split(".").pop() || fileType || "").toLowerCase();

  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext) || fileType.startsWith("image")) {
    return {
      type: "image",
      icon: ImageIcon,
      color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
      badgeColor: "bg-violet-500/20 text-violet-300",
      label: ext.toUpperCase() || "IMAGE",
    };
  }

  if (["pdf"].includes(ext)) {
    return {
      type: "pdf",
      icon: FileText,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      badgeColor: "bg-rose-500/20 text-rose-300",
      label: "PDF",
    };
  }

  if (["doc", "docx", "txt", "rtf", "md"].includes(ext)) {
    return {
      type: "document",
      icon: FileText,
      color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      badgeColor: "bg-sky-500/20 text-sky-300",
      label: ext.toUpperCase() || "DOC",
    };
  }

  if (["xls", "xlsx", "csv"].includes(ext)) {
    return {
      type: "spreadsheet",
      icon: FileSpreadsheet,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      badgeColor: "bg-emerald-500/20 text-emerald-300",
      label: "EXCEL",
    };
  }

  if (["js", "jsx", "ts", "tsx", "py", "cpp", "c", "java", "html", "css", "json", "sql"].includes(ext)) {
    return {
      type: "code",
      icon: FileCode,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      badgeColor: "bg-amber-500/20 text-amber-300",
      label: ext.toUpperCase() || "CODE",
    };
  }

  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return {
      type: "archive",
      icon: FileArchive,
      color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
      badgeColor: "bg-orange-500/20 text-orange-300",
      label: ext.toUpperCase() || "ZIP",
    };
  }

  return {
    type: "generic",
    icon: FileGeneric,
    color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    badgeColor: "bg-zinc-500/20 text-zinc-300",
    label: ext.toUpperCase() || "FILE",
  };
}

/**
 * Component hiển thị thẻ file đính kèm trong tin nhắn hoặc danh sách tài liệu
 */
export function FileItemCard(props) {
  const fileUrl = props.fileUrl || props.file?.fileUrl || props.file?.url;
  const fileName = cleanFileName(
    props.fileName || props.file?.fileName || props.file?.name || props.name || "Tài liệu"
  );
  const fileType = props.fileType || props.file?.fileType || props.file?.type || "";
  const fileSize =
    props.fileSize !== undefined
      ? props.fileSize
      : props.file?.fileSize !== undefined
      ? props.file.fileSize
      : props.file?.size !== undefined
      ? props.file.size
      : 0;
  const { onImageClick, compact = false, className, isSenderMe = false, showDetails = false } = props;

  const meta = getFileMeta(fileName, fileType);
  const IconComponent = meta.icon;
  const isImage = meta.type === "image";

  // Nếu là ảnh và có thumbnail, render ảnh bo góc đẹp mắt
  if (isImage && !compact) {
    return (
      <div className={cn("overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/60 max-w-xs", className)}>
        <div className="relative group cursor-pointer overflow-hidden" onClick={() => onImageClick?.(fileUrl, fileName)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt={fileName}
            className="w-full max-h-60 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <span className="text-xs font-medium text-white px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Phóng to
            </span>
          </div>
        </div>
        <div className="p-2 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/60">
          <span className="truncate pr-2 font-mono text-[10px]">{fileName}</span>
          <div className="flex items-center gap-2 shrink-0">
            {fileSize > 0 && <span className="text-zinc-500">{formatFileSize(fileSize)}</span>}
            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              title="Tải ảnh về"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Nếu là tài liệu (PDF, Word, Code, ZIP, etc.)
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all duration-200",
        "bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700/80 hover:bg-zinc-900",
        compact ? "p-2 text-xs" : "min-w-[220px] max-w-sm",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0", meta.color)}>
          <IconComponent className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-200 truncate" title={fileName}>
            {fileName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-[9px] font-semibold uppercase px-1 rounded", meta.badgeColor)}>
              {meta.label}
            </span>
            {fileSize > 0 && (
              <span className="text-[10px] font-mono text-zinc-500">
                {formatFileSize(fileSize)}
              </span>
            )}
          </div>
        </div>
      </div>

      <a
        href={fileUrl}
        download={fileName}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800/60 transition shrink-0"
        title="Tải về máy"
      >
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
}

export default FileItemCard;
