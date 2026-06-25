/**
 * Launches the built Electron app against an isolated, temporary user-data-dir so
 * tests never touch the real `%APPDATA%\proyecto-totem-games-app\config.json`.
 *
 * Each launch can seed electron-store (bypassing login / preselecting a project),
 * toggles the env-gated mock AI seam, and starts a Playwright trace. On teardown
 * it attaches a screenshot + trace to the test report when the test failed.
 */
import { _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page, TestInfo } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getConfig, isMockAi, REPO_ROOT } from "./env";
import { writeStoreConfig, SeedConfig } from "./seedStore";

export interface LaunchOptions {
  /** electron-store keys to seed before launch (token, user, project, folder...). */
  seed?: SeedConfig;
  /** Force mock/real AI for this launch. Defaults to the global env decision. */
  mockAi?: boolean;
}

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
}

const activeDirs = new Set<string>();

/**
 * Returns the main renderer window (the `file://...index.html` page), ignoring
 * any DevTools window. Falls back to the first window if none matches in time.
 */
async function getAppWindow(app: ElectronApplication): Promise<Page> {
  const first = await app.firstWindow();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const main = app
      .windows()
      .find((w) => w.url().startsWith("file://"));
    if (main) return main;
    await new Promise((r) => setTimeout(r, 200));
  }
  return first;
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "totem-userdata-"));
  activeDirs.add(userDataDir);

  if (options.seed) {
    writeStoreConfig(userDataDir, options.seed);
  }

  const mock = options.mockAi ?? isMockAi();
  const cfg = getConfig();

  const app = await electron.launch({
    args: [REPO_ROOT, `--user-data-dir=${userDataDir}`],
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      E2E: "1",
      E2E_MOCK_AI: mock ? "1" : "0",
      // Real-AI runs still read keys from the store; these are surfaced for any
      // future env-based provider wiring and for the load harness parity.
      ...(cfg.realAi && cfg.openaiKey ? { OPENAI_API_KEY: cfg.openaiKey } : {}),
      ...(cfg.realAi && cfg.geminiKey ? { GEMINI_API_KEY: cfg.geminiKey } : {}),
    },
  });

  const page = await getAppWindow(app);
  await page.waitForLoadState("domcontentloaded");

  try {
    await app.context().tracing.start({ screenshots: true, snapshots: true, title: "e2e" });
  } catch {
    /* tracing is best-effort */
  }

  return { app, page, userDataDir };
}

/**
 * Navigates the HashRouter app to a route (e.g. "dashboard", "notes") and waits
 * for the hash to update. Pass without a leading slash.
 */
export async function gotoRoute(page: Page, route: string): Promise<void> {
  const hash = route.startsWith("#") ? route : `#/${route.replace(/^\//, "")}`;
  // Wait until React has actually mounted before changing the route, otherwise
  // a too-early hash change can be dropped and leave a blank screen.
  await page
    .waitForFunction(
      () => {
        const root = document.getElementById("root");
        return !!root && root.children.length > 0;
      },
      { timeout: 20_000 },
    )
    .catch(() => undefined);
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
  await page
    .waitForFunction((h) => window.location.hash === h, hash, { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(250);
}

/** Reads a single key from the seeded electron-store config.json. */
export function readStoreKey<T = unknown>(userDataDir: string, key: string): T | undefined {
  const configPath = path.join(userDataDir, "config.json");
  if (!fs.existsSync(configPath)) return undefined;
  const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return data[key] as T;
}

export async function closeApp(
  launched: LaunchedApp | undefined,
  testInfo?: TestInfo,
): Promise<void> {
  if (!launched) return;
  const { app, page, userDataDir } = launched;

  const failed =
    !!testInfo && testInfo.status !== testInfo.expectedStatus;

  try {
    if (testInfo) {
      const traceName = `trace-${testInfo.title.replace(/[^\w.-]+/g, "_")}.zip`;
      const tracePath = testInfo.outputPath(traceName);
      await app.context().tracing.stop({ path: failed ? tracePath : undefined as any });
      if (failed && fs.existsSync(tracePath)) {
        await testInfo.attach("trace", { path: tracePath, contentType: "application/zip" });
      }
    } else {
      await app.context().tracing.stop();
    }
  } catch {
    /* ignore tracing stop errors */
  }

  try {
    if (failed && testInfo && page) {
      const shot = await page.screenshot();
      await testInfo.attach("screenshot-on-failure", {
        body: shot,
        contentType: "image/png",
      });
    }
  } catch {
    /* ignore screenshot errors */
  }

  try {
    await app.close();
  } catch {
    /* ignore */
  }

  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    activeDirs.delete(userDataDir);
  } catch {
    /* best-effort cleanup */
  }
}
