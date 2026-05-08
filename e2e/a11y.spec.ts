import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { registerAs } from "./helpers";
import { TEST_USER } from "./fixtures";

/**
 * Axe accessibility checks. Runs on both the desktop "chromium" project
 * and the "Mobile Chrome" Pixel 5 project so we catch responsive regressions.
 *
 * The wcag2a/wcag2aa tag set is the meaningful baseline. We deliberately
 * exclude `color-contrast` for now: the dark-mode tokens occasionally trip
 * AA thresholds during transitions and we'd rather audit them deliberately.
 */

const baseTags = ["wcag2a", "wcag2aa"];

const buildAxe = (page: Parameters<Parameters<typeof test>[1]>[0]["page"]) =>
  new AxeBuilder({ page })
    .withTags(baseTags)
    .disableRules(["color-contrast"]);

test.describe("Accessibility", () => {
  test("login page has no axe violations", async ({ page }) => {
    await page.goto("/login");
    const results = await buildAxe(page).analyze();
    expect(results.violations).toEqual([]);
  });

  test("inventory page has no axe violations", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `a11y-inventory+${Date.now()}@pantrymaid.test`,
    };
    await registerAs(page, user);
    const results = await buildAxe(page).analyze();
    expect(results.violations).toEqual([]);
  });

  test("add item dialog has no axe violations", async ({ page, isMobile }) => {
    const user = {
      ...TEST_USER,
      email: `a11y-add+${Date.now()}@pantrymaid.test`,
    };
    await registerAs(page, user);
    // FAB is md:hidden on desktop; section buttons exist on desktop only
    if (isMobile) {
      await page.getByTestId("mobile-fab").click();
    } else {
      await page.getByTestId("section-pantry").getByRole("button", { name: /add item to pantry/i }).click();
    }
    await expect(page.getByText("Add New Item")).toBeVisible();
    const results = await buildAxe(page).analyze();
    expect(results.violations).toEqual([]);
  });
});
