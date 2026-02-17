/**
 * Shared types for translation providers.
 * New providers (e.g. Azure, Claude) should implement ITranslationProvider.
 */

export interface TranslationResultItem {
  id: string;
  translatedText: string;
}

export interface TranslationBatchRequest {
  contextSnippet: string;
  glossarySnippet: string;
  sourceLanguageName: string;
  targetLanguage: { code: string; name: string };
  items: { id: string; key: string; sourceText: string }[];
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
   * Translate a batch of items. Returns an array of { id, translatedText }.
   * The provider is responsible for prompt construction and API response parsing.
   */
  translateBatch(
    apiKey: string,
    modelId: string,
    request: TranslationBatchRequest
  ): Promise<TranslationResultItem[]>;

  /**
   * Correct spelling and grammar of texts in the same language.
   * Returns an array of { id, translatedText } where translatedText is the corrected text.
   */
  spellCorrectBatch(
    apiKey: string,
    modelId: string,
    request: SpellCheckBatchRequest
  ): Promise<TranslationResultItem[]>;
}
