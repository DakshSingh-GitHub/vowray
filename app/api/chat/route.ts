import { NextRequest } from "next/server";
import type { Message } from "@/lib/types";

const SYSTEM_INSTRUCTION =
  "You are Vowray, a calm, articulate, and helpful AI assistant. Provide clear, well-structured answers using Markdown when helpful (tables, lists, headings, and fenced code blocks with language identifiers). Be concise yet thorough.";

interface ChatRequestBody {
  history?: Message[];
  prompt?: string;
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
  }>;
}

export async function POST(req: NextRequest) {
  const apiKey = (
    process.env.NVIDIA_API_KEY ??
    process.env.GEMINI_API_KEY ??
    ""
  ).trim();

  if (!apiKey) {
    return Response.json(
      {
        error:
          "Server API key is not configured. Add NVIDIA_API_KEY to your .env file and restart the server.",
      },
      { status: 500 }
    );
  }

  const baseUrl = (
    process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1"
  )
    .trim()
    .replace(/\/+$/, "");

  const model = (
    process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3.5-super-vl-120b-a12b"
  ).trim();

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...history
      .filter(
        (msg) =>
          !msg.isError &&
          typeof msg.content === "string" &&
          msg.content.trim().length > 0
      )
      .map((msg) => ({
        role: (msg.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: msg.content,
      })),
    { role: "user", content: prompt },
  ];

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: req.signal,
    });

    if (!upstream.ok) {
      let errorDetail = `Upstream request failed with status ${upstream.status}.`;
      try {
        const errText = await upstream.text();
        if (errText) {
          try {
            const parsed = JSON.parse(errText) as {
              error?: { message?: string } | string;
              detail?: string;
            };
            if (typeof parsed.error === "string") {
              errorDetail = parsed.error;
            } else if (parsed.error?.message) {
              errorDetail = parsed.error.message;
            } else if (parsed.detail) {
              errorDetail = parsed.detail;
            }
          } catch {
            errorDetail = errText.slice(0, 300);
          }
        }
      } catch {
        // Use fallback errorDetail
      }
      return Response.json({ error: errorDetail }, { status: upstream.status });
    }

    if (!upstream.body) {
      return Response.json(
        { error: "No response stream received from upstream API." },
        { status: 502 }
      );
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            if (req.signal.aborted) {
              await reader.cancel();
              break;
            }

            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line || !line.startsWith("data:")) continue;
              const dataStr = line.slice(5).trim();
              if (dataStr === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(dataStr) as OpenAIStreamChunk;
                const delta = parsed.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length > 0) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // Ignore malformed partial SSE frames
              }
            }
          }
          controller.close();
        } catch (err) {
          if (
            req.signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError")
          ) {
            controller.close();
            return;
          }
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    if (
      req.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      return new Response(null, { status: 499 });
    }

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while generating a response.";

    return Response.json({ error: message }, { status: 500 });
  }
}
