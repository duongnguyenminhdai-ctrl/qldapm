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
      <DialogContent className="max-w-sm border-stone-200 bg-[#FAF8F5] p-6 text-[#2D241E] shadow-2xl backdrop-blur-sm dark:border-[#3a3128] dark:bg-[#1c1815] dark:text-[#f5ede3]">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-[#EAE3D5] text-[#b3894e] dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#c3a47b]">
            <QrCode className="h-5 w-5 text-[#b3894e] dark:text-[#c3a47b]" strokeWidth={1.75} />
          </div>
          <DialogTitle className="font-serif text-lg font-bold text-[#2D241E] dark:text-[#f5ede3]">
            Mã QR vào phòng học
          </DialogTitle>
          <DialogDescription className="text-xs text-[#615247] dark:text-[#a89b8d]">
            Quét mã để tham gia ngay trên điện thoại hoặc chia sẻ cho bạn bè.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* Khung hiển thị QR code bo góc trắng nổi bật */}
          <div
            ref={qrRef}
            className="group relative flex items-center justify-center rounded-2xl bg-white p-4 shadow-xl ring-1 ring-stone-200 dark:ring-[#3a3128] transition-transform hover:scale-[1.02]"
          >
            <QRCodeCanvas
              value={roomUrl}
              size={210}
              level="H"
              marginSize={0}
              fgColor="#141210"
              bgColor="#ffffff"
            />
          </div>

          {/* Mã phòng & Trạng thái phòng */}
          <div className="w-full space-y-2 text-center">
            <div className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-[#EAE3D5] dark:border-[#3a3128] dark:bg-[#201b18] px-3 py-1.5">
              <span className="text-xs text-[#615247] dark:text-[#a89b8d]">Mã phòng:</span>
              <span className="font-mono text-sm font-bold tracking-wider text-[#b3894e] dark:text-[#c3a47b]">
                {roomCode}
              </span>
            </div>

            <div>
              {isApprovalRequired ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[11px] font-medium text-amber-800 dark:text-[#e8cca4]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Có xét duyệt (Chủ phòng cần đồng ý)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-[#EAE3D5] text-[#2D241E] dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#d8c8b4] px-3 py-1 text-[11px] font-medium">
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
              className="gap-1.5 border-stone-300 bg-[#EAE3D5] text-xs font-medium text-[#2D241E] hover:bg-stone-200 dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#d8c8b4] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#c3a47b]" />
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
              className="gap-1.5 bg-[#c3a47b] text-xs font-medium text-[#161311] hover:bg-[#d6b88f] shadow-sm"
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
