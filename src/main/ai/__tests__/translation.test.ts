import { getProvider } from "../providers";
import { translateFileInMain, resolveConfidenceComputation } from "../translation";
import * as XLSX from "xlsx";
import {
  CSV_MINIMAL,
  CSV_WITH_EXISTING_LANG,
  defaultTranslationPayload,
  mockTranslateResults,
} from "./fixtures/translationFixtures";
import { readFileMock, writeFileMock } from "./fixtures/mocks/fsPromises";

jest.mock("fs/promises", () => {
  const m = require("./fixtures/mocks/fsPromises");
  return { __esModule: true, default: m.default };
});

jest.mock("../providers", () => ({ getProvider: jest.fn() }));

const getProviderMock = getProvider as jest.Mock;

describe("resolveConfidenceComputation", () => {
  it("legacy: standard uses text similarity only", () => {
    expect(
      resolveConfidenceComputation({
        ...defaultTranslationPayload,
        calculateConfidence: true,
        confidenceMode: "standard",
      }),
    ).toEqual({
      needBackTranslation: true,
      computeTextSimilarity: true,
      computeEmbeddingSimilarity: false,
    });
  });

  it("legacy: standard+embeddings with model enables both", () => {
    expect(
      resolveConfidenceComputation({
        ...defaultTranslationPayload,
        calculateConfidence: true,
        confidenceMode: "standard+embeddings",
        confidenceEmbeddingModel: "text-embedding-3-small",
      }),
    ).toEqual({
      needBackTranslation: true,
      computeTextSimilarity: true,
      computeEmbeddingSimilarity: true,
    });
  });

  it("new flags: embeddings only with model", () => {
    expect(
      resolveConfidenceComputation({
        ...defaultTranslationPayload,
        confidenceTextSimilarity: false,
        confidenceEmbeddingSimilarity: true,
        confidenceEmbeddingModel: "text-embedding-3-small",
      }),
    ).toEqual({
      needBackTranslation: true,
      computeTextSimilarity: false,
      computeEmbeddingSimilarity: true,
    });
  });

  it("new flags: text only", () => {
    expect(
      resolveConfidenceComputation({
        ...defaultTranslationPayload,
        confidenceTextSimilarity: true,
        confidenceEmbeddingSimilarity: false,
      }),
    ).toEqual({
      needBackTranslation: true,
      computeTextSimilarity: true,
      computeEmbeddingSimilarity: false,
    });
  });
});

