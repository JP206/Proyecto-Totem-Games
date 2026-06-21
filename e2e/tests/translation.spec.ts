import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import * as fs from "fs";
import {
  launchApp,
  closeApp,
  gotoRoute,
  LaunchedApp,
} from "../helpers/electronApp";
import { getConfig } from "../helpers/env";
import { githubUser } from "../helpers/seedStore";
import { writeProjectRepo, writeLocalizeCsvFile } from "../helpers/fixtures";

/**
 * Translation lifecycle, driven through the real UI with the deterministic mock
 * AI provider (offline). Real-AI UI runs are out of scope here because they need
 * a personal key configured in the encrypted store; use `npm run test:load:real`
 * for the real-API path instead.
 */

let launched: LaunchedApp | undefined;
let projectRepoPath: string;
let csvFixture: string;

test.beforeEach(() => {
  test.skip(
    getConfig().realAi,
    "Translation UI E2E runs only in mocked-AI mode (see test:load:real for real API).",
  );
  const project = writeProjectRepo({ name: "e2e-game", withGeneralSibling: true });
  projectRepoPath = project.repoPath;
  csvFixture = writeLocalizeCsvFile(6, "e2e-source.csv");
});

test.afterEach(async ({}, testInfo) => {
  await closeApp(launched, testInfo);
  launched = undefined;
});

async function openLandingWithProject(): Promise<Page> {
  launched = await launchApp({
    seed: {
      github_token: "ghp_seeded_fake_token",
      github_user: githubUser("e2e-tester"),
      current_project: {
        repoPath: projectRepoPath,
        repoName: "e2e-game",
        repoOwner: "Proyecto-Final-de-Grado",
      },
    },
  });
  const { page } = launched;
  await gotoRoute(page, "landing");
  // Provider radios appear once the (mocked) personal config has loaded.
  await expect(
    page.locator("label.spellcheck-label").filter({ hasText: "OpenAI" }),
  ).toBeVisible({ timeout: 30_000 });
  return page;
}

async function configureAndStart(page: Page, opts: { spellcheckFirst?: boolean } = {}) {
  // Upload the localization file FIRST. Uploading triggers a language-detection
  // effect that rewrites `targetLanguages`, so any language picked beforehand
  // would be wiped — select languages only after the file is settled.
  await page.locator("#file-upload").setInputFiles(csvFixture);
  await expect(page.locator(".landing-file-strip-details")).toBeVisible({
    timeout: 20_000,
  });
  // Let the post-upload language detection effect run.
  await page.waitForTimeout(1_000);

  // Provider: OpenAI (mocked).
  await page
    .locator("label.spellcheck-label")
    .filter({ hasText: "OpenAI" })
    .locator('input[type="radio"]')
    .check();

  // Target language: first non-locked option; confirm it registered.
  await page.locator(".language-option:not(.locked)").first().click();
  await expect(page.locator(".selected-language")).toBeVisible({ timeout: 10_000 });

  if (opts.spellcheckFirst) {
    await page
      .locator("label")
      .filter({ hasText: "Revisar ortografía con IA" })
      .locator('input[type="checkbox"]')
      .check();
  }

  const localizeBtn = page.locator("button.localize-btn");
  await expect(localizeBtn).toBeEnabled({ timeout: 20_000 });
  await localizeBtn.click();
}

test.describe("Translation lifecycle (mocked AI)", () => {
  test("translate a file and land on the preview with translated rows", async () => {
    const page = await openLandingWithProject();
    await configureAndStart(page);

    await expect(
      page.getByRole("heading", { name: "Resultado de traducción AI" }),
    ).toBeVisible({ timeout: 60_000 });
    // At least one cell carries a mock translation (prefixed with the lang code).
    await expect(page.locator(".translation-preview-cell-input").first()).toBeVisible();
  });

  test("edit a translation cell updates its value", async () => {
    const page = await openLandingWithProject();
    await configureAndStart(page);
    await expect(
      page.getByRole("heading", { name: "Resultado de traducción AI" }),
    ).toBeVisible({ timeout: 60_000 });

    const cell = page.locator(".translation-preview-cell-input").first();
    await cell.fill("EDITADO_E2E");
    await expect(cell).toHaveValue("EDITADO_E2E");
  });

  test("saving (upload write) persists edited content to disk", async () => {
    const page = await openLandingWithProject();
    await configureAndStart(page);
    await expect(
      page.getByRole("heading", { name: "Resultado de traducción AI" }),
    ).toBeVisible({ timeout: 60_000 });

    await page.locator(".translation-preview-cell-input").first().fill("EDITADO_E2E");

    // "Subir al repositorio" writes the file to disk first, then attempts a git
    // push (which fails against the fake local repo, surfacing a toast). The
    // on-disk write is what we assert here.
    await page.getByRole("button", { name: "Subir al repositorio" }).click();

    const savedPath = `${projectRepoPath}/Localizacion/e2e-game_localizar.csv`;
    await expect
      .poll(
        () => (fs.existsSync(savedPath) ? fs.readFileSync(savedPath, "utf8") : ""),
        { timeout: 20_000 },
      )
      .toContain("EDITADO_E2E");
  });

  test("download CSV produces content (captured via createObjectURL spy)", async () => {
    const page = await openLandingWithProject();
    await configureAndStart(page);
    await expect(
      page.getByRole("heading", { name: "Resultado de traducción AI" }),
    ).toBeVisible({ timeout: 60_000 });

    await page.evaluate(() => {
      (window as any).__e2eDownloadCsv = null;
      const orig = URL.createObjectURL.bind(URL);
      (URL as any).createObjectURL = (blob: Blob) => {
        try {
          blob.text().then((t) => {
            (window as any).__e2eDownloadCsv = t;
          });
        } catch {
          /* ignore */
        }
        return orig(blob);
      };
    });

    await page.getByRole("button", { name: "Descargar CSV" }).click();

    await expect
      .poll(() => page.evaluate(() => (window as any).__e2eDownloadCsv), {
        timeout: 15_000,
      })
      .toContain("Clave");
  });

  test("rollback restores the original translation in a cell", async () => {
    const page = await openLandingWithProject();
    await configureAndStart(page);
    await expect(
      page.getByRole("heading", { name: "Resultado de traducción AI" }),
    ).toBeVisible({ timeout: 60_000 });

    const cell = page.locator(".translation-preview-cell-input").first();
    const original = await cell.inputValue();
    await cell.fill("EDITADO_E2E");
    await expect(cell).toHaveValue("EDITADO_E2E");

    await page.getByRole("button", { name: "Revertir cambios" }).click();
    await expect(page.locator(".translation-preview-cell-input").first()).toHaveValue(
      original,
    );
  });

  test("spellcheck-first then confirm re-translates into the AI result view", async () => {
    const page = await openLandingWithProject();
    await configureAndStart(page, { spellcheckFirst: true });

    // Lands first on the spellcheck-only preview.
    await expect(
      page.getByRole("heading", {
        name: "Revisión ortográfica y gramatical (IA)",
      }),
    ).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Confirmar traducciones" }).click();

    await expect(
      page.getByRole("heading", { name: "Resultado de traducción AI" }),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("upload success requires a configured sandbox repo (opt-in)", async () => {
    test.skip(
      !getConfig().sandboxRepo,
      "E2E_SANDBOX_REPO not set; real push is skipped (write-to-disk is covered above).",
    );
    // Implemented when a sandbox repo + real local clone is configured; the
    // default suite asserts the write-to-disk path instead (see test above).
  });
});
