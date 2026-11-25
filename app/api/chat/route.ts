import { NextRequest } from "next/server";
import type { GeneratedImage, Message } from "@/lib/types";
import {
  generateImageFromModel,
  getActiveImageModelLabel,
  normalizeAspectRatio,
} from "@/lib/image-gen";

const SYSTEM_INSTRUCTION = [
  "You are Vowray, a calm, articulate, and helpful AI assistant.",
  "Provide clear, well-structured answers using Markdown when helpful (tables, lists, headings, fenced code blocks with language identifiers, and LaTeX math).",
  "When the user asks you to generate, create, draw, or render a raster image, photo, illustration, or artwork (and does NOT specifically ask for SVG/code), delegate to the image generation model by calling the `generate_image` tool with a rich, detailed visual prompt. If tool calling is unavailable, output `[GENERATE_IMAGE: <detailed visual prompt>]` on its own line.",
  "Be concise yet thorough.",
].join(" ");

const GENERATE_IMAGE_TOOL = {
  type: "function",
  function: {
    name: "generate_image",
    description:
      "Generate a raster image, illustration, or artwork using a dedicated image generation model whenever the user asks to create or draw an image.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "A detailed, descriptive visual prompt for the image generation model (subject, style, lighting, composition).",
        },
        aspect_ratio: {
          type: "string",
          enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
          description: "Aspect ratio for the generated image. Defaults to 1:1.",
        },
      },
      required: ["prompt"],
    },
  },
};

