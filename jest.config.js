module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  collectCoverageFrom: [
    "src/main/preload.ts",
    "src/main/ai/**/*.ts",
    "src/renderer/src/utils/csv.ts",
    "src/renderer/src/utils/desktop.ts",
    "!**/__tests__/**",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
  moduleNameMapper: {},
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: { module: "commonjs", esModuleInterop: true } },
    ],
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/src/renderer/build/",
    "/fixtures/",
  ],
};
