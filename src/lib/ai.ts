import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { Connection } from "./types";

export type AIProviderId = "openai" | "anthropic" | "gateway" | "openrouter" | "bedrock" | "custom";

export type AIModelRole = "chat" | "autocomplete";

export interface AIProviderMeta {
  id: AIProviderId;
  name: string;
  defaultModel: string;
  /** Default when autocomplete model field is empty. */
  defaultAutocompleteModel: string;
  /** When true, the second connection field ({@link AIProviderMeta.baseUrlField}) is shown. */
  needsBaseUrl: boolean;
  apiKeyHint: string;
  apiKeyRequired: boolean;
  modelHint: string;
  autocompleteModelHint: string;
  /**
   * Shown next to {@link AIProviderMeta.needsBaseUrl} field (Bedrock region vs custom HTTP base).
   */
  baseUrlField?: { label: string; placeholder: string; fieldHint?: string };
}

export const AI_PROVIDERS: AIProviderMeta[] = [
  {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-5",
    defaultAutocompleteModel: "gpt-5-mini",
    needsBaseUrl: false,
    apiKeyHint: "sk-...",
    apiKeyRequired: true,
    modelHint: "gpt-5, gpt-5.2, gpt-4.1",
    autocompleteModelHint: "gpt-5-mini, gpt-4.1-mini",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    defaultModel: "claude-sonnet-4-5",
    defaultAutocompleteModel: "claude-haiku-4-5",
    needsBaseUrl: false,
    apiKeyHint: "sk-ant-...",
    apiKeyRequired: true,
    modelHint: "claude-sonnet-4-5, claude-opus-4-5",
    autocompleteModelHint: "claude-haiku-4-5, claude-3-5-haiku-latest",
  },
  {
    id: "gateway",
    name: "Vercel AI Gateway",
    defaultModel: "openai/gpt-5",
    defaultAutocompleteModel: "openai/gpt-5-mini",
    needsBaseUrl: false,
    apiKeyHint: "vck_...",
    apiKeyRequired: true,
    modelHint: "openai/gpt-5, anthropic/claude-sonnet-4-5",
    autocompleteModelHint: "openai/gpt-5-mini, google/gemini-2.5-flash",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "openai/gpt-5",
    defaultAutocompleteModel: "openai/gpt-5-mini",
    needsBaseUrl: false,
    apiKeyHint: "sk-or-...",
    apiKeyRequired: true,
    modelHint: "openai/gpt-5, anthropic/claude-sonnet-4-5",
    autocompleteModelHint: "openai/gpt-4.1-mini, google/gemini-2.5-flash",
  },
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    defaultModel: "anthropic.claude-sonnet-4-20250514-v1:0",
    defaultAutocompleteModel: "anthropic.claude-haiku-4-5-20251001-v1:0",
    needsBaseUrl: true,
    baseUrlField: {
      label: "Region",
      placeholder: "us-east-1",
      fieldHint: "optional — uses AWS_REGION if empty",
    },
    apiKeyHint: "Bedrock API key — or IAM via env",
    apiKeyRequired: false,
    modelHint: "anthropic.claude-sonnet-4-20250514-v1:0, us.amazon.nova-pro-v1:0",
    autocompleteModelHint: "anthropic.claude-haiku-4-5-20251001-v1:0, us.amazon.nova-lite-v1:0",
  },
  {
    id: "custom",
    name: "Custom endpoint (OpenAI compatible)",
    defaultModel: "",
    defaultAutocompleteModel: "",
    needsBaseUrl: true,
    baseUrlField: {
      label: "Base URL",
      placeholder: "http://localhost:11434/v1",
      fieldHint: "required",
    },
    apiKeyHint: "Optional for local servers",
    apiKeyRequired: false,
    modelHint: "e.g. qwen2.5, llama3.1",
    autocompleteModelHint: "e.g. qwen2.5:1.5b, tinyllama",
  },
];

export interface AISettings {
  provider: AIProviderId;
  apiKey: string;
  /** Region for Bedrock, or HTTP base URL for custom OpenAI-compatible. */
  baseUrl: string;
  chatModel: string;
  autocompleteModel: string;
  autocompleteEnabled: boolean;
  chatEnabled: boolean;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "openai",
  apiKey: "",
  baseUrl: "",
  chatModel: "",
  autocompleteModel: "",
  autocompleteEnabled: false,
  chatEnabled: false,
};

export function getProviderMeta(id: AIProviderId): AIProviderMeta {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]!;
}

function resolvedModelId(s: AISettings, role: AIModelRole): string {
  const meta = getProviderMeta(s.provider);
  if (role === "chat") {
    return s.chatModel.trim() || meta.defaultModel;
  }
  return s.autocompleteModel.trim() || meta.defaultAutocompleteModel || meta.defaultModel;
}

/**
 * Build a Vercel AI SDK v6 LanguageModel for chat or autocomplete.
 * Returns null if the configuration is incomplete.
 */
export function createLanguageModel(s: AISettings, role: AIModelRole): LanguageModel | null {
  const meta = getProviderMeta(s.provider);
  const model = resolvedModelId(s, role);
  if (!model) return null;
  if (meta.apiKeyRequired && !s.apiKey.trim()) return null;

  switch (s.provider) {
    case "openai":
      return createOpenAI({ apiKey: s.apiKey.trim() })(model);
    case "anthropic":
      return createAnthropic({ apiKey: s.apiKey.trim() })(model);
    case "gateway":
      return createGateway({ apiKey: s.apiKey.trim() })(model);
    case "openrouter":
      return createOpenAICompatible({
        name: "openrouter",
        apiKey: s.apiKey.trim(),
        baseURL: "https://openrouter.ai/api/v1",
      })(model);
    case "bedrock": {
      const region = s.baseUrl.trim();
      const apiKey = s.apiKey.trim();
      return createAmazonBedrock({
        ...(region ? { region } : {}),
        ...(apiKey ? { apiKey } : {}),
      })(model);
    }
    case "custom": {
      const baseURL = s.baseUrl.trim();
      if (!baseURL) return null;
      return createOpenAICompatible({
        name: "custom",
        baseURL,
        ...(s.apiKey.trim() ? { apiKey: s.apiKey.trim() } : {}),
      })(model);
    }
  }
}

export function isAIConfigured(s: AISettings): boolean {
  return createLanguageModel(s, "chat") !== null && createLanguageModel(s, "autocomplete") !== null;
}

/** When unset or true, this host honors global AI settings; when false, AI is off for its sessions. */
export function hostAllowsAiFeatures(conn: Connection): boolean {
  return conn.aiFeaturesEnabled !== false;
}
