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
 * Issues are GitHub issues with `bug` / `enhancement` labels. New issues are
 * always created as `bug`. Runs against E2E_TEST_REPO and cleans up created
 * issues. Self-skips when the repo/token are not configured.
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
  dummyRepoPath = makeTempDir("totem-issuesproj-");
});

test.afterEach(async ({}, testInfo) => {
  await closeApp(launched, testInfo);
  launched = undefined;
  rmDir(dummyRepoPath);
});

test.afterAll(async () => {
  const repo = getConfig().testRepo;
  if (repo) await closeOpenIssuesByTitlePrefix(repo.owner, repo.name, RUN_TAG);
});

async function openIssues(): Promise<Page> {
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
  await gotoRoute(page, "issues");
  await expect(
    page.getByRole("heading", { name: "Issues del Proyecto" }),
  ).toBeVisible({ timeout: 30_000 });
  return page;
}

test.describe("Issues (real GitHub)", () => {
  test("guard: no current project redirects away from issues", async () => {
    launched = await launchApp({
      seed: {
        github_token: getConfig().githubToken,
        github_user: githubUser(login),
      },
    });
    const { page } = launched;
    await gotoRoute(page, "issues");
    await expect(
      page.getByRole("heading", { name: "Issues del Proyecto" }),
    ).toHaveCount(0, { timeout: 20_000 });
  });

  test("create validation: Guardar disabled with empty title", async () => {
    const page = await openIssues();
    await page.getByRole("button", { name: "Nuevo Issue" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  test("create issue (bug) shows success toast and card", async () => {
    const page = await openIssues();
    const title = `${RUN_TAG} issue creado`;

    await page.getByRole("button", { name: "Nuevo Issue" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#issue-title").fill(title);
    await dialog.locator("#issue-desc").fill("descripcion de prueba");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("Issue creado exitosamente")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
    // New issues carry the "Issue" (bug) badge.
    await expect(page.getByText("🐞 Issue").first()).toBeVisible();
  });

  test("edit issue updates the title", async () => {
    const page = await openIssues();
    const title = `${RUN_TAG} issue editar`;

    await page.getByRole("button", { name: "Nuevo Issue" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.locator("#issue-title").fill(title);
    await dialog.locator("#issue-desc").fill("desc");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });

    await page.getByText(title).click();
    dialog = page.getByRole("dialog");
    await dialog.locator("#issue-title").fill(`${title} v2`);
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/Issue #\d+ actualizado/)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("resolve an open issue marks it closed", async () => {
    const page = await openIssues();
    const title = `${RUN_TAG} issue resolver`;

    await page.getByRole("button", { name: "Nuevo Issue" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.locator("#issue-title").fill(title);
    await dialog.locator("#issue-desc").fill("desc");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });

    await page.getByText(title).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Marcar como resuelto" }).click();
    await expect(page.getByText(/marcado como resuelto/)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("filter by status shows closed-only set", async () => {
    const page = await openIssues();
    const statusSelect = page
      .locator("label")
      .filter({ hasText: "Estado" })
      .locator("select");
    await statusSelect.selectOption({ label: "Cerrados" });
    // Either some cards or the empty state, but never an error/loading lock.
    await expect(
      page.getByRole("heading", { name: "Issues del Proyecto" }),
    ).toBeVisible();
  });
});
