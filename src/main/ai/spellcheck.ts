/**
 * Spell and grammar check using the same AI providers (OpenAI, Gemini).
 * No local dictionary; uses provider APIs with a correction-only prompt.
 */
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

const PROGRESS_CHANNEL = "spellcheck-progress";

export type ProviderMode = "openai" | "gemini";

export interface SpellCheckPayload {
  filePath: string;
  /** Display name for the text language (e.g. "Español", "Spanish"). */
  language?: string;
  /** Max data rows to process (default 200). */
  maxRows?: number;
  /** If false, do not write to file; return corrected content for preview only. */
  applyToFile?: boolean;
  providerOptions: {
    mode: ProviderMode;
    openaiModel: string;
    geminiModel: string;
    usePersonalOpenAI?: boolean;
    usePersonalGemini?: boolean;
    personalOpenAIModel?: string;
    personalGeminiModel?: string;
  };
}

export interface SpellCheckPreviewRow {
  rowIndex: number;
  key: string;
  originalSource: string;
  correctedSource: string;
}

export interface SpellCheckResult {
  filePath: string;
  csvContent: string;
  preview: SpellCheckPreviewRow[];
  stats: {
    totalRows: number;
    correctedRows: number;
    tokensUsed?: number;
    estimatedTokens?: number;
  };
}

export interface SpellCheckCostEstimate {
  estimatedTokens: number;
}

function resolveModelIdForSpellEstimate(payload: SpellCheckPayload): string {
  const o = payload.providerOptions;
  if (o.mode === "openai") {
    return o.personalOpenAIModel || o.openaiModel;
  }
  return o.personalGeminiModel || o.geminiModel;
}

function isRowEffectivelyEmpty(row: any[] | undefined | null): boolean {
  if (!row || row.length === 0) return true;
  for (const cell of row) {
    if (String(cell ?? "").trim() !== "") return false;
  }
  return true;
}

