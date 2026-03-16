import { geminiProvider } from "../gemini";
import {
  mockTranslationItems,
  mockTranslationResponse,
  mockSpellCheckResponse,
} from "./fixtures/providerFixtures";

const mockFetch = jest.fn();

beforeAll(() => {
  (global as any).fetch = mockFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe("geminiProvider", () => {
  it("has id gemini", () => {
    expect(geminiProvider.id).toBe("gemini");
  });

  describe("translateBatch", () => {
    it("returns parsed translations from API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(mockTranslationResponse) }],
                },
              },
            ],
          }),
      });

      const result = await geminiProvider.translateBatch(
        "fake-key",
        "gemini-1.5-flash",
        {
          contextSnippet: "",
          glossarySnippet: "",
          sourceLanguageName: "English",
          targetLanguage: { code: "es", name: "Spanish" },
          items: mockTranslationItems,
        },
      );

      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({ id: "1", translatedText: "Hola" });
      expect(result.results[1]).toEqual({ id: "2", translatedText: "Mundo" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("generateContent"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      await expect(
        geminiProvider.translateBatch("bad-key", "gemini-1.5", {
          contextSnippet: "",
          glossarySnippet: "",
          sourceLanguageName: "English",
          targetLanguage: { code: "es", name: "Spanish" },
          items: mockTranslationItems,
        }),
      ).rejects.toThrow("Error en Gemini: 403");
    });

    it("returns empty array when content is missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ candidates: [] }),
      });

      const result = await geminiProvider.translateBatch(
        "fake-key",
        "gemini-1.5",
        {
          contextSnippet: "",
          glossarySnippet: "",
          sourceLanguageName: "English",
          targetLanguage: { code: "es", name: "Spanish" },
          items: mockTranslationItems,
        },
      );

      expect(result).toEqual([]);
    });

    it("parses array content embedded in extra text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'wrapped [{"id":"1","translatedText":"Hola"}] wrapped',
                    },
                  ],
                },
              },
            ],
          }),
      });

      const result = await geminiProvider.translateBatch(
        "fake-key",
        "gemini-1.5",
        {
          contextSnippet: "",
          glossarySnippet: "",
          sourceLanguageName: "English",
          targetLanguage: { code: "es", name: "Spanish" },
          items: mockTranslationItems,
        },
      );

      expect(result).toEqual([{ id: "1", translatedText: "Hola" }]);
    });

    it("handles promptFeedback blockReason", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            promptFeedback: { blockReason: "SAFETY" },
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(mockTranslationResponse) }],
                },
              },
            ],
          }),
      });

      const result = await geminiProvider.translateBatch(
        "fake-key",
        "gemini-1.5",
        {
          contextSnippet: "",
          glossarySnippet: "",
          sourceLanguageName: "English",
          targetLanguage: { code: "es", name: "Spanish" },
          items: mockTranslationItems,
        },
      );

      expect(result).toHaveLength(2);
    });
  });

  describe("spellCorrectBatch", () => {
    it("returns parsed corrections from API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify(mockSpellCheckResponse),
                    },
                  ],
                },
              },
            ],
          }),
      });

      const result = await geminiProvider.spellCorrectBatch(
        "fake-key",
        "gemini-1.5",
        {
          languageName: "Español",
          items: [{ id: "spell:1", key: "k1", sourceText: "Incorrect" }],
        },
      );

      expect(result).toEqual(mockSpellCheckResponse);
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limit"),
      });

      await expect(
        geminiProvider.spellCorrectBatch("fake-key", "gemini-1.5", {
          languageName: "Español",
          items: [{ id: "spell:1", key: "k1", sourceText: "Incorrect" }],
        }),
      ).rejects.toThrow("Error en Gemini: 429");
    });

    it("returns empty array when spellcheck content is missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ candidates: [] }),
      });

      const result = await geminiProvider.spellCorrectBatch(
        "fake-key",
        "gemini-1.5",
        {
          languageName: "Español",
          items: [{ id: "spell:1", key: "k1", sourceText: "Incorrect" }],
        },
      );

      expect(result).toEqual([]);
    });
  });
});
