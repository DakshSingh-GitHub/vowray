import { GoogleGenAI } from "@google/genai";

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: AspectRatio;
  signal?: AbortSignal;
}

export interface GenerateImageResult {
  dataUrl: string;
  prompt: string;
  model: string;
}

const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "4:3": { width: 1152, height: 896 },
  "3:4": { width: 896, height: 1152 },
};

export function normalizeAspectRatio(raw?: string): AspectRatio {
  if (
    raw === "1:1" ||
    raw === "16:9" ||
    raw === "9:16" ||
    raw === "4:3" ||
    raw === "3:4"
  ) {
    return raw;
  }
  return "1:1";
}

export function getActiveImageModelLabel(): string {
  const provider = resolveProvider();
  if (provider === "gemini") {
    return (process.env.GEMINI_IMAGE_MODEL ?? "imagen-3.0-generate-002").trim();
  }
  if (provider === "openai") {
    return (process.env.IMAGE_MODEL ?? "dall-e-3").trim();
  }
  return (
    process.env.NVIDIA_IMAGE_MODEL ?? "black-forest-labs/flux.1-schnell"
  ).trim();
}

function resolveProvider(): "nvidia" | "gemini" | "openai" {
  const explicit = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  if (explicit === "gemini" || explicit === "nvidia" || explicit === "openai") {
    return explicit;
  }
  if (process.env.IMAGE_API_URL?.trim()) {
    return "openai";
  }
  if (
    (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) &&
    !process.env.NVIDIA_API_KEY?.trim()
  ) {
    return "gemini";
  }
  return "nvidia";
}

async function generateWithNvidia({
  prompt,
  aspectRatio = "1:1",
  signal,
}: GenerateImageParams): Promise<GenerateImageResult> {
  const apiKey = (process.env.NVIDIA_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error(
      "NVIDIA_API_KEY is not configured. Add it to .env to generate images."
    );
  }

  const model = (
    process.env.NVIDIA_IMAGE_MODEL ?? "black-forest-labs/flux.1-schnell"
  ).trim();
  const endpoint = (
    process.env.NVIDIA_IMAGE_URL ??
    `https://ai.api.nvidia.com/v1/genai/${model}`
  ).trim();

  const { width, height } = ASPECT_DIMENSIONS[aspectRatio];

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      width,
      height,
      steps: 4,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let detail = `Image generation failed (${response.status}).`;
    try {
      const parsed = JSON.parse(errText) as {
        detail?: unknown;
        title?: string;
        error?: { message?: string } | string;
      };
      if (typeof parsed.error === "string") {
        detail = parsed.error;
      } else if (parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string") {
        detail = parsed.error.message;
      } else if (typeof parsed.detail === "string") {
        detail = parsed.detail;
      } else if (Array.isArray(parsed.detail)) {
        detail = parsed.detail
          .map((item) =>
            typeof item === "string"
              ? item
              : typeof (item as { msg?: unknown })?.msg === "string"
                ? (item as { msg: string }).msg
                : JSON.stringify(item)
          )
          .join("; ");
      } else if (parsed.detail && typeof parsed.detail === "object") {
        detail = JSON.stringify(parsed.detail);
      } else if (typeof parsed.title === "string") {
        detail = parsed.title;
      }
    } catch {
      if (errText) detail = errText.slice(0, 240);
    }
    throw new Error(detail);
  }

  const data = (await response.json()) as {
    artifacts?: Array<{ base64?: string; finishReason?: string }>;
    image?: string;
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const base64 =
    data.artifacts?.[0]?.base64 ??
    data.image ??
    data.data?.[0]?.b64_json ??
    null;

  if (base64) {
    const dataUrl = base64.startsWith("data:")
      ? base64
      : `data:image/jpeg;base64,${base64}`;
    return { dataUrl, prompt, model };
  }

  if (data.data?.[0]?.url) {
    return { dataUrl: data.data[0].url, prompt, model };
  }

  throw new Error("Image model returned no image data.");
}

async function generateWithGemini({
  prompt,
  aspectRatio = "1:1",
}: GenerateImageParams): Promise<GenerateImageResult> {
  const apiKey = (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    ""
  ).trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to .env to use Gemini/Imagen."
    );
  }

  const model = (
    process.env.GEMINI_IMAGE_MODEL ?? "imagen-3.0-generate-002"
  ).trim();
  const ai = new GoogleGenAI({ apiKey });

  if (model.startsWith("gemini-")) {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? "image/png";
        return {
          dataUrl: `data:${mime};base64,${part.inlineData.data}`,
          prompt,
          model,
        };
      }
    }
    throw new Error("Gemini model did not return an image.");
  }

  const response = await ai.models.generateImages({
    model,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio,
    },
  });

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) {
    throw new Error("Imagen did not return an image.");
  }

  return {
    dataUrl: `data:image/png;base64,${imageBytes}`,
    prompt,
    model,
  };
}

async function generateWithOpenAICompatible({
  prompt,
  aspectRatio = "1:1",
  signal,
}: GenerateImageParams): Promise<GenerateImageResult> {
  const apiKey = (
    process.env.IMAGE_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.NVIDIA_API_KEY ??
    ""
  ).trim();
  const endpoint = (process.env.IMAGE_API_URL ?? "").trim();
  const model = (process.env.IMAGE_MODEL ?? "dall-e-3").trim();

  if (!endpoint || !apiKey) {
    throw new Error(
      "IMAGE_API_URL and IMAGE_API_KEY (or OPENAI_API_KEY) must be configured."
    );
  }

  const { width, height } = ASPECT_DIMENSIONS[aspectRatio];

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: `${width}x${height}`,
      response_format: "b64_json",
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      errText.slice(0, 240) || `Image generation failed (${response.status}).`
    );
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = data.data?.[0];
  if (first?.b64_json) {
    return {
      dataUrl: `data:image/png;base64,${first.b64_json}`,
      prompt,
      model,
    };
  }
  if (first?.url) {
    return { dataUrl: first.url, prompt, model };
  }

  throw new Error("Image endpoint returned no image data.");
}

/**
 * Generates an image by delegating to the configured dedicated image model
 * (NVIDIA NIM Flux/SD, Google Imagen/Gemini, or an OpenAI-compatible endpoint).
 */
export async function generateImageFromModel(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const provider = resolveProvider();
  if (provider === "gemini") {
    return generateWithGemini(params);
  }
  if (provider === "openai") {
    return generateWithOpenAICompatible(params);
  }
  return generateWithNvidia(params);
}
