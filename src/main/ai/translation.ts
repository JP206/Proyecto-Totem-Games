import path from "path";
import fs from "fs/promises";
import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";
import * as XLSX from "xlsx";
import { getProvider } from "./providers";
import type { TranslationResultItem } from "./providers";

export type ProviderMode = "openai" | "gemini" | "both";

export interface TargetLanguage {
  code: string;
  name: string;
}

export interface ProviderOptions {
  mode: ProviderMode;
  openaiModel: string;
  geminiModel: string;
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

async function readContexts(contextPaths: string[], maxChars: number): Promise<string> {
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

async function readGlossaries(glossaryPaths: string[], maxChars: number): Promise<string> {
  let result = "";
  for (const glossaryPath of glossaryPaths) {
    if (result.length >= maxChars) break;
    try {
      const ext = path.extname(glossaryPath).toLowerCase();
      let entries: { term: string; translation: string }[] = [];

      if (ext === ".csv") {
        const raw = await fs.readFile(glossaryPath, "utf8");
        const rows: string[][] = csvParse(raw, { skip_empty_lines: true });
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
function getProvidersToRun(payload: TranslateFilePayload): { id: string; apiKey: string; modelId: string }[] {
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

export async function translateFileInMain(payload: TranslateFilePayload): Promise<TranslateFileResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!openaiKey && (payload.providerOptions.mode === "openai" || payload.providerOptions.mode === "both")) {
    throw new Error("OPENAI_API_KEY no está configurada en el entorno.");
  }
  if (!geminiKey && (payload.providerOptions.mode === "gemini" || payload.providerOptions.mode === "both")) {
    throw new Error("GEMINI_API_KEY no está configurada en el entorno.");
  }

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
    rows = csvParse(raw, { skip_empty_lines: false });
  } else if (fileExt === ".xlsx") {
    const buf = await fs.readFile(payload.filePath);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true }) as any[][];
  } else {
    throw new Error("Formato de archivo no soportado. Usa .csv o .xlsx");
  }

  if (!rows.length) {
    throw new Error("El archivo de localización está vacío.");
  }

  const header = rows[0] || [];
  const keyColIndex = 0;
  const sourceColIndex = 1;

  const detectedSourceLanguageName = String(header[sourceColIndex] || "").trim();
  const sourceLanguageName = payload.sourceLanguageName || detectedSourceLanguageName || "Idioma origen";

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
      throw new Error("OPENAI_API_KEY no está configurada en el entorno.");
    }
    if (providerMode === "gemini" || providerMode === "both") {
      throw new Error("GEMINI_API_KEY no está configurada en el entorno.");
    }
  }

  const previewRows: PreviewRow[] = [];
  let translatedRowsCount = 0;

  type WorkItem = { rowIndex: number; id: string; key: string; sourceText: string };
  const toBatchRequest = (batchItems: WorkItem[], targetLang: TargetLanguage) => ({
    contextSnippet,
    glossarySnippet,
    sourceLanguageName,
    targetLanguage: targetLang,
    items: batchItems.map((it) => ({ id: it.id, key: it.key, sourceText: it.sourceText })),
  });

  for (const lang of payload.targetLanguages) {
    const langColIndex = targetLanguageToColumn[lang.name.toLowerCase()];
    if (typeof langColIndex !== "number") continue;

    const workItems: { rowIndex: number; id: string; key: string; sourceText: string }[] = [];

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
        resultsByProvider[id] = await provider.translateBatch(apiKey, modelId, toBatchRequest(batchItems, lang));
      }

      const openaiResults: TranslationResultItem[] = resultsByProvider["openai"] ?? [];
      const geminiResults: TranslationResultItem[] = resultsByProvider["gemini"] ?? [];

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
          confidence = 0.5;
        }

        if (mergedText) {
          const row = rows[item.rowIndex] || [];
          row[langColIndex] = mergedText;
          rows[item.rowIndex] = row;
          translatedRowsCount++;
        }

        if (previewRows.length < 50) {
          let previewRow = previewRows.find(
            (pr) => pr.key === item.key && pr.sourceText === item.sourceText,
          );
          if (!previewRow) {
            previewRow = {
              key: item.key,
              sourceText: item.sourceText,
              perLanguage: {},
            };
            previewRows.push(previewRow);
          }
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
      totalRows: rows.length - 1,
      translatedRows: translatedRowsCount,
    },
  };
}

