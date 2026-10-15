"use client";

import { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Check, Download, QrCode, ShieldCheck, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function RoomQRCodeModal({ open, onOpenChange, roomCode, roomTitle, accessType = "OPEN" }) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  const roomUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${roomCode}`
      : `/room/${roomCode}`;

  const isApprovalRequired = accessType === "APPROVAL_REQUIRED";

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(roomUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (_) {}
  };

  const handleDownloadQR = () => {
    try {
      const canvas = qrRef.current?.querySelector("canvas");
      if (!canvas) return;
      const imageUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = imageUrl;
      downloadLink.download = `VSR-Phong-${roomCode}-QR.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.warn("Lỗi tải ảnh QR:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-zinc-800/80 bg-zinc-950 p-6 text-zinc-100 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-900 text-zinc-200">
            <QrCode className="h-5 w-5 text-zinc-300" strokeWidth={1.75} />
          </div>
          <DialogTitle className="text-lg font-bold text-zinc-100">
            Mã QR vào phòng học
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Quét mã để tham gia ngay trên điện thoại hoặc chia sẻ cho bạn bè.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* Khung hiển thị QR code bo góc trắng nổi bật */}
          <div
            ref={qrRef}
            className="group relative flex items-center justify-center rounded-2xl bg-white p-4 shadow-xl ring-1 ring-zinc-800 transition-transform hover:scale-[1.02]"
          >
            <QRCodeCanvas
              value={roomUrl}
              size={210}
              level="H"
              marginSize={0}
              fgColor="#09090b"
              bgColor="#ffffff"
            />
          </div>

          {/* Mã phòng & Trạng thái phòng */}
          <div className="w-full space-y-2 text-center">
            <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
              <span className="text-xs text-zinc-400">Mã phòng:</span>
              <span className="font-mono text-sm font-bold tracking-wider text-amber-400">
                {roomCode}
              </span>
            </div>

            <div>
              {isApprovalRequired ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Có xét duyệt (Chủ phòng cần đồng ý)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                  <Users className="h-3.5 w-3.5" />
                  <span>Mở tự do (Vào thẳng phòng)</span>
                </div>
              )}
            </div>
          </div>

          {/* 2 Nút hành động */}
          <div className="grid w-full grid-cols-2 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyLink}
              id="btn-qr-copy-link"
              className="gap-1.5 border-zinc-800 bg-zinc-900/80 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Đã sao chép!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Sao chép link</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleDownloadQR}
              id="btn-qr-download"
              className="gap-1.5 bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-white shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Tải ảnh QR</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