function getProvidersToRun(
  payload: SpellCheckPayload,
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

export async function spellCheckFileInMain(
  payload: SpellCheckPayload,
  sender?: WebContents,
): Promise<SpellCheckResult> {
  const maxRows = Math.min(payload.maxRows ?? 200, 500);
  const filePath = payload.filePath;
  const applyToFile = payload.applyToFile !== false;
  const languageName = payload.language || "Español";
  const fileExt = path.extname(filePath).toLowerCase();

  let rows: any[][];
  if (fileExt === ".csv") {
    const raw = await fs.readFile(filePath, "utf8");
    const delimiter = detectDelimiter(raw);
    rows = csvParse(raw, { delimiter, skip_empty_lines: true });
  } else if (fileExt === ".xlsx") {
    const buf = await fs.readFile(filePath);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
    }) as any[][];
  } else {
    throw new Error("Solo se soporta .csv o .xlsx para revisión ortográfica.");
  }

  if (!rows.length) throw new Error("El archivo está vacío.");

  // Trim trailing empty rows (common with .xlsx exports / accidental empty lines).
  while (rows.length > 1 && isRowEffectivelyEmpty(rows[rows.length - 1])) {
    rows.pop();
  }

  const providerToRun = getProvidersToRun(payload);
  const estimateTokens = createTokenEstimator(
    providerToRun.id,
    providerToRun.modelId,
  );

  const keyColIndex = 0;
  const sourceColIndex = 1;
  const preview: SpellCheckPreviewRow[] = [];
  let correctedRowsCount = 0;
  let totalTokensUsed = 0;
  let estimatedTokens = 0;

  const workItems: {
    rowIndex: number;
    id: string;
    key: string;
    sourceText: string;
  }[] = [];
  const dataRowEnd = Math.min(rows.length, maxRows + 1);
  for (let rowIndex = 1; rowIndex < dataRowEnd; rowIndex++) {
    const row = rows[rowIndex] || [];
    const key = String(row[keyColIndex] ?? "").trim();
    const sourceText = String(row[sourceColIndex] ?? "").trim();
    if (sourceText) {
      workItems.push({ rowIndex, key, sourceText, id: `spell:${rowIndex}` });
    }
  }

  const total = workItems.length;
  const sendProgress = (current: number) => {
    if (sender && !sender.isDestroyed()) {
      const percent = total ? Math.round((current / total) * 100) : 100;
      sender.send(PROGRESS_CHANNEL, { percent, current, total });
    }
  };

  const batchSize = 40;
  const totalBatches = Math.ceil(workItems.length / batchSize);
  let batchDone = 0;

  console.log(
    `[SpellCheck AI] START file="${filePath}" items=${total} mode=${payload.providerOptions.mode}`,
  );

  for (let i = 0; i < workItems.length; i += batchSize) {
    const batchItems = workItems.slice(i, i + batchSize);
    batchDone++;
    sendProgress(i);

    const provider = getProvider(providerToRun.id);
    if (!provider || !provider.spellCorrectBatch) continue;
    const batchResult = await provider.spellCorrectBatch(
      providerToRun.apiKey,
      providerToRun.modelId,
      {
        languageName,
        items: batchItems.map((it) => ({
          id: it.id,
          key: it.key,
          sourceText: it.sourceText,
        })),
      },
    );
    const asAny: any = batchResult as any;
    const batchResultsArray: TranslationResultItem[] = Array.isArray(asAny)
      ? (asAny as TranslationResultItem[])
      : asAny.results ?? [];
    if (asAny.usage?.totalTokens) {
      totalTokensUsed += asAny.usage.totalTokens;
    } else {
      estimatedTokens += batchItems.reduce(
        (acc, curr) => acc + estimateTokens(curr.sourceText),
        0,
      );
    }
    const providerMap = new Map<string, string>();
    for (const item of batchResultsArray) {
      providerMap.set(item.id, item.translatedText);
    }

    for (const item of batchItems) {
      const corrected = providerMap.get(item.id) ?? item.sourceText;

      if (corrected !== item.sourceText) {
        const row = rows[item.rowIndex];
        if (row) {
          row[sourceColIndex] = corrected;
          correctedRowsCount++;
        }
      }

      if (preview.length < 100) {
        preview.push({
          rowIndex: item.rowIndex,
          key: item.key,
          originalSource: item.sourceText,
          correctedSource: corrected,
        });
      }
    }

    const percent = totalBatches
      ? Math.round((batchDone / totalBatches) * 100)
      : 100;
    sendProgress(Math.min(i + batchSize, total));
  }

  sendProgress(total);
  console.log(`[SpellCheck AI] END correctedRows=${correctedRowsCount}`);

  const csvContent = csvStringify(rows);
  if (applyToFile) {
    if (fileExt === ".csv") {
      await fs.writeFile(filePath, csvContent, "utf8");
    } else {
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, "Localizacion");
      const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      await fs.writeFile(filePath, buf);
    }
  }

  return {
    filePath,
    csvContent,
    preview,
    stats: {
      totalRows: workItems.length,
      correctedRows: correctedRowsCount,
      tokensUsed: totalTokensUsed || undefined,
      estimatedTokens: estimatedTokens || undefined,
    },
  };
}

export async function estimateSpellCheckCostInMain(
  payload: SpellCheckPayload,
): Promise<SpellCheckCostEstimate> {
  const estimateTokens = createTokenEstimator(
    payload.providerOptions.mode,
    resolveModelIdForSpellEstimate(payload),
  );
  const filePath = payload.filePath;
  const maxRows = Math.min(payload.maxRows ?? 200, 500);
  const fileExt = path.extname(filePath).toLowerCase();
  let rows: any[][] = [];
  if (fileExt === ".csv") {
    const raw = await fs.readFile(filePath, "utf8");
    const delimiter = detectDelimiter(raw);
    rows = csvParse(raw, { delimiter, skip_empty_lines: true });
  } else if (fileExt === ".xlsx") {
    const buf = await fs.readFile(filePath);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as any[][];
  }
  const sourceColIndex = 1;
  let estimatedTokens = 0;
  const dataRowEnd = Math.min(rows.length, maxRows + 1);
  for (let rowIndex = 1; rowIndex < dataRowEnd; rowIndex++) {
    const row = rows[rowIndex] || [];
    const sourceText = String(row[sourceColIndex] ?? "").trim();
    if (!sourceText) continue;
    estimatedTokens +=
      estimateTokens(sourceText) + Math.ceil(estimateTokens(sourceText) * 0.25);
  }
  return { estimatedTokens };
}
