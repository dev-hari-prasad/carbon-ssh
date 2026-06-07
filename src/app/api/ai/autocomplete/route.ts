import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createLanguageModel, type AISettings } from "@/lib/ai";

const BodySchema = z.object({
  prompt: z.string(),
  settings: z.object({
    provider: z.enum(["openai", "anthropic", "gateway", "openrouter", "bedrock", "custom"]),
    apiKey: z.string().optional(),
    baseUrl: z.string(),
    autocompleteModel: z.string(),
  }),
});

const SYSTEM_PROMPT = `You are an expert Linux/Unix terminal assistant. Your goal is to provide extremely accurate, concise, and production-ready shell commands.

Rules:
1. Provide exactly 3 diverse and relevant command options.
2. Response MUST be a JSON array of objects: [{"command": "...", "label": "...", "description": "..."}]
3. Use ONLY lowercase or sentence case for "label". NEVER USE ALL CAPS.
4. Keep "label" to 2-4 words maximum.
5. "command" should be the literal shell command.
6. If the user asks a question, provide the commands that answer it directly.
7. Prefer common, efficient tools (e.g. use 'ls -A' for hidden files, 'sudo apt upgrade' for updates).

Example:
Input: "show hidden files"
Output: [{"command": "ls -A", "label": "List hidden files", "description": "Show all files except . and .."}]`;

function hasValidInternalApiToken(req: Request): boolean {
  const secret = process.env.INTERNAL_API_TOKEN?.trim();
  if (!secret) return false;
  return req.headers.get("x-api-token") === secret;
}

export async function POST(req: Request) {
  try {
    if (!hasValidInternalApiToken(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { prompt, settings, context } = parsed.data as any;

    const s: AISettings = {
      ...settings,
      apiKey: typeof settings.apiKey === "string" ? settings.apiKey : "",
      chatModel: "",
      autocompleteEnabled: true,
      chatEnabled: false,
    };

    const model = createLanguageModel(s, "autocomplete");

    if (!model) {
      return NextResponse.json({ error: "AI model not configured" }, { status: 400 });
    }

    const historyList = (context?.history || []).join(", ");
    const outputContext = (context?.terminalOutput || []).join("\n");
    const contextualSystemPrompt = `${SYSTEM_PROMPT}
Current Context:
- User: ${context?.username || "unknown"}
- Environment: Remote Terminal Session
- Recent Commands: ${historyList || "none"}
- Terminal Output (Last 20 lines):
${outputContext || "none"}

Based on the recent commands, the terminal output, and the current environment, provide highly relevant suggestions. 
Pay close attention to recent errors or filenames mentioned in the output to resolve terms like "it", "that", or "this file".`;

    const { text } = await generateText({
      model,
      system: contextualSystemPrompt,
      prompt,
      maxOutputTokens: 300,
      temperature: 0.2,
    });

    let suggestions = [];
    try {
      // Handle cases where AI might wrap JSON in markdown blocks
      const cleanJson = text.replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(cleanJson);
    } catch (e) {
      console.warn("AI failed to return valid JSON, falling back to line parsing:", text);
      suggestions = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("`"))
        .slice(0, 3)
        .map((cmd) => ({ command: cmd, label: cmd, description: "" }));
    }

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("Autocomplete error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 },
    );
  }
}
