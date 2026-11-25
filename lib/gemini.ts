import { GeneratedImage, Message } from "./types";

export interface StreamChatOptions {
  history: Message[];
  prompt: string;
  signal?: AbortSignal;
  onChunk: (accumulatedText: string) => void;
  onStatus?: (status: string) => void;
  onImage?: (image: GeneratedImage) => void;
}

export interface StreamChatResult {
  content: string;
  images: GeneratedImage[];
}

type ChatStreamEvent =
  | { type: "text"; content: string }
  | { type: "status"; status: string }
  | { type: "image"; image: GeneratedImage };

export async function streamChatResponse({
  history,
  prompt,
  signal,
  onChunk,
  onStatus,
  onImage,
}: StreamChatOptions): Promise<StreamChatResult> {
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

  const isNdjson =
    response.headers.get("content-type")?.includes("application/x-ndjson") ??
    false;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  const images: GeneratedImage[] = [];
  let lineBuffer = "";

  const processNdjsonLine = (rawLine: string) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    try {
      const event = JSON.parse(trimmed) as ChatStreamEvent;
      if (event.type === "text" && typeof event.content === "string") {
        accumulated += event.content;
        onChunk(accumulated);
      } else if (event.type === "status" && typeof event.status === "string") {
        onStatus?.(event.status);
      } else if (event.type === "image" && event.image) {
        images.push(event.image);
        onImage?.(event.image);
      }
    } catch {
      // Ignore malformed NDJSON frames
    }
  };

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      break;
    }

    const { value, done } = await reader.read();
    if (done) break;

    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      if (isNdjson) {
        lineBuffer += chunk;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          processNdjsonLine(line);
        }
      } else {
        accumulated += chunk;
        onChunk(accumulated);
      }
    }
  }

  const trailing = decoder.decode();
  if (trailing) {
    if (isNdjson) {
      lineBuffer += trailing;
    } else {
      accumulated += trailing;
      onChunk(accumulated);
    }
  }

  if (isNdjson && lineBuffer.trim()) {
    processNdjsonLine(lineBuffer);
  }

  onStatus?.("");
  return { content: accumulated, images };
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
