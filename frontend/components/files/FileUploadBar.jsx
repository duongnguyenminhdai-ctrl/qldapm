"use client";

import { X, Loader2, CheckCircle2 } from "lucide-react";
import { formatFileSize, getFileMeta, cleanFileName } from "./FileItemCard";
import { cn } from "@/lib/utils";

export function FileUploadBar(props) {
  const file = props.file;
  const uploadedData = props.uploadedData;
  const rawFileName =
    props.fileName ||
    file?.name ||
    uploadedData?.fileName ||
    "Tập tin";
  const fileName = cleanFileName(rawFileName);
  const fileSize =
    props.fileSize !== undefined
      ? props.fileSize
      : file?.size || uploadedData?.fileSize || 0;
  const fileType = file?.type || uploadedData?.fileType || "";
  const uploading = Boolean(props.uploading);
  const progress = props.progress !== undefined ? props.progress : 0;
  const error = props.error || null;
  const onRemove = props.onRemove || props.onCancel;
  const className = props.className;

  if (!file && !props.fileName && !uploadedData && !props.fileUrl) return null;

  const meta = getFileMeta(fileName, fileType);
  const IconComponent = meta.icon;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-1.5 p-3 rounded-2xl border transition-all duration-300 ease-out select-none",
        "animate-in fade-in zoom-in-95 slide-in-from-bottom-2",
        error
          ? "bg-red-950/40 border-red-500/40 text-red-200 shadow-lg shadow-red-950/20"
          : "bg-[#181512]/95 dark:bg-[#181512]/95 border-amber-900/30 dark:border-stone-800/80 text-zinc-100 shadow-xl backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-xs transition-transform duration-300",
              meta.color
            )}
          >
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold truncate text-zinc-100" title={fileName}>
              {fileName}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
              <span>{formatFileSize(fileSize)}</span>
              {uploading && (
                <span className="text-amber-400 flex items-center gap-1.5 font-mono font-medium">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                  Đang tải lên {progress > 0 ? `${progress}%` : "..."}
                </span>
              )}
              {(uploadedData || props.fileUrl || progress === 100) && !uploading && !error && (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Đã sẵn sàng
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 shadow-xs active:scale-95"
          title="Hủy tệp đính kèm"
          aria-label="Hủy tệp"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Thanh tiến trình upload gradient mượt mà */}
      {uploading && (
        <div className="w-full h-1.5 bg-zinc-800/90 rounded-full overflow-hidden mt-1 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(6, progress)}%` }}
          />
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-400 truncate mt-0.5 font-medium">
          Lỗi: {error}
        </p>
      )}
    </div>
  );
}

export default FileUploadBar;
