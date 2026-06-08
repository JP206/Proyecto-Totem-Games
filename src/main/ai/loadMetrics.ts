import fs from "fs/promises";
import path from "path";
import {
  AiMetricsLoadResult,
  TranslationMetricRecord,
} from "./metricsTypes";

export const GENERAL_REPO_NAME = "repo-general-totem-games";

const METRICS_DIRS = ["metricas", "metricas_ia"];
const HISTORIAL_FILE = "historial.json";
const LOCALIZE_METRICS_FILE = "metricas_ia.json";

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

function projectFromMetricsFilename(filename: string): string | undefined {
  if (filename === HISTORIAL_FILE) return undefined;
  return filename.replace(/-metrics\.json$/i, "").replace(/\.json$/i, "");
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
    tokens: record.tokens || { spellcheck: 0, translation: 0, total: 0 },
    similarity: record.similarity || { lexical: false, embeddings: false },
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

async function readMetricsDirectory(
  dirPath: string,
): Promise<TranslationMetricRecord[]> {
  if (!(await fileExists(dirPath))) return [];

  const entries = await fs.readdir(dirPath);
  const records: TranslationMetricRecord[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const filePath = path.join(dirPath, entry);
    const projectFromFile = projectFromMetricsFilename(entry);
    records.push(...(await readMetricsFile(filePath, projectFromFile)));
  }

  return records;
}

async function loadGeneralRepoMetrics(
  selectedFolder: string,
): Promise<{ records: TranslationMetricRecord[]; sources: string[] }> {
  const generalPath = path.join(selectedFolder, GENERAL_REPO_NAME);
  const records: TranslationMetricRecord[] = [];
  const sources: string[] = [];

  for (const dirName of METRICS_DIRS) {
    const metricsDir = path.join(generalPath, dirName);
    const historialPath = path.join(metricsDir, HISTORIAL_FILE);
    const dirRecords: TranslationMetricRecord[] = [];

    if (await fileExists(historialPath)) {
      dirRecords.push(...(await readMetricsFile(historialPath)));
    }

    dirRecords.push(...(await readMetricsDirectory(metricsDir)));

    if (dirRecords.length > 0) {
      sources.push(metricsDir);
      records.push(...dirRecords);
    }
  }

  return { records, sources };
}

async function loadLocalRepoMetrics(
  repoPath: string,
  repoName: string,
): Promise<TranslationMetricRecord[]> {
  const candidates = [
    path.join(repoPath, "Localizacion", LOCALIZE_METRICS_FILE),
    ...METRICS_DIRS.flatMap((dirName) => [
      path.join(repoPath, dirName, HISTORIAL_FILE),
      path.join(repoPath, dirName, `${repoName}-metrics.json`),
      path.join(repoPath, dirName, `${repoName}.json`),
    ]),
  ];

  const records: TranslationMetricRecord[] = [];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      records.push(...(await readMetricsFile(candidate, repoName)));
    }
  }

  for (const dirName of METRICS_DIRS) {
    records.push(...(await readMetricsDirectory(path.join(repoPath, dirName))));
  }

  return records;
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

  const general = await loadGeneralRepoMetrics(selectedFolder);
  if (general.records.length > 0) {
    sources.push(...general.sources);
    allRecords.push(...general.records);
  }

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

      const repoRecords = await loadLocalRepoMetrics(repoPath, entry);
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
