import type { TranslationMetricRecord } from "../types";

export interface MetricsFilters {
  project: string;
  provider: string;
  model: string;
  dateFrom: string;
  dateTo: string;
  spellcheck: string;
}

export interface AggregatedMetrics {
  totalRuns: number;
  totalTexts: number;
  totalCorrected: number;
  avgCorrectionRate: number;
  totalTokens: number;
  avgTokensPerRun: number;
  spellcheckTokens: number;
  translationTokens: number;
  avgConfidence: number;
  avgLexical: number;
  avgMeaning: number;
  runsWithSpellcheck: number;
  runsWithLexical: number;
  runsWithEmbeddings: number;
  languageAverages: Array<{
    lang: string;
    lexical: number;
    meaning: number;
    confidence: number;
    runs: number;
  }>;
  providerBreakdown: Array<{
    provider: string;
    runs: number;
    tokens: number;
    avgCorrectionRate: number;
  }>;
  projectBreakdown: Array<{
    project: string;
    runs: number;
    tokens: number;
    avgConfidence: number;
  }>;
}

export const DEFAULT_FILTERS: MetricsFilters = {
  project: "all",
  provider: "all",
  model: "all",
  dateFrom: "",
  dateTo: "",
  spellcheck: "all",
};

export function filterRecords(
  records: TranslationMetricRecord[],
  filters: MetricsFilters,
): TranslationMetricRecord[] {
  return records.filter((record) => {
    if (filters.project !== "all" && record.project !== filters.project) {
      return false;
    }
    if (filters.provider !== "all" && record.provider !== filters.provider) {
      return false;
    }
    if (filters.model !== "all" && record.model !== filters.model) {
      return false;
    }
    if (filters.spellcheck === "yes" && !record.spellcheck) return false;
    if (filters.spellcheck === "no" && record.spellcheck) return false;

    const recordDate = record.date.slice(0, 10);
    if (filters.dateFrom && recordDate < filters.dateFrom) return false;
    if (filters.dateTo && recordDate > filters.dateTo) return false;

    return true;
  });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function aggregateMetrics(
  records: TranslationMetricRecord[],
): AggregatedMetrics {
  const languageMap = new Map<
    string,
    { lexical: number[]; meaning: number[]; confidence: number[] }
  >();
  const providerMap = new Map<
    string,
    { runs: number; tokens: number; correctionRates: number[] }
  >();
  const projectMap = new Map<
    string,
    { runs: number; tokens: number; confidences: number[] }
  >();

  let totalTexts = 0;
  let totalCorrected = 0;
  let totalTokens = 0;
  let spellcheckTokens = 0;
  let translationTokens = 0;
  let runsWithSpellcheck = 0;
  let runsWithLexical = 0;
  let runsWithEmbeddings = 0;
  const confidences: number[] = [];
  const lexicals: number[] = [];
  const meanings: number[] = [];

  for (const record of records) {
    totalTexts += record.totalTexts;
    totalCorrected += record.correctedTexts ?? 0;
    totalTokens += record.tokens?.total ?? 0;
    spellcheckTokens += record.tokens?.spellcheck ?? 0;
    translationTokens += record.tokens?.translation ?? 0;

    if (record.spellcheck) runsWithSpellcheck += 1;
    if (record.similarity?.lexical) runsWithLexical += 1;
    if (record.similarity?.embeddings) runsWithEmbeddings += 1;

    for (const lang of record.languages || []) {
      const bucket = languageMap.get(lang.lang) || {
        lexical: [],
        meaning: [],
        confidence: [],
      };
      if (typeof lang.lexical === "number") bucket.lexical.push(lang.lexical);
      if (typeof lang.meaning === "number") bucket.meaning.push(lang.meaning);
      if (typeof lang.confidence === "number") bucket.confidence.push(lang.confidence);
      languageMap.set(lang.lang, bucket);

      if (typeof lang.confidence === "number") confidences.push(lang.confidence);
      if (typeof lang.lexical === "number") lexicals.push(lang.lexical);
      if (typeof lang.meaning === "number") meanings.push(lang.meaning);
    }

    const providerStats = providerMap.get(record.provider) || {
      runs: 0,
      tokens: 0,
      correctionRates: [],
    };
    providerStats.runs += 1;
    providerStats.tokens += record.tokens?.total ?? 0;
    providerStats.correctionRates.push(record.correctionRate ?? 0);
    providerMap.set(record.provider, providerStats);

    const projectKey = record.project || "desconocido";
    const projectStats = projectMap.get(projectKey) || {
      runs: 0,
      tokens: 0,
      confidences: [],
    };
    projectStats.runs += 1;
    projectStats.tokens += record.tokens?.total ?? 0;
    for (const lang of record.languages || []) {
      if (typeof lang.confidence === "number") {
        projectStats.confidences.push(lang.confidence);
      }
    }
    projectMap.set(projectKey, projectStats);
  }

  return {
    totalRuns: records.length,
    totalTexts,
    totalCorrected,
    avgCorrectionRate: average(records.map((record) => record.correctionRate ?? 0)),
    totalTokens,
    avgTokensPerRun: records.length ? totalTokens / records.length : 0,
    spellcheckTokens,
    translationTokens,
    avgConfidence: average(confidences),
    avgLexical: average(lexicals),
    avgMeaning: average(meanings),
    runsWithSpellcheck,
    runsWithLexical,
    runsWithEmbeddings,
    languageAverages: Array.from(languageMap.entries())
      .map(([lang, stats]) => ({
        lang,
        lexical: average(stats.lexical),
        meaning: average(stats.meaning),
        confidence: average(stats.confidence),
        runs: stats.confidence.length,
      }))
      .sort((a, b) => b.confidence - a.confidence),
    providerBreakdown: Array.from(providerMap.entries())
      .map(([provider, stats]) => ({
        provider,
        runs: stats.runs,
        tokens: stats.tokens,
        avgCorrectionRate: average(stats.correctionRates),
      }))
      .sort((a, b) => b.runs - a.runs),
    projectBreakdown: Array.from(projectMap.entries())
      .map(([project, stats]) => ({
        project,
        runs: stats.runs,
        tokens: stats.tokens,
        avgConfidence: average(stats.confidences),
      }))
      .sort((a, b) => b.runs - a.runs),
  };
}

export function getUniqueValues(
  records: TranslationMetricRecord[],
  key: "provider" | "model",
): string[] {
  return Array.from(new Set(records.map((record) => record[key]).filter(Boolean))).sort();
}

export function applyDatePreset(
  preset: "7d" | "30d" | "90d" | "all",
): Pick<MetricsFilters, "dateFrom" | "dateTo"> {
  if (preset === "all") {
    return { dateFrom: "", dateTo: "" };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export function formatNumber(value: number, decimals = 1): string {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatInteger(value: number): string {
  return value.toLocaleString("es-AR");
}
