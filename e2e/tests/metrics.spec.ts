import { test, expect } from "@playwright/test";
import {
  launchApp,
  closeApp,
  gotoRoute,
  LaunchedApp,
} from "../helpers/electronApp";
import { getConfig, missingGithubReason } from "../helpers/env";
import { githubUser } from "../helpers/seedStore";
import { writeMetricsRoot, metricRecord, rmDir } from "../helpers/fixtures";
import { getAuthenticatedUser, getOrgRole } from "../helpers/github";

/**
 * AI metrics: the local metrics scanner + admin UI. Viewing metrics requires the
 * seeded token to belong to a GitHub org admin (verified live via verify-user-role),
 * so the data-rendering tests self-skip for non-admin / missing tokens. The
 * no-token redirect runs fully offline.
 */

let launched: LaunchedApp | undefined;
let metricsRoot: string | null = null;
let realLogin = "";
let role: "administrador" | "desarrollador" | "sin-acceso" = "sin-acceso";

test.beforeAll(async () => {
  const cfg = getConfig();
  if (cfg.githubToken) {
    const user = await getAuthenticatedUser();
    realLogin = user?.login || cfg.githubLogin || "";
    if (realLogin) role = await getOrgRole(cfg.org, realLogin);
  }
});

test.afterEach(async ({}, testInfo) => {
  await closeApp(launched, testInfo);
  launched = undefined;
  if (metricsRoot) {
    rmDir(metricsRoot);
    metricsRoot = null;
  }
});

function seedMetricsFolder() {
  const built = writeMetricsRoot(
    [
      {
        name: "juego-a",
        records: [
          metricRecord({
            id: "2026-06-07T08-00-00_juego-a",
            provider: "gemini",
            model: "gemini-2.5-flash",
            totalTexts: 10,
          }),
        ],
      },
      {
        name: "juego-b",
        records: [
          metricRecord({
            id: "2026-06-08T08-00-00_juego-b",
            provider: "openai",
            model: "gpt-4o-mini",
            totalTexts: 25,
            spellcheck: true,
            correctionRate: 12,
          }),
        ],
      },
    ],
    { includeGeneralRepo: true },
  );
  metricsRoot = built.root;
  return built;
}

test("no token: /admin-metrics redirects to login (offline)", async () => {
  launched = await launchApp();
  const { page } = launched;
  await gotoRoute(page, "admin-metrics");
  await expect(
    page.getByRole("heading", { name: "Iniciar Sesión en GitHub" }),
  ).toBeVisible({ timeout: 20_000 });
});

test.describe("metrics rendering (admin only)", () => {
  test.beforeEach(() => {
    test.skip(!!missingGithubReason(), missingGithubReason() || "");
    test.skip(
      role !== "administrador",
      `Seeded token user "${realLogin}" is not an org admin (role=${role}).`,
    );
  });

  test("aggregates metrics across games and excludes the general repo", async () => {
    const built = seedMetricsFolder();
    launched = await launchApp({
      seed: {
        github_token: getConfig().githubToken,
        github_user: githubUser(realLogin),
        selected_folder: built.root,
      },
    });
    const { page } = launched;
    await gotoRoute(page, "admin-metrics");

    await expect(
      page.getByRole("heading", { name: "Métricas de traducciones" }),
    ).toBeVisible({ timeout: 30_000 });
    // Hero stats render (totals computed from both games).
    await expect(page.locator(".metrics-hero-stat-value").first()).toBeVisible();
    // Both projects are offered in the project filter; general repo is excluded.
    const projectSelect = page
      .locator("label.metrics-filter-field")
      .filter({ hasText: "Proyecto" })
      .locator("select");
    await expect(projectSelect.locator("option", { hasText: "juego-a" })).toHaveCount(1);
    await expect(projectSelect.locator("option", { hasText: "juego-b" })).toHaveCount(1);
    await expect(
      projectSelect.locator("option", { hasText: "repo-general-totem-games" }),
    ).toHaveCount(0);
  });

  test("filter by project narrows the data", async () => {
    const built = seedMetricsFolder();
    launched = await launchApp({
      seed: {
        github_token: getConfig().githubToken,
        github_user: githubUser(realLogin),
        selected_folder: built.root,
      },
    });
    const { page } = launched;
    await gotoRoute(page, "admin-metrics");
    await expect(
      page.getByRole("heading", { name: "Métricas de traducciones" }),
    ).toBeVisible({ timeout: 30_000 });

    const projectSelect = page
      .locator("label.metrics-filter-field")
      .filter({ hasText: "Proyecto" })
      .locator("select");
    await projectSelect.selectOption({ label: "juego-a" });

    // Expand details and confirm the project breakdown reflects a single project.
    await page.locator(".metrics-details-toggle").click();
    await expect(page.getByText("juego-a")).toBeVisible();
    await expect(page.getByText("juego-b")).toHaveCount(0);
  });

  test("empty selected_folder shows the no-metrics state", async () => {
    const built = writeMetricsRoot([], {});
    metricsRoot = built.root;
    launched = await launchApp({
      seed: {
        github_token: getConfig().githubToken,
        github_user: githubUser(realLogin),
        selected_folder: built.root,
      },
    });
    const { page } = launched;
    await gotoRoute(page, "admin-metrics");
    await expect(page.getByText("Sin métricas disponibles")).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe("non-admin gating", () => {
  test.beforeEach(() => {
    test.skip(!!missingGithubReason(), missingGithubReason() || "");
    test.skip(
      role === "administrador",
      "Seeded token is an admin; non-admin redirect cannot be exercised.",
    );
  });

  test("non-admin visiting /admin-metrics is redirected to the dashboard", async () => {
    launched = await launchApp({
      seed: {
        github_token: getConfig().githubToken,
        github_user: githubUser(realLogin),
      },
    });
    const { page } = launched;
    await gotoRoute(page, "admin-metrics");
    // Redirected away from metrics (dashboard) after the role check.
    await expect(
      page.getByRole("heading", { name: "Métricas de traducciones" }),
    ).toHaveCount(0, { timeout: 20_000 });
  });
});
