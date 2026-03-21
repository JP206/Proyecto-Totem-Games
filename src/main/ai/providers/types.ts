/**
 * Shared types for translation providers.
 * New providers (e.g. Azure, Claude) should implement ITranslationProvider.
 */

export interface TranslationResultItem {
  id: string;
  translatedText: string;
}

/** Token usage returned by a provider for one API call. */
export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** Result of a batch translation or spell-check with optional usage. */
export interface TranslationBatchResult {
  results: TranslationResultItem[];
  usage?: ProviderUsage;
}

/** forward = normal translate; backTranslation = round-trip / confidence pass */
export type TranslationRequestPhase = "forward" | "backTranslation";

export interface TranslationBatchRequest {
  contextSnippet: string;
  glossarySnippet: string;
  sourceLanguageName: string;
  targetLanguage: { code: string; name: string };
  items: { id: string; key: string; sourceText: string }[];
  /** For logging / diagnostics; omit for forward */
  phase?: TranslationRequestPhase;
}

/** Request for spell/grammar correction (same language). */
export interface SpellCheckBatchRequest {
  languageName: string;
  items: { id: string; key: string; sourceText: string }[];
}

/**
 * Interface that all translation providers must implement.
 * Add new providers by creating a file under providers/ and registering them.
 */
export interface ITranslationProvider {
  readonly id: string;

  /**
   * Translate a batch of items. Returns results and optional token usage.
   */
  translateBatch(
    apiKey: string,
    modelId: string,
    request: TranslationBatchRequest,
  ): Promise<TranslationBatchResult>;

  /**
   * Correct spelling and grammar of texts in the same language.
   * Returns results and optional token usage. translatedText is the corrected text.
   */
  spellCorrectBatch(
    apiKey: string,
    modelId: string,
    request: SpellCheckBatchRequest,
  ): Promise<TranslationBatchResult>;
}
