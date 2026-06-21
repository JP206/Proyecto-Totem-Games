import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import Store from "electron-store";

const execAsync = promisify(exec);
const store = new Store();

const NETWORK_GIT_COMMAND = /\bgit\s+(fetch|pull|push|clone|ls-remote)\b/i;

function wrapGitCommandWithAuth(
  command: string,
  token: string | undefined,
): { command: string; env: NodeJS.ProcessEnv } {
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (!token || !NETWORK_GIT_COMMAND.test(command)) {
    return { command, env };
  }

  env.GIT_TERMINAL_PROMPT = "0";
  env.GCM_INTERACTIVE = "Never";

  const basicAuth = Buffer.from(`x-access-token:${token}`).toString("base64");
  const subcommand = command.replace(/^git\s+/i, "");
  const wrappedCommand = `git -c credential.helper= -c "http.extraHeader=Authorization: Basic ${basicAuth}" ${subcommand}`;

  return { command: wrappedCommand, env };
}

function getStoredGithubToken(): string | undefined {
  const raw = store.get("github_token");
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export async function pushRepoFile(
  repoPath: string,
  absoluteFilePath: string,
  commitMessage: string,
): Promise<{ success: boolean; error?: string; commitCreated?: boolean }> {
  const relativePath = path
    .relative(repoPath, absoluteFilePath)
    .split(path.sep)
    .join("/");
  const token = getStoredGithubToken();

  const runGit = async (command: string) => {
    const wrapped = wrapGitCommandWithAuth(command, token);
    const { stdout, stderr } = await execAsync(wrapped.command, {
      cwd: repoPath,
      env: wrapped.env,
      timeout: 60000,
    });
    return { stdout, stderr };
  };

  try {
    await runGit(`git add "${relativePath}"`);

    let commitCreated = true;
    try {
      const { stderr } = await runGit(
        `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
      );
      if (stderr && stderr.includes("nothing to commit")) {
        commitCreated = false;
      }
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err);
      if (msg.includes("nothing to commit")) {
        commitCreated = false;
      } else {
        throw err;
      }
    }

    await runGit("git push origin main");
    return { success: true, commitCreated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
