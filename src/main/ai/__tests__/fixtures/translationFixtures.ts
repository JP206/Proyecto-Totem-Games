export const CSV_MINIMAL = "Clave,Origen\n1,Hello world\n2,Another string";
export const CSV_WITH_EXISTING_LANG =
  "Clave,Origen,English\n1,Hola,\n2,Mundo,World";
export const CSV_EMPTY_ROWS = "Clave,Origen\n1,Hi\n\n2,Bye";

export const mockTranslateResults = [
  { id: "es:1", translatedText: "Hola mundo" },
  { id: "es:2", translatedText: "Otra cadena" },
];

export const defaultTranslationPayload = {
  repoPath: "/repo",
  projectName: "Test",
  filePath: "/repo/localizar.csv",
  targetLanguages: [{ code: "es", name: "Spanish" }],
  contexts: [],
  glossaries: [],
  providerOptions: {
    mode: "openai" as const,
    openaiModel: "gpt-4",
    geminiModel: "gemini-1.5",
  },
};
