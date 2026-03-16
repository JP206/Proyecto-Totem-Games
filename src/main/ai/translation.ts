import path from "path";
import fs from "fs/promises";
import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";
import * as XLSX from "xlsx";
import type { WebContents } from "electron";
import { getProvider } from "./providers";
import type { TranslationResultItem } from "./providers";
import { detectDelimiter } from "./csvDelimiter";

const TRANSLATION_PROGRESS_CHANNEL = "translation-progress";

export type ProviderMode = "openai" | "gemini" | "both";

export interface TargetLanguage {
  code: string;
  name: string;
}

export interface ProviderOptions {
  mode: ProviderMode;
  openaiModel: string;
  geminiModel: string;
  usePersonalOpenAI?: boolean;
  usePersonalGemini?: boolean;
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
}

export type { TranslationResultItem } from "./providers";

export interface RowProviderTranslation {
  openaiText?: string;
  geminiText?: string;
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
  };
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

function normalizeForSimilarity(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
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
    } catch {
      // ignorar errores individuales
    }
  }
  return result.trim();
}

/** Resolve which providers to run and their config (key + model) from payload. */
function getProvidersToRun(
  payload: TranslateFilePayload,
): { id: string; apiKey: string; modelId: string }[] {
  const {
    mode,
    openaiModel,
    geminiModel,
    usePersonalOpenAI,
    usePersonalGemini,
    personalOpenAIModel,
    personalGeminiModel,
  } = payload.providerOptions;

  const list: { id: string; apiKey: string; modelId: string }[] = [];

  const personalConfig =
    (global as any).__aiPersonalConfig ??
    (typeof (global as any).getAiPersonalConfig === "function"
      ? (global as any).getAiPersonalConfig()
      : null);

  const openaiEnvKey = process.env.OPENAI_API_KEY;
  const geminiEnvKey = process.env.GEMINI_API_KEY;

  if (mode === "openai" || mode === "both") {
    let apiKey: string | undefined;
    let modelId = openaiModel;

    const personal = personalConfig?.openai as
      | { apiKey?: string; defaultModel?: string | null }
      | undefined;

    if (usePersonalOpenAI && personal?.apiKey) {
      apiKey = personal.apiKey;
      modelId =
        personalOpenAIModel || personal.defaultModel || openaiModel;
    } else if (openaiEnvKey) {
      apiKey = openaiEnvKey;
    }

    if (apiKey) {
      list.push({ id: "openai", apiKey, modelId });
    }
  }

  if (mode === "gemini" || mode === "both") {
    let apiKey: string | undefined;
    let modelId = geminiModel;

    const personal = personalConfig?.gemini as
      | { apiKey?: string; defaultModel?: string | null }
      | undefined;

    if (usePersonalGemini && personal?.apiKey) {
      apiKey = personal.apiKey;
      modelId =
        personalGeminiModel || personal.defaultModel || geminiModel;
    } else if (geminiEnvKey) {
      apiKey = geminiEnvKey;
    }

    if (apiKey) {
      list.push({ id: "gemini", apiKey, modelId });
    }
  }

  return list;
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

  const providerMode = payload.providerOptions.mode;
  const providersToRun = getProvidersToRun(payload);
  if (!providersToRun.length) {
    if (providerMode === "openai" || providerMode === "both") {
      throw new Error(
        "No hay una API key disponible para OpenAI. Configura OPENAI_API_KEY en el entorno o una key personal en tu perfil.",
      );
    }
    if (providerMode === "gemini" || providerMode === "both") {
      throw new Error(
        "No hay una API key disponible para Gemini. Configura GEMINI_API_KEY en el entorno o una key personal en tu perfil.",
      );
    }
  }

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

  type WorkItem = {
    rowIndex: number;
    id: string;
    key: string;
    sourceText: string;
  };
  const toBatchRequest = (
    batchItems: WorkItem[],
    targetLang: TargetLanguage,
  ) => ({
    contextSnippet,
    glossarySnippet,
    sourceLanguageName,
    targetLanguage: targetLang,
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
    totalBatches += Math.ceil(count / maxRowsPerBatch) || 0;
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

      const textsConcat = batchItems.map((it) => it.sourceText).join("\n");
      const approxTokens =
        estimateTokensFromText(textsConcat) +
        estimateTokensFromText(contextSnippet) +
        estimateTokensFromText(glossarySnippet);

      if (approxTokens > 12000) {
        // ya tenemos límites por caracteres, así que esto es solo una red
      }

      const resultsByProvider: Record<string, TranslationResultItem[]> = {};
      for (const { id, apiKey, modelId } of providersToRun) {
        const provider = getProvider(id);
        if (!provider) continue;
        try {
          console.log(
            `[AI Translate] Provider ${id} batch lang=${lang.code} items=${batchItems.length}`,
          );
          const batchResult = await provider.translateBatch(
            apiKey,
            modelId,
            toBatchRequest(batchItems, lang),
          );
          const asAny: any = batchResult as any;
          const batchResultsArray: TranslationResultItem[] = Array.isArray(asAny)
            ? (asAny as TranslationResultItem[])
            : asAny.results ?? [];
          resultsByProvider[id] = batchResultsArray;
          if (asAny.usage?.totalTokens) {
            totalTokensUsed += asAny.usage.totalTokens;
          }
          console.log(
            `[AI Translate] Provider ${id} returned ${resultsByProvider[id].length} results`,
          );
        } catch (err) {
          console.error(`[AI Translate] Provider ${id} error:`, err);
          throw err;
        }
      }

      const openaiResults: TranslationResultItem[] =
        resultsByProvider["openai"] ?? [];
      const geminiResults: TranslationResultItem[] =
        resultsByProvider["gemini"] ?? [];

      const openaiMap = new Map<string, string>();
      for (const item of openaiResults) {
        openaiMap.set(item.id, item.translatedText);
      }

      const geminiMap = new Map<string, string>();
      for (const item of geminiResults) {
        geminiMap.set(item.id, item.translatedText);
      }

      for (const item of batchItems) {
        const openaiText = openaiMap.get(item.id);
        const geminiText = geminiMap.get(item.id);

        let mergedText = openaiText || geminiText || "";
        let confidence: number | null = null;

        if (openaiText && geminiText) {
          const sim = jaccardSimilarity(openaiText, geminiText);
          confidence = sim;

          const sourceLen = item.sourceText.length || 1;
          const diffOpenai = Math.abs((openaiText.length || 0) - sourceLen);
          const diffGemini = Math.abs((geminiText.length || 0) - sourceLen);
          mergedText = diffOpenai <= diffGemini ? openaiText : geminiText;
        } else if (openaiText || geminiText) {
          mergedText = openaiText || geminiText || "";
          confidence = null; // single provider: no comparison
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
            openaiText,
            geminiText,
            mergedText,
            confidence,
          };
        }
      }
    }
  }

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
    },
  };
}
