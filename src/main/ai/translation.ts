import path from "path";
import fs from "fs/promises";
import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";
import * as XLSX from "xlsx";
import type { WebContents } from "electron";
import { getProvider } from "./providers";
import type { TranslationResultItem } from "./providers";
import { detectDelimiter } from "./csvDelimiter";
import { createTokenEstimator } from "./tokenEstimate";

const TRANSLATION_PROGRESS_CHANNEL = "translation-progress";

export type ProviderMode = "openai" | "gemini";

export interface TargetLanguage {
  code: string;
  name: string;
}

export interface ProviderOptions {
  mode: ProviderMode;
  openaiModel: string;
  geminiModel: string;
  personalOpenAIModel?: string;
  personalGeminiModel?: string;
}

export interface TranslateFilePayload {
  repoPath: string;
  projectName: string;
  filePath: string;
  sourceLanguageName?: string;
  targetLanguages: TargetLanguage[];
  contexts: string[];
  glossaries: string[];
  providerOptions: ProviderOptions;
  maxRowsPerBatch?: number;
  maxContextChars?: number;
  /** @deprecated Prefer `confidenceTextSimilarity` / `confidenceEmbeddingSimilarity`. */
  calculateConfidence?: boolean;
  /** @deprecated Prefer explicit flags below. */
  confidenceMode?: "standard" | "standard+embeddings";
  /** Lexical similarity (retraducción). Independent of embeddings. */
  confidenceTextSimilarity?: boolean;
  /** Embedding similarity vs source (requires `confidenceEmbeddingModel`). Independent of text similarity. */
  confidenceEmbeddingSimilarity?: boolean;
  confidenceEmbeddingModel?: string;
}

/** Resolves legacy `calculateConfidence` + `confidenceMode` vs the newer explicit flags. */
export function resolveConfidenceComputation(payload: TranslateFilePayload): {
  needBackTranslation: boolean;
  computeTextSimilarity: boolean;
  computeEmbeddingSimilarity: boolean;
} {
  const hasNewFlags =
    payload.confidenceTextSimilarity !== undefined ||
    payload.confidenceEmbeddingSimilarity !== undefined;

  if (hasNewFlags) {
    const text = payload.confidenceTextSimilarity ?? false;
    const wantEmb = payload.confidenceEmbeddingSimilarity ?? false;
    const model = payload.confidenceEmbeddingModel?.trim();
    const emb = wantEmb && !!model;
    return {
      needBackTranslation: text || emb,
      computeTextSimilarity: text,
      computeEmbeddingSimilarity: emb,
    };
  }

  const legacy = payload.calculateConfidence ?? false;
  const mode = payload.confidenceMode ?? "standard";
  const model = payload.confidenceEmbeddingModel?.trim();
  return {
    needBackTranslation: legacy,
    computeTextSimilarity: legacy,
    computeEmbeddingSimilarity:
      legacy && mode === "standard+embeddings" && !!model,
  };
}

export type { TranslationResultItem } from "./providers";

export interface RowProviderTranslation {
  openaiText?: string;
  geminiText?: string;
  providerText?: string;
  roundTripText?: string;
  textSimilarity?: number | null;
  embeddingSimilarity?: number | null;
  mergedText: string;
  confidence: number | null;
}

export interface PreviewRow {
  rowIndex: number;
  key: string;
  sourceText: string;
  perLanguage: {
    [langCode: string]: RowProviderTranslation;
  };
}

export interface TranslateFileResult {
  filePath: string;
  csvContent: string;
  preview: PreviewRow[];
  stats: {
    totalRows: number;
    translatedRows: number;
    tokensUsed?: number;
    estimatedTokens?: number;
  };
}

export interface TranslationCostEstimate {
  estimatedTokens: number;
}

