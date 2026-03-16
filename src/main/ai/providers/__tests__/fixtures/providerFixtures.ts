export const mockTranslationItems = [
  { id: "1", key: "key1", sourceText: "Hello" },
  { id: "2", key: "key2", sourceText: "World" },
];

export const mockTranslationResponse = [
  { id: "1", translatedText: "Hola" },
  { id: "2", translatedText: "Mundo" },
];

export const mockTranslationAPIResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify(mockTranslationResponse),
      },
    },
  ],
};

export const mockSpellCheckResponse = [
  { id: "spell:1", translatedText: "Corrected text" },
];

export const mockSpellCheckAPIResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify(mockSpellCheckResponse),
      },
    },
  ],
};
