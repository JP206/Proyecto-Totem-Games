export const CSV_SOURCE =
  "Clave,Origen\n1,Helo world\n2,Teh quick brown\n3,No errors here";
export const CSV_SINGLE_ROW = "Clave,Origen\n1,Only one row";
export const CSV_HEADER_ONLY = "Clave,Origen";

export const mockSpellResults = [
  { id: "spell:1", translatedText: "Hello world" },
  { id: "spell:2", translatedText: "The quick brown" },
  { id: "spell:3", translatedText: "No errors here" },
];

export const defaultSpellCheckPayload = {
  filePath: "/repo/localizar.csv",
  language: "Español",
  maxRows: 200,
  applyToFile: false,
  providerOptions: {
    mode: "openai" as const,
    openaiModel: "gpt-4",
    geminiModel: "gemini-1.5",
  },
};
