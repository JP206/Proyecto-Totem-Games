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

const PROGRESS_CHANNEL = "spellcheck-progress";

export type ProviderMode = "openai" | "gemini" | "both";

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
  stats: { totalRows: number; correctedRows: number };
}

function getProvidersToRun(payload: SpellCheckPayload): { id: string; apiKey: string; modelId: string }[] {
  const { mode, openaiModel, geminiModel } = payload.providerOptions;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const list: { id: string; apiKey: string; modelId: string }[] = [];
  if ((mode === "openai" || mode === "both") && openaiKey) {
    list.push({ id: "openai", apiKey: openaiKey, modelId: openaiModel });
  }
  if ((mode === "gemini" || mode === "both") && geminiKey) {
    list.push({ id: "gemini", apiKey: geminiKey, modelId: geminiModel });
  }
  return list;
}

export async function spellCheckFileInMain(
  payload: SpellCheckPayload,
  sender?: WebContents
): Promise<SpellCheckResult> {
  const maxRows = Math.min(payload.maxRows ?? 200, 500);
  const filePath = payload.filePath;
  const applyToFile = payload.applyToFile !== false;
  const languageName = payload.language || "Español";
  const fileExt = path.extname(filePath).toLowerCase();

  let rows: any[][];
  if (fileExt === ".csv") {
    const raw = await fs.readFile(filePath, "utf8");
    rows = csvParse(raw, { skip_empty_lines: false });
  } else if (fileExt === ".xlsx") {
    const buf = await fs.readFile(filePath);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true }) as any[][];
  } else {
    throw new Error("Solo se soporta .csv o .xlsx para revisión ortográfica.");
  }

  if (!rows.length) throw new Error("El archivo está vacío.");

  const providersToRun = getProvidersToRun(payload);
  if (!providersToRun.length) {
    throw new Error("Configura OPENAI_API_KEY o GEMINI_API_KEY en el entorno para usar la revisión con IA.");
  }

  const keyColIndex = 0;
  const sourceColIndex = 1;
  const preview: SpellCheckPreviewRow[] = [];
  let correctedRowsCount = 0;

  const workItems: { rowIndex: number; id: string; key: string; sourceText: string }[] = [];
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

  console.log(`[SpellCheck AI] START file="${filePath}" items=${total} mode=${payload.providerOptions.mode}`);

  for (let i = 0; i < workItems.length; i += batchSize) {
    const batchItems = workItems.slice(i, i + batchSize);
    batchDone++;
    sendProgress(i);

    const resultsByProvider: Record<string, TranslationResultItem[]> = {};
    for (const { id, apiKey, modelId } of providersToRun) {
      const provider = getProvider(id);
      if (!provider || !provider.spellCorrectBatch) continue;
      try {
        resultsByProvider[id] = await provider.spellCorrectBatch(apiKey, modelId, {
          languageName,
          items: batchItems.map((it) => ({ id: it.id, key: it.key, sourceText: it.sourceText })),
        });
      } catch (err) {
        console.error(`[SpellCheck AI] Provider ${id} error:`, err);
        throw err;
      }
    }

    const openaiResults = resultsByProvider["openai"] ?? [];
    const geminiResults = resultsByProvider["gemini"] ?? [];
    const openaiMap = new Map<string, string>();
    for (const item of openaiResults) openaiMap.set(item.id, item.translatedText);
    const geminiMap = new Map<string, string>();
    for (const item of geminiResults) geminiMap.set(item.id, item.translatedText);

    for (const item of batchItems) {
      const openaiText = openaiMap.get(item.id);
      const geminiText = geminiMap.get(item.id);
      const corrected = openaiText ?? geminiText ?? item.sourceText;

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

    const percent = totalBatches ? Math.round((batchDone / totalBatches) * 100) : 100;
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
      totalRows: rows.length - 1,
      correctedRows: correctedRowsCount,
    },
  };
}
