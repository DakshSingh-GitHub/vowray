import { Message } from "./types";

export interface StreamChatOptions {
  history: Message[];
  prompt: string;
  signal?: AbortSignal;
  onChunk: (accumulatedText: string) => void;
}

export async function streamChatResponse({
  history,
  prompt,
  signal,
  onChunk,
}: StreamChatOptions): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      history,
      prompt,
    }),
    signal,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}.`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        errorMessage = data.error;
      }
    } catch {
      // Fall back to status message
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("No response stream received from the server.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      break;
    }

    const { value, done } = await reader.read();
    if (done) break;

    if (value) {
      accumulated += decoder.decode(value, { stream: true });
      onChunk(accumulated);
    }
  }

  const trailing = decoder.decode();
  if (trailing) {
    accumulated += trailing;
    onChunk(accumulated);
  }

  return accumulated;
}

export function formatChatError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Generation stopped.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred while generating a response.";
}

export async function generateSummaryTitle(
  prompt: string
): Promise<string | null> {
  try {
    const response = await fetch("/api/title", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: string | null };
    return typeof data.title === "string" && data.title.trim().length > 0
      ? data.title.trim()
      : null;
  } catch {
    return null;
  }
}
