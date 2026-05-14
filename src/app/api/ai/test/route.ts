import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createLanguageModel, type AISettings } from "@/lib/ai";

const BodySchema = z.object({
  provider: z.enum(["openai", "anthropic", "gateway", "openrouter", "bedrock", "custom"]),
  apiKey: z.string().optional(),
  baseUrl: z.string(),
  autocompleteModel: z.string(),
});

function toSettings(body: z.infer<typeof BodySchema>): AISettings {
  return {
    provider: body.provider,
    apiKey: body.apiKey ?? "",
    baseUrl: body.baseUrl,
    chatModel: "",
    autocompleteModel: body.autocompleteModel,
    autocompleteEnabled: false,
    chatEnabled: false,
  };
}

function messageFromUnknown(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Request failed";
  }
}

const PING_PROMPT = "Reply with exactly one word: ok. No punctuation or explanation.";

export async function POST(req: Request) {
  const isInternalCall = req.headers.get("x-carbon-internal-ai") === "1";
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "Expected JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid AI settings payload" },
      { status: 400 },
    );
  }
  if (!isInternalCall && parsed.data.apiKey && process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { ok: false as const, error: "Raw API keys are not accepted from renderer requests" },
      { status: 400 },
    );
  }

  const s = toSettings(parsed.data);
  const acLm = createLanguageModel(s, "autocomplete");

  if (!acLm) {
    return NextResponse.json(
      {
        ok: false as const,
        error:
          "Autocomplete model is not ready. Check API key, base URL, and autocomplete model id.",
      },
      { status: 400 },
    );
  }

  try {
    await generateText({
      model: acLm,
      prompt: PING_PROMPT,
      maxOutputTokens: 12,
      maxRetries: 0,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false as const,
        error: `Autocomplete model: ${messageFromUnknown(e)}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true as const });
}
