"use client";

import React, { useEffect } from "react";
import { Trash2, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  sessionTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  sessionTitle,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[3px]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-[var(--shadow-float)] p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="delete-modal-title"
                className="text-base font-semibold tracking-tight text-[var(--text-primary)]"
              >
                Delete conversation
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                This action cannot be undone
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close modal"
            className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--pill-bg)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p
          id="delete-modal-description"
          className="text-sm text-[var(--text-secondary)] leading-relaxed"
        >
          Are you sure you want to delete{" "}
          <span className="font-medium text-[var(--text-primary)]">
            &ldquo;{sessionTitle}&rdquo;
          </span>
          ? Its messages will be permanently removed from this browser.
        </p>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-4 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--pill-bg)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 px-5 rounded-full inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
