/**
 * Builders for on-disk test fixtures: localization CSV/XLSX files, fake "game"
 * repos with `Localizacion/metricas_ia.json`, and local project repos used as
 * `current_project`. All fixtures are created under the OS temp dir and removed
 * by the caller's teardown.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as XLSX from "xlsx";

const GENERAL_REPO = "repo-general-totem-games";

export function makeTempDir(prefix = "totem-e2e-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function rmDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup */
  }
}

/** Header is `Clave,Origen`; one data row per item. */
export function localizeCsv(rowCount: number, prefix = "Texto"): string {
  const lines = ["Clave,Origen"];
  for (let i = 1; i <= rowCount; i++) {
    lines.push(`${i},${prefix} ${i}`);
  }
  return lines.join("\n");
}

/** Marks a directory as a git repo just enough for the metrics scanner (`.git` exists). */
function markAsGitRepo(repoDir: string): void {
  const gitDir = path.join(repoDir, ".git");
  fs.mkdirSync(gitDir, { recursive: true });
  fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n", "utf8");
}

export interface MetricLanguage {
  lang: string;
  confidence?: number;
  lexical?: number;
  meaning?: number;
  count?: number;
}

export interface MetricRecord {
  id: string;
  date: string;
  file: string;
  provider: string;
  model: string;
  spellcheck: boolean;
  totalTexts: number;
  tokens: { translation?: number; spellcheck?: number; total: number };
  languages: MetricLanguage[];
  similarity?: { lexical?: boolean; embeddings?: boolean };
  correctionRate?: number;
  project?: string;
}

export function metricRecord(partial: Partial<MetricRecord> & { id: string }): MetricRecord {
  return {
    date: "2026-06-07",
    file: "main.csv",
    provider: "gemini",
    model: "gemini-2.5-flash",
    spellcheck: false,
    totalTexts: 10,
    tokens: { translation: 100, total: 100 },
    languages: [
      { lang: "shared", confidence: 80, lexical: 75, meaning: 90, count: 10 },
      { lang: "en_us", confidence: 84, lexical: 75, meaning: 93, count: 10 },
    ],
    similarity: { lexical: true, embeddings: true },
    ...partial,
  };
}

/**
 * Creates a temp `selected_folder` containing several fake game repos, each with
 * `Localizacion/metricas_ia.json`, plus the excluded general repo. Returns the
 * root path so it can be seeded as `selected_folder`.
 */
export function writeMetricsRoot(
  games: { name: string; records: MetricRecord[] }[],
  opts: { includeGeneralRepo?: boolean } = {},
): { root: string; games: string[] } {
  const root = makeTempDir("totem-metrics-");
  for (const game of games) {
    const repoDir = path.join(root, game.name);
    markAsGitRepo(repoDir);
    const locDir = path.join(repoDir, "Localizacion");
    fs.mkdirSync(locDir, { recursive: true });
    fs.writeFileSync(
      path.join(locDir, "metricas_ia.json"),
      JSON.stringify({ gameName: game.name, translations: game.records }, null, 2),
      "utf8",
    );
  }
  if (opts.includeGeneralRepo) {
    const generalDir = path.join(root, GENERAL_REPO);
    markAsGitRepo(generalDir);
    const locDir = path.join(generalDir, "Localizacion");
    fs.mkdirSync(locDir, { recursive: true });
    fs.writeFileSync(
      path.join(locDir, "metricas_ia.json"),
      JSON.stringify(
        {
          gameName: GENERAL_REPO,
          translations: [metricRecord({ id: "2026-06-01T00-00-00_general" })],
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  return { root, games: games.map((g) => g.name) };
}

/**
 * Creates a local project repo directory usable as `current_project.repoPath`,
 * with a `Localizacion/` folder and an optional localization CSV.
 *
 * A sibling `repo-general-totem-games` folder is created by default so the
 * Landing page's "ensure general repo" step finds it on disk and skips the
 * network `git clone` (the local git fetch/pull then fail fast and are ignored).
 */
export function writeProjectRepo(opts: {
  name: string;
  rows?: number;
  withLocalizeCsv?: boolean;
  withGeneralSibling?: boolean;
}): { repoPath: string; parentDir: string; localizeCsvPath: string | null } {
  const parentDir = makeTempDir("totem-project-");
  const repoPath = path.join(parentDir, opts.name);
  markAsGitRepo(repoPath);
  const locDir = path.join(repoPath, "Localizacion");
  fs.mkdirSync(locDir, { recursive: true });

  if (opts.withGeneralSibling !== false) {
    const generalDir = path.join(parentDir, GENERAL_REPO);
    markAsGitRepo(generalDir);
    fs.mkdirSync(path.join(generalDir, "contextos_generales"), { recursive: true });
    fs.mkdirSync(path.join(generalDir, "glosarios_generales"), { recursive: true });
  }

  let localizeCsvPath: string | null = null;
  if (opts.withLocalizeCsv) {
    localizeCsvPath = path.join(locDir, `${opts.name}_localizar.csv`);
    fs.writeFileSync(localizeCsvPath, localizeCsv(opts.rows ?? 5), "utf8");
  }
  return { repoPath, parentDir, localizeCsvPath };
}

/** Writes a standalone localization CSV fixture, returns its absolute path. */
export function writeLocalizeCsvFile(rowCount: number, name = "localizar.csv"): string {
  const dir = makeTempDir("totem-csv-");
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, localizeCsv(rowCount), "utf8");
  return filePath;
}

/** Writes a standalone localization XLSX fixture (header `Clave,Origen`). */
export function writeLocalizeXlsxFile(rowCount: number, name = "localizar.xlsx"): string {
  const dir = makeTempDir("totem-xlsx-");
  const filePath = path.join(dir, name);
  const aoa: (string | number)[][] = [["Clave", "Origen"]];
  for (let i = 1; i <= rowCount; i++) aoa.push([i, `Texto ${i}`]);
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Localizacion");
  XLSX.writeFile(wb, filePath);
  return filePath;
}
