import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  launchApp,
  closeApp,
  gotoRoute,
  LaunchedApp,
} from "../helpers/electronApp";
import { getConfig, missingTestRepoReason } from "../helpers/env";
import { githubUser } from "../helpers/seedStore";
import { makeTempDir, rmDir } from "../helpers/fixtures";
import {
  getAuthenticatedUser,
  closeOpenIssuesByTitlePrefix,
} from "../helpers/github";

/**
 * Notes are GitHub issues with the `documentation` label. These run against the
 * dedicated test repo (E2E_TEST_REPO) and clean up the issues they create. They
 * self-skip when the repo/token are not configured.
 */

const RUN_TAG = `E2E-${Date.now()}`;
let launched: LaunchedApp | undefined;
let dummyRepoPath: string;
let login = "e2e-tester";

test.beforeAll(async () => {
  if (!missingTestRepoReason()) {
    const user = await getAuthenticatedUser();
    login = user?.login || getConfig().githubLogin || login;
  }
});

test.beforeEach(() => {
  test.skip(!!missingTestRepoReason(), missingTestRepoReason() || "");
  dummyRepoPath = makeTempDir("totem-notesproj-");
});

test.afterEach(async ({}, testInfo) => {
  await closeApp(launched, testInfo);
  launched = undefined;
  rmDir(dummyRepoPath);
});

test.afterAll(async () => {
  const repo = getConfig().testRepo;
  if (repo) {
    await closeOpenIssuesByTitlePrefix(repo.owner, repo.name, RUN_TAG);
  }
});

async function openNotes(): Promise<Page> {
  const repo = getConfig().testRepo!;
  launched = await launchApp({
    seed: {
      github_token: getConfig().githubToken,
      github_user: githubUser(login),
      current_project: {
        repoPath: dummyRepoPath,
        repoName: repo.name,
        repoOwner: repo.owner,
      },
    },
  });
  const { page } = launched;
  await gotoRoute(page, "notes");
  await expect(
    page.getByRole("heading", { name: "Notas del Proyecto" }),
  ).toBeVisible({ timeout: 30_000 });
  return page;
}

test.describe("Notes (real GitHub)", () => {
  test("guard: no current project redirects to the dashboard", async () => {
    launched = await launchApp({
      seed: {
        github_token: getConfig().githubToken,
        github_user: githubUser(login),
      },
    });
    const { page } = launched;
    await gotoRoute(page, "notes");
    await expect(
      page.getByRole("heading", { name: "Notas del Proyecto" }),
    ).toHaveCount(0, { timeout: 20_000 });
  });

  test("create note shows sync overlay then the new card", async () => {
    const page = await openNotes();
    const title = `${RUN_TAG} nota creada`;

    await page.getByRole("button", { name: "Nueva Nota" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("Título de la nota").fill(title);
    await dialog
      .getByPlaceholder("Escribe el contenido de tu nota aquí...")
      .fill("Contenido de prueba E2E");
    await dialog.getByRole("button", { name: "Guardar nota" }).click();

    // Toast confirms creation; the card eventually appears after GitHub sync.
    await expect(page.getByText("Nota creada")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
  });

  test("create validation: save disabled with empty title", async () => {
    const page = await openNotes();
    await page.getByRole("button", { name: "Nueva Nota" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Guardar nota" })).toBeDisabled();
  });

  test("edit note updates its title", async () => {
    const page = await openNotes();
    const title = `${RUN_TAG} nota editar`;

    // create
    await page.getByRole("button", { name: "Nueva Nota" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Título de la nota").fill(title);
    await dialog
      .getByPlaceholder("Escribe el contenido de tu nota aquí...")
      .fill("original");
    await dialog.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });

    // edit
    await page.getByText(title).click();
    dialog = page.getByRole("dialog");
    const newTitle = `${title} v2`;
    await dialog.getByPlaceholder("Título de la nota").fill(newTitle);
    await dialog.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByText("Nota actualizada")).toBeVisible({ timeout: 30_000 });
  });

  test("archive note removes it from the open list", async () => {
    const page = await openNotes();
    const title = `${RUN_TAG} nota archivar`;

    await page.getByRole("button", { name: "Nueva Nota" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Título de la nota").fill(title);
    await dialog
      .getByPlaceholder("Escribe el contenido de tu nota aquí...")
      .fill("para archivar");
    await dialog.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });

    await page.getByText(title).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Archivar" }).click();
    // Confirm dialog
    await page
      .getByRole("button", { name: "Archivar" })
      .last()
      .click();
    await expect(page.getByText("Nota archivada")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 30_000 });
  });

  test("search filters the notes list", async () => {
    const page = await openNotes();
    const search = page.getByPlaceholder("Buscar por título o autor...");
    await search.fill("zzz-nonexistent-note-xyz");
    await expect(
      page.getByText(/No se encontraron notas|No hay notas que coincidan/),
    ).toBeVisible({ timeout: 15_000 });
  });
});