function canonicalizeForSimilarity(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐‑‒–—―]/g, " ")
    .replace(/…/g, "...")
    .replace(/[.,!?;:()"“”'‘’`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForSimilarity(text: string): string[] {
  return canonicalizeForSimilarity(text).split(" ").filter(Boolean);
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeForSimilarity(a));
  const tokensB = new Set(normalizeForSimilarity(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

function levenshteinDistance(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function normalizedLevenshteinSimilarity(a: string, b: string): number {
  const normA = canonicalizeForSimilarity(a);
  const normB = canonicalizeForSimilarity(b);
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(normA, normB) / maxLen;
}

function hybridSimilarity(a: string, b: string): number {
  return (jaccardSimilarity(a, b) + normalizedLevenshteinSimilarity(a, b)) / 2;
}

function estimateTranslationBatchTotals(
  batchItems: { key: string; sourceText: string }[],
  contextSnippet: string,
  glossarySnippet: string,
  estimateTokens: (text: string) => number,
): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const sourceTokens = batchItems.reduce(
    (acc, item) => acc + estimateTokens(item.sourceText),
    0,
  );
  const itemsMetadataTokens = estimateTokens(
    JSON.stringify(batchItems.map((it) => ({ key: it.key, text: it.sourceText }))),
  );
  const contextTokens = estimateTokens(contextSnippet);
  const glossaryTokens = estimateTokens(glossarySnippet);
  const promptOverhead = 180;
  const inputTokens =
    sourceTokens + itemsMetadataTokens + contextTokens + glossaryTokens + promptOverhead;
  const outputTokens = Math.max(Math.ceil(sourceTokens * 1.15), batchItems.length * 6);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

/**
 * Same prompt shell as forward but empty context/glossary; items carry merged target text (~longer than source).
 * Derived from forward batch estimate with empty snippets, scaled for longer inputs + JSON back to source.
 */
function estimateBackTranslationBatchTotals(
  batchItems: { key: string; sourceText: string }[],
  estimateTokens: (text: string) => number,
): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const base = estimateTranslationBatchTotals(batchItems, "", "", estimateTokens);
  const inputTokens = Math.ceil(base.inputTokens * 1.18);
  const outputTokens = Math.ceil(base.outputTokens * 1.08);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

function resolveModelIdForEstimate(payload: TranslateFilePayload): string {
  const o = payload.providerOptions;
  if (o.mode === "openai") {
    return o.personalOpenAIModel || o.openaiModel;
  }
  return o.personalGeminiModel || o.geminiModel;
}

let rollingEstimateCalibration = 0.72;

function isRowEffectivelyEmpty(row: any[] | undefined | null): boolean {
  if (!row || row.length === 0) return true;
  for (const cell of row) {
    if (String(cell ?? "").trim() !== "") return false;
  }
  return true;
}

async function readContexts(
  contextPaths: string[],
  maxChars: number,
): Promise<string> {
  let result = "";
  for (const contextPath of contextPaths) {
    if (result.length >= maxChars) break;
    try {
      const content = await fs.readFile(contextPath, "utf8");
      const remaining = maxChars - result.length;
      if (remaining <= 0) break;
      const sliced = content.slice(0, remaining);
      result += `\n\n[Contexto: ${path.basename(contextPath)}]\n${sliced}`;
    } catch {
      // ignorar errores individuales
    }
  }
  return result.trim();
}

async function readGlossaries(
  glossaryPaths: string[],
  maxChars: number,
): Promise<string> {
  let result = "";
  for (const glossaryPath of glossaryPaths) {
    if (result.length >= maxChars) break;
    try {
      // Marker per file so selection changes the snippet even if entries are empty/truncated alike.
      const fileHeader = `\n\n[Glosario: ${path.basename(glossaryPath)}]\n`;
      if (result.length + fileHeader.length > maxChars) break;
      result += fileHeader;

      const ext = path.extname(glossaryPath).toLowerCase();
      let entries: { term: string; translation: string }[] = [];

      if (ext === ".csv") {
        const raw = await fs.readFile(glossaryPath, "utf8");
        const delimiter = detectDelimiter(raw);
        const rows: string[][] = csvParse(raw, {
          delimiter,
          skip_empty_lines: true,
        });
        for (let i = 1; i < rows.length; i++) {
          const [term, translation] = rows[i];
          if (term && translation) {
            entries.push({ term, translation });
          }
        }
      } else if (ext === ".xlsx") {
        const buf = await fs.readFile(glossaryPath);
        const workbook = XLSX.read(buf, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] || [];
          const term = row[0];
          const translation = row[1];
          if (typeof term === "string" && typeof translation === "string") {
            entries.push({ term, translation });
          }
        }
      }

      for (const entry of entries) {
        const line = `Termino: ${entry.term} -> Traduccion: ${entry.translation}\n`;
        if (result.length + line.length > maxChars) {
          return result.trim();
        }
        result += line;
      }
      if (!entries.length && result.length + 40 <= maxChars) {
        result += "[Sin entradas válidas en este archivo]\n";
      }
    } catch {
      // ignorar errores individuales
    }
  }
  return result.trim();
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbeddingVector(
  providerId: ProviderMode,
  apiKey: string,
  modelId: string,
  text: string,
): Promise<number[] | null> {
  try {
    if (providerId === "openai") {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: modelId, input: text }),
      });
      if (!response.ok) return null;
      const data: any = await response.json();
      return Array.isArray(data?.data?.[0]?.embedding) ? data.data[0].embedding : null;
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelId,
      )}:embedContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
        }),
      },
    );
    if (!response.ok) return null;
    const data: any = await response.json();
    const values = data?.embedding?.values;
    return Array.isArray(values) ? values : null;
  } catch {
    return null;
  }
}

