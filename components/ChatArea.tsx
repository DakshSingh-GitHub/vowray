"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, Check, Copy, Sparkles, Square } from "lucide-react";
import { Message, STARTER_PROMPTS } from "@/lib/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { GeneratedImageCard } from "./GeneratedImageCard";
import { VowrayLogo } from "./VowrayLogo";

interface ChatAreaProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
  onStopStreaming: () => void;
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy response"
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--pill-bg)] transition-colors cursor-pointer"
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
  );
}

export function ChatArea({
  messages,
  isStreaming,
  onSendMessage,
  onStopStreaming,
}: ChatAreaProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea and only show scrollbar when content exceeds max height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 200 ? "auto" : "hidden";
  }, [input]);

  // Smooth scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full relative">
      {/* Scrollable Message Feed or Empty State */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-4">
        {messages.length === 0 ? (
          <div className="h-full max-w-3xl mx-auto flex flex-col items-center justify-center py-8">
            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-12 h-12 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-[var(--shadow-soft)] flex items-center justify-center mb-5">
                <VowrayLogo className="w-7 h-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)] mb-2">
                Hello, I&apos;m Vowray
              </h1>
              <p className="text-sm sm:text-[15px] text-[var(--text-secondary)] max-w-md leading-relaxed">
                A calm workspace for thinking, writing, and building.
              </p>
            </div>

            {/* 2x2 Starter Prompt Cards */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {STARTER_PROMPTS.map((starter) => (
                <button
                  key={starter.title}
                  type="button"
                  onClick={() => onSendMessage(starter.prompt)}
                  className="text-left p-5 rounded-2xl bg-[var(--surface-elevated)] hover:bg-[var(--pill-bg)]/60 border border-[var(--border-subtle)] hover:border-[var(--border-strong)] shadow-[var(--shadow-soft)] transition-all group cursor-pointer"
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)] mb-1 group-hover:translate-x-0.5 transition-transform">
                    {starter.title}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {starter.subtitle}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              const isLast = index === messages.length - 1;
              const isCurrentlyStreamingThis =
                !isUser && isStreaming && isLast;

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[75%] px-5 py-3.5 rounded-3xl rounded-br-lg bg-[var(--user-bubble)] border border-[var(--border-subtle)] text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words shadow-[var(--shadow-soft)]">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-[var(--shadow-soft)] flex items-center justify-center shrink-0 mt-0.5">
                    <VowrayLogo className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        Vowray
                      </span>
                    </div>

                    {msg.isError ? (
                      <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-red-500/8 border border-red-500/20 text-sm text-red-700 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>{msg.content}</p>
                      </div>
                    ) : (
                      <>
                        {msg.statusText && (
                          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[var(--pill-bg)]/80 border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)]">
                            <Sparkles className="w-3.5 h-3.5 animate-pulse text-[var(--text-primary)]" />
                            <span>{msg.statusText}</span>
                          </div>
                        )}

                        {msg.images && msg.images.length > 0 && (
                          <div className="space-y-3">
                            {msg.images.map((img) => (
                              <GeneratedImageCard key={img.id} image={img} />
                            ))}
                          </div>
                        )}

                        {msg.content ? (
                          <div className="pt-0.5">
                            <MarkdownRenderer content={msg.content} />
                          </div>
                        ) : isCurrentlyStreamingThis &&
                          !msg.isStopped &&
                          !msg.statusText &&
                          !(msg.images && msg.images.length > 0) ? (
                          <div className="flex items-center gap-1.5 py-2 text-xs text-[var(--text-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-pulse" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-pulse [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-pulse [animation-delay:300ms]" />
                          </div>
                        ) : null}

                        {msg.isStopped && (
                          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[var(--pill-bg)]/80 border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)]">
                            <Square className="w-3 h-3 fill-current text-[var(--text-muted)]" />
                            <span>User stopped the response</span>
                          </div>
                        )}
                      </>
                    )}

                    {!isCurrentlyStreamingThis &&
                      !msg.isError &&
                      msg.content && (
                        <div className="pt-1 flex items-center">
                          <CopyMessageButton text={msg.content} />
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Bottom Floating Composer */}
      <div className="shrink-0 px-4 sm:px-6 pb-4 pt-2 bg-gradient-to-t from-[var(--canvas)] via-[var(--canvas)]/90 to-transparent">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-strong)] shadow-[var(--shadow-float)] p-2.5 pl-4 flex items-end gap-2 transition-colors focus-within:border-[var(--text-secondary)]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Vowray…"
              aria-label="Message Vowray"
              className="flex-1 max-h-[200px] overflow-y-hidden py-2 bg-transparent resize-none outline-none text-[15px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                aria-label="Stop generating"
                title="Stop generating"
                className="h-10 px-4 rounded-full bg-[var(--pill-bg)] hover:bg-[var(--pill-hover)] border border-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="Send message"
                title="Send message"
                className="h-10 w-10 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-text)] flex items-center justify-center shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">
            Vowray can make mistakes. Verify important details.
          </p>
        </div>
      </div>
    </div>
  );
}
