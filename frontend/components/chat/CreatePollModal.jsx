"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { BarChart2, Plus, X, Trash2, Settings, CheckSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_QUESTION_LENGTH = 200;
const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;

export default function CreatePollModal({
  isOpen,
  open,
  onClose,
  onOpenChange,
  onSubmit,
  onCreatePoll,
}) {
  const modalOpen = Boolean(isOpen ?? open);
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Đảm bảo không bị bất kỳ thư viện ngoài nào (như Radix/inert/aria-hidden) vô hiệu hóa tương tác
  useEffect(() => {
    if (!modalOpen || !wrapperRef.current) return;
    const el = wrapperRef.current;
    if (el.hasAttribute("aria-hidden")) el.removeAttribute("aria-hidden");
    if (el.hasAttribute("inert")) el.removeAttribute("inert");

    const observer = new MutationObserver(() => {
      if (el.hasAttribute("aria-hidden")) el.removeAttribute("aria-hidden");
      if (el.hasAttribute("inert")) el.removeAttribute("inert");
    });
    observer.observe(el, { attributes: true, attributeFilter: ["aria-hidden", "inert"] });

    return () => observer.disconnect();
  }, [modalOpen]);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  }, [onClose, onOpenChange]);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowAddOptions, setAllowAddOptions] = useState(false);
  const [error, setError] = useState("");

  // Tự động nhận focus vào ô câu hỏi khi mở modal
  useEffect(() => {
    if (modalOpen) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [modalOpen]);

  // Reset form khi modal mở ra
  useEffect(() => {
    if (modalOpen) {
      setQuestion("");
      setOptions(["", ""]);
      setAllowMultiple(false);
      setAllowAddOptions(false);
      setError("");
    }
  }, [modalOpen]);

  // Phím tắt Escape để đóng modal
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen, handleClose]);

  const handleAddOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions((prev) => [...prev, ""]);
    }
  };

  const handleRemoveOption = (indexToRemove) => {
    if (options.length > MIN_OPTIONS) {
      setOptions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    }
  };

  const handleOptionChange = (index, value) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleApplyPreset = (presetList) => {
    setOptions([...presetList]);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    setError("");

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError("Vui lòng đặt câu hỏi bình chọn.");
      return;
    }

    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (trimmedOptions.length < MIN_OPTIONS) {
      setError("Bình chọn cần ít nhất 2 lựa chọn có nội dung.");
      return;
    }

    const pollPayload = {
      question: trimmedQuestion,
      options: trimmedOptions,
      allowMultiple,
      allowAddOptions,
    };

    if (onSubmit) {
      onSubmit(pollPayload);
    } else if (onCreatePoll) {
      onCreatePoll(pollPayload);
    }

    handleClose();
  };

  if (!mounted || !modalOpen) return null;

  const validOptionsCount = options.map((o) => o.trim()).filter(Boolean).length;
  const isSubmitDisabled = !question.trim() || validOptionsCount < MIN_OPTIONS;

  return createPortal(
    <div
      ref={wrapperRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-auto"
    >
      {/* 1. Backdrop: nằm riêng, CHỈ làm nền, không bọc thẻ modal */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm pointer-events-auto cursor-pointer"
        onClick={handleClose}
      />

      {/* 2. Modal Box: PHẢI CÓ z-10, relative, pointer-events-auto, select-auto */}
      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#181513] p-0 shadow-2xl text-stone-200 pointer-events-auto select-auto overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header chuẩn Zalo với phong cách Dark Academia */}
        <div className="flex items-center justify-between border-b border-[#382f26] px-5 py-3.5 bg-[#1f1a16]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c3a47b]/20 text-[#c3a47b] border border-[#c3a47b]/40 shadow-inner">
              <BarChart2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f5ede3] font-serif leading-snug">
                Tạo bình chọn
              </h3>
              <p className="text-[11px] text-[#a89b8d]">
                Biểu quyết ý kiến trực tiếp trong phòng học
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-stone-400 hover:text-stone-100 hover:bg-[#2a241e] transition cursor-pointer"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pointer-events-auto relative z-10 px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Ô nhập câu hỏi */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="poll-question-input"
                className="text-xs font-medium text-[#d8c8b4] cursor-pointer hover:text-[#f5ede3] transition select-none"
              >
                Câu hỏi bình chọn <span className="text-rose-400">*</span>
              </label>
              <span className={cn(
                "font-mono text-[11px]",
                question.length >= MAX_QUESTION_LENGTH ? "text-rose-400 font-bold" : "text-stone-400"
              )}>
                {question.length}/{MAX_QUESTION_LENGTH}
              </span>
            </div>
            <textarea
              id="poll-question-input"
              ref={textareaRef}
              tabIndex={0}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Đặt câu hỏi bình chọn (Ví dụ: Chúng ta nên giải bài tập nào trước?)..."
              maxLength={MAX_QUESTION_LENGTH}
              rows={2}
              className="relative z-20 pointer-events-auto cursor-text select-text focus:outline-none w-full resize-none rounded-xl border border-[#382f26] bg-[#12100e] px-3 py-2 text-xs text-[#f5ede3] placeholder:text-stone-500 focus:border-[#c3a47b] focus:ring-1 focus:ring-[#c3a47b] transition"
              autoFocus
            />
          </div>

          {/* Preset gợi ý nhanh */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-stone-400 flex items-center gap-1 select-none">
              <Sparkles className="h-3 w-3 text-[#c3a47b]" /> Mẫu:
            </span>
            <button
              type="button"
              onClick={() => handleApplyPreset(["Có", "Không"])}
              className="rounded-lg border border-[#382f26] bg-[#221c17] px-2 py-0.5 text-[11px] text-[#d8c8b4] hover:border-[#c3a47b]/50 hover:text-[#f5ede3] transition cursor-pointer select-none"
            >
              Có / Không
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(["Đồng ý", "Phản đối"])}
              className="rounded-lg border border-[#382f26] bg-[#221c17] px-2 py-0.5 text-[11px] text-[#d8c8b4] hover:border-[#c3a47b]/50 hover:text-[#f5ede3] transition cursor-pointer select-none"
            >
              Đồng ý / Phản đối
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset(["Phương án A", "Phương án B", "Phương án C"])}
              className="rounded-lg border border-[#382f26] bg-[#221c17] px-2 py-0.5 text-[11px] text-[#d8c8b4] hover:border-[#c3a47b]/50 hover:text-[#f5ede3] transition cursor-pointer select-none"
            >
              A / B / C
            </button>
          </div>

          {/* Danh sách các lựa chọn */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#d8c8b4] select-none">
                Các phương án ({options.length}/{MAX_OPTIONS}) <span className="text-rose-400">*</span>
              </label>
              {options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#c3a47b] hover:text-[#e0caaa] transition cursor-pointer select-none"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm lựa chọn</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <label
                    htmlFor={`poll-option-${idx}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#382f26] bg-[#1f1a16] text-[11px] font-mono text-[#a89b8d] cursor-pointer hover:border-[#c3a47b]/40 hover:text-[#f5ede3] transition select-none"
                    title={`Chọn phương án ${idx + 1}`}
                  >
                    {idx + 1}
                  </label>
                  <input
                    id={`poll-option-${idx}`}
                    type="text"
                    tabIndex={0}
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Lựa chọn ${idx + 1}...`}
                    maxLength={100}
                    className="relative z-20 pointer-events-auto cursor-text select-text focus:outline-none flex-1 rounded-xl border border-[#382f26] bg-[#12100e] px-3 py-1.5 text-xs text-[#f5ede3] placeholder:text-stone-500 focus:border-[#c3a47b] focus:ring-1 focus:ring-[#c3a47b] transition"
                  />
                  {options.length > MIN_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      title="Xóa lựa chọn này"
                      className="rounded-lg p-1.5 text-stone-400 hover:bg-rose-950/40 hover:text-rose-400 transition cursor-pointer shrink-0 select-none"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>


          {/* Cụm cài đặt nâng cao phong cách Zalo */}
          <div className="space-y-2.5 pt-2 border-t border-[#382f26]/80">
            <div className="text-[11px] font-semibold text-[#c3a47b] uppercase tracking-wider flex items-center gap-1.5">
              <Settings className="h-3 w-3" /> Cài đặt bình chọn
            </div>

            <label className="flex items-center justify-between p-2.5 rounded-xl border border-[#382f26] bg-[#1f1a16]/60 hover:bg-[#1f1a16] transition cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-[#c3a47b]" />
                <div>
                  <div className="text-xs font-medium text-[#f5ede3]">
                    Chọn nhiều phương án
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Thành viên có thể chọn nhiều hơn 1 phương án
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="h-4 w-4 rounded border-[#382f26] bg-[#141210] text-[#c3a47b] accent-[#c3a47b] focus:ring-[#c3a47b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-xl border border-[#382f26] bg-[#1f1a16]/60 hover:bg-[#1f1a16] transition cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#c3a47b]" />
                <div>
                  <div className="text-xs font-medium text-[#f5ede3]">
                    Cho phép thêm phương án mới
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Các thành viên khác có thể nhập thêm phương án
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={allowAddOptions}
                onChange={(e) => setAllowAddOptions(e.target.checked)}
                className="h-4 w-4 rounded border-[#382f26] bg-[#141210] text-[#c3a47b] accent-[#c3a47b] focus:ring-[#c3a47b] cursor-pointer"
              />
            </label>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-400 bg-rose-950/30 border border-rose-900/50 p-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="pt-2 border-t border-[#382f26] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-[#382f26] bg-[#221c17] text-stone-300 hover:bg-[#2b231d] hover:text-white text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              className="bg-[#c3a47b] text-[#141210] font-semibold hover:bg-[#d6b88f] text-xs px-4 shadow-md transition disabled:opacity-50"
            >
              Tạo bình chọn
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
