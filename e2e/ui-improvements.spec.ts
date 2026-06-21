import { test, expect } from "@playwright/test";
import { registerAs } from "./helpers";
import { TEST_USER } from "./fixtures";

/**
 * E2E Tests: UI overhaul (desktop)
 * Covers the new desktop primary CTA and the search-aware empty state.
 * The optimistic quantity stepper is covered by unit tests
 * (src/test/hooks/useInventoryMutations.test.tsx).
 */

test.describe("UI improvements", () => {
  test("desktop header exposes a primary New Item action that opens the dialog", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop header CTA only — mobile uses the FAB");

    await registerAs(page, { ...TEST_USER, email: `newitem+${Date.now()}@pantrymaid.test` });

    await page.getByRole("button", { name: "New Item" }).click();
    await expect(page.locator('text="Add New Item"')).toBeVisible();
  });

  test("search shows a search-aware empty state when nothing matches", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop search is always visible; mobile is behind a toggle");

    await registerAs(page, { ...TEST_USER, email: `search+${Date.now()}@pantrymaid.test` });

    // Add an item so the difference between "empty" and "no matches" is meaningful.
    const pantry = page.getByTestId("section-pantry");
    await pantry.locator('button:has([class*="lucide-plus"])').click();
    await expect(page.locator('text="Add New Item"')).toBeVisible();
    await page.fill("#name", "Olive Oil");
    await page.fill("#quantity", "1");
    await page.click('button:has-text("Add Item")');
    await expect(page.locator('text="Olive Oil"')).toBeVisible();

    // Search for something that matches nothing.
    await page.getByRole("textbox", { name: "Search items" }).fill("zzznomatch");

    await expect(page.getByText("No items match your search").first()).toBeVisible();
    await expect(page.locator('text="Olive Oil"')).toBeHidden();
  });
});
