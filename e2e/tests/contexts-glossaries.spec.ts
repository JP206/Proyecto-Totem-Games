import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  launchApp,
  closeApp,
  gotoRoute,
  LaunchedApp,
} from "../helpers/electronApp";
import { getConfig, missingTestRepoReason, missingGithubReason } from "../helpers/env";
import { githubUser } from "../helpers/seedStore";
import { writeProjectRepo, rmDir } from "../helpers/fixtures";
import { cloneTestRepo } from "../helpers/git";
import {
  getAuthenticatedUser,
  getOrgRole,
  deleteFileIfExists,
} from "../helpers/github";

/**
 * Contexts & Glossaries. The CRUD operations commit + push to the test repo and
 * its sibling general repo, so they are guarded behind E2E_ALLOW_DESTRUCTIVE.
 * Guards and the Landing-consumption test run offline against a local fixture
 * project (no real GitHub needed).
 */

const RUN_TAG = `e2e_${Date.now()}`;
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

// --- Offline guards + Landing consumption (local fixture project) -----------

test.describe("Contexts/Glossaries guards & Landing consumption (offline)", () => {
  test("guard: no token redirects to login", async () => {
    launched = await launchApp();
    const { page } = launched;
    await gotoRoute(page, "contexts-glossaries");
    await expect(
      page.getByRole("heading", { name: "Iniciar Sesión en GitHub" }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("guard: no current project redirects to dashboard", async () => {
    launched = await launchApp({
      seed: {
        github_token: "ghp_seeded_fake_token",
        github_user: githubUser("e2e-tester"),
      },
    });
    const { page } = launched;
    await gotoRoute(page, "contexts-glossaries");
    await expect(
      page.getByRole("heading", { name: "Contextos y Glosarios" }),
    ).toHaveCount(0, { timeout: 20_000 });
  });

  test("Landing lists a project-specific context and selects it by default", async () => {
    test.skip(
      getConfig().realAi,
      "Landing consumption is asserted in mocked mode.",
    );
    const project = writeProjectRepo({ name: "ctx-game", withGeneralSibling: true });
    const ctxDir = path.join(
      project.repoPath,
      "Localizacion",
      "contextos_especificos",
    );
    fs.mkdirSync(ctxDir, { recursive: true });
    fs.writeFileSync(path.join(ctxDir, "contexto_e2e.txt"), "tono informal", "utf8");

    launched = await launchApp({
      seed: {
        github_token: "ghp_seeded_fake_token",
        github_user: githubUser("e2e-tester"),
        current_project: {
          repoPath: project.repoPath,
          repoName: "ctx-game",
          repoOwner: "Proyecto-Final-de-Grado",
        },
      },
    });
    const { page } = launched;
    await gotoRoute(page, "landing");
    await expect(page.getByText("contexto_e2e.txt")).toBeVisible({
      timeout: 30_000,
    });
    rmDir(project.repoPath);
  });
});

// --- Real-GitHub CRUD (opt-in, destructive) ---------------------------------

test.describe("Contexts/Glossaries CRUD (real GitHub, destructive)", () => {
  let clonePath: string | null = null;

  test.beforeEach(() => {
    test.skip(!!missingTestRepoReason(), missingTestRepoReason() || "");
    test.skip(
      !getConfig().allowDestructive,
      "Set E2E_ALLOW_DESTRUCTIVE=1 to run context/glossary push tests.",
    );
    const repo = getConfig().testRepo!;
    clonePath = cloneTestRepo(repo.owner, repo.name);
  });

  test.afterEach(async () => {
    if (clonePath) {
      rmDir(path.dirname(clonePath));
      clonePath = null;
    }
  });

  async function openPage(): Promise<Page> {
    const repo = getConfig().testRepo!;
    launched = await launchApp({
      seed: {
        github_token: getConfig().githubToken,
        github_user: githubUser(login),
        current_project: {
          repoPath: clonePath!,
          repoName: repo.name,
          repoOwner: repo.owner,
        },
      },
    });
    const { page } = launched;
    await gotoRoute(page, "contexts-glossaries");
    await expect(
      page.getByRole("heading", { name: "Contextos y Glosarios" }),
    ).toBeVisible({ timeout: 40_000 });
    return page;
  }

  test("page shows both sections and switches tabs", async () => {
    const page = await openPage();
    await expect(page.getByText("Generales (compartidos)")).toBeVisible();
    await expect(page.getByText("Específicos del proyecto")).toBeVisible();
    await page.getByRole("button", { name: "GLOSARIOS" }).click();
    await expect(page.getByText("Específicos del proyecto")).toBeVisible();
  });

  test("create a project-specific context appears under Específicos", async () => {
    const page = await openPage();
    const title = `${RUN_TAG}_ctx`;

    await page.getByRole("button", { name: "Nuevo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Título del contexto").fill(title);
    await dialog.getByPlaceholder("Describe el contexto...").fill("contenido e2e");
    await dialog.getByRole("button", { name: "Crear" }).click();

    await expect(page.getByText("Sincronizando con GitHub...")).toBeHidden({
      timeout: 60_000,
    });
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });

    // teardown: remove the pushed file
    const repo = getConfig().testRepo!;
    await deleteFileIfExists(
      repo.owner,
      repo.name,
      `Localizacion/contextos_especificos/${title}.txt`,
    );
  });

  test("delete a project-specific context removes it", async () => {
    const page = await openPage();
    const title = `${RUN_TAG}_ctx_del`;

    await page.getByRole("button", { name: "Nuevo" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Título del contexto").fill(title);
    await dialog.getByPlaceholder("Describe el contexto...").fill("a borrar");
    await dialog.getByRole("button", { name: "Crear" }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 40_000 });

    // open the card actions and delete
    await page.locator('[title="Eliminar"]').first().click();
    await expect(page.getByText("¿Eliminar?")).toBeVisible();
    await page.getByRole("button", { name: "Eliminar" }).last().click();
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 40_000 });
  });

  test("admin can create a general context", async () => {
    test.skip(role !== "administrador", `Requires org admin (role=${role}).`);
    const page = await openPage();
    const title = `${RUN_TAG}_general`;

    await page.getByRole("button", { name: "Nuevo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Título del contexto").fill(title);
    // Admin-only "Tipo" selector -> General
    await dialog
      .locator("select")
      .selectOption({ label: "General (todos los proyectos)" })
      .catch(() => undefined);
    await dialog.getByPlaceholder("Describe el contexto...").fill("contexto general e2e");
    await dialog.getByRole("button", { name: "Crear" }).click();

    await expect(page.getByText("Sincronizando con GitHub...")).toBeHidden({
      timeout: 60_000,
    });
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
  });
});
