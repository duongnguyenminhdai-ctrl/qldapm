"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Xác nhận",
    cancelText: "Hủy bỏ",
    variant: "warning",
    icon: null,
    isAlert: false,
  });

  const resolverRef = useRef(null);

  /**
   * Gọi hộp thoại xác nhận Promise-based:
   * const isConfirmed = await confirm({ title, message, confirmText, cancelText, variant });
   */
  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      const opts = typeof options === "string" ? { message: options } : options;
      setModalState({
        isOpen: true,
        title: opts.title || "Xác nhận hành động",
        message: opts.message || opts.description || "",
        confirmText: opts.confirmText || "Xác nhận",
        cancelText: opts.cancelText || "Hủy bỏ",
        variant: opts.variant || "warning",
        icon: opts.icon || null,
        isAlert: Boolean(opts.isAlert),
      });
    });
  }, []);

  /**
   * Thay thế window.alert() bằng popup thông báo đơn lẻ:
   * await alert("Nội dung thông báo");
   */
  const alert = useCallback((options = {}) => {
    const opts = typeof options === "string" ? { message: options } : options;
    return confirm({
      ...opts,
      title: opts.title || "Thông báo",
      isAlert: true,
      confirmText: opts.confirmText || "Đã hiểu",
      variant: opts.variant || "info",
    });
  }, [confirm]);

  const handleConfirm = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        variant={modalState.variant}
        icon={modalState.icon}
        isAlert={modalState.isAlert}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

/**
 * Hook useConfirm hỗ trợ cả 2 dạng:
 * 1. const confirm = useConfirm(); await confirm({ ... });
 * 2. const { confirm, alert } = useConfirm();
 */
export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    const fallback = (options) => {
      console.warn("useConfirm must be used within a ConfirmProvider");
      return Promise.resolve(false);
    };
    fallback.confirm = fallback;
    fallback.alert = () => Promise.resolve(true);
    return fallback;
  }

  const fn = context.confirm;
  fn.confirm = context.confirm;
  fn.alert = context.alert;
  return fn;
}

export default useConfirm;
