import { NextRequest } from "next/server";

const TITLE_SYSTEM_PROMPT =
  "Summarize the core topic or content discussed in the user's message into a concise, descriptive chat title (3 to 6 words, Title Case). Return only the title text with no quotes, no markdown formatting, and no trailing period.";

interface TitleRequestBody {
  prompt?: string;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, " ")
    .replace(/^["'`*#:\-\s]+|["'`*.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  const apiKey = (
    process.env.NVIDIA_API_KEY ??
    process.env.GEMINI_API_KEY ??
    ""
  ).trim();

  if (!apiKey) {
    return Response.json({ title: null }, { status: 200 });
  }

  const baseUrl = (
    process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1"
  )
    .trim()
    .replace(/\/+$/, "");

  const model = (
    process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3.5-super-vl-120b-a12b"
  ).trim();

  let body: TitleRequestBody;
  try {
    body = (await req.json()) as TitleRequestBody;
  } catch {
    return Response.json({ title: null }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return Response.json({ title: null }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: TITLE_SYSTEM_PROMPT },
          { role: "user", content: prompt.slice(0, 1500) },
        ],
        stream: false,
        temperature: 0.3,
        max_tokens: 512,
      }),
      signal: req.signal,
    });

    if (!upstream.ok) {
      return Response.json({ title: null }, { status: 200 });
    }

    const data = (await upstream.json()) as OpenAIChatCompletionResponse;
    const rawContent = data.choices?.[0]?.message?.content ?? "";
    const cleaned = sanitizeTitle(rawContent);

    return Response.json({ title: cleaned || null });
  } catch {
    return Response.json({ title: null }, { status: 200 });
  }
}
