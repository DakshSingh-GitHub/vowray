"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChatSession, Message, ThemeMode } from "@/lib/types";
import {
  deleteSessionFromDb,
  generateSessionTitle,
  loadActiveSessionId,
  loadSessions,
  loadTheme,
  putSession,
  saveActiveSessionId,
  saveTheme,
} from "@/lib/storage";
import {
  formatChatError,
  generateSummaryTitle,
  streamChatResponse,
} from "@/lib/gemini";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { ChatArea } from "./ChatArea";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function VowrayApp() {
  const [hydrated, setHydrated] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTargetRef = useRef<{
    sessionId: string;
    messageId: string;
  } | null>(null);
  const sessionsRef = useRef<ChatSession[]>([]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Hydrate client state from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [loadedSessions, loadedActiveId, loadedTheme] = await Promise.all([
        loadSessions(),
        loadActiveSessionId(),
        loadTheme(),
      ]);

      if (cancelled) return;

      setSessions(loadedSessions);
      setTheme(loadedTheme);

      if (
        loadedActiveId &&
        loadedSessions.some((s) => s.id === loadedActiveId)
      ) {
        setActiveSessionId(loadedActiveId);
      } else if (loadedSessions.length > 0) {
        setActiveSessionId(loadedSessions[0].id);
      }

      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }

      setHydrated(true);
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync theme class on <html> and persist to IndexedDB
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    void saveTheme(theme);
  }, [theme, hydrated]);

  // Persist active session ID to IndexedDB
  useEffect(() => {
    if (!hydrated) return;
    void saveActiveSessionId(activeSessionId);
  }, [activeSessionId, hydrated]);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? null;

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const target = streamingTargetRef.current;
    streamingTargetRef.current = null;

    if (target) {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== target.sessionId) return s;
          const updated: ChatSession = {
            ...s,
            updatedAt: Date.now(),
            messages: s.messages.map((m) =>
              m.id === target.messageId ? { ...m, isStopped: true } : m
            ),
          };
          void putSession(updated);
          return updated;
        })
      );
    }

    setIsStreaming(false);
  }, []);

  const handleNewChat = () => {
    handleStopStreaming();
    setActiveSessionId(null);
  };

  const handleSelectSession = (id: string) => {
    if (id === activeSessionId) return;
    handleStopStreaming();
    setActiveSessionId(id);
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, title: newTitle, hasCustomTitle: true };
        void putSession(updated);
        return updated;
      })
    );
  };

  const handleRequestDeleteSession = (id: string) => {
    setPendingDeleteId(id);
  };

  const handleConfirmDeleteSession = () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);

    if (id === activeSessionId) {
      handleStopStreaming();
    }

    void deleteSessionFromDb(id);

    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (id === activeSessionId) {
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  const pendingDeleteSession =
    sessions.find((s) => s.id === pendingDeleteId) ?? null;

  const handleSendMessage = async (promptText: string) => {
    const now = Date.now();
    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: promptText,
      createdAt: now,
    };

    const assistantMessageId = createId();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "model",
      content: "",
      createdAt: now + 1,
    };

    let targetSessionId = activeSessionId;
    let historyBeforePrompt: Message[] = [];
    let isFirstPrompt = false;

    if (!targetSessionId) {
      targetSessionId = createId();
      isFirstPrompt = true;
      const newSession: ChatSession = {
        id: targetSessionId,
        title: generateSessionTitle(promptText),
        createdAt: now,
        updatedAt: now,
        messages: [userMessage, assistantPlaceholder],
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(targetSessionId);
      void putSession(newSession);
    } else {
      const existing = sessionsRef.current.find((s) => s.id === targetSessionId);
      historyBeforePrompt = existing?.messages ?? [];
      isFirstPrompt = historyBeforePrompt.length === 0;

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          const updated: ChatSession = {
            ...s,
            title: isFirstPrompt ? generateSessionTitle(promptText) : s.title,
            updatedAt: now,
            messages: [...s.messages, userMessage, assistantPlaceholder],
          };
          void putSession(updated);
          return updated;
        })
      );
    }

    if (isFirstPrompt) {
      const sessionIdForTitle = targetSessionId;
      void generateSummaryTitle(promptText).then((summaryTitle) => {
        if (!summaryTitle) return;
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionIdForTitle || s.hasCustomTitle) return s;
            const updated: ChatSession = { ...s, title: summaryTitle };
            void putSession(updated);
            return updated;
          })
        );
      });
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    streamingTargetRef.current = {
      sessionId: targetSessionId,
      messageId: assistantMessageId,
    };
    setIsStreaming(true);

    let lastPersistedAt = 0;

    try {
      const finalContent = await streamChatResponse({
        history: historyBeforePrompt,
        prompt: promptText,
        signal: controller.signal,
        onChunk: (accumulatedText) => {
          if (controller.signal.aborted) return;
          const chunkTime = Date.now();
          const shouldPersist = chunkTime - lastPersistedAt > 400;
          if (shouldPersist) lastPersistedAt = chunkTime;

          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== targetSessionId) return s;
              const updated: ChatSession = {
                ...s,
                updatedAt: chunkTime,
                messages: s.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: accumulatedText }
                    : m
                ),
              };
              if (shouldPersist) {
                void putSession(updated);
              }
              return updated;
            })
          );
        },
      });

      if (!finalContent && !controller.signal.aborted) {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== targetSessionId) return s;
            const updated: ChatSession = {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content: "No response was returned.",
                      isError: true,
                    }
                  : m
              ),
            };
            void putSession(updated);
            return updated;
          })
        );
      } else {
        const latest = sessionsRef.current.find((s) => s.id === targetSessionId);
        if (latest) {
          void putSession(latest);
        }
      }
    } catch (error) {
      const isAborted =
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError");

      if (!isAborted) {
        const errorText = formatChatError(error);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== targetSessionId) return s;
            const updated: ChatSession = {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content: errorText,
                      isError: true,
                    }
                  : m
              ),
            };
            void putSession(updated);
            return updated;
          })
        );
      } else {
        const latest = sessionsRef.current.find((s) => s.id === targetSessionId);
        if (latest) {
          void putSession(latest);
        }
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (
        streamingTargetRef.current?.sessionId === targetSessionId &&
        streamingTargetRef.current?.messageId === assistantMessageId
      ) {
        streamingTargetRef.current = null;
      }
      setIsStreaming(false);
    }
  };

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden bg-[var(--canvas)] text-[var(--text-primary)]">
      <Header
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          onCloseMobile={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setIsSidebarOpen(false);
            }
          }}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleRequestDeleteSession}
        />

        <ChatArea
          messages={activeSession?.messages ?? []}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onStopStreaming={handleStopStreaming}
        />
      </div>

      <DeleteConfirmModal
        isOpen={pendingDeleteSession !== null}
        sessionTitle={pendingDeleteSession?.title ?? "this conversation"}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={handleConfirmDeleteSession}
      />
    </div>
  );
}
