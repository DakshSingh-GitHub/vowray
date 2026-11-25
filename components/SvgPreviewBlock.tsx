"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Code2, Copy, Download, Eye, Maximize2, X } from "lucide-react";

interface SvgPreviewBlockProps {
  code: string;
  highlightedHtml: string;
}

/**
 * Ensures the SVG markup has an XML namespace so it renders reliably in an <img> tag,
 * and returns a UTF-8 data URL (which browsers sandbox against script execution).
 */
function buildSafeSvgDataUrl(rawSvg: string): string | null {
  const startIdx = rawSvg.search(/<svg[\s>]/i);
  const endIdx = rawSvg.search(/<\/svg>/i);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return null;
  }

  let svg = rawSvg.slice(startIdx, endIdx + "</svg>".length).trim();

  // Ensure xmlns is present on the root <svg> element for standalone <img> rendering
  svg = svg.replace(/<svg(\s[^>]*)?>/i, (tag, attrs = "") => {
    if (/xmlns\s*=/i.test(attrs)) return tag;
    return `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>`;
  });

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function SvgPreviewBlock({ code, highlightedHtml }: SvgPreviewBlockProps) {
  const svgDataUrl = useMemo(() => buildSafeSvgDataUrl(code), [code]);
  const isCompleteSvg = svgDataUrl !== null;

  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [checkerboard, setCheckerboard] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  const activeMode = isCompleteSvg ? viewMode : "code";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vowray-image.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const checkerboardStyle: React.CSSProperties | undefined = checkerboard
    ? {
        backgroundImage:
          "linear-gradient(45deg, var(--border-subtle) 25%, transparent 25%), linear-gradient(-45deg, var(--border-subtle) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--border-subtle) 75%), linear-gradient(-45deg, transparent 75%, var(--border-subtle) 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
      }
    : undefined;

  return (
    <>
      <div className="my-4 rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--code-bg)] shadow-[var(--shadow-soft)]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[var(--code-header)] border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              svg
            </span>

            {isCompleteSvg && (
              <div className="inline-flex items-center rounded-full p-0.5 bg-[var(--surface)]/70 border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                    activeMode === "preview"
                      ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("code")}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                    activeMode === "code"
                      ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Code2 className="w-3 h-3" />
                  <span>Code</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {activeMode === "preview" && isCompleteSvg && (
              <>
                <button
                  type="button"
                  onClick={() => setCheckerboard((prev) => !prev)}
                  title="Toggle transparency grid"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                >
                  <span>{checkerboard ? "Grid: On" : "Grid: Off"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  aria-label="Expand SVG preview"
                  title="Expand preview"
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {isCompleteSvg && (
              <button
                type="button"
                onClick={handleDownload}
                aria-label="Download SVG"
                title="Download .svg"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Save</span>
              </button>
            )}

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
        </div>

        {/* Body */}
        {activeMode === "preview" && svgDataUrl ? (
          <div
            className="p-6 flex items-center justify-center min-h-[160px] max-h-[460px] overflow-auto bg-[var(--surface)]"
            style={checkerboardStyle}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgDataUrl}
              alt="SVG preview"
              className="max-w-full max-h-[400px] h-auto w-auto object-contain select-none"
            />
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <pre className="m-0 p-0 bg-transparent text-[13px] leading-relaxed font-mono">
              <code
                className="hljs language-xml"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </pre>
          </div>
        )}
      </div>

      {/* Expanded Lightbox Modal */}
      {isExpanded && svgDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/55 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-float)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--code-header)]">
              <span className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                SVG Preview
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  aria-label="Close SVG preview"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              className="flex-1 p-6 sm:p-10 flex items-center justify-center overflow-auto min-h-[300px]"
              style={checkerboardStyle}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={svgDataUrl}
                alt="Expanded SVG preview"
                className="max-w-full max-h-[72vh] h-auto w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