/** Resolve which providers to run and their config (key + model) from payload. */
function getProviderToRun(
  payload: TranslateFilePayload,
): { id: ProviderMode; apiKey: string; modelId: string } {
  const {
    mode,
    openaiModel,
    geminiModel,
    personalOpenAIModel,
    personalGeminiModel,
  } = payload.providerOptions;

  const personalConfig =
    (global as any).__aiPersonalConfig ??
    (typeof (global as any).getAiPersonalConfig === "function"
      ? (global as any).getAiPersonalConfig()
      : null);

  if (mode === "openai") {
    let modelId = openaiModel;

    const personal = personalConfig?.openai as
      | { apiKey?: string; defaultModel?: string | null }
      | undefined;

    if (personal?.apiKey) {
      modelId = personalOpenAIModel || personal.defaultModel || openaiModel;
      return { id: "openai", apiKey: personal.apiKey, modelId };
    }
    throw new Error(
      "No hay una API key personal disponible para OpenAI. Configurala en tu perfil.",
    );
  }

  if (mode === "gemini") {
    let modelId = geminiModel;

    const personal = personalConfig?.gemini as
      | { apiKey?: string; defaultModel?: string | null }
      | undefined;

    if (personal?.apiKey) {
      modelId = personalGeminiModel || personal.defaultModel || geminiModel;
      return { id: "gemini", apiKey: personal.apiKey, modelId };
    }
    throw new Error(
      "No hay una API key personal disponible para Gemini. Configurala en tu perfil.",
    );
  }
  throw new Error("Proveedor de IA inválido.");
}

