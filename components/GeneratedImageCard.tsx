"use client";

import React, { useEffect, useState } from "react";
import { Download, Maximize2, Sparkles, X } from "lucide-react";
import { GeneratedImage } from "@/lib/types";

interface GeneratedImageCardProps {
  image: GeneratedImage;
}

export function GeneratedImageCard({ image }: GeneratedImageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = image.dataUrl;
    const isPng = image.dataUrl.startsWith("data:image/png");
    link.download = `vowray-generated.${isPng ? "png" : "jpg"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="my-3 rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-[var(--shadow-soft)] max-w-lg">
        <div className="relative group bg-[var(--code-bg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.dataUrl}
            alt={image.prompt}
            onClick={() => setIsExpanded(true)}
            className="w-full max-h-[420px] object-contain cursor-zoom-in block"
          />
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              aria-label="Expand image"
              title="Expand image"
              className="h-8 w-8 rounded-full flex items-center justify-center bg-black/55 text-white hover:bg-black/75 backdrop-blur-sm transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              aria-label="Download image"
              title="Download image"
              className="h-8 w-8 rounded-full flex items-center justify-center bg-black/55 text-white hover:bg-black/75 backdrop-blur-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="px-3.5 py-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {image.prompt}
            </p>
            {image.model && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono text-[var(--text-muted)]">
                <Sparkles className="w-2.5 h-2.5" />
                <span>{image.model}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--pill-bg)] transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/65 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-float)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--code-header)]">
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {image.prompt}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
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
                  aria-label="Close image preview"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 flex items-center justify-center overflow-auto bg-[var(--code-bg)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.dataUrl}
                alt={image.prompt}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
