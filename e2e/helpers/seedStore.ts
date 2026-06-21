/**
 * Seeds an isolated electron-store `config.json` inside a temp user-data-dir.
 *
 * The app uses `new Store()` with no options, so electron-store writes a plain
 * JSON file at `<userData>/config.json` with the keys at the top level. Writing
 * that file before launch lets us bypass the login screen and preselect a project.
 */
import * as fs from "fs";
import * as path from "path";

export interface CurrentProject {
  repoPath: string;
  repoName: string;
  repoOwner: string;
}

export interface SeedConfig {
  github_token?: string;
  github_user?: Record<string, unknown>;
  current_project?: CurrentProject;
  selected_folder?: string;
  [key: string]: unknown;
}

export function writeStoreConfig(userDataDir: string, config: SeedConfig): string {
  fs.mkdirSync(userDataDir, { recursive: true });
  const configPath = path.join(userDataDir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  return configPath;
}

/** Convenience: a minimal logged-in session object for `github_user`. */
export function githubUser(login: string, extra: Record<string, unknown> = {}) {
  return {
    login,
    name: login,
    avatar_url: `https://avatars.githubusercontent.com/${login}`,
    ...extra,
  };
}