export async function translateFileInMain(
  payload: TranslateFilePayload,
  sender?: WebContents,
): Promise<TranslateFileResult> {
  const sendProgress = (percent: number, stage?: string) => {
    if (sender && !sender.isDestroyed())
      sender.send(TRANSLATION_PROGRESS_CHANNEL, { percent, stage });
  };
  console.log("[AI Translate] Start", {
    filePath: payload.filePath,
    targetLanguages: payload.targetLanguages.map((l) => l.code),
    mode: payload.providerOptions.mode,
  });

  const maxRowsPerBatch = payload.maxRowsPerBatch ?? 40;
  const maxContextChars = payload.maxContextChars ?? 8000;

  const [contextSnippet, glossarySnippet] = await Promise.all([
    readContexts(payload.contexts, maxContextChars),
    readGlossaries(payload.glossaries, maxContextChars),
  ]);

  const fileExt = path.extname(payload.filePath).toLowerCase();
  let rows: any[][] = [];

  if (fileExt === ".csv") {
    const raw = await fs.readFile(payload.filePath, "utf8");
    const delimiter = detectDelimiter(raw);
    rows = csvParse(raw, { delimiter, skip_empty_lines: true });
  } else if (fileExt === ".xlsx") {
    const buf = await fs.readFile(payload.filePath);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
    }) as any[][];
  } else {
    throw new Error("Formato de archivo no soportado. Usa .csv o .xlsx");
  }

  if (!rows.length) {
    throw new Error("El archivo de localización está vacío.");
  }

  // Trim trailing empty rows (common with .xlsx exports / accidental empty lines).
  while (rows.length > 1 && isRowEffectivelyEmpty(rows[rows.length - 1])) {
    rows.pop();
  }

  const header = rows[0] || [];
  const keyColIndex = 0;
  const sourceColIndex = 1;

  const detectedSourceLanguageName = String(
    header[sourceColIndex] || "",
  ).trim();
  const sourceLanguageName =
    payload.sourceLanguageName || detectedSourceLanguageName || "Idioma origen";

  const targetLanguageToColumn: { [name: string]: number } = {};
  for (let col = 2; col < header.length; col++) {
    const langName = String(header[col] || "").trim();
    if (langName) {
      targetLanguageToColumn[langName.toLowerCase()] = col;
    }
  }

  for (const lang of payload.targetLanguages) {
    const langNameLower = lang.name.toLowerCase();
    if (!(langNameLower in targetLanguageToColumn)) {
      header.push(lang.name);
      targetLanguageToColumn[langNameLower] = header.length - 1;
    }
  }
  rows[0] = header;

  const selectedProvider = getProviderToRun(payload);
  const estimateTokens = createTokenEstimator(
    selectedProvider.id,
    selectedProvider.modelId,
  );

  // Build preview for all data rows so the UI can show translations (and provider/confidence) for every row.
  // Cap at 10_000 to avoid huge payloads; typical files are hundreds of rows.
  const maxPreviewRows = 10_000;
  const previewRows: PreviewRow[] = [];
  for (
    let rowIndex = 1;
    rowIndex < rows.length && previewRows.length < maxPreviewRows;
    rowIndex++
  ) {
    const row = rows[rowIndex] || [];
    const key = String(row[keyColIndex] ?? "").trim();
    const sourceText = String(row[sourceColIndex] ?? "").trim();
    if (!key && !sourceText) continue;
    previewRows.push({
      rowIndex,
      key,
      sourceText,
      perLanguage: {},
    });
  }

  let translatedRowsCount = 0;
  let totalTokensUsed = 0;
  let estimatedTokens = 0;
  const confOpts = resolveConfidenceComputation(payload);

  type WorkItem = {
    rowIndex: number;
    id: string;
    key: string;
    sourceText: string;
  };
  const toBatchRequest = (
    batchItems: WorkItem[],
    targetLang: TargetLanguage,
    phase: "forward" | "backTranslation" = "forward",
  ) => ({
    contextSnippet,
    glossarySnippet,
    sourceLanguageName,
    targetLanguage: targetLang,
    phase,
    items: batchItems.map((it) => ({
      id: it.id,
      key: it.key,
      sourceText: it.sourceText,
    })),
  });

  let totalBatches = 0;
  for (const lang of payload.targetLanguages) {
    const langColIndex = targetLanguageToColumn[lang.name.toLowerCase()];
    if (typeof langColIndex !== "number") continue;
    let count = 0;
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex] || [];
      const sourceText = String(row[sourceColIndex] || "").trim();
      const existingTranslation = String(row[langColIndex] || "").trim();
      if (sourceText && !existingTranslation) count++;
    }
    const forwardBatches = Math.ceil(count / maxRowsPerBatch) || 0;
    totalBatches += forwardBatches;
    if (confOpts.needBackTranslation) {
      totalBatches += forwardBatches;
    }
  }
  let batchDone = 0;

  for (const lang of payload.targetLanguages) {
    const langColIndex = targetLanguageToColumn[lang.name.toLowerCase()];
    if (typeof langColIndex !== "number") continue;

    const workItems: {
      rowIndex: number;
      id: string;
      key: string;
      sourceText: string;
    }[] = [];

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex] || [];
      const key = String(row[keyColIndex] || "").trim();
      const sourceText = String(row[sourceColIndex] || "").trim();
      const existingTranslation = String(row[langColIndex] || "").trim();

      if (!key && !sourceText) continue;

      if (sourceText && !existingTranslation) {
        workItems.push({
          rowIndex,
          id: `${lang.code}:${rowIndex}`,
          key,
          sourceText,
        });
      }
    }

    if (!workItems.length) {
      continue;
    }

    for (let i = 0; i < workItems.length; i += maxRowsPerBatch) {
      const batchItems = workItems.slice(i, i + maxRowsPerBatch);
      batchDone++;
      const percent = totalBatches
        ? Math.round((batchDone / totalBatches) * 100)
        : 0;
      sendProgress(percent, `${lang.name}`);

      const batchEstimate = estimateTranslationBatchTotals(
        batchItems,
        contextSnippet,
        glossarySnippet,
        estimateTokens,
      );
      if (batchEstimate.inputTokens > 12000) {
        // ya tenemos límites por caracteres, así que esto es solo una red
      }

      const provider = getProvider(selectedProvider.id);
      if (!provider) continue;
      const response = await provider.translateBatch(
        selectedProvider.apiKey,
        selectedProvider.modelId,
        toBatchRequest(batchItems, lang, "forward"),
      );
      const asAny: any = response as any;
      const providerResults: TranslationResultItem[] = Array.isArray(asAny)
        ? (asAny as TranslationResultItem[])
        : asAny.results ?? [];
      if (asAny.usage?.totalTokens) {
        totalTokensUsed += asAny.usage.totalTokens;
      }
      const providerMap = new Map<string, string>();
      for (const resultItem of providerResults) {
        providerMap.set(resultItem.id, resultItem.translatedText);
      }

      estimatedTokens += batchEstimate.totalTokens;

      const backMap = new Map<string, string>();

      if (confOpts.needBackTranslation) {
        const backItems: { id: string; key: string; sourceText: string }[] = [];
        const backEstimateItems: { key: string; sourceText: string }[] = [];
        for (const item of batchItems) {
          const merged = providerMap.get(item.id) || "";
          if (!merged) continue;
          backItems.push({
            id: item.id,
            key: item.key,
            sourceText: merged,
          });
          backEstimateItems.push({ key: item.key, sourceText: item.sourceText });
        }

        if (backItems.length > 0) {
          const backBatchEstimate = estimateBackTranslationBatchTotals(
            backEstimateItems,
            estimateTokens,
          );
          estimatedTokens += backBatchEstimate.totalTokens;

          const runBackBatch = async (
            items: { id: string; key: string; sourceText: string }[],
          ) => {
            return provider.translateBatch(selectedProvider.apiKey, selectedProvider.modelId, {
              contextSnippet: "",
              glossarySnippet: "",
              sourceLanguageName: lang.name,
              targetLanguage: { code: "src", name: sourceLanguageName },
              phase: "backTranslation",
              items,
            });
          };

          let backResponse = await runBackBatch(backItems);
          let asAnyBack: any = backResponse as any;
          let backResults: TranslationResultItem[] = Array.isArray(asAnyBack)
            ? (asAnyBack as TranslationResultItem[])
            : asAnyBack.results ?? [];
          for (const r of backResults) {
            if (r.id && r.translatedText) backMap.set(r.id, r.translatedText);
          }

          const missingAfterBatch = backItems.filter(
            (it) => !backMap.get(it.id)?.trim(),
          );
          for (const it of missingAfterBatch) {
            const singleRes = await runBackBatch([it]);
            const s: any = singleRes as any;
            const singleList: TranslationResultItem[] = Array.isArray(s)
              ? (s as TranslationResultItem[])
              : s.results ?? [];
            const bt = singleList[0]?.translatedText || "";
            if (bt) backMap.set(it.id, bt);
            if (s.usage?.totalTokens) {
              totalTokensUsed += s.usage.totalTokens;
            }
          }

          if (asAnyBack.usage?.totalTokens) {
            totalTokensUsed += asAnyBack.usage.totalTokens;
          }

          batchDone++;
          const pctBack = totalBatches
            ? Math.round((batchDone / totalBatches) * 100)
            : 0;
          sendProgress(pctBack, `${lang.name} (round-trip)`);
        }
      }

      for (const item of batchItems) {
        const providerText = providerMap.get(item.id);
        let mergedText = providerText || "";
        let confidence: number | null = null;
        let roundTripText: string | undefined;
        let textSimilarity: number | null = null;
        let embeddingSimilarity: number | null = null;

        if (confOpts.needBackTranslation && mergedText) {
          const backText = backMap.get(item.id) || "";
          roundTripText = backText || undefined;
          const scoreParts: number[] = [];
          if (confOpts.computeTextSimilarity) {
            textSimilarity = hybridSimilarity(item.sourceText, backText);
            scoreParts.push(textSimilarity);
          }
          if (
            confOpts.computeEmbeddingSimilarity &&
            payload.confidenceEmbeddingModel &&
            backText
          ) {
            const [originalEmbedding, backEmbedding] = await Promise.all([
              getEmbeddingVector(
                selectedProvider.id,
                selectedProvider.apiKey,
                payload.confidenceEmbeddingModel,
                item.sourceText,
              ),
              getEmbeddingVector(
                selectedProvider.id,
                selectedProvider.apiKey,
                payload.confidenceEmbeddingModel,
                backText,
              ),
            ]);
            if (originalEmbedding && backEmbedding) {
              embeddingSimilarity = cosineSimilarity(originalEmbedding, backEmbedding);
              scoreParts.push(embeddingSimilarity);
            }
          }
          if (scoreParts.length > 0) {
            confidence =
              scoreParts.reduce((acc, n) => acc + n, 0) / scoreParts.length;
          }
          if (confOpts.computeEmbeddingSimilarity && payload.confidenceEmbeddingModel) {
            estimatedTokens +=
              estimateTokens(item.sourceText) + estimateTokens(backText);
          }
        }

        if (mergedText) {
          const row = rows[item.rowIndex] || [];
          row[langColIndex] = mergedText;
          rows[item.rowIndex] = row;
          translatedRowsCount++;
        }

        const previewRow = previewRows.find(
          (pr) => pr.rowIndex === item.rowIndex,
        );
        if (previewRow) {
          previewRow.perLanguage[lang.code] = {
            openaiText: selectedProvider.id === "openai" ? providerText : undefined,
            geminiText: selectedProvider.id === "gemini" ? providerText : undefined,
            providerText,
            roundTripText,
            textSimilarity,
            embeddingSimilarity,
            mergedText,
            confidence,
          };
        }
      }
    }
  }

  if (totalTokensUsed > 0 && estimatedTokens > 0) {
    const ratio = Math.min(1.2, Math.max(0.4, totalTokensUsed / estimatedTokens));
    rollingEstimateCalibration = rollingEstimateCalibration * 0.8 + ratio * 0.2;
  }
  const calibratedEstimatedTokens = Math.round(
    estimatedTokens * rollingEstimateCalibration,
  );

  sendProgress(100, "done");

  let updatedContent = "";
  if (fileExt === ".csv") {
    updatedContent = csvStringify(rows);
    await fs.writeFile(payload.filePath, updatedContent, "utf8");
  } else if (fileExt === ".xlsx") {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Localizacion");
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    await fs.writeFile(payload.filePath, buf);

    updatedContent = csvStringify(rows);
  }

  return {
    filePath: payload.filePath,
    csvContent: updatedContent,
    preview: previewRows,
    stats: {
      totalRows: (() => {
        let count = 0;
        for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex] || [];
          const key = String(row[0] ?? "").trim();
          const sourceText = String(row[1] ?? "").trim();
          if (key || sourceText) count++;
        }
        return count;
      })(),
      translatedRows: translatedRowsCount,
      tokensUsed: totalTokensUsed || undefined,
      estimatedTokens: calibratedEstimatedTokens || undefined,
    },
  };
}

