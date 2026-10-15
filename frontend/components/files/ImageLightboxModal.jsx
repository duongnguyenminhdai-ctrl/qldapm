"use client";

import { useEffect } from "react";
import { X, Download, ExternalLink } from "lucide-react";

export function ImageLightboxModal({ isOpen, src, imageUrl, alt, onClose }) {
  const finalSrc = src || imageUrl;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !finalSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controls */}
        <div className="absolute top-2 right-2 flex items-center gap-2 z-10 bg-zinc-900/80 backdrop-blur-sm rounded-xl p-1.5 border border-zinc-800/80">
          <a
            href={finalSrc}
            download={alt || "image"}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            title="Tải ảnh về máy"
          >
            <Download className="w-4 h-4" />
          </a>
          <a
            href={finalSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            title="Mở tab mới"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={finalSrc}
          alt={alt || "Ảnh phóng to"}
          className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-zinc-800/60"
        />

        {alt && (
          <p className="mt-2 text-xs font-mono text-zinc-400 truncate max-w-md">
            {alt}
          </p>
        )}
      </div>
    </div>
  );
}

export default ImageLightboxModal;
