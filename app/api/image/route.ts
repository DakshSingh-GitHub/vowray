import { NextRequest } from "next/server";
import {
  generateImageFromModel,
  normalizeAspectRatio,
} from "@/lib/image-gen";

interface ImageRequestBody {
  prompt?: string;
  aspectRatio?: string;
}

export async function POST(req: NextRequest) {
  let body: ImageRequestBody;
  try {
    body = (await req.json()) as ImageRequestBody;
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

  try {
    const result = await generateImageFromModel({
      prompt,
      aspectRatio: normalizeAspectRatio(body.aspectRatio),
      signal: req.signal,
    });

    return Response.json({
      image: {
        id: crypto.randomUUID(),
        dataUrl: result.dataUrl,
        prompt: result.prompt,
        model: result.model,
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
        : "Failed to generate image.";
    return Response.json({ error: message }, { status: 500 });
  }
}
