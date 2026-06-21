export interface TranslationMetricLanguage {
  lang: string;
  lexical?: number;
  meaning?: number;
  confidence?: number;
}

export interface TranslationMetricTokens {
  spellcheck?: number;
  translation?: number;
  total: number;
}

export interface TranslationMetricRecord {
  id: string;
  date: string;
  file: string;
  provider: string;
  model: string;
  similarity?: { lexical?: boolean; embeddings?: boolean };
  spellcheck: boolean;
  totalTexts: number;
  correctedTexts?: number;
  correctionRate?: number;
  tokens: TranslationMetricTokens;
  languages: TranslationMetricLanguage[];
  useCustomApiKey?: boolean;
  project?: string;
}

export interface AiMetricsLoadResult {
  records: TranslationMetricRecord[];
  projects: string[];
  sources: string[];
}

export interface MetricsFileShape {
  gameName: string;
  translations: TranslationMetricRecord[];
}
