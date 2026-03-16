import { getProvider } from "../providers";
import { spellCheckFileInMain } from "../spellcheck";
import * as XLSX from "xlsx";
import {
  CSV_SOURCE,
  CSV_HEADER_ONLY,
  CSV_SINGLE_ROW,
  defaultSpellCheckPayload,
  mockSpellResults,
} from "./fixtures/spellcheckFixtures";
import { readFileMock, writeFileMock } from "./fixtures/mocks/fsPromises";

jest.mock("fs/promises", () => {
  const m = require("./fixtures/mocks/fsPromises");
  return { __esModule: true, default: m.default };
});

jest.mock("../providers", () => ({ getProvider: jest.fn() }));

const getProviderMock = getProvider as jest.Mock;

describe("spellCheckFileInMain", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
    readFileMock.mockResolvedValue(CSV_SOURCE);
    getProviderMock.mockReturnValue({
      spellCorrectBatch: jest.fn().mockResolvedValue(mockSpellResults),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns result with filePath, csvContent, preview and stats", async () => {
    const result = await spellCheckFileInMain(defaultSpellCheckPayload);

    expect(result).toHaveProperty(
      "filePath",
      defaultSpellCheckPayload.filePath,
    );
    expect(result).toHaveProperty("csvContent");
    expect(result.csvContent).toContain("Clave");
    expect(result).toHaveProperty("preview");
    expect(Array.isArray(result.preview)).toBe(true);
    expect(result).toHaveProperty("stats");
    expect(result.stats).toHaveProperty("totalRows");
    expect(result.stats).toHaveProperty("correctedRows");
  });

  it("preview rows have originalSource and correctedSource", async () => {
    const result = await spellCheckFileInMain(defaultSpellCheckPayload);

    expect(result.preview.length).toBeGreaterThan(0);
    const first = result.preview[0];
    expect(first).toHaveProperty("rowIndex");
    expect(first).toHaveProperty("key");
    expect(first).toHaveProperty("originalSource");
    expect(first).toHaveProperty("correctedSource");
  });

  it("stats totalRows is data row count", async () => {
    const result = await spellCheckFileInMain(defaultSpellCheckPayload);

    expect(result.stats.totalRows).toBe(3);
  });

  it("does not write file when applyToFile is false", async () => {
    await spellCheckFileInMain({
      ...defaultSpellCheckPayload,
      applyToFile: false,
    });

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("writes file when applyToFile is true", async () => {
    await spellCheckFileInMain({
      ...defaultSpellCheckPayload,
      applyToFile: true,
    });

    expect(writeFileMock).toHaveBeenCalledWith(
      defaultSpellCheckPayload.filePath,
      expect.any(String),
      "utf8",
    );
  });

  it("throws when file is empty", async () => {
    readFileMock.mockResolvedValue("");

    await expect(
      spellCheckFileInMain(defaultSpellCheckPayload),
    ).rejects.toThrow("El archivo está vacío.");
  });

  it("handles file with only header (no data rows)", async () => {
    readFileMock.mockResolvedValue(CSV_HEADER_ONLY);

    const result = await spellCheckFileInMain(defaultSpellCheckPayload);
    expect(result.stats.totalRows).toBe(0);
    expect(result.preview).toHaveLength(0);
  });

  it("throws for unsupported format when path has .txt", async () => {
    await expect(
      spellCheckFileInMain({
        ...defaultSpellCheckPayload,
        filePath: "/repo/file.txt",
      }),
    ).rejects.toThrow(/\.csv o \.xlsx/);
  });

  it("throws when no API key is set", async () => {
    process.env.OPENAI_API_KEY = "";
    process.env.GEMINI_API_KEY = "";

    await expect(
      spellCheckFileInMain(defaultSpellCheckPayload),
    ).rejects.toThrow(/OPENAI_API_KEY|GEMINI_API_KEY/);
  });

  it("calls provider spellCorrectBatch with language and items", async () => {
    const provider = { spellCorrectBatch: jest.fn().mockResolvedValue([]) };
    getProviderMock.mockReturnValue(provider);

    await spellCheckFileInMain({
      ...defaultSpellCheckPayload,
      language: "English",
    });

    expect(provider.spellCorrectBatch).toHaveBeenCalledWith(
      "test-key",
      "gpt-4",
      expect.objectContaining({
        languageName: "English",
        items: expect.arrayContaining([
          expect.objectContaining({ id: "spell:1", sourceText: "Helo world" }),
          expect.objectContaining({
            id: "spell:2",
            sourceText: "Teh quick brown",
          }),
        ]),
      }),
    );
  });

  it("respects maxRows", async () => {
    const provider = { spellCorrectBatch: jest.fn().mockResolvedValue([]) };
    getProviderMock.mockReturnValue(provider);

    readFileMock.mockResolvedValue(CSV_SINGLE_ROW);

    await spellCheckFileInMain({
      ...defaultSpellCheckPayload,
      maxRows: 1,
    });

    expect(provider.spellCorrectBatch).toHaveBeenCalledWith(
      "test-key",
      "gpt-4",
      expect.objectContaining({
        items: expect.any(Array),
      }),
    );
    expect(provider.spellCorrectBatch.mock.calls[0][2].items.length).toBe(1);
  });

  it("uses xlsx read and writes xlsx buffer when applyToFile is true", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Clave", "Origen"],
      ["1", "Helo world"],
      ["2", "Teh quick brown"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Localizacion");
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    readFileMock.mockResolvedValue(buf);

    const result = await spellCheckFileInMain({
      ...defaultSpellCheckPayload,
      filePath: "/repo/localizar.xlsx",
      applyToFile: true,
    });

    expect(result.csvContent).toContain("Clave,Origen");
    expect(writeFileMock).toHaveBeenCalledWith(
      "/repo/localizar.xlsx",
      expect.any(Buffer),
    );
  });

  it("runs both providers when mode is both", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    const openaiProvider = {
      spellCorrectBatch: jest
        .fn()
        .mockResolvedValue([{ id: "spell:1", translatedText: "Hello world" }]),
    };
    const geminiProvider = {
      spellCorrectBatch: jest
        .fn()
        .mockResolvedValue([{ id: "spell:1", translatedText: "Hallo world" }]),
    };
    getProviderMock.mockImplementation((id: string) => {
      if (id === "openai") return openaiProvider;
      if (id === "gemini") return geminiProvider;
      return null;
    });

    await spellCheckFileInMain({
      ...defaultSpellCheckPayload,
      providerOptions: {
        ...defaultSpellCheckPayload.providerOptions,
        mode: "both",
      },
    });

    expect(openaiProvider.spellCorrectBatch).toHaveBeenCalledTimes(1);
    expect(geminiProvider.spellCorrectBatch).toHaveBeenCalledTimes(1);
  });

  it("sends progress events to sender", async () => {
    const sender = {
      isDestroyed: jest.fn().mockReturnValue(false),
      send: jest.fn(),
    };

    await spellCheckFileInMain(defaultSpellCheckPayload, sender as any);

    expect(sender.send).toHaveBeenCalledWith(
      "spellcheck-progress",
      expect.objectContaining({ percent: expect.any(Number) }),
    );
    const lastCall = sender.send.mock.calls[sender.send.mock.calls.length - 1];
    expect(lastCall[1].percent).toBe(100);
  });

  it("accumulates tokensUsed from provider usage", async () => {
    const provider = {
      spellCorrectBatch: jest.fn().mockResolvedValue({
        results: mockSpellResults,
        usage: { totalTokens: 17 },
      }),
    };
    getProviderMock.mockReturnValue(provider);

    const result = await spellCheckFileInMain(defaultSpellCheckPayload);

    expect(result.stats.tokensUsed).toBe(17);
  });
});
