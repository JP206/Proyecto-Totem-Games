import fs from "fs/promises";
import os from "os";
import path from "path";
import { loadAiMetrics } from "../loadMetrics";
import { GAME_METRICS_DIR, GAME_METRICS_FILE } from "../saveMetrics";

describe("loadAiMetrics", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "metrics-load-"));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  async function createGameRepo(
    name: string,
    translations: unknown[],
  ): Promise<string> {
    const repoPath = path.join(tempDir, name);
    const gitPath = path.join(repoPath, ".git");
    const metricsPath = path.join(repoPath, GAME_METRICS_DIR, GAME_METRICS_FILE);
    await fs.mkdir(gitPath, { recursive: true });
    await fs.mkdir(path.dirname(metricsPath), { recursive: true });
    await fs.writeFile(
      metricsPath,
      JSON.stringify({ gameName: name, translations }, null, 2),
      "utf8",
    );
    return repoPath;
  }

  it("loads metrics from each game repo and skips the general repo", async () => {
    await createGameRepo("juego-a", [
      {
        id: "2026-06-07T08-00-00_juego-a",
        date: "2026-06-07",
        file: "main.csv",
        provider: "gemini",
        model: "gemini-2.5-flash",
        spellcheck: false,
        totalTexts: 10,
        tokens: { translation: 100, total: 100 },
        languages: [{ lang: "shared", confidence: 80 }],
      },
    ]);
    await createGameRepo("juego-b", [
      {
        id: "2026-06-06T08-00-00_juego-b",
        date: "2026-06-06",
        file: "ui.csv",
        provider: "openai",
        model: "gpt-4",
        spellcheck: false,
        totalTexts: 5,
        tokens: { translation: 50, total: 50 },
        languages: [{ lang: "shared", confidence: 70 }],
      },
    ]);

    const generalRepoPath = path.join(tempDir, "repo-general-totem-games");
    await fs.mkdir(path.join(generalRepoPath, ".git"), { recursive: true });
    await fs.mkdir(path.join(generalRepoPath, "metricas"), { recursive: true });
    await fs.writeFile(
      path.join(generalRepoPath, "metricas", "legacy-metrics.json"),
      JSON.stringify({
        gameName: "legacy",
        translations: [
          {
            id: "legacy-should-not-load",
            date: "2026-01-01",
            file: "legacy.csv",
            provider: "openai",
            model: "gpt-4",
            spellcheck: false,
            totalTexts: 1,
            tokens: { translation: 1, total: 1 },
            languages: [{ lang: "shared", confidence: 1 }],
          },
        ],
      }),
      "utf8",
    );

    const result = await loadAiMetrics(tempDir);

    expect(result.records).toHaveLength(2);
    expect(result.projects).toEqual(["juego-a", "juego-b"]);
    expect(result.records.map((record) => record.project)).toEqual([
      "juego-a",
      "juego-b",
    ]);
    expect(result.sources).toHaveLength(2);
    expect(result.records.some((record) => record.id === "legacy-should-not-load")).toBe(
      false,
    );
  });
});
