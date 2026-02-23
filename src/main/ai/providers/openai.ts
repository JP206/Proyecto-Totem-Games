import type {
  ITranslationProvider,
  TranslationBatchRequest,
  TranslationResultItem,
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

export const openaiProvider: ITranslationProvider = {
  id: "openai",

  async translateBatch(
    apiKey: string,
    modelId: string,
    request: TranslationBatchRequest,
  ): Promise<TranslationResultItem[]> {
    const url = "https://api.openai.com/v1/chat/completions";
    const systemPrompt =
      "Eres un traductor profesional de videojuegos. Respeta el contexto y los glosarios proporcionados. " +
      "Mantén el tono y evita inventar información. Devuelve SOLO un JSON válido.";

    let userContent = `Contexto adicional (puede estar truncado):\n${request.contextSnippet || "Ninguno"}\n\n`;
    userContent += `Glosario (usa exactamente estas traducciones cuando apliquen):\n${
      request.glossarySnippet || "Ninguno"
    }\n\n`;
    userContent += `Idioma origen: ${request.sourceLanguageName}\n`;
    userContent += `Idioma destino: ${request.targetLanguage.name} (${request.targetLanguage.code})\n\n`;
    userContent +=
      "Traduce los siguientes textos y devuelve un JSON con el formato:\n";
    userContent += `[{"id": "ID_DEL_ITEM", "translatedText": "texto traducido"}]\n\n`;
    userContent += "Items a traducir:\n";
    userContent += JSON.stringify(
      request.items.map((it) => ({
        id: it.id,
        key: it.key,
        sourceText: it.sourceText,
      })),
    );

    const payload = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[OpenAI] API error:", response.status, text);
      throw new Error(`Error en OpenAI: ${response.status} ${text}`);
    }

    const data: any = await response.json();
    const content: string = data.choices?.[0]?.message?.content || "[]";
    const results = parseJsonResults(content);
    console.log(
      "[OpenAI] Parsed",
      results.length,
      "translations for",
      request.items.length,
      "items",
    );
    return results;
  },

  async spellCorrectBatch(
    apiKey: string,
    modelId: string,
    request: SpellCheckBatchRequest,
  ): Promise<TranslationResultItem[]> {
    const url = "https://api.openai.com/v1/chat/completions";
    const systemPrompt =
      "Eres un corrector ortográfico y gramatical. Corrige únicamente errores de ortografía y gramática en el mismo idioma. " +
      "No traduzcas ni cambies el significado. Mantén el tono y formato (diálogos, mayúsculas, etc.). Devuelve SOLO un JSON válido.";
    const userContent =
      `Idioma del texto: ${request.languageName}\n\n` +
      "Devuelve un JSON con el formato:\n" +
      `[{"id": "ID_DEL_ITEM", "translatedText": "texto corregido"}]\n\n` +
      "Textos a corregir:\n" +
      JSON.stringify(
        request.items.map((it) => ({
          id: it.id,
          key: it.key,
          sourceText: it.sourceText,
        })),
      );

    const payload = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Error en OpenAI: ${response.status} ${text}`);
    }

    const data: any = await response.json();
    const content: string = data.choices?.[0]?.message?.content || "[]";
    return parseJsonResults(content);
  },
};
