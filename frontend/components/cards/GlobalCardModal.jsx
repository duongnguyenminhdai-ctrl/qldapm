"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CardDrawModal } from "./CardDrawModal";
import { connectSocket } from "@/lib/socket";

export function GlobalCardModal() {
  const [isOpen, setIsOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Mở modal nếu có query param ?openCardModal=true
  useEffect(() => {
    if (searchParams?.get("openCardModal") === "true") {
      setIsOpen(true);
      // Xóa query param để không tự mở lại khi refresh
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("openCardModal");
        window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
      } catch (_) {}
    }
  }, [searchParams]);

  // Lắng nghe sự kiện toàn cục vsr:open-card-modal
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener("vsr:open-card-modal", handleOpen);
    return () => {
      window.removeEventListener("vsr:open-card-modal", handleOpen);
    };
  }, []);

  // Lắng nghe socket card:reward-available
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleRewardAvailable = (data) => {
      console.log("[Card] Thưởng thẻ bài sẵn sàng:", data);
    };

    socket.on("card:reward-available", handleRewardAvailable);
    return () => {
      socket.off("card:reward-available", handleRewardAvailable);
    };
  }, []);

  return (
    <CardDrawModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onDrawSuccess={() => {
        // Dispatch sự kiện để cập nhật kho thẻ và lượt mở toàn hệ thống
        window.dispatchEvent(new CustomEvent("vsr:card-drawn"));
      }}
    />
  );
}

export default GlobalCardModal;
