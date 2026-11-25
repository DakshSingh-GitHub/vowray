"use client";

import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import hljs from "highlight.js";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  language?: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const highlightedHtml = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }, [code, language]);

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

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="vowray-markdown text-[15px] leading-[1.7] text-[var(--text-primary)] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
