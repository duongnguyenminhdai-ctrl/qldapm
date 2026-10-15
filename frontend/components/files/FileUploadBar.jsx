"use client";

import { X, Loader2, CheckCircle2 } from "lucide-react";
import { formatFileSize, getFileMeta } from "./FileItemCard";
import { cn } from "@/lib/utils";

export function FileUploadBar(props) {
  const file = props.file;
  const uploadedData = props.uploadedData;
  const fileName = props.fileName || file?.name || uploadedData?.fileName || "Tập tin";
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

  if (!file && !props.fileName && !uploadedData) return null;

  const meta = getFileMeta(fileName, fileType);
  const IconComponent = meta.icon;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all",
        error
          ? "bg-red-500/10 border-red-500/30 text-red-200"
          : "bg-zinc-900 border-zinc-800 text-zinc-200 shadow-md",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={cn(
              "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
              meta.color
            )}
          >
            <IconComponent className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate" title={fileName}>
              {fileName}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span>{formatFileSize(fileSize)}</span>
              {uploading && (
                <span className="text-amber-400 flex items-center gap-1 font-mono">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Đang tải lên {progress > 0 ? `${progress}%` : "..."}
                </span>
              )}
              {(uploadedData || props.fileUrl || progress === 100) && !uploading && !error && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Đã sẵn sàng
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          title="Hủy file"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Thanh tiến trình upload */}
      {uploading && (
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-amber-400 rounded-full transition-all duration-200"
            style={{ width: `${Math.max(5, progress)}%` }}
          />
        </div>
      )}

      {error && (
        <p className="text-[10px] text-red-400 truncate">
          Lỗi: {error}
        </p>
      )}
    </div>
  );
}

export default FileUploadBar;
