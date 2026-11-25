"use client";

import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import hljs from "highlight.js";
import { Check, Copy } from "lucide-react";
import { SvgPreviewBlock } from "./SvgPreviewBlock";

function highlightCode(code: string, language?: string): string {
  try {
    const lang = language === "svg" ? "xml" : language;
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

function isSvgCodeBlock(code: string, language?: string): boolean {
  const normalizedLang = language?.toLowerCase();
  if (normalizedLang === "svg") return true;
  if (!normalizedLang || normalizedLang === "xml" || normalizedLang === "html") {
    return /^\s*(?:<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(code);
  }
  return false;
}

interface CodeBlockProps {
  language?: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const highlightedHtml = useMemo(
    () => highlightCode(code, language),
    [code, language]
  );

  if (isSvgCodeBlock(code, language)) {
    return <SvgPreviewBlock code={code} highlightedHtml={highlightedHtml} />;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--code-bg)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--code-header)] border-b border-[var(--border-subtle)]">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          {language || "text"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        <pre className="m-0 p-0 bg-transparent text-[13px] leading-relaxed font-mono">
          <code
            className={`hljs ${language ? `language-${language}` : ""}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
}

/**
 * Normalizes LaTeX `\[...\]` / `\(...\)` math delimiters and wraps standalone raw
 * `<svg>...</svg>` blocks into fenced `svg` blocks outside of existing code blocks.
 */
function preprocessMarkdown(markdown: string): string {
  const segments = markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g);

  return segments
    .map((segment, index) => {
      // Odd indices are code blocks or inline code spans; leave untouched.
      if (index % 2 === 1) return segment;

      return segment
        .replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr: string) => {
          const trimmed = expr.trim();
          return trimmed ? `\n$$\n${trimmed}\n$$\n` : "";
        })
        .replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr: string) => {
          const trimmed = expr.trim();
          return trimmed ? `$${trimmed}$` : "";
        })
        .replace(/(<svg[\s>][\s\S]*?<\/svg>)/gi, (svgBlock: string) => {
          return `\n\`\`\`svg\n${svgBlock.trim()}\n\`\`\`\n`;
        });
    })
    .join("");
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const processedContent = useMemo(
    () => preprocessMarkdown(content),
    [content]
  );

  return (
    <div className="vowray-markdown text-[15px] leading-[1.7] text-[var(--text-primary)] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold tracking-tight mt-6 mb-3 first:mt-0 text-[var(--text-primary)]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold tracking-tight mt-5 mb-2.5 first:mt-0 text-[var(--text-primary)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-4 mb-2 first:mt-0 text-[var(--text-primary)]">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-3 pl-5 list-disc space-y-1.5 marker:text-[var(--text-muted)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 pl-5 list-decimal space-y-1.5 marker:text-[var(--text-muted)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-2 border-[var(--border-strong)] text-[var(--text-secondary)] italic">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-5 border-t border-[var(--border-subtle)]" />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--text-primary)] transition-colors font-medium"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
              <table className="w-full text-left border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[var(--pill-bg)]/65 border-b border-[var(--border-subtle)]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-[var(--text-secondary)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 border-t border-[var(--border-subtle)] align-top">
              {children}
            </td>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const match = /language-([\w-]+)/.exec(className || "");
            const rawCode = String(children).replace(/\n$/, "");
            const isBlock = Boolean(match) || rawCode.includes("\n");

            if (isBlock) {
              return <CodeBlock language={match?.[1]} code={rawCode} />;
            }

            return (
              <code
                {...props}
                className="font-mono text-[13px] px-1.5 py-0.5 rounded-md bg-[var(--pill-bg)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
              >
                {children}
              </code>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