describe("translateFileInMain", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
    (global as any).__aiPersonalConfig = {
      openai: { apiKey: "personal-key", defaultModel: "gpt-4" },
      gemini: { apiKey: "gem-personal-key", defaultModel: "gemini-1.5" },
    };
    readFileMock.mockResolvedValue(CSV_MINIMAL);
    getProviderMock.mockReturnValue({
      translateBatch: jest.fn().mockResolvedValue(mockTranslateResults),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    delete (global as any).__aiPersonalConfig;
  });

  it("returns result with filePath, csvContent, preview and stats", async () => {
    const result = await translateFileInMain(defaultTranslationPayload);

    expect(result).toHaveProperty(
      "filePath",
      defaultTranslationPayload.filePath,
    );
    expect(result).toHaveProperty("csvContent");
    expect(result.csvContent).toContain("Clave");
    expect(result).toHaveProperty("preview");
    expect(Array.isArray(result.preview)).toBe(true);
    expect(result).toHaveProperty("stats");
    expect(result.stats).toHaveProperty("totalRows");
    expect(result.stats).toHaveProperty("translatedRows");
  });

  it("preview rows have rowIndex, key, sourceText and perLanguage", async () => {
    const result = await translateFileInMain(defaultTranslationPayload);

    expect(result.preview.length).toBeGreaterThan(0);
    const first = result.preview[0];
    expect(first).toHaveProperty("rowIndex");
    expect(first).toHaveProperty("key");
    expect(first).toHaveProperty("sourceText");
    expect(first).toHaveProperty("perLanguage");
    expect(typeof first.perLanguage).toBe("object");
  });

  it("stats totalRows is data row count", async () => {
    const result = await translateFileInMain(defaultTranslationPayload);

    expect(result.stats.totalRows).toBe(2);
  });

  it("throws when file is empty", async () => {
    readFileMock.mockResolvedValue("");

    await expect(
      translateFileInMain(defaultTranslationPayload),
    ).rejects.toThrow("vacío");
  });

  it("throws for unsupported format when path has .txt", async () => {
    await expect(
      translateFileInMain({
        ...defaultTranslationPayload,
        filePath: "/repo/file.txt",
      }),
    ).rejects.toThrow(/no soportado|\.csv|\.xlsx/);
  });

  it("throws when personal OpenAI key is missing", async () => {
    (global as any).__aiPersonalConfig = {};
    await expect(translateFileInMain(defaultTranslationPayload)).rejects.toThrow(
      /API key personal disponible para OpenAI/,
    );
  });

  it("calls provider translateBatch with batch request shape", async () => {
    const provider = {
      translateBatch: jest.fn().mockResolvedValue(mockTranslateResults),
    };
    getProviderMock.mockReturnValue(provider);

    await translateFileInMain(defaultTranslationPayload);

    expect(provider.translateBatch).toHaveBeenCalledWith(
      "personal-key",
      "gpt-4",
      expect.objectContaining({
        sourceLanguageName: expect.any(String),
        targetLanguage: { code: "es", name: "Spanish" },
        items: expect.arrayContaining([
          expect.objectContaining({
            id: "es:1",
            key: "1",
            sourceText: "Hello world",
          }),
          expect.objectContaining({
            id: "es:2",
            key: "2",
            sourceText: "Another string",
          }),
        ]),
      }),
    );
  });

  it("writes updated CSV with translated content", async () => {
    await translateFileInMain(defaultTranslationPayload);

    expect(writeFileMock).toHaveBeenCalledWith(
      defaultTranslationPayload.filePath,
      expect.any(String),
      "utf8",
    );
    const written = writeFileMock.mock.calls[0][1];
    expect(written).toContain("Spanish");
    expect(written).toContain("Hola mundo");
    expect(written).toContain("Otra cadena");
  });

  it("skips rows that already have translation for that language", async () => {
    readFileMock.mockResolvedValue(CSV_WITH_EXISTING_LANG);
    const provider = { translateBatch: jest.fn().mockResolvedValue([]) };
    getProviderMock.mockReturnValue(provider);

    await translateFileInMain({
      ...defaultTranslationPayload,
      targetLanguages: [{ code: "en", name: "English" }],
    });

    expect(provider.translateBatch).toHaveBeenCalled();
    const items = provider.translateBatch.mock.calls[0][2].items;
    expect(items.every((it: { id: string }) => !it.id.startsWith("en:2"))).toBe(
      true,
    );
  });

  it("uses xlsx read and writes xlsx buffer", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Clave", "Origen"],
      ["1", "Hello world"],
      ["2", "Another string"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Localizacion");
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    readFileMock.mockResolvedValue(buf);

    await translateFileInMain({
      ...defaultTranslationPayload,
      filePath: "/repo/localizar.xlsx",
    });

    expect(writeFileMock).toHaveBeenCalledWith(
      "/repo/localizar.xlsx",
      expect.any(Buffer),
    );
  });

  it("computes confidence with optional back-translation", async () => {
    const openaiProvider = {
      translateBatch: jest.fn().mockResolvedValue([
        { id: "es:1", translatedText: "Hola mundo" },
        { id: "es:2", translatedText: "Otra cadena" },
      ]),
    };
    getProviderMock.mockReturnValue(openaiProvider);

    const result = await translateFileInMain({
      ...defaultTranslationPayload,
      providerOptions: {
        ...defaultTranslationPayload.providerOptions,
        mode: "openai",
      },
      confidenceTextSimilarity: true,
      confidenceEmbeddingSimilarity: false,
    });

    expect(openaiProvider.translateBatch).toHaveBeenCalledTimes(2);
    expect(openaiProvider.translateBatch.mock.calls[1][2]).toEqual(
      expect.objectContaining({
        phase: "backTranslation",
        contextSnippet: "",
        glossarySnippet: "",
        items: expect.arrayContaining([
          expect.objectContaining({ id: "es:1", sourceText: "Hola mundo" }),
          expect.objectContaining({ id: "es:2", sourceText: "Otra cadena" }),
        ]),
      }),
    );
    expect(result.preview[0].perLanguage.es.confidence).not.toBeNull();
    expect(result.preview[0].perLanguage.es.roundTripText).toBeTruthy();
  });

  it("treats unicode punctuation variants as high lexical similarity", async () => {
    readFileMock.mockResolvedValue("Clave,Origen\n1,… Encuentra… todo");
    const provider = {
      translateBatch: jest
        .fn()
        .mockResolvedValueOnce([
          { id: "es:1", translatedText: "… Encuentra… todo" },
        ])
        .mockResolvedValueOnce([
          { id: "es:1", translatedText: "... Encuentra... todo" },
        ]),
    };
    getProviderMock.mockReturnValue(provider);

    const result = await translateFileInMain({
      ...defaultTranslationPayload,
      confidenceTextSimilarity: true,
      confidenceEmbeddingSimilarity: false,
    });

    const score = result.preview[0].perLanguage.es.textSimilarity ?? 0;
    expect(score).toBeGreaterThan(0.9);
  });

  it("keeps genuinely different texts at low lexical similarity", async () => {
    readFileMock.mockResolvedValue("Clave,Origen\n1,… Encuentra… todo");
    const provider = {
      translateBatch: jest
        .fn()
        .mockResolvedValueOnce([
          { id: "es:1", translatedText: "… Encuentra… todo" },
        ])
        .mockResolvedValueOnce([
          { id: "es:1", translatedText: "Abrir opciones avanzadas" },
        ]),
    };
    getProviderMock.mockReturnValue(provider);

    const result = await translateFileInMain({
      ...defaultTranslationPayload,
      confidenceTextSimilarity: true,
      confidenceEmbeddingSimilarity: false,
    });

    const score = result.preview[0].perLanguage.es.textSimilarity ?? 0;
    expect(score).toBeLessThan(0.6);
  });

  it("supports multiple target languages in one run", async () => {
    const provider = {
      translateBatch: jest.fn().mockResolvedValue([
        { id: "es:1", translatedText: "Hola mundo" },
        { id: "es:2", translatedText: "Otra cadena" },
        { id: "fr:1", translatedText: "Bonjour monde" },
        { id: "fr:2", translatedText: "Autre chaine" },
      ]),
    };
    getProviderMock.mockReturnValue(provider);

    const result = await translateFileInMain({
      ...defaultTranslationPayload,
      targetLanguages: [
        { code: "es", name: "Spanish" },
        { code: "fr", name: "French" },
      ],
    });

    expect(provider.translateBatch).toHaveBeenCalledTimes(2);
    expect(result.stats.translatedRows).toBe(4);
    expect(result.preview[0].perLanguage.es.mergedText).toBeTruthy();
    expect(result.preview[0].perLanguage.fr.mergedText).toBeTruthy();
  });

  it("passes context and glossary snippets to provider", async () => {
    const provider = {
      translateBatch: jest.fn().mockResolvedValue(mockTranslateResults),
    };
    getProviderMock.mockReturnValue(provider);
    readFileMock.mockImplementation((filePath: string) => {
      if (filePath === "/repo/localizar.csv")
        return Promise.resolve(CSV_MINIMAL);
      if (filePath === "/repo/context.txt")
        return Promise.resolve("combat and UI lore");
      if (filePath === "/repo/glossary.csv") {
        return Promise.resolve("term,translation\nStart,Iniciar");
      }
      return Promise.resolve("");
    });

    await translateFileInMain({
      ...defaultTranslationPayload,
      contexts: ["/repo/context.txt"],
      glossaries: ["/repo/glossary.csv"],
    });

    expect(provider.translateBatch).toHaveBeenCalledWith(
      "personal-key",
      "gpt-4",
      expect.objectContaining({
        contextSnippet: expect.stringContaining("combat and UI lore"),
        glossarySnippet: expect.stringContaining("Start"),
      }),
    );
  });

  it("includes both global and specific contexts in translation", async () => {
    const globalContextPath = "/base/repo-general-totem-games/contextos_generales/lore.txt";
    const specificContextPath = "/base/MyGame/Localizacion/contextos_especificos/ui.txt";
    const provider = {
      translateBatch: jest.fn().mockResolvedValue(mockTranslateResults),
    };
    getProviderMock.mockReturnValue(provider);
    readFileMock.mockImplementation((filePath: string) => {
      if (filePath === "/repo/localizar.csv") return Promise.resolve(CSV_MINIMAL);
      if (filePath === globalContextPath) return Promise.resolve("global lore content");
      if (filePath === specificContextPath) return Promise.resolve("specific UI content");
      return Promise.resolve("");
    });

    await translateFileInMain({
      ...defaultTranslationPayload,
      contexts: [globalContextPath, specificContextPath],
      glossaries: [],
    });

    const call = provider.translateBatch.mock.calls[0][2];
    expect(call.contextSnippet).toContain("global lore content");
    expect(call.contextSnippet).toContain("specific UI content");
  });

  it("includes both global and specific glossaries in translation", async () => {
    const globalGlossaryPath = "/base/repo-general-totem-games/glosarios_generales/terms.csv";
    const specificGlossaryPath = "/base/MyGame/Localizacion/glosarios_especificos/game.csv";
    const provider = {
      translateBatch: jest.fn().mockResolvedValue(mockTranslateResults),
    };
    getProviderMock.mockReturnValue(provider);
    readFileMock.mockImplementation((filePath: string) => {
      if (filePath === "/repo/localizar.csv") return Promise.resolve(CSV_MINIMAL);
      if (filePath === globalGlossaryPath)
        return Promise.resolve("term,translation\nAttack,Ataque\nDefend,Defender");
      if (filePath === specificGlossaryPath)
        return Promise.resolve("term,translation\nBoss,Jefe\nItem,Objeto");
      return Promise.resolve("");
    });

    await translateFileInMain({
      ...defaultTranslationPayload,
      contexts: [],
      glossaries: [globalGlossaryPath, specificGlossaryPath],
    });

    const call = provider.translateBatch.mock.calls[0][2];
    expect(call.glossarySnippet).toContain("Attack");
    expect(call.glossarySnippet).toContain("Defender");
    expect(call.glossarySnippet).toContain("Boss");
    expect(call.glossarySnippet).toContain("Objeto");
  });

  it("preserves order of contexts and glossaries (global first, then specific)", async () => {
    const globalCtx = "/general/contextos_generales/a.txt";
    const specificCtx = "/project/contextos_especificos/b.txt";
    const globalGlos = "/general/glosarios_generales/g.csv";
    const specificGlos = "/project/glosarios_especificos/s.csv";
    const provider = {
      translateBatch: jest.fn().mockResolvedValue(mockTranslateResults),
    };
    getProviderMock.mockReturnValue(provider);
    readFileMock.mockImplementation((filePath: string) => {
      if (filePath === "/repo/localizar.csv") return Promise.resolve(CSV_MINIMAL);
      if (filePath === globalCtx) return Promise.resolve("FIRST");
      if (filePath === specificCtx) return Promise.resolve("SECOND");
      if (filePath === globalGlos) return Promise.resolve("term,translation\nG1,T1");
      if (filePath === specificGlos) return Promise.resolve("term,translation\nS1,T2");
      return Promise.resolve("");
    });

    await translateFileInMain({
      ...defaultTranslationPayload,
      contexts: [globalCtx, specificCtx],
      glossaries: [globalGlos, specificGlos],
    });

    const call = provider.translateBatch.mock.calls[0][2];
    const firstCtxIdx = call.contextSnippet.indexOf("FIRST");
    const secondCtxIdx = call.contextSnippet.indexOf("SECOND");
    expect(firstCtxIdx).toBeGreaterThanOrEqual(0);
    expect(secondCtxIdx).toBeGreaterThanOrEqual(0);
    expect(firstCtxIdx).toBeLessThan(secondCtxIdx);

    const g1Idx = call.glossarySnippet.indexOf("G1");
    const s1Idx = call.glossarySnippet.indexOf("S1");
    expect(g1Idx).toBeGreaterThanOrEqual(0);
    expect(s1Idx).toBeGreaterThanOrEqual(0);
    expect(g1Idx).toBeLessThan(s1Idx);
  });

  it("uses gemini provider when mode is gemini", async () => {
    const provider = {
      translateBatch: jest.fn().mockResolvedValue(mockTranslateResults),
    };
    getProviderMock.mockReturnValue(provider);

    await translateFileInMain({
      ...defaultTranslationPayload,
      providerOptions: {
        ...defaultTranslationPayload.providerOptions,
        mode: "gemini",
      },
    });

    expect(provider.translateBatch).toHaveBeenCalledWith(
      "gem-personal-key",
      "gemini-1.5",
      expect.any(Object),
    );
  });

  it("throws when personal Gemini key is missing and mode is gemini", async () => {
    (global as any).__aiPersonalConfig = { openai: { apiKey: "personal-key", defaultModel: "gpt-4" } };

    await expect(
      translateFileInMain({
        ...defaultTranslationPayload,
        providerOptions: {
          ...defaultTranslationPayload.providerOptions,
          mode: "gemini",
        },
      }),
    ).rejects.toThrow(/API key personal disponible para Gemini/);
  });

  it("uses personal OpenAI key when configured", async () => {
    (global as any).__aiPersonalConfig = {
      openai: { apiKey: "personal-key", defaultModel: "gpt-personal" },
    };
    const provider = {
      translateBatch: jest.fn().mockResolvedValue(mockTranslateResults),
    };
    getProviderMock.mockReturnValue(provider);

    await translateFileInMain({
      ...defaultTranslationPayload,
      providerOptions: {
        ...defaultTranslationPayload.providerOptions,
        personalOpenAIModel: "gpt-personal",
      },
    });

    expect(provider.translateBatch).toHaveBeenCalledWith(
      "personal-key",
      "gpt-personal",
      expect.any(Object),
    );
  });

  it("handles sender that is destroyed without sending progress", async () => {
    const sender = {
      isDestroyed: jest.fn().mockReturnValue(true),
      send: jest.fn(),
    };

    await translateFileInMain(defaultTranslationPayload, sender as any);

    expect(sender.send).not.toHaveBeenCalled();
  });

  it("skips provider ids with no provider instance", async () => {
    getProviderMock.mockReturnValue(null);

    const result = await translateFileInMain({
      ...defaultTranslationPayload,
      providerOptions: {
        ...defaultTranslationPayload.providerOptions,
        mode: "gemini",
      },
    });

    expect(result.stats.translatedRows).toBe(0);
  });

  it("continues when one target language has no pending rows", async () => {
    readFileMock.mockResolvedValue(
      "Clave,Origen,Spanish\n1,Hola,Ya traducido\n2,Mundo,",
    );
    const provider = {
      translateBatch: jest
        .fn()
        .mockResolvedValue([{ id: "es:2", translatedText: "World" }]),
    };
    getProviderMock.mockReturnValue(provider);

    await translateFileInMain({
      ...defaultTranslationPayload,
      targetLanguages: [
        { code: "es", name: "Spanish" },
        { code: "fr", name: "French" },
      ],
    });

    expect(provider.translateBatch).toHaveBeenCalled();
  });

  it("propagates provider errors", async () => {
    const provider = {
      translateBatch: jest.fn().mockRejectedValue(new Error("provider failed")),
    };
    getProviderMock.mockReturnValue(provider);

    await expect(
      translateFileInMain(defaultTranslationPayload),
    ).rejects.toThrow("provider failed");
  });

  it("reads glossary xlsx and trims by maxContextChars", async () => {
    const glossaryWorkbook = XLSX.utils.book_new();
    const glossarySheet = XLSX.utils.aoa_to_sheet([
      ["term", "translation"],
      ["Start", "Iniciar"],
      ["Exit", "Salir"],
    ]);
    XLSX.utils.book_append_sheet(glossaryWorkbook, glossarySheet, "Glossary");
    const glossaryBuffer = XLSX.write(glossaryWorkbook, {
      type: "buffer",
      bookType: "xlsx",
    });
    const provider = {
      translateBatch: jest.fn().mockResolvedValue(mockTranslateResults),
    };
    getProviderMock.mockReturnValue(provider);
    readFileMock.mockImplementation((filePath: string, encoding?: string) => {
      if (filePath === "/repo/localizar.csv" && encoding === "utf8") {
        return Promise.resolve(CSV_MINIMAL);
      }
      if (filePath === "/repo/context.txt" && encoding === "utf8") {
        return Promise.resolve("long context text");
      }
      if (filePath === "/repo/glossary.xlsx") {
        return Promise.resolve(glossaryBuffer);
      }
      return Promise.resolve("");
    });

    await translateFileInMain({
      ...defaultTranslationPayload,
      contexts: ["/repo/context.txt"],
      glossaries: ["/repo/glossary.xlsx"],
      maxContextChars: 20,
    });

    expect(provider.translateBatch).toHaveBeenCalledWith(
      "personal-key",
      "gpt-4",
      expect.objectContaining({
        contextSnippet: expect.any(String),
        glossarySnippet: "",
      }),
    );
  });

  it("accumulates tokensUsed from provider usage", async () => {
    const provider = {
      translateBatch: jest.fn().mockResolvedValue({
        results: mockTranslateResults,
        usage: { totalTokens: 42 },
      }),
    };
    getProviderMock.mockReturnValue(provider);

    const result = await translateFileInMain(defaultTranslationPayload);

    expect(result.stats.tokensUsed).toBe(42);
  });
});
