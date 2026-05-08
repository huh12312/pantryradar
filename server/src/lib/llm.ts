import { generateObject } from "ai";
import { openai as openaiProvider, createOpenAI } from "@ai-sdk/openai";
import { anthropic as anthropicProvider } from "@ai-sdk/anthropic";
import { groq as groqProvider } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

export type LLMProvider = "openai" | "anthropic" | "groq" | "ollama";

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  groq: "llama-3.1-8b-instant",
  ollama: "llama3.2",
};

const DEFAULT_VISION_MODELS: Partial<Record<LLMProvider, string>> = {
  openai: "gpt-5.4-mini",
  anthropic: "claude-sonnet-4-6",
};

export function getModel(): LanguageModel {
  const provider = (process.env.LLM_PROVIDER ?? "openai") as LLMProvider;
  const modelId = process.env.LLM_MODEL ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "openai":
      return openaiProvider(modelId);
    case "anthropic":
      return anthropicProvider(modelId);
    case "groq":
      return groqProvider(modelId);
    case "ollama": {
      const ollama = createOpenAI({
        baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
        apiKey: "ollama",
      });
      return ollama(modelId);
    }
    default:
      throw new Error(
        `Unsupported LLM_PROVIDER: "${provider}". Valid options: openai, anthropic, groq, ollama`
      );
  }
}

export function getVisionModel(): LanguageModel {
  const provider = (process.env.LLM_PROVIDER ?? "openai") as LLMProvider;
  const modelId = process.env.LLM_VISION_MODEL ?? DEFAULT_VISION_MODELS[provider];

  if (!modelId) {
    throw new Error(
      `LLM_PROVIDER "${provider}" does not support vision. Use openai or anthropic, or set LLM_VISION_MODEL explicitly.`
    );
  }

  switch (provider) {
    case "openai":
      return openaiProvider(modelId);
    case "anthropic":
      return anthropicProvider(modelId);
    default:
      throw new Error(
        `Vision not supported for provider "${provider}". Use openai or anthropic, or set LLM_VISION_MODEL explicitly.`
      );
  }
}

export { generateObject };

// Mutable deps object — lets tests replace generateObject without module-level mocking
export const _deps = { generateObject };
