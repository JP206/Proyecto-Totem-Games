import fs from "fs/promises";
import path from "path";
import type {
  MetricsFileShape,
  TranslationMetricLanguage,
  TranslationMetricRecord,
  TranslationMetricTokens,
} from "./metricsTypes";
import type { PreviewRow, TranslateFilePayload } from "./translation";
import { pushRepoFile } from "./gitPushFile";

export const GAME_METRICS_DIR = "Localizacion";
export const GAME_METRICS_FILE = "metricas_ia.json";
export const GENERAL_REPO_NAME = "repo-general-totem-games";

interface LangBucket {
  lexical: number[];
  meaning: number[];
  confidence: number[];
}

async function readMetricsFileShape(
  filePath: string,
  gameName: string,
): Promise<MetricsFileShape> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.translations)) {
      return {
        gameName: typeof parsed.gameName === "string" ? parsed.gameName : gameName,
        translations: parsed.translations,
      };
    }
    if (Array.isArray(parsed)) {
      return { gameName, translations: parsed };
    }
  } catch {
    // file missing or invalid — start fresh
  }
  return { gameName, translations: [] };
}

async function writeMetricsFileShape(
  filePath: string,
  data: MetricsFileShape,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function toMetricLangCode(code: string): string {
  return code.toLowerCase().replace(/-/g, "_");
}

function formatMetricId(projectName: string, now = new Date()): string {
  const iso = now.toISOString().slice(0, 19).replace(/:/g, "-");
  return `${iso}_${projectName}`;
}

function formatMetricDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function toScorePercent(value: number): number {
  const normalized = value <= 1 ? value * 100 : value;
  return Math.round(normalized);
}

function buildLanguageEntry(
  lang: string,
  bucket: LangBucket | undefined,
  options: {
    computeTextSimilarity: boolean;
    computeEmbeddingSimilarity: boolean;
  },
): TranslationMetricLanguage {
  const entry: TranslationMetricLanguage = { lang };

  if (options.computeTextSimilarity && bucket?.lexical.length) {
    entry.lexical = toScorePercent(average(bucket.lexical));
  }
  if (options.computeEmbeddingSimilarity && bucket?.meaning.length) {
    entry.meaning = toScorePercent(average(bucket.meaning));
  }
  if (bucket?.confidence.length) {
    entry.confidence = toScorePercent(average(bucket.confidence));
  }

  return entry;
}

function mergeBuckets(buckets: LangBucket[]): LangBucket {
  const merged: LangBucket = { lexical: [], meaning: [], confidence: [] };
  for (const bucket of buckets) {
    merged.lexical.push(...bucket.lexical);
    merged.meaning.push(...bucket.meaning);
    merged.confidence.push(...bucket.confidence);
  }
  return merged;
}

function buildTokens(
  spellcheck: boolean,
  translationTokens: number,
  spellcheckTokens = 0,
): TranslationMetricTokens {
  if (spellcheck && spellcheckTokens > 0) {
    return {
      spellcheck: spellcheckTokens,
      translation: translationTokens,
      total: spellcheckTokens + translationTokens,
    };
  }
  return {
    translation: translationTokens,
    total: translationTokens,
  };
}

export function buildTranslationMetricRecord(
  payload: TranslateFilePayload,
  preview: PreviewRow[],
  stats: {
    totalRows: number;
    translatedRows: number;
    tokensUsed?: number;
  },
  provider: { id: string; modelId: string },
  options: {
    computeTextSimilarity: boolean;
    computeEmbeddingSimilarity: boolean;
    spellcheck?: boolean;
    correctedTexts?: number;
    spellcheckTokens?: number;
    useCustomApiKey?: boolean;
  },
): TranslationMetricRecord {
  const langStats = new Map<string, LangBucket>();

  for (const row of preview) {
    for (const [code, langData] of Object.entries(row.perLanguage)) {
      if (!langStats.has(code)) {
        langStats.set(code, { lexical: [], meaning: [], confidence: [] });
      }
      const bucket = langStats.get(code)!;
      if (typeof langData.textSimilarity === "number") {
        bucket.lexical.push(langData.textSimilarity);
      }
      if (typeof langData.embeddingSimilarity === "number") {
        bucket.meaning.push(langData.embeddingSimilarity);
      }
      if (typeof langData.confidence === "number") {
        bucket.confidence.push(langData.confidence);
      }
    }
  }

  const now = new Date();
  const spellcheck = options.spellcheck ?? false;
  const correctedTexts = options.correctedTexts ?? 0;
  const totalTexts = stats.totalRows;
  const translationTokens = stats.tokensUsed ?? 0;
  const langOptions = {
    computeTextSimilarity: options.computeTextSimilarity,
    computeEmbeddingSimilarity: options.computeEmbeddingSimilarity,
  };

  const perLanguageBuckets = payload.targetLanguages
    .map((lang) => langStats.get(lang.code))
    .filter((bucket): bucket is LangBucket => Boolean(bucket));

  const languages: TranslationMetricLanguage[] = [
    buildLanguageEntry("shared", mergeBuckets(perLanguageBuckets), langOptions),
    ...payload.targetLanguages.map((lang) =>
      buildLanguageEntry(toMetricLangCode(lang.code), langStats.get(lang.code), langOptions),
    ),
  ];

  const record: TranslationMetricRecord = {
    id: formatMetricId(payload.projectName, now),
    date: formatMetricDate(now),
    file: path.basename(payload.filePath),
    provider: provider.id,
    model: provider.modelId,
    spellcheck,
    totalTexts,
    tokens: buildTokens(spellcheck, translationTokens, options.spellcheckTokens ?? 0),
    languages,
  };

  if (options.computeTextSimilarity || options.computeEmbeddingSimilarity) {
    record.similarity = {};
    if (options.computeTextSimilarity) record.similarity.lexical = true;
    if (options.computeEmbeddingSimilarity) record.similarity.embeddings = true;
  }

  if (spellcheck && correctedTexts > 0) {
    record.correctedTexts = correctedTexts;
    record.correctionRate =
      totalTexts > 0
        ? Math.round((correctedTexts / totalTexts) * 1000) / 10
        : 0;
  }

  if (options.useCustomApiKey !== false) {
    record.useCustomApiKey = true;
  }

  return record;
}

export function resolveGameMetricsPaths(
  repoPath: string,
  projectName: string,
): { gameRepoPath: string; metricsFilePath: string; relativeMetricsPath: string } {
  const gameRepoPath = repoPath;
  const metricsFilePath = path.join(
    gameRepoPath,
    GAME_METRICS_DIR,
    GAME_METRICS_FILE,
  );
  const relativeMetricsPath = path
    .relative(gameRepoPath, metricsFilePath)
    .split(path.sep)
    .join("/");

  return { gameRepoPath, metricsFilePath, relativeMetricsPath };
}

export async function appendTranslationMetric(
  repoPath: string,
  projectName: string,
  record: TranslationMetricRecord,
): Promise<void> {
  const { gameRepoPath, metricsFilePath } = resolveGameMetricsPaths(
    repoPath,
    projectName,
  );

  const metricsData = await readMetricsFileShape(metricsFilePath, projectName);
  metricsData.gameName = projectName;
  metricsData.translations.push(record);
  await writeMetricsFileShape(metricsFilePath, metricsData);

  const pushResult = await pushRepoFile(
    gameRepoPath,
    metricsFilePath,
    `Update AI metrics for ${projectName}`,
  );

  if (!pushResult.success) {
    console.error(
      "[AI Metrics] Error pushing metrics to game repo:",
      pushResult.error,
    );
  }
}
