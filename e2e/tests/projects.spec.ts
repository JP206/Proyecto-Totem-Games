import { test, expect } from "@playwright/test";
import {
  launchApp,
  closeApp,
  gotoRoute,
  LaunchedApp,
} from "../helpers/electronApp";
import { getConfig, missingGithubReason } from "../helpers/env";
import { githubUser } from "../helpers/seedStore";
import {
  getAuthenticatedUser,
  getOrgRole,
  deleteRepo,
  repoExists,
} from "../helpers/github";

/**
 * Projects = org repositories created from a template via the GitHub API. Listing
 * needs a token; create/edit/delete are destructive and admin-only, so they are
 * guarded behind E2E_ALLOW_DESTRUCTIVE + org-admin role and clean up after
 * themselves.
 */

const RUN_TAG = `e2e-proj-${Date.now()}`;
let launched: LaunchedApp | undefined;
let login = "e2e-tester";
let role: "administrador" | "desarrollador" | "sin-acceso" = "sin-acceso";

test.beforeAll(async () => {
  const cfg = getConfig();
  if (cfg.githubToken) {
    const user = await getAuthenticatedUser();
    login = user?.login || cfg.githubLogin || login;
    if (login) role = await getOrgRole(cfg.org, login);
  }
});

test.afterEach(async ({}, testInfo) => {
  await closeApp(launched, testInfo);
  launched = undefined;
});

function seededSession() {
  return {
    github_token: getConfig().githubToken,
    github_user: githubUser(login),
  };
}

test.describe("Projects admin-button visibility", () => {
  test.beforeEach(() => {
    test.skip(!!missingGithubReason(), missingGithubReason() || "");
  });

  test("admin sees the Proyectos button; non-admin does not", async () => {
    launched = await launchApp({ seed: seededSession() });
    const { page } = launched;
    await gotoRoute(page, "dashboard");
    await expect(page.getByText(`@${login}`)).toBeVisible({ timeout: 30_000 });
    // Give the live role check time to resolve.
    await page.waitForTimeout(2_000);
    const projectsBtn = page.getByRole("button", { name: "Proyectos" });
    if (role === "administrador") {
      await expect(projectsBtn).toBeVisible();
    } else {
      await expect(projectsBtn).toHaveCount(0);
    }
  });
});

test.describe("Projects list & validation", () => {
  test.beforeEach(() => {
    test.skip(!!missingGithubReason(), missingGithubReason() || "");
  });

  test("projects page loads the org repos (or empty state)", async () => {
    launched = await launchApp({ seed: seededSession() });
    const { page } = launched;
    await gotoRoute(page, "projects");
    await expect(page.getByRole("heading", { name: "Proyectos" })).toBeVisible({
      timeout: 30_000,
    });
    // Loading resolves to either cards or the empty state.
    await expect(page.getByText("Cargando proyectos...")).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test("create modal: Guardar disabled with empty title", async () => {
    launched = await launchApp({ seed: seededSession() });
    const { page } = launched;
    await gotoRoute(page, "projects");
    await expect(page.getByRole("heading", { name: "Proyectos" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Nuevo Proyecto" }).click();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});

test.describe("Projects create/delete (destructive, admin-only)", () => {
  test.beforeEach(() => {
    test.skip(!!missingGithubReason(), missingGithubReason() || "");
    test.skip(
      !getConfig().allowDestructive,
      "Set E2E_ALLOW_DESTRUCTIVE=1 to run project create/delete.",
    );
    test.skip(role !== "administrador", `Requires org admin (role=${role}).`);
  });

  test("create a project from template, then clean it up", async () => {
    const org = getConfig().org;
    const name = RUN_TAG;
    launched = await launchApp({ seed: seededSession() });
    const { page } = launched;
    await gotoRoute(page, "projects");
    await expect(page.getByRole("heading", { name: "Proyectos" })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "Nuevo Proyecto" }).click();
    await page.locator("#project-title-input").fill(name);
    await page.locator("#project-desc-input").fill("repo creado por E2E");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Proyecto creado")).toBeVisible({
      timeout: 60_000,
    });

    // Cleanup: delete the repo created during the test.
    await expect
      .poll(() => repoExists(org, name), { timeout: 30_000 })
      .toBe(true);
    const deleted = await deleteRepo(org, name);
    expect(deleted).toBe(true);
  });
});
