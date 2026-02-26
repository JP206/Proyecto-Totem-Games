import type {
  ITranslationProvider,
  TranslationBatchRequest,
  TranslationResultItem,
  TranslationBatchResult,
  SpellCheckBatchRequest,
} from "./types";

function parseJsonResults(content: string): TranslationResultItem[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any) => ({
          id: String(item.id),
          translatedText:
            typeof item.translatedText === "string" ? item.translatedText : "",
        }))
        .filter((it: TranslationResultItem) => it.id);
    }
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item: any) => ({
              id: String(item.id),
              translatedText:
                typeof item.translatedText === "string"
                  ? item.translatedText
                  : "",
            }))
            .filter((it: TranslationResultItem) => it.id);
        }
      } catch {
        // ignore
      }
    }
  }
  return [];
}

export const geminiProvider: ITranslationProvider = {
  id: "gemini",

  async translateBatch(
    apiKey: string,
    modelId: string,
    request: TranslationBatchRequest,
  ): Promise<TranslationBatchResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelId,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let text =
      "Eres un traductor profesional de videojuegos. Respeta el contexto y los glosarios proporcionados. ";
    text += "Devuelve SOLO un JSON con formato ";
    text += `[{"id": "ID_DEL_ITEM", "translatedText": "texto traducido"}].\n\n`;

    text += `Contexto adicional (puede estar truncado):\n${request.contextSnippet || "Ninguno"}\n\n`;
    text += `Glosario (usa exactamente estas traducciones cuando apliquen):\n${
      request.glossarySnippet || "Ninguno"
    }\n\n`;
    text += `Idioma origen: ${request.sourceLanguageName}\n`;
    text += `Idioma destino: ${request.targetLanguage.name} (${request.targetLanguage.code})\n\n`;
    text += "Items a traducir:\n";
    text += JSON.stringify(
      request.items.map((it) => ({
        id: it.id,
        key: it.key,
        sourceText: it.sourceText,
      })),
    );

    const payload = {
      contents: [{ parts: [{ text }] }],
      generationConfig: { temperature: 0.2 },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[Gemini] API error:", response.status, body);
      throw new Error(`Error en Gemini: ${response.status} ${body}`);
    }

    const data: any = await response.json();
    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) {
      console.error("[Gemini] Blocked:", blockReason, data.promptFeedback);
    }
    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || "")
        .join("\n") || "[]";
    const results = parseJsonResults(content);
    const um = data.usageMetadata;
    const usage =
      um && (um.promptTokenCount != null || um.candidatesTokenCount != null)
        ? {
            inputTokens: um.promptTokenCount ?? 0,
            outputTokens: um.candidatesTokenCount ?? 0,
            totalTokens:
              um.totalTokenCount ??
              (um.promptTokenCount ?? 0) + (um.candidatesTokenCount ?? 0),
          }
        : undefined;
    console.log(
      "[Gemini] Parsed",
      results.length,
      "translations for",
      request.items.length,
      "items",
      usage ? `| tokens: ${usage.totalTokens}` : "",
    );
    return { results, usage };
  },

  async spellCorrectBatch(
    apiKey: string,
    modelId: string,
    request: SpellCheckBatchRequest,
  ): Promise<TranslationBatchResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelId,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const text =
      "Eres un corrector ortográfico y gramatical. Corrige únicamente errores de ortografía y gramática en el mismo idioma. " +
      "No traduzcas ni cambies el significado. Mantén el tono y formato. Devuelve SOLO un JSON: " +
      `[{"id": "ID_DEL_ITEM", "translatedText": "texto corregido"}].\n\n` +
      `Idioma del texto: ${request.languageName}\n\n` +
      "Textos a corregir:\n" +
      JSON.stringify(
        request.items.map((it) => ({
          id: it.id,
          key: it.key,
          sourceText: it.sourceText,
        })),
      );

    const payload = {
      contents: [{ parts: [{ text }] }],
      generationConfig: { temperature: 0.1 },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Error en Gemini: ${response.status} ${body}`);
    }

    const data: any = await response.json();
    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || "")
        .join("\n") || "[]";
    const results = parseJsonResults(content);
    const um = data.usageMetadata;
    const usage =
      um && (um.promptTokenCount != null || um.candidatesTokenCount != null)
        ? {
            inputTokens: um.promptTokenCount ?? 0,
            outputTokens: um.candidatesTokenCount ?? 0,
            totalTokens:
              um.totalTokenCount ??
              (um.promptTokenCount ?? 0) + (um.candidatesTokenCount ?? 0),
          }
        : undefined;
    return { results, usage };
  },
};
