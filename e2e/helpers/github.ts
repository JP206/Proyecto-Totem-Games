/**
 * Thin GitHub REST helpers used by E2E specs for setup, role detection and
 * teardown (closing issues / removing files) so real-GitHub runs are repeatable.
 * The application itself talks to GitHub the same way; this is only for the
 * tests' own bookkeeping.
 */
import { getConfig } from "./env";

const API = "https://api.github.com";

function headers(): Record<string, string> {
  const { githubToken } = getConfig();
  return {
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function gh<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as any) },
  });
  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

export interface GithubUser {
  login: string;
  name?: string;
  avatar_url?: string;
  id?: number;
}

export async function getAuthenticatedUser(): Promise<GithubUser | null> {
  const { status, data } = await gh<GithubUser>("/user");
  return status === 200 ? data : null;
}

/**
 * Mirrors the app's `verify-user-role`: org membership role `admin` -> administrador.
 */
export async function getOrgRole(
  org: string,
  username: string,
): Promise<"administrador" | "desarrollador" | "sin-acceso"> {
  const { status, data } = await gh<{ role?: string }>(
    `/orgs/${org}/memberships/${username}`,
  );
  if (status !== 200 || !data) return "sin-acceso";
  return data.role === "admin" ? "administrador" : "desarrollador";
}

export interface GithubIssue {
  number: number;
  title: string;
  body?: string;
  state: string;
  labels: { name: string }[];
  pull_request?: unknown;
}

export async function listIssues(
  owner: string,
  name: string,
  params: { labels?: string; state?: string } = {},
): Promise<GithubIssue[]> {
  const qs = new URLSearchParams({
    state: params.state || "all",
    per_page: "100",
    ...(params.labels ? { labels: params.labels } : {}),
  });
  const { data } = await gh<GithubIssue[]>(
    `/repos/${owner}/${name}/issues?${qs.toString()}`,
  );
  return (Array.isArray(data) ? data : []).filter((i) => !i.pull_request);
}

export async function closeIssue(
  owner: string,
  name: string,
  number: number,
): Promise<void> {
  await gh(`/repos/${owner}/${name}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
}

/** Close every open issue carrying the given label (test teardown helper). */
export async function closeOpenIssuesByLabel(
  owner: string,
  name: string,
  label: string,
): Promise<number> {
  const open = await listIssues(owner, name, { labels: label, state: "open" });
  for (const issue of open) {
    await closeIssue(owner, name, issue.number);
  }
  return open.length;
}

/**
 * Close every open issue whose title starts with `prefix` (used to clean up only
 * the artifacts a test run created, leaving any pre-existing repo issues intact).
 */
export async function closeOpenIssuesByTitlePrefix(
  owner: string,
  name: string,
  prefix: string,
): Promise<number> {
  const open = await listIssues(owner, name, { state: "open" });
  let closed = 0;
  for (const issue of open) {
    if (issue.title.startsWith(prefix)) {
      await closeIssue(owner, name, issue.number);
      closed++;
    }
  }
  return closed;
}

/** Delete a file from the default branch if it exists (test teardown helper). */
export async function deleteFileIfExists(
  owner: string,
  name: string,
  filePath: string,
  message = "e2e teardown: remove test artifact",
): Promise<boolean> {
  const { status, data } = await gh<{ sha: string }>(
    `/repos/${owner}/${name}/contents/${encodeURIComponent(filePath)}`,
  );
  if (status !== 200 || !data?.sha) return false;
  const res = await gh(`/repos/${owner}/${name}/contents/${encodeURIComponent(filePath)}`, {
    method: "DELETE",
    body: JSON.stringify({ message, sha: data.sha }),
  });
  return res.status >= 200 && res.status < 300;
}

export async function repoExists(owner: string, name: string): Promise<boolean> {
  const { status } = await gh(`/repos/${owner}/${name}`);
  return status === 200;
}

export async function deleteRepo(owner: string, name: string): Promise<boolean> {
  const { status } = await gh(`/repos/${owner}/${name}`, { method: "DELETE" });
  return status === 204;
}
