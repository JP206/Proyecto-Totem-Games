import { openaiProvider } from "../openai";
import {
  mockTranslationItems,
  mockTranslationAPIResponse,
  mockSpellCheckResponse,
  mockSpellCheckAPIResponse,
} from "./fixtures/providerFixtures";

const mockFetch = jest.fn();

beforeAll(() => {
  (global as any).fetch = mockFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe("openaiProvider", () => {
  it("has id openai", () => {
    expect(openaiProvider.id).toBe("openai");
  });

  describe("translateBatch", () => {
    it("returns parsed translations from API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTranslationAPIResponse),
      });

      const result = await openaiProvider.translateBatch("fake-key", "gpt-4", {
        contextSnippet: "",
        glossarySnippet: "",
        sourceLanguageName: "English",
        targetLanguage: { code: "es", name: "Spanish" },
        items: mockTranslationItems,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "1", translatedText: "Hola" });
      expect(result[1]).toEqual({ id: "2", translatedText: "Mundo" });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer fake-key",
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(
        openaiProvider.translateBatch("bad-key", "gpt-4", {
          contextSnippet: "",
          glossarySnippet: "",
          sourceLanguageName: "English",
          targetLanguage: { code: "es", name: "Spanish" },
          items: mockTranslationItems,
        }),
      ).rejects.toThrow("Error en OpenAI: 401");
    });

    it("returns empty array when content is invalid JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "not valid json" } }],
          }),
      });

      const result = await openaiProvider.translateBatch("fake-key", "gpt-4", {
        contextSnippet: "",
        glossarySnippet: "",
        sourceLanguageName: "English",
        targetLanguage: { code: "es", name: "Spanish" },
        items: mockTranslationItems,
      });

      expect(result).toEqual([]);
    });

    it("parses array content embedded in extra text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content:
                    'text before [{"id":"1","translatedText":"Hola"}] text after',
                },
              },
            ],
          }),
      });

      const result = await openaiProvider.translateBatch("fake-key", "gpt-4", {
        contextSnippet: "",
        glossarySnippet: "",
        sourceLanguageName: "English",
        targetLanguage: { code: "es", name: "Spanish" },
        items: mockTranslationItems,
      });

      expect(result).toEqual([{ id: "1", translatedText: "Hola" }]);
    });
  });

  describe("spellCorrectBatch", () => {
    it("returns parsed corrections from API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSpellCheckAPIResponse),
      });

      const result = await openaiProvider.spellCorrectBatch(
        "fake-key",
        "gpt-4",
        {
          languageName: "Español",
          items: [{ id: "spell:1", key: "k1", sourceText: "Incorrect text" }],
        },
      );

      expect(result).toEqual(mockSpellCheckResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.any(Object),
      );
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server Error"),
      });

      await expect(
        openaiProvider.spellCorrectBatch("fake-key", "gpt-4", {
          languageName: "Español",
          items: [{ id: "1", key: "k", sourceText: "text" }],
        }),
      ).rejects.toThrow("Error en OpenAI: 500");
    });

    it("returns empty array when spellcheck content is invalid JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "{invalid" } }],
          }),
      });

      const result = await openaiProvider.spellCorrectBatch(
        "fake-key",
        "gpt-4",
        {
          languageName: "Español",
          items: [{ id: "spell:1", key: "k1", sourceText: "Incorrect text" }],
        },
      );

      expect(result).toEqual([]);
    });

    it("supports empty items list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSpellCheckAPIResponse),
      });

      const result = await openaiProvider.spellCorrectBatch(
        "fake-key",
        "gpt-4",
        {
          languageName: "Español",
          items: [],
        },
      );

      expect(Array.isArray(result)).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
