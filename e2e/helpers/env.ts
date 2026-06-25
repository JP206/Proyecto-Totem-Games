/**
 * Loads per-developer E2E configuration from `.env.e2e` (gitignored) and exposes
 * it as a typed object. Nothing here is committed; each developer fills in their
 * own `.env.e2e` (see `.env.e2e.example`).
 */
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

export const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENV_FILE = path.join(REPO_ROOT, ".env.e2e");

let loaded = false;
function ensureLoaded(): void {
  if (loaded) return;
  if (fs.existsSync(ENV_FILE)) {
    dotenv.config({ path: ENV_FILE });
  }
  loaded = true;
}

function parseRepo(value: string | undefined): { owner: string; name: string } | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\.git$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[parts.length - 2], name: parts[parts.length - 1] };
}

export interface E2EConfig {
  githubToken: string;
  githubLogin: string;
  testRepo: { owner: string; name: string } | null;
  sandboxRepo: { owner: string; name: string } | null;
  openaiKey: string;
  geminiKey: string;
  allowDestructive: boolean;
  /** True when the real OpenAI/Gemini APIs should be used instead of the mock. */
  realAi: boolean;
  /** Org used for role checks / projects (hardcoded in the app). */
  org: string;
}

export function getConfig(): E2EConfig {
  ensureLoaded();
  const realAi =
    process.env.E2E_REAL_AI === "1" || process.env.E2E_REAL_AI === "true";
  return {
    githubToken: (process.env.E2E_GITHUB_TOKEN || "").trim(),
    githubLogin: (process.env.E2E_GITHUB_LOGIN || "").trim(),
    testRepo: parseRepo(process.env.E2E_TEST_REPO),
    sandboxRepo: parseRepo(process.env.E2E_SANDBOX_REPO),
    openaiKey: (process.env.E2E_OPENAI_API_KEY || "").trim(),
    geminiKey: (process.env.E2E_GEMINI_API_KEY || "").trim(),
    allowDestructive:
      process.env.E2E_ALLOW_DESTRUCTIVE === "1" ||
      process.env.E2E_ALLOW_DESTRUCTIVE === "true",
    realAi,
    org: "Proyecto-Final-de-Grado",
  };
}

/** True when AI calls should be mocked (the default unless real AI was requested). */
export function isMockAi(): boolean {
  return !getConfig().realAi;
}

/**
 * Human-readable reason explaining why a real-GitHub test is being skipped, or
 * null when the prerequisites are satisfied. Use in `test.skip(...)` guards.
 */
export function missingGithubReason(): string | null {
  const cfg = getConfig();
  if (!cfg.githubToken) {
    return "E2E_GITHUB_TOKEN not set in .env.e2e (copy .env.e2e.example)";
  }
  return null;
}

export function missingTestRepoReason(): string | null {
  const ghReason = missingGithubReason();
  if (ghReason) return ghReason;
  if (!getConfig().testRepo) {
    return "E2E_TEST_REPO (owner/name) not set in .env.e2e";
  }
  return null;
}

export function missingRealAiKeysReason(): string | null {
  const cfg = getConfig();
  if (!cfg.realAi) return null;
  if (cfg.openaiKey || cfg.geminiKey) return null;
  return "E2E_REAL_AI=1 but no E2E_OPENAI_API_KEY / E2E_GEMINI_API_KEY set";
}
