import { test, expect } from "@playwright/test";
import {
  launchApp,
  closeApp,
  gotoRoute,
  readStoreKey,
  LaunchedApp,
} from "../helpers/electronApp";
import { getConfig, missingGithubReason } from "../helpers/env";
import { githubUser } from "../helpers/seedStore";

let launched: LaunchedApp | undefined;

test.afterEach(async ({}, testInfo) => {
  await closeApp(launched, testInfo);
  launched = undefined;
});

test.describe("Auth / session", () => {
  test("starts on the login screen with no session", async () => {
    launched = await launchApp();
    const { page } = launched;
    await expect(
      page.getByRole("heading", { name: "Iniciar Sesión en GitHub" }),
    ).toBeVisible();
  });

  test("submit is disabled with an empty token", async () => {
    launched = await launchApp();
    const { page } = launched;
    const submit = page.getByRole("button", { name: /Iniciar Sesión/ });
    await expect(submit).toBeDisabled();
  });

  test("guarded route (notes) without token redirects to login", async () => {
    launched = await launchApp();
    const { page } = launched;
    await gotoRoute(page, "notes");
    await expect(
      page.getByRole("heading", { name: "Iniciar Sesión en GitHub" }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("seeded session is accepted and lands on the dashboard route", async () => {
    launched = await launchApp({
      seed: {
        github_token: "ghp_seeded_fake_token",
        github_user: githubUser("e2e-tester"),
      },
    });
    const { page } = launched;
    await gotoRoute(page, "dashboard");
    // The seeded token is accepted: we are NOT bounced back to the login screen.
    await expect(
      page.getByRole("heading", { name: "Iniciar Sesión en GitHub" }),
    ).toHaveCount(0);
    expect(await page.evaluate(() => window.location.hash)).toContain("dashboard");
  });

  test("logout clears the stored github token", async () => {
    launched = await launchApp({
      seed: {
        github_token: "ghp_seeded_fake_token",
        github_user: githubUser("e2e-tester"),
      },
    });
    const { page, userDataDir } = launched;

    await gotoRoute(page, "profile");
    const logout = page.getByRole("button", { name: "Cerrar Sesión" });
    await expect(logout).toBeVisible({ timeout: 20_000 });
    await logout.click();

    await expect(
      page.getByRole("heading", { name: "Iniciar Sesión en GitHub" }),
    ).toBeVisible({ timeout: 20_000 });

    // electron-store persisted the cleared token.
    await page.waitForTimeout(300);
    expect(readStoreKey(userDataDir, "github_token")).toBeFalsy();
  });

  test("invalid token surfaces an error (requires internet)", async () => {
    test.skip(
      !!missingGithubReason() && getConfig().githubToken === "",
      "No token context; still attempts network. Run with internet access.",
    );
    launched = await launchApp();
    const { page } = launched;
    await page.locator("input.token-input").fill("ghp_definitely_invalid_token_xyz");
    await page.getByRole("button", { name: /Iniciar Sesión/ }).click();
    // Either a GitHub 401 message or a connection error must appear.
    await expect(page.locator(".error-message")).toBeVisible({ timeout: 20_000 });
  });
});
