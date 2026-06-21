import {
  buildTranslationMetricRecord,
  resolveGameMetricsPaths,
  toMetricLangCode,
} from "../saveMetrics";
import type { PreviewRow, TranslateFilePayload } from "../translation";

const basePayload: TranslateFilePayload = {
  repoPath: "/games/juego-totem-games",
  projectName: "juego-totem-games",
  filePath: "/games/juego-totem-games/Localizacion/juego-totem-games_localizar.csv",
  targetLanguages: [
    { code: "EN-US", name: "Inglés (Estados Unidos)" },
    { code: "PT-BR", name: "Portugués (Brasil)" },
  ],
  contexts: [],
  glossaries: [],
  providerOptions: {
    mode: "gemini",
    openaiModel: "gpt-4",
    geminiModel: "gemini-2.5-flash",
  },
  confidenceTextSimilarity: true,
  confidenceEmbeddingSimilarity: true,
};

const previewRows: PreviewRow[] = [
  {
    rowIndex: 1,
    key: "1",
    sourceText: "Hola",
    perLanguage: {
      "EN-US": {
        mergedText: "Hello",
        confidence: 0.84,
        textSimilarity: 0.75,
        embeddingSimilarity: 0.93,
      },
      "PT-BR": {
        mergedText: "Olá",
        confidence: 0.81,
        textSimilarity: 0.72,
        embeddingSimilarity: 0.91,
      },
    },
  },
];

describe("buildTranslationMetricRecord", () => {
  it("formats ids, dates and language codes like existing metrics files", () => {
    const record = buildTranslationMetricRecord(
      basePayload,
      previewRows,
      { totalRows: 1, translatedRows: 1, tokensUsed: 12450 },
      { id: "gemini", modelId: "gemini-2.5-flash" },
      {
        computeTextSimilarity: true,
        computeEmbeddingSimilarity: true,
        spellcheck: true,
        correctedTexts: 1,
        spellcheckTokens: 2340,
      },
    );

    expect(record.id).toMatch(/^[\d-]+T[\d-]+_juego-totem-games$/);
    expect(record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(record.file).toBe("juego-totem-games_localizar.csv");
    expect(record.similarity).toEqual({ lexical: true, embeddings: true });
    expect(record.spellcheck).toBe(true);
    expect(record.correctedTexts).toBe(1);
    expect(record.correctionRate).toBe(100);
    expect(record.tokens).toEqual({
      spellcheck: 2340,
      translation: 12450,
      total: 14790,
    });
    expect(record.useCustomApiKey).toBe(true);
    expect(record.languages[0]).toEqual({
      lang: "shared",
      lexical: 74,
      meaning: 92,
      confidence: 83,
    });
    expect(record.languages[1]).toEqual({
      lang: "en_us",
      lexical: 75,
      meaning: 93,
      confidence: 84,
    });
    expect(record.languages[2]).toEqual({
      lang: "pt_br",
      lexical: 72,
      meaning: 91,
      confidence: 81,
    });
  });

  it("omits spellcheck token fields when spellcheck is disabled", () => {
    const record = buildTranslationMetricRecord(
      basePayload,
      previewRows,
      { totalRows: 1, translatedRows: 1, tokensUsed: 8760 },
      { id: "openai", modelId: "gpt-4" },
      {
        computeTextSimilarity: true,
        computeEmbeddingSimilarity: true,
        spellcheck: false,
      },
    );

    expect(record.tokens).toEqual({ translation: 8760, total: 8760 });
    expect(record.correctedTexts).toBeUndefined();
    expect(record.correctionRate).toBeUndefined();
  });

  it("converts language codes to lowercase underscore format", () => {
    expect(toMetricLangCode("EN-US")).toBe("en_us");
    expect(toMetricLangCode("ES-MX")).toBe("es_mx");
  });

  it("stores metrics under Localizacion/metricas_ia.json in the game repo", () => {
    const paths = resolveGameMetricsPaths(
      "/games/juego-totem-games",
      "juego-totem-games",
    );

    expect(paths.gameRepoPath).toBe("/games/juego-totem-games");
    expect(paths.metricsFilePath.replace(/\\/g, "/")).toBe(
      "/games/juego-totem-games/Localizacion/metricas_ia.json",
    );
    expect(paths.relativeMetricsPath.replace(/\\/g, "/")).toBe(
      "Localizacion/metricas_ia.json",
    );
  });
});
