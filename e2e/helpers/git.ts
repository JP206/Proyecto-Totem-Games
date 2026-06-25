/**
 * Minimal git helper for E2E tests that need a real local clone of the test repo
 * (e.g. Contexts/Glossaries CRUD, which commits + pushes). Only used by opt-in
 * destructive tests; never by the default suite.
 */
import { execFileSync } from "child_process";
import * as path from "path";
import { makeTempDir } from "./fixtures";
import { getConfig } from "./env";

/** Clones `owner/name` (with the token embedded) into a fresh temp dir. */
export function cloneTestRepo(owner: string, name: string): string {
  const { githubToken } = getConfig();
  const dir = path.join(makeTempDir("totem-clone-"), name);
  const url = `https://${githubToken}@github.com/${owner}/${name}.git`;
  execFileSync("git", ["clone", "--depth", "1", url, dir], {
    stdio: "ignore",
  });
  return dir;
}
