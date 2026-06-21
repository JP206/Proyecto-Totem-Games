/* eslint-disable no-console */
/**
 * Rolls the Playwright E2E JSON report + the load-harness JSON into a single,
 * documentation-ready `test-reports/SUMMARY.md` (plus keeps the raw JSON/CSV as
 * evidence). Safe to run after either or both test runs.
 *
 *   npm run test:report
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const REPO_ROOT = path.resolve(__dirname, "..");
const REPORTS = path.join(REPO_ROOT, "test-reports");
const E2E_JSON = path.join(REPORTS, "e2e-results.json");
const LOAD_JSON = path.join(REPORTS, "load-results.json");
const SUMMARY = path.join(REPORTS, "SUMMARY.md");

interface SpecEntry {
  group: string;
  title: string;
  status: string;
  durationMs: number;
  errors: string[];
  attachments: string[];
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function gitCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: REPO_ROOT }).toString().trim();
  } catch {
    return "unknown";
  }
}

/** Group name derived from the spec file (auth/translation/metrics/...). */
function groupFromFile(file: string | undefined): string {
  if (!file) return "other";
  const base = path.basename(file).replace(/\.spec\.ts$/, "");
  return base;
}

function walkSuite(suite: any, out: SpecEntry[], fileHint?: string): void {
  const file = suite.file || fileHint;
  for (const spec of suite.specs || []) {
    const tests = spec.tests || [];
    let status = "skipped";
    let durationMs = 0;
    const errors: string[] = [];
    const attachments: string[] = [];
    for (const t of tests) {
      for (const r of t.results || []) {
        durationMs += r.duration || 0;
        if (r.status && r.status !== "skipped") status = r.status;
        for (const e of r.errors || []) {
          if (e.message) errors.push(String(e.message).split("\n")[0]);
        }
        for (const a of r.attachments || []) {
          if (a.path) attachments.push(a.path);
        }
      }
      if (t.status === "skipped" && status === "skipped") status = "skipped";
    }
    out.push({
      group: groupFromFile(spec.file || file),
      title: spec.title,
      status,
      durationMs,
      errors,
      attachments,
    });
  }
  for (const child of suite.suites || []) walkSuite(child, out, file);
}

function collectE2E(): SpecEntry[] {
  const data = readJson<any>(E2E_JSON);
  if (!data) return [];
  const out: SpecEntry[] = [];
  for (const suite of data.suites || []) walkSuite(suite, out);
  return out;
}

function pct(n: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function buildE2ESection(entries: SpecEntry[]): string {
  if (!entries.length) {
    return "_No E2E results found (run `npm run test:e2e`)._\n";
  }
  const groups = new Map<
    string,
    { passed: number; failed: number; skipped: number; durationMs: number }
  >();
  for (const e of entries) {
    const g = groups.get(e.group) || {
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
    };
    if (e.status === "passed" || e.status === "expected") g.passed++;
    else if (e.status === "skipped") g.skipped++;
    else g.failed++;
    g.durationMs += e.durationMs;
    groups.set(e.group, g);
  }

  const lines: string[] = [];
  lines.push("| Spec group | Passed | Failed | Skipped | Total | Duration |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  let tp = 0,
    tf = 0,
    ts = 0,
    td = 0;
  for (const [group, g] of [...groups.entries()].sort()) {
    const total = g.passed + g.failed + g.skipped;
    tp += g.passed;
    tf += g.failed;
    ts += g.skipped;
    td += g.durationMs;
    lines.push(
      `| ${group} | ${g.passed} | ${g.failed} | ${g.skipped} | ${total} | ${(g.durationMs / 1000).toFixed(1)}s |`,
    );
  }
  const totalAll = tp + tf + ts;
  lines.push(
    `| **Total** | **${tp}** | **${tf}** | **${ts}** | **${totalAll}** | **${(td / 1000).toFixed(1)}s** |`,
  );
  lines.push("");
  lines.push(`Pass rate (excluding skipped): **${pct(tp, tp + tf)}**`);
  lines.push("");

  const failures = entries.filter(
    (e) => e.status !== "passed" && e.status !== "skipped" && e.status !== "expected",
  );
  if (failures.length) {
    lines.push("### Failures");
    lines.push("");
    for (const f of failures) {
      lines.push(`- **[${f.group}] ${f.title}**`);
      if (f.errors.length) lines.push(`  - error: ${f.errors[0]}`);
      for (const a of f.attachments) {
        lines.push(`  - evidence: \`${path.relative(REPO_ROOT, a)}\``);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildLoadSection(): string {
  const data = readJson<any>(LOAD_JSON);
  if (!data || !Array.isArray(data.results)) {
    return "_No load results found (run `npm run test:load`)._\n";
  }
  const lines: string[] = [];
  lines.push(
    `AI mode: **${data.meta?.aiMode ?? "?"}**, maxRowsPerBatch: ${data.meta?.maxRowsPerBatch ?? "?"}`,
  );
  lines.push("");
  lines.push(
    "| Scenario | Rows | Langs | Conf | Duration (ms) | ms/row | Batches | Tokens | Peak heap (MB) |",
  );
  lines.push("|---|---:|---:|:--:|---:|---:|---:|---:|---:|");
  for (const r of data.results) {
    lines.push(
      `| ${r.scenario} | ${r.size} | ${r.languages} | ${r.confidence ? "yes" : "no"} | ${r.durationMs} | ${r.msPerRow} | ${r.batches} | ${r.tokens} | ${r.peakHeapMB} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function main(): void {
  fs.mkdirSync(REPORTS, { recursive: true });
  const e2e = collectE2E();
  const e2eData = readJson<any>(E2E_JSON);

  const out: string[] = [];
  out.push("# Totem Games - Test Summary");
  out.push("");
  out.push(`- Generated: ${new Date().toISOString()}`);
  out.push(`- Commit: \`${gitCommit()}\``);
  if (e2eData?.stats) {
    out.push(
      `- E2E started: ${e2eData.stats.startTime ?? "?"} (duration ${(
        (e2eData.stats.duration ?? 0) / 1000
      ).toFixed(1)}s)`,
    );
  }
  out.push("");
  out.push("## E2E results");
  out.push("");
  out.push(buildE2ESection(e2e));
  out.push("## Translation load / throughput");
  out.push("");
  out.push(buildLoadSection());
  out.push("---");
  out.push("");
  out.push(
    "_Raw evidence: `test-reports/e2e-results.json`, `test-reports/e2e-junit.xml`, " +
      "`test-reports/load-results.json`, `test-reports/load-results.csv`, and the " +
      "interactive Playwright report under `test-reports/playwright-html/`._",
  );
  out.push("");

  fs.writeFileSync(SUMMARY, out.join("\n"), "utf8");
  console.log(`Wrote ${path.relative(REPO_ROOT, SUMMARY)}`);
}

main();
