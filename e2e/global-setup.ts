/**
 * Playwright global setup.
 *
 * - Loads `.env.e2e` (via the env helper) and prints a clear summary of which
 *   suites can run vs. which will self-skip due to missing credentials.
 * - Ensures the report directory exists.
 * - When E2E_REQUIRE_GITHUB=1, fails fast if no token is configured (use this in
 *   CI jobs that are supposed to exercise the real-GitHub suites). By default it
 *   only warns, so the offline mock suites (translation, guards) still run.
 */
import * as fs from "fs";
import * as path from "path";
import {
  getConfig,
  REPO_ROOT,
  missingGithubReason,
  missingTestRepoReason,
  missingRealAiKeysReason,
} from "./helpers/env";

async function globalSetup(): Promise<void> {
  const cfg = getConfig();

  const reportsDir = path.join(REPO_ROOT, "test-reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const distMain = path.join(REPO_ROOT, "dist", "main", "index.js");
  const rendererIndex = path.join(
    REPO_ROOT,
    "src",
    "renderer",
    "build",
    "index.html",
  );
  if (!fs.existsSync(distMain) || !fs.existsSync(rendererIndex)) {
    throw new Error(
      "Build output missing. Run `npm run build:e2e` before the E2E suite " +
        "(the `pretest:e2e` script does this automatically).",
    );
  }

  const lines: string[] = [];
  lines.push("──────────────────────────────────────────────");
  lines.push(" Totem Games E2E setup");
  lines.push(`  AI mode:            ${cfg.realAi ? "REAL (network)" : "MOCKED (offline)"}`);
  lines.push(`  GitHub token:       ${cfg.githubToken ? "present" : "MISSING"}`);
  lines.push(`  Test repo:          ${cfg.testRepo ? `${cfg.testRepo.owner}/${cfg.testRepo.name}` : "not set"}`);
  lines.push(`  Sandbox repo:       ${cfg.sandboxRepo ? `${cfg.sandboxRepo.owner}/${cfg.sandboxRepo.name}` : "not set (upload push will be skipped)"}`);
  lines.push(`  Destructive ops:    ${cfg.allowDestructive ? "ALLOWED" : "disabled"}`);

  const skips: string[] = [];
  if (missingGithubReason()) skips.push(`  - Auth/Dashboard real checks, Metrics, Notes, Issues, Contexts, Projects: ${missingGithubReason()}`);
  else if (missingTestRepoReason()) skips.push(`  - Notes/Issues/Contexts: ${missingTestRepoReason()}`);
  if (missingRealAiKeysReason()) skips.push(`  - Real-AI translation: ${missingRealAiKeysReason()}`);
  if (skips.length) {
    lines.push("  Will SKIP (missing prerequisites):");
    lines.push(...skips);
  } else {
    lines.push("  All prerequisites satisfied.");
  }
  lines.push("──────────────────────────────────────────────");
  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));

  const requireGithub =
    process.env.E2E_REQUIRE_GITHUB === "1" ||
    process.env.E2E_REQUIRE_GITHUB === "true";
  if (requireGithub && missingGithubReason()) {
    throw new Error(
      `E2E_REQUIRE_GITHUB is set but ${missingGithubReason()}. ` +
        "Copy .env.e2e.example to .env.e2e and add your token.",
    );
  }
}

export default globalSetup;
