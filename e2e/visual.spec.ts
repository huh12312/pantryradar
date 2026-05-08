import { test, expect } from "@playwright/test";
import { registerAs } from "./helpers";
import { TEST_USER } from "./fixtures";

/**
 * Visual regression snapshots for representative pages.
 *
 * Snapshots live under e2e/visual.spec.ts-snapshots/ keyed by Playwright project
 * name (so we get separate baselines for desktop "chromium" and "Mobile Chrome").
 *
 * The invite code element is masked because it changes per registration.
 *
 * Gated behind RUN_VISUAL=1 so CI doesn't fail on the first run before
 * baselines are committed. Workflow:
 *   1. pnpm test:e2e:update-snapshots  (locally, with stack running)
 *   2. git add e2e/visual.spec.ts-snapshots && git commit
 *   3. flip RUN_VISUAL=1 in the e2e workflow once baselines are in
 */

test.skip(
  !process.env.RUN_VISUAL,
  "Set RUN_VISUAL=1 to run visual regression (requires committed baselines)"
);

test.describe("Visual regression", () => {
  test("login page", async ({ page }) => {
    await page.goto("/login");
    // Wait for fonts so type metrics stabilise before snapshot.
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("login.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("inventory page", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `visual+${Date.now()}@pantrymaid.test`,
    };
    await registerAs(page, user);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("inventory.png", {
      fullPage: true,
      animations: "disabled",
      mask: [page.locator('[data-testid="invite-code"]')],
    });
  });
});