export async function estimateTranslationCostInMain(
  payload: TranslateFilePayload,
): Promise<TranslationCostEstimate> {
  const fileExt = path.extname(payload.filePath).toLowerCase();
  let rows: any[][] = [];
  if (fileExt === ".csv") {
    const raw = await fs.readFile(payload.filePath, "utf8");
    const delimiter = detectDelimiter(raw);
    rows = csvParse(raw, { delimiter, skip_empty_lines: true });
  } else if (fileExt === ".xlsx") {
    const buf = await fs.readFile(payload.filePath);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as any[][];
  }
  if (!rows.length) return { estimatedTokens: 0 };
  const header = rows[0] || [];
  const sourceColIndex = 1;
  const maxContextChars = payload.maxContextChars ?? 8000;
  const [contextSnippet, glossarySnippet] = await Promise.all([
    readContexts(payload.contexts, maxContextChars),
    readGlossaries(payload.glossaries, maxContextChars),
  ]);

  const estimateTokens = createTokenEstimator(
    payload.providerOptions.mode,
    resolveModelIdForEstimate(payload),
  );
  const confOpts = resolveConfidenceComputation(payload);

  const maxRowsPerBatch = payload.maxRowsPerBatch ?? 40;
  let estimatedInputTokens = 0;
  let estimatedOutputTokens = 0;
  for (const lang of payload.targetLanguages) {
    let langColIndex = -1;
    for (let col = 2; col < header.length; col++) {
      if (String(header[col] || "").trim().toLowerCase() === lang.name.toLowerCase()) {
        langColIndex = col;
        break;
      }
    }
    const pendingItems: { key: string; sourceText: string }[] = [];
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex] || [];
      const key = String(row[0] || "").trim();
      const sourceText = String(row[sourceColIndex] || "").trim();
      const existing = langColIndex >= 0 ? String(row[langColIndex] || "").trim() : "";
      if (!sourceText || existing) continue;
      pendingItems.push({ key, sourceText });
    }
    for (let i = 0; i < pendingItems.length; i += maxRowsPerBatch) {
      const batchItems = pendingItems.slice(i, i + maxRowsPerBatch);
      const batchTotals = estimateTranslationBatchTotals(
        batchItems,
        contextSnippet,
        glossarySnippet,
        estimateTokens,
      );
      estimatedInputTokens += batchTotals.inputTokens;
      estimatedOutputTokens += batchTotals.outputTokens;
      if (confOpts.needBackTranslation) {
        const backTotals = estimateBackTranslationBatchTotals(batchItems, estimateTokens);
        estimatedInputTokens += backTotals.inputTokens;
        estimatedOutputTokens += backTotals.outputTokens;
      }
    }
  }
  let estimatedTokens = estimatedInputTokens + estimatedOutputTokens;
  // No pending cells to translate → batch math stays 0, but context/glossary still ship on a run.
  // Include them so toggling glossaries/contexts changes the preview.
  if (estimatedInputTokens === 0 && estimatedOutputTokens === 0) {
    estimatedTokens =
      estimateTokens(contextSnippet) +
      estimateTokens(glossarySnippet) +
      200;
  }
  if (confOpts.computeEmbeddingSimilarity && payload.confidenceEmbeddingModel) {
    let embeddingTokenExtra = 0;
    for (const lang of payload.targetLanguages) {
      let langColIndex = -1;
      for (let col = 2; col < header.length; col++) {
        if (String(header[col] || "").trim().toLowerCase() === lang.name.toLowerCase()) {
          langColIndex = col;
          break;
        }
      }
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex] || [];
        const sourceText = String(row[sourceColIndex] || "").trim();
        const existing = langColIndex >= 0 ? String(row[langColIndex] || "").trim() : "";
        if (sourceText && !existing) {
          embeddingTokenExtra +=
            estimateTokens(sourceText) + estimateTokens(sourceText);
        }
      }
    }
    estimatedTokens += embeddingTokenExtra;
  }
  return { estimatedTokens: Math.round(estimatedTokens) };
}
