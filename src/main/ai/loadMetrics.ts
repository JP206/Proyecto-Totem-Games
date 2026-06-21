import fs from "fs/promises";
import path from "path";
import {
  AiMetricsLoadResult,
  TranslationMetricRecord,
} from "./metricsTypes";
import {
  GAME_METRICS_DIR,
  GAME_METRICS_FILE,
  GENERAL_REPO_NAME,
} from "./saveMetrics";

function isValidRecord(value: unknown): value is TranslationMetricRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as TranslationMetricRecord;
  return (
    typeof record.id === "string" &&
    typeof record.date === "string" &&
    typeof record.totalTexts === "number" &&
    Array.isArray(record.languages)
  );
}

function inferProjectFromId(id: string): string | undefined {
  const parts = id.split("_");
  if (parts.length < 2) return undefined;
  return parts[parts.length - 1] || undefined;
}

function normalizeRecord(
  record: TranslationMetricRecord,
  fallbackProject?: string,
): TranslationMetricRecord {
  const correctedTexts =
    typeof record.correctedTexts === "number" ? record.correctedTexts : 0;

  return {
    ...record,
    file: record.file || "desconocido",
    provider: record.provider || "desconocido",
    model: record.model || "desconocido",
    project:
      record.project ||
      fallbackProject ||
      inferProjectFromId(record.id) ||
      "desconocido",
    correctedTexts,
    correctionRate:
      typeof record.correctionRate === "number"
        ? record.correctionRate
        : record.totalTexts > 0
          ? (correctedTexts / record.totalTexts) * 100
          : 0,
    tokens: {
      spellcheck: record.tokens?.spellcheck ?? 0,
      translation: record.tokens?.translation ?? 0,
      total: record.tokens?.total ?? 0,
    },
    similarity: {
      lexical: Boolean(record.similarity?.lexical),
      embeddings: Boolean(record.similarity?.embeddings),
    },
    spellcheck: Boolean(record.spellcheck),
    languages: (record.languages || []).map((lang) => ({
      lang: lang.lang,
      lexical: lang.lexical ?? 0,
      meaning: lang.meaning ?? 0,
      confidence: lang.confidence ?? 0,
    })),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractRawRecords(
  parsed: unknown,
  fallbackProject?: string,
): TranslationMetricRecord[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(isValidRecord);
  }

  if (!parsed || typeof parsed !== "object") {
    return isValidRecord(parsed) ? [parsed] : [];
  }

  const obj = parsed as Record<string, unknown>;

  if (Array.isArray(obj.translations)) {
    const project =
      (typeof obj.gameName === "string" && obj.gameName) || fallbackProject;
    return obj.translations
      .filter(isValidRecord)
      .map((record) => ({ ...record, project: record.project || project }));
  }

  if (Array.isArray(obj.records)) {
    return obj.records.filter(isValidRecord);
  }

  return isValidRecord(parsed) ? [parsed] : [];
}

async function readMetricsFile(
  filePath: string,
  fallbackProject?: string,
): Promise<TranslationMetricRecord[]> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    const rawRecords = extractRawRecords(parsed, fallbackProject);

    return rawRecords.map((record) =>
      normalizeRecord(record, fallbackProject),
    );
  } catch {
    return [];
  }
}

async function loadGameRepoMetrics(
  repoPath: string,
  repoName: string,
): Promise<TranslationMetricRecord[]> {
  const metricsPath = path.join(repoPath, GAME_METRICS_DIR, GAME_METRICS_FILE);
  if (!(await fileExists(metricsPath))) return [];
  return readMetricsFile(metricsPath, repoName);
}

function dedupeRecords(
  records: TranslationMetricRecord[],
): TranslationMetricRecord[] {
  const byId = new Map<string, TranslationMetricRecord>();
  for (const record of records) {
    const existing = byId.get(record.id);
    if (!existing || (record.project && !existing.project)) {
      byId.set(record.id, record);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function loadAiMetrics(
  selectedFolder: string | null | undefined,
): Promise<AiMetricsLoadResult> {
  if (!selectedFolder) {
    return { records: [], projects: [], sources: [] };
  }

  const sources: string[] = [];
  const allRecords: TranslationMetricRecord[] = [];

  try {
    const entries = await fs.readdir(selectedFolder);
    for (const entry of entries) {
      if (entry === GENERAL_REPO_NAME) continue;

      const repoPath = path.join(selectedFolder, entry);
      let stats;
      try {
        stats = await fs.stat(repoPath);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;

      const gitPath = path.join(repoPath, ".git");
      if (!(await fileExists(gitPath))) continue;

      const repoRecords = await loadGameRepoMetrics(repoPath, entry);
      if (repoRecords.length > 0) {
        sources.push(repoPath);
        allRecords.push(...repoRecords);
      }
    }
  } catch {
    // ignore folder read errors
  }

  const records = dedupeRecords(allRecords);
  const projects = Array.from(
    new Set(records.map((record) => record.project).filter(Boolean)),
  ).sort() as string[];

  return { records, projects, sources };
}