interface ChatRequestBody {
  history?: Message[];
  prompt?: string;
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

type StreamEvent =
  | { type: "text"; content: string }
  | { type: "status"; status: string }
  | { type: "image"; image: GeneratedImage };

function encodeEvent(encoder: TextEncoder, event: StreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

async function runImageGeneration(
  prompt: string,
  aspectRatio: string | undefined,
  signal: AbortSignal,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  emitCaption: boolean
) {
  const modelLabel = getActiveImageModelLabel();
  controller.enqueue(
    encodeEvent(encoder, {
      type: "status",
      status: `Generating image with ${modelLabel}…`,
    })
  );

  try {
    const result = await generateImageFromModel({
      prompt,
      aspectRatio: normalizeAspectRatio(aspectRatio),
      signal,
    });

    controller.enqueue(
      encodeEvent(encoder, {
        type: "image",
        image: {
          id: crypto.randomUUID(),
          dataUrl: result.dataUrl,
          prompt: result.prompt,
          model: result.model,
        },
      })
    );

    if (emitCaption) {
      controller.enqueue(
        encodeEvent(encoder, {
          type: "text",
          content: `Generated image for: *${result.prompt}*`,
        })
      );
    }
  } catch (err) {
    if (
      signal.aborted ||
      (err instanceof DOMException && err.name === "AbortError")
    ) {
      return;
    }
    const detail =
      err instanceof Error ? err.message : "Image generation failed.";
    controller.enqueue(
      encodeEvent(encoder, {
        type: "text",
        content: `\n\n> **Image generation unavailable:** ${detail}`,
      })
    );
  } finally {
    controller.enqueue(encodeEvent(encoder, { type: "status", status: "" }));
  }
}

export async function POST(req: NextRequest) {
  const apiKey = (
    process.env.NVIDIA_API_KEY ??
    process.env.GEMINI_API_KEY ??
    ""
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

  // Explicit `/image <prompt>` command routes directly to the image model
  if (/^\/image\s+/i.test(prompt)) {
    const imagePrompt = prompt.replace(/^\/image\s+/i, "").trim();
    const encoder = new TextEncoder();
    const directStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await runImageGeneration(
            imagePrompt,
            "1:1",
            req.signal,
            controller,
            encoder,
            true
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(directStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

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

  const history = Array.isArray(body.history) ? body.history : [];

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...history
      .filter(
        (msg) =>
          !msg.isError &&
          typeof msg.content === "string" &&
          msg.content.trim().length > 0
      )
      .map((msg) => ({
        role: (msg.role === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: msg.content,
      })),
    { role: "user", content: prompt },
  ];

  const requestUpstream = (includeTools: boolean) =>
    fetch(`${baseUrl}/chat/completions`, {
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
        ...(includeTools
          ? { tools: [GENERATE_IMAGE_TOOL], tool_choice: "auto" }
          : {}),
      }),
      signal: req.signal,
    });

  try {
    let upstream = await requestUpstream(true);

    // Gracefully fall back if the configured model/endpoint rejects `tools`
    if (!upstream.ok && upstream.status === 400) {
      upstream = await requestUpstream(false);
    }

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
        let emittedText = false;
        let directiveBuffer = "";
        const pendingToolCalls = new Map<
          number,
          { name: string; arguments: string }
        >();

        const flushDirectiveText = async (forceEnd = false) => {
          while (directiveBuffer.length > 0) {
            const startIdx = directiveBuffer.indexOf("[GENERATE_IMAGE:");
            if (startIdx === -1) {
              // Keep a small tail in case `[GENERATE_IMAGE:` spans chunks
              const safeKeep = forceEnd ? 0 : 18;
              if (directiveBuffer.length > safeKeep) {
                const toEmit = directiveBuffer.slice(
                  0,
                  directiveBuffer.length - safeKeep
                );
                directiveBuffer = directiveBuffer.slice(
                  directiveBuffer.length - safeKeep
                );
                if (toEmit) {
                  emittedText = true;
                  controller.enqueue(
                    encodeEvent(encoder, { type: "text", content: toEmit })
                  );
                }
              }
              break;
            }

            if (startIdx > 0) {
              const before = directiveBuffer.slice(0, startIdx);
              emittedText = true;
              controller.enqueue(
                encodeEvent(encoder, { type: "text", content: before })
              );
              directiveBuffer = directiveBuffer.slice(startIdx);
            }

            const endIdx = directiveBuffer.indexOf("]");
            if (endIdx === -1) {
              if (forceEnd) {
                emittedText = true;
                controller.enqueue(
                  encodeEvent(encoder, {
                    type: "text",
                    content: directiveBuffer,
                  })
                );
                directiveBuffer = "";
              }
              break;
            }

            const tag = directiveBuffer.slice(0, endIdx + 1);
            directiveBuffer = directiveBuffer.slice(endIdx + 1);
            const extractedPrompt = tag
              .slice("[GENERATE_IMAGE:".length, -1)
              .trim();

            if (extractedPrompt) {
              await runImageGeneration(
                extractedPrompt,
                "1:1",
                req.signal,
                controller,
                encoder,
                !emittedText
              );
            }
          }
        };

        const finalizeToolCalls = async () => {
          for (const call of pendingToolCalls.values()) {
            if (call.name !== "generate_image") continue;
            try {
              const args = JSON.parse(call.arguments || "{}") as {
                prompt?: string;
                aspect_ratio?: string;
              };
              const imgPrompt =
                typeof args.prompt === "string" && args.prompt.trim()
                  ? args.prompt.trim()
                  : prompt;
              await runImageGeneration(
                imgPrompt,
                args.aspect_ratio,
                req.signal,
                controller,
                encoder,
                !emittedText
              );
            } catch {
              await runImageGeneration(
                prompt,
                "1:1",
                req.signal,
                controller,
                encoder,
                !emittedText
              );
            }
          }
          pendingToolCalls.clear();
        };

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
                await flushDirectiveText(true);
                await finalizeToolCalls();
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(dataStr) as OpenAIStreamChunk;
                const delta = parsed.choices?.[0]?.delta;

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    const existing = pendingToolCalls.get(idx) ?? {
                      name: "",
                      arguments: "",
                    };
                    if (tc.function?.name) existing.name = tc.function.name;
                    if (tc.function?.arguments) {
                      existing.arguments += tc.function.arguments;
                    }
                    pendingToolCalls.set(idx, existing);
                  }
                }

                if (typeof delta?.content === "string" && delta.content.length > 0) {
                  directiveBuffer += delta.content;
                  await flushDirectiveText(false);
                }
              } catch {
                // Ignore malformed partial SSE frames
              }
            }
          }

          await flushDirectiveText(true);
          await finalizeToolCalls();
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
        "Content-Type": "application/x-ndjson; charset=utf-8",
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
