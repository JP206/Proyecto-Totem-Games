import type { ITranslationProvider } from "./types";
import { openaiProvider } from "./openai";
import { geminiProvider } from "./gemini";

export type { ITranslationProvider, TranslationBatchRequest, TranslationResultItem, SpellCheckBatchRequest } from "./types";
export { openaiProvider } from "./openai";
export { geminiProvider } from "./gemini";

const providersById = new Map<string, ITranslationProvider>([
  [openaiProvider.id, openaiProvider],
  [geminiProvider.id, geminiProvider],
]);

/**
 * Get a translation provider by id. Use "openai" or "gemini".
 * Add new providers to providersById to support them in the UI and translation flow.
 */
export function getProvider(id: string): ITranslationProvider | undefined {
  return providersById.get(id);
}

/**
 * All registered provider ids (for UI dropdowns, validation, etc.).
 */
export function getProviderIds(): string[] {
  return Array.from(providersById.keys());
}
