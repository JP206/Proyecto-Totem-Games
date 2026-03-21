/**
 * Token counts for cost estimation.
 * OpenAI: uses tiktoken (same family as the API billing tokenizer for chat models).
 * Gemini: no public identical local tokenizer; uses a multilingual heuristic calibrated similarly to API docs.
 */
import { get_encoding, type TiktokenEncoding } from "@dqbd/tiktoken";

let cachedEncoder: { name: TiktokenEncoding; inst: ReturnType<typeof get_encoding> } | null =
  null;

function releaseCachedEncoder() {
  if (cachedEncoder?.inst) {
    try {
      cachedEncoder.inst.free();
    } catch {
      /* ignore */
    }
  }
  cachedEncoder = null;
}

/** Map model id to encoding used by OpenAI for that generation (cl100k vs o200k). */
export function encodingForOpenAIModel(modelId?: string): TiktokenEncoding {
  if (!modelId) return "cl100k_base";
  const m = modelId.toLowerCase();
  if (
    m.includes("gpt-4o") ||
    m.includes("gpt-5") ||
    m.includes("gpt-4.1") ||
    m.includes("gpt-4.5") ||
    m.includes("chatgpt-4o") ||
    m.includes("o1") ||
    m.includes("o3") ||
    m.includes("o4")
  ) {
    return "o200k_base";
  }
  return "cl100k_base";
}

function getOpenAIEncoder(modelId?: string): ReturnType<typeof get_encoding> {
  const name = encodingForOpenAIModel(modelId);
  if (cachedEncoder?.name === name && cachedEncoder.inst) return cachedEncoder.inst;
  releaseCachedEncoder();
  const inst = get_encoding(name);
  cachedEncoder = { name, inst };
  return inst;
}

/** Count tokens for OpenAI chat/completions-style text (ordinary tokens only). */
export function countTokensOpenAI(text: string, modelId?: string): number {
  if (!text) return 0;
  try {
    const enc = getOpenAIEncoder(modelId);
    return enc.encode_ordinary(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Approximate Gemini token count (API uses SentencePiece; we blend char/token ratios for Latin vs CJK).
 */
export function countTokensGemini(text: string): number {
  if (!text) return 0;
  const len = text.length;
  let nonLatin = 0;
  for (let i = 0; i < len; i++) {
    if (text.charCodeAt(i) > 127) nonLatin++;
  }
  const ratio = nonLatin / len;
  const charsPerToken = ratio * 1.85 + (1 - ratio) * 4.0;
  return Math.max(1, Math.ceil(len / charsPerToken));
}

export function estimateTokensForProvider(
  text: string,
  provider: "openai" | "gemini",
  modelId?: string,
): number {
  if (!text) return 0;
  if (provider === "openai") return countTokensOpenAI(text, modelId);
  return countTokensGemini(text);
}

export function createTokenEstimator(
  provider: "openai" | "gemini",
  modelId: string,
): (text: string) => number {
  return (text: string) => estimateTokensForProvider(text, provider, modelId);
}
