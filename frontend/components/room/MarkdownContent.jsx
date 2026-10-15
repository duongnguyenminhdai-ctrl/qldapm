"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Nút sao chép mã nguồn với hiệu ứng phản hồi trực quan
 */
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950 shadow-md">
      <div className="flex items-center justify-between border-b border-zinc-800/70 bg-zinc-900/70 px-3.5 py-1.5 text-[11px] text-zinc-400">
        <span className="font-mono lowercase text-zinc-400">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          title="Sao chép đoạn mã"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Đã sao chép</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-zinc-200 selection:bg-violet-500/30">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Trình phân tích & hiển thị Markdown siêu nhẹ, tối ưu cho câu trả lời từ AI
 * Hỗ trợ: Code block có nút Copy, inline code, bold, italic, headers, bullet list, blockquotes
 */
export function MarkdownContent({ content = "", className = "" }) {
  if (!content) return null;

  // Tách khối code block (```lang ... ```) khỏi văn bản thường
  const parts = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: "code",
      language: match[1] || "text",
      code: match[2].trimEnd(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  return (
    <div className={cn("text-xs leading-relaxed text-zinc-200 space-y-2", className)}>
      {parts.map((part, index) => {
        if (part.type === "code") {
          return (
            <CodeBlock
              key={`code-${index}`}
              language={part.language}
              code={part.code}
            />
          );
        }

        // Render đoạn văn bản thông thường
        return (
          <div key={`text-${index}`} className="space-y-1.5">
            {renderFormattedText(part.content)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Render từng dòng văn bản (tiêu đề, danh sách, quote, in đậm, inline code)
 */
function renderFormattedText(rawText) {
  const lines = rawText.split("\n");
  const renderedElements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      renderedElements.push(
        <ul key={`ul-${renderedElements.length}`} className="my-1.5 space-y-1 pl-4 list-disc marker:text-violet-400">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Dòng trống
    if (!trimmed) {
      flushList();
      return;
    }

    // Tiêu đề ###
    if (trimmed.startsWith("### ")) {
      flushList();
      renderedElements.push(
        <h4
          key={`h4-${lineIdx}`}
          className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-violet-400"
        >
          {parseInlineMarkdown(trimmed.slice(4))}
        </h4>
      );
      return;
    }

    // Tiêu đề ##
    if (trimmed.startsWith("## ")) {
      flushList();
      renderedElements.push(
        <h3
          key={`h3-${lineIdx}`}
          className="mt-3 mb-1 text-sm font-semibold text-zinc-100"
        >
          {parseInlineMarkdown(trimmed.slice(3))}
        </h3>
      );
      return;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      flushList();
      renderedElements.push(
        <blockquote
          key={`quote-${lineIdx}`}
          className="my-2 rounded-r-lg border-l-2 border-violet-500/70 bg-violet-500/5 px-3 py-1.5 text-xs italic text-zinc-300"
        >
          {parseInlineMarkdown(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    // Danh sách bullet (- hoặc *)
    if (/^[-*]\s+/.test(trimmed)) {
      currentList.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }

    // Danh sách đánh số (1., 2., etc.)
    if (/^\d+\.\s+/.test(trimmed)) {
      currentList.push(trimmed.replace(/^\d+\.\s+/, ""));
      return;
    }

    // Đoạn văn bản thường
    flushList();
    renderedElements.push(
      <p key={`p-${lineIdx}`} className="leading-relaxed text-zinc-300">
        {parseInlineMarkdown(trimmed)}
      </p>
    );
  });

  flushList();
  return renderedElements;
}

/**
 * Parse in đậm (**bold**), in nghiêng (*italic*), và inline code (`code`)
 */
function parseInlineMarkdown(text) {
  if (!text) return "";

  // Tách inline code trước
  const codeSegments = text.split(/`([^`]+)`/g);

  return codeSegments.map((segment, segIdx) => {
    // Nếu là đoạn inline code
    if (segIdx % 2 === 1) {
      return (
        <code
          key={`inline-code-${segIdx}`}
          className="mx-0.5 rounded-md border border-zinc-800 bg-zinc-900/90 px-1.5 py-0.5 font-mono text-[11px] text-violet-300"
        >
          {segment}
        </code>
      );
    }

    // Với đoạn thường: parse **bold**
    const boldSegments = segment.split(/\*\*([^*]+)\*\*/g);
    return boldSegments.map((sub, bIdx) => {
      if (bIdx % 2 === 1) {
        return (
          <strong key={`b-${segIdx}-${bIdx}`} className="font-semibold text-zinc-100">
            {sub}
          </strong>
        );
      }
      return sub;
    });
  });
}
