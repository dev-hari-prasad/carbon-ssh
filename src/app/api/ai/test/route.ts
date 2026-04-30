import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createLanguageModel,
  type AISettings,
} from "@/lib/ai";

const BodySchema = z.object({
  provider: z.enum([
    "openai",
    "anthropic",
    "gateway",
    "openrouter",
    "bedrock",
    "custom",
  ]),
  apiKey: z.string(),
  baseUrl: z.string(),
  chatModel: z.string(),
  autocompleteModel: z.string(),
});

function toSettings(body: z.infer<typeof BodySchema>): AISettings {
  return {
    provider: body.provider,
    apiKey: body.apiKey,
    baseUrl: body.baseUrl,
    chatModel: body.chatModel,
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

const PING_PROMPT =
  "Reply with exactly one word: ok. No punctuation or explanation.";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Expected JSON body" },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid AI settings payload" },
      { status: 400 },
    );
  }

  const s = toSettings(parsed.data);
  const chatLm = createLanguageModel(s, "chat");
  const acLm = createLanguageModel(s, "autocomplete");

  if (!chatLm) {
    return NextResponse.json(
      {
        ok: false as const,
        error:
          "Chat model is not ready. Add an API key (if required), fill the base URL for custom endpoints, and set a chat model id.",
      },
      { status: 400 },
    );
  }
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
      model: chatLm,
      prompt: PING_PROMPT,
      maxOutputTokens: 12,
      maxRetries: 0,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false as const,
        error: `Chat model: ${messageFromUnknown(e)}`,
      },
      { status: 502 },
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
