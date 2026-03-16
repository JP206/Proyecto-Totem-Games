/**
 * Persist and read daily token usage per project (repo path).
 * Used to show "Tokens utilizados hoy" on Landing.
 */

const STORAGE_KEY_PREFIX = "totem-ai-tokens";

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${STORAGE_KEY_PREFIX}-${y}-${m}-${d}`;
}

function getStored(): Record<string, number> {
  try {
    const raw = localStorage.getItem(getTodayKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function setStored(data: Record<string, number>): void {
  try {
    localStorage.setItem(getTodayKey(), JSON.stringify(data));
  } catch {
    // ignore
  }
}

/**
 * Add tokens used for a project today. Call after a translation or spell-check run.
 */
export function addTokensToday(repoPath: string, tokens: number): void {
  if (!repoPath || tokens <= 0) return;
  const data = getStored();
  data[repoPath] = (data[repoPath] ?? 0) + tokens;
  setStored(data);
}

/**
 * Get total tokens used today for the given project.
 */
export function getTokensToday(repoPath: string): number {
  if (!repoPath) return 0;
  return getStored()[repoPath] ?? 0;
}
