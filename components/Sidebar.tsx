"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ChatSession } from "@/lib/types";
import { groupSessionsChronologically } from "@/lib/storage";

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
}

export function Sidebar({
  isOpen,
  onCloseMobile,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setDraftTitle(session.title);
  };

  const commitRename = (id: string) => {
    const trimmed = draftTitle.trim();
    if (trimmed) {
      onRenameSession(id, trimmed);
    }
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftTitle("");
  };

  const grouped = groupSessionsChronologically(sessions);

  const sidebarContent = (
    <aside className="w-72 h-full flex flex-col bg-[var(--surface)] border-r border-[var(--border-subtle)] select-none">
      {/* Top Action: + New Chat */}
      <div className="p-4 pb-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="w-full h-11 px-4 rounded-full bg-[var(--pill-bg)] hover:bg-[var(--pill-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-[var(--shadow-soft)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Chronologically Grouped Chat History */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {grouped.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Your conversations will appear here and persist locally in your
              browser.
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                {group.label}
              </div>
              <ul className="space-y-1">
                {group.items.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isEditing = editingId === session.id;

                  return (
                    <li key={session.id}>
                      {isEditing ? (
                        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[var(--pill-bg)] border border-[var(--border-strong)]">
                          <input
                            ref={inputRef}
                            type="text"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitRename(session.id);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                            onBlur={() => commitRename(session.id)}
                            aria-label="Rename conversation"
                            className="flex-1 min-w-0 bg-transparent text-xs font-medium text-[var(--text-primary)] outline-none px-1"
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              commitRename(session.id);
                            }}
                            aria-label="Save title"
                            className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              cancelRename();
                            }}
                            aria-label="Cancel rename"
                            className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            onSelectSession(session.id);
                            onCloseMobile();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelectSession(session.id);
                              onCloseMobile();
                            }
                          }}
                          className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-full text-sm transition-colors cursor-pointer ${
                            isActive
                              ? "bg-[var(--pill-bg)] text-[var(--text-primary)] font-medium"
                              : "text-[var(--text-secondary)] hover:bg-[var(--pill-bg)]/70 hover:text-[var(--text-primary)]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-65" />
                            <span className="truncate text-[13px]">
                              {session.title}
                            </span>
                          </div>

                          <div
                            className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                              isActive
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => startEditing(session, e)}
                              aria-label="Rename chat"
                              title="Rename"
                              className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(session.id);
                              }}
                              aria-label="Delete chat"
                              title="Delete"
                              className="p-1 rounded-full text-[var(--text-muted)] hover:text-red-600 dark:hover:text-red-400 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop collapsible sidebar */}
      <div
        className={`hidden md:block shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${
          isOpen ? "w-72" : "w-0"
        }`}
      >
        <div className="w-72 h-full">{sidebarContent}</div>
      </div>

      {/* Mobile slide-over drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
