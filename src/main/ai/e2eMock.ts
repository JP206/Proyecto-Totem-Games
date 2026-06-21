/**
 * E2E mock seam for the AI translation pipeline.
 *
 * This module is ONLY active when `process.env.E2E_MOCK_AI === "1"`, which is set
 * exclusively by the Playwright E2E launcher and the load-test harness. In normal
 * (production / dev) usage the env var is unset and none of this code changes behavior.
 *
 * It lets the full translation/spellcheck flow run completely offline and
 * deterministically (no OpenAI/Gemini network calls, no real API keys required),
 * so UI E2E tests and mock load tests are fast, free and repeatable.
 */
import type {
  ITranslationProvider,
  TranslationBatchRequest,
  TranslationBatchResult,
  SpellCheckBatchRequest,
} from "./providers/types";
import type { ProviderMode } from "./translation";

/** True only when the E2E/load harness explicitly opts in to mocked AI. */
export function isE2EMockMode(): boolean {
  return process.env.E2E_MOCK_AI === "1";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Optional latency / failure injection for load-test resilience scenarios. The
 * load harness sets these globals; in normal mock usage they are undefined and
 * have no effect.
 */
async function applyInjectedBehavior(): Promise<void> {
  const latency = Number((global as any).__e2eMockLatencyMs) || 0;
  if (latency > 0) await sleep(latency);
  const failRate = Number((global as any).__e2eMockFailRate) || 0;
  if (failRate > 0 && Math.random() < failRate) {
    const err: any = new Error("e2e-mock injected failure (HTTP 429 simulated)");
    err.status = 429;
    throw err;
  }
}

/** Deterministic, cheap token estimate so metrics/tokens are non-zero and stable. */
function fakeUsage(items: { sourceText?: string }[]) {
  const totalInput = items.reduce(
    (n, it) => n + Math.max(1, Math.ceil((it.sourceText || "").length / 4)),
    0,
  );
  return {
    inputTokens: totalInput,
    outputTokens: totalInput,
    totalTokens: totalInput * 2,
  };
}

/**
 * Deterministic provider used in mock mode. For a forward translation it prefixes
 * the source with the target language code (`[es] Hello`). For the round-trip /
 * back-translation phase it echoes the text back so confidence scoring runs without
 * any network access.
 */
export const e2eMockProvider: ITranslationProvider = {
  id: "e2e-mock",

  async translateBatch(
    _apiKey: string,
    _modelId: string,
    request: TranslationBatchRequest,
  ): Promise<TranslationBatchResult> {
    await applyInjectedBehavior();
    const isBack = request.phase === "backTranslation";
    const results = request.items.map((it) => ({
      id: it.id,
      translatedText: isBack
        ? it.sourceText
        : `[${request.targetLanguage.code}] ${it.sourceText}`,
    }));
    return { results, usage: fakeUsage(request.items) };
  },

  async spellCorrectBatch(
    _apiKey: string,
    _modelId: string,
    request: SpellCheckBatchRequest,
  ): Promise<TranslationBatchResult> {
    const results = request.items.map((it) => ({
      id: it.id,
      translatedText: it.sourceText,
    }));
    return { results, usage: fakeUsage(request.items) };
  },
};

/**
 * Provider-run config used by `getProviderToRun` / `getProvidersToRun` in mock mode,
 * so the pipeline does not require a real personal API key in the store.
 */
export function mockProviderRunConfig(mode: ProviderMode): {
  id: ProviderMode;
  apiKey: string;
  modelId: string;
} {
  return {
    id: mode,
    apiKey: "e2e-mock-key",
    modelId: mode === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini",
  };
}

/** Canned personal-AI-config summary so the UI shows providers as available offline. */
export function mockPersonalConfigSummary() {
  const openaiModels = [{ id: "gpt-4o-mini", displayName: "gpt-4o-mini" }];
  const openaiEmb = [
    { id: "text-embedding-3-small", displayName: "text-embedding-3-small" },
  ];
  const geminiModels = [
    { id: "gemini-1.5-flash", displayName: "gemini-1.5-flash" },
  ];
  const geminiEmb = [
    { id: "text-embedding-004", displayName: "text-embedding-004" },
  ];
  return {
    openai: {
      hasKey: true,
      defaultModel: "gpt-4o-mini",
      models: openaiModels,
      embeddingModels: openaiEmb,
    },
    gemini: {
      hasKey: true,
      defaultModel: "gemini-1.5-flash",
      models: geminiModels,
      embeddingModels: geminiEmb,
    },
  };
}
