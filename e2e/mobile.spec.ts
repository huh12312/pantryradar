import { test, expect } from "@playwright/test";
import { registerAs } from "./helpers";
import { TEST_USER } from "./fixtures";

/**
 * Mobile-only E2E flows that exercise chrome that only exists below `md`:
 * the segmented top tabs, FAB, overflow menu, and bottom-sheet dialog.
 *
 * Runs against the "Mobile Chrome" Playwright project (Pixel 5).
 */

test.describe("Mobile chrome", () => {
  test("segmented tabs are visible with four roles=tab", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `mobile-tabs+${Date.now()}@pantrymaid.test`,
    };
    await registerAs(page, user);

    const tablist = page.getByRole("tablist");
    await expect(tablist).toBeVisible();
    const tabs = tablist.getByRole("tab");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toContainText(/All/i);
    await expect(tabs.nth(1)).toContainText(/Pantry/i);
    await expect(tabs.nth(2)).toContainText(/Fridge/i);
    await expect(tabs.nth(3)).toContainText(/Freezer/i);
  });

  test("FAB opens the add-item sheet", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `mobile-fab+${Date.now()}@pantrymaid.test`,
    };
    await registerAs(page, user);

    await page.getByTestId("mobile-fab").click();
    await expect(page.getByText("Add New Item")).toBeVisible();
    await expect(page.locator('[data-testid="sheet-content"]')).toBeVisible();
  });

  test("overflow menu sign out returns user to login", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `mobile-logout+${Date.now()}@pantrymaid.test`,
    };
    await registerAs(page, user);

    await page.getByTestId("overflow-menu-trigger").click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("filter to fridge tab shows only fridge", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `mobile-filter+${Date.now()}@pantrymaid.test`,
    };
    await registerAs(page, user);

    // Add a pantry item via the FAB
    await page.getByTestId("mobile-fab").click();
    await page.getByLabel("Name *").fill("Mobile Pantry Item");
    await page.getByRole("button", { name: "Add Item", exact: true }).click();
    await expect(page.getByText("Mobile Pantry Item")).toBeVisible();

    // Add a fridge item, choosing Fridge from the location select
    await page.getByTestId("mobile-fab").click();
    await page.getByLabel("Name *").fill("Mobile Fridge Item");
    await page.getByLabel("Location *").click();
    await page.getByRole("option", { name: /fridge/i }).click();
    await page.getByRole("button", { name: "Add Item", exact: true }).click();
    await expect(page.getByText("Mobile Fridge Item")).toBeVisible();

    // Switch to Fridge tab
    await page.getByRole("tab", { name: /fridge/i }).click();
    await expect(page.getByText("Mobile Fridge Item")).toBeVisible();
    await expect(page.getByText("Mobile Pantry Item")).not.toBeVisible();
  });

  test("overflow menu reveals invite code", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `mobile-invite+${Date.now()}@pantrymaid.test`,
    };
    await registerAs(page, user);

    await page.getByTestId("overflow-menu-trigger").click();
    await expect(page.getByText(/invite:/i)).toBeVisible();
  });
});
