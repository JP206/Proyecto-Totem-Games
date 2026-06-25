/* eslint-disable no-console */
/**
 * Translation load / soak harness (pipeline level).
 *
 * Calls `translateFileInMain` directly (no Electron, no UI) across a set of
 * scenarios and records throughput / memory numbers to `test-reports/`:
 *   - test-reports/load-results.json
 *   - test-reports/load-results.csv
 *
 * AI is mocked by default (deterministic, offline). With E2E_REAL_AI=1 and keys
 * in `.env.e2e` it benchmarks the real OpenAI/Gemini APIs (opt-in; do not run in
 * CI). Run via: `npm run test:load` (mock) or `npm run test:load:real`.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";

const REPO_ROOT = path.resolve(__dirname, "..");

// Load .env.e2e (for real-AI keys / flags) before deciding the mode.
const ENV_FILE = path.join(REPO_ROOT, ".env.e2e");
if (fs.existsSync(ENV_FILE)) dotenv.config({ path: ENV_FILE });

const REAL_AI =
  process.env.E2E_REAL_AI === "1" || process.env.E2E_REAL_AI === "true";

if (!REAL_AI) {
  // Activate the deterministic mock provider seam.
  process.env.E2E_MOCK_AI = "1";
} else {
  // Provide real keys to the pipeline via the same global the app uses.
  const openaiKey = (process.env.E2E_OPENAI_API_KEY || "").trim();
  const geminiKey = (process.env.E2E_GEMINI_API_KEY || "").trim();
  (global as any).__aiPersonalConfig = {
    ...(openaiKey ? { openai: { apiKey: openaiKey, defaultModel: "gpt-4o-mini" } } : {}),
    ...(geminiKey ? { gemini: { apiKey: geminiKey, defaultModel: "gemini-1.5-flash" } } : {}),
  };
}

// Imported after env is set so the mock seam is active for mock runs.
import {
  translateFileInMain,
  TranslateFilePayload,
  TargetLanguage,
} from "../src/main/ai/translation";

const MAX_ROWS_PER_BATCH = 40;

const ALL_LANGS: TargetLanguage[] = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
];

interface ScenarioResult {
  scenario: string;
  size: number;
  languages: number;
  confidence: boolean;
  durationMs: number;
  msPerRow: number;
  batches: number;
  tokens: number;
  peakHeapMB: number;
  translatedRows: number;
  error?: string;
}

function tmpCsv(rows: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "totem-soak-"));
  const file = path.join(dir, "soak.csv");
  const lines = ["Clave,Origen"];
  for (let i = 1; i <= rows; i++) lines.push(`${i},Sample source text number ${i}`);
  fs.writeFileSync(file, lines.join("\n"), "utf8");
  return file;
}

function expectedBatches(rows: number, languages: number, confidence: boolean): number {
  const forward = Math.ceil(rows / MAX_ROWS_PER_BATCH) * languages;
  return confidence ? forward * 2 : forward;
}

async function runScenario(opts: {
  scenario: string;
  rows: number;
  languages: number;
  confidence?: boolean;
}): Promise<ScenarioResult> {
  const { scenario, rows, languages } = opts;
  const confidence = !!opts.confidence;
  const filePath = tmpCsv(rows);

  const payload: TranslateFilePayload = {
    repoPath: path.dirname(filePath),
    projectName: "soak",
    filePath,
    sourceLanguageName: "English",
    targetLanguages: ALL_LANGS.slice(0, languages),
    contexts: [],
    glossaries: [],
    providerOptions: {
      mode: REAL_AI && process.env.E2E_OPENAI_API_KEY ? "openai" : "gemini",
      openaiModel: "gpt-4o-mini",
      geminiModel: "gemini-1.5-flash",
    },
    confidenceTextSimilarity: confidence,
    confidenceEmbeddingSimilarity: false,
  };

  let peakHeap = process.memoryUsage().heapUsed;
  const sampler = setInterval(() => {
    const h = process.memoryUsage().heapUsed;
    if (h > peakHeap) peakHeap = h;
  }, 50);

  const start = Date.now();
  let tokens = 0;
  let translatedRows = 0;
  let error: string | undefined;
  try {
    const result = await translateFileInMain(payload);
    tokens = result.stats.tokensUsed ?? 0;
    translatedRows = result.stats.translatedRows ?? 0;
  } catch (e: any) {
    error = e?.message || String(e);
  } finally {
    clearInterval(sampler);
  }
  const durationMs = Date.now() - start;

  return {
    scenario,
    size: rows,
    languages,
    confidence,
    durationMs,
    msPerRow: rows ? +(durationMs / rows).toFixed(3) : 0,
    batches: expectedBatches(rows, languages, confidence),
    tokens,
    peakHeapMB: +(peakHeap / 1024 / 1024).toFixed(1),
    translatedRows,
    error,
  };
}

async function main(): Promise<void> {
  const results: ScenarioResult[] = [];

  console.log(`Translation soak harness (AI mode: ${REAL_AI ? "REAL" : "MOCK"})`);

  // 1) Throughput by size
  for (const rows of [100, 500, 2000, REAL_AI ? 200 : 5000]) {
    results.push(await runScenario({ scenario: "throughput-by-size", rows, languages: 1 }));
  }

  // 2) Multi-language scaling
  for (const languages of [1, 3, 5]) {
    results.push(
      await runScenario({ scenario: "multi-language", rows: REAL_AI ? 50 : 500, languages }),
    );
  }

  // 3) Confidence / back-translation on (doubles batches)
  results.push(
    await runScenario({
      scenario: "confidence-on",
      rows: REAL_AI ? 50 : 200,
      languages: 1,
      confidence: true,
    }),
  );

  // 4) Batch-boundary cases
  if (!REAL_AI) {
    for (const rows of [39, 40, 41, 80, 81]) {
      results.push(await runScenario({ scenario: "batch-boundary", rows, languages: 1 }));
    }
  }

  // 5) Memory / large file (mock only to keep it bounded)
  if (!REAL_AI) {
    results.push(await runScenario({ scenario: "memory-large", rows: 8000, languages: 1 }));
  }

  // 6) Resilience: inject latency + intermittent failures (mock only)
  if (!REAL_AI) {
    (global as any).__e2eMockLatencyMs = 2;
    (global as any).__e2eMockFailRate = 0; // keep deterministic; flip to >0 to stress retries
    results.push(await runScenario({ scenario: "resilience-latency", rows: 500, languages: 1 }));
    (global as any).__e2eMockLatencyMs = 0;
  }

  // Write reports
  const reportsDir = path.join(REPO_ROOT, "test-reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const meta = {
    generatedAt: new Date().toISOString(),
    aiMode: REAL_AI ? "real" : "mock",
    maxRowsPerBatch: MAX_ROWS_PER_BATCH,
  };
  fs.writeFileSync(
    path.join(reportsDir, "load-results.json"),
    JSON.stringify({ meta, results }, null, 2),
    "utf8",
  );

  const header = [
    "scenario",
    "size",
    "languages",
    "confidence",
    "durationMs",
    "msPerRow",
    "batches",
    "tokens",
    "peakHeapMB",
    "translatedRows",
    "error",
  ];
  const csv = [header.join(",")]
    .concat(
      results.map((r) =>
        [
          r.scenario,
          r.size,
          r.languages,
          r.confidence,
          r.durationMs,
          r.msPerRow,
          r.batches,
          r.tokens,
          r.peakHeapMB,
          r.translatedRows,
          r.error ? `"${r.error.replace(/"/g, "'")}"` : "",
        ].join(","),
      ),
    )
    .join("\n");
  fs.writeFileSync(path.join(reportsDir, "load-results.csv"), csv, "utf8");

  console.table(
    results.map((r) => ({
      scenario: r.scenario,
      size: r.size,
      langs: r.languages,
      conf: r.confidence,
      ms: r.durationMs,
      msPerRow: r.msPerRow,
      batches: r.batches,
      tokens: r.tokens,
      heapMB: r.peakHeapMB,
    })),
  );
  console.log(`\nReports written to ${reportsDir}`);

  if (results.some((r) => r.error)) {
    console.error("Some scenarios errored (see report).");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
