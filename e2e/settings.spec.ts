import { test, expect } from "@playwright/test";
import { registerAs } from "./helpers";

const MOCK_STORES = [
  {
    locationId: "09700163",
    name: "Harris Teeter Fuel - Shadowline Fuel",
    chain: "HART",
    address: "1461 Blowing Rock Rd",
    city: "Boone",
    state: "NC",
    zipCode: "28607",
  },
  {
    locationId: "09700165",
    name: "Harris Teeter - Shops at Shadowline",
    chain: "HART",
    address: "240 Shadowline Dr",
    city: "BOONE",
    state: "NC",
    zipCode: "28607",
  },
];

test.describe("Settings Page — Store Setup", () => {
  let testEmail: string;

  test.beforeEach(async ({ page }) => {
    // Create a fresh user for each test
    testEmail = `settings+${Date.now()}@pantrymaid.test`;
    await registerAs(page, {
      email: testEmail,
      password: "testpass123",
      name: "Settings Tester",
    });

    // Mock the Kroger store search so tests don't need real API credentials
    await page.route("**/api/stores/search*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_STORES }),
      });
    });
  });

  test("settings page is reachable from sidebar Settings link", async ({ page }) => {
    await page.goto("/inventory");
    await page.click('button:has-text("Settings")');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator("h1")).toContainText("Settings");
  });

  test("settings page shows Store Setup section with zip input", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Store Setup")).toBeVisible();
    await expect(page.getByPlaceholder(/zip code/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /find stores/i })).toBeVisible();
  });

  test("zip search returns store list", async ({ page }) => {
    await page.goto("/settings");

    await page.fill('[placeholder*="zip" i]', "28607");
    await page.click('button:has-text("Find stores")');

    await expect(page.locator("text=Harris Teeter - Shops at Shadowline")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Harris Teeter Fuel - Shadowline Fuel")).toBeVisible();
  });

  test("selecting a store saves it and shows confirmation", async ({ page }) => {
    await page.goto("/settings");

    await page.fill('[placeholder*="zip" i]', "28607");
    await page.click('button:has-text("Find stores")');

    await page.locator("text=Harris Teeter - Shops at Shadowline").click();

    // After saving, the store name should be shown in the confirmed state
    await expect(page.locator("text=Harris Teeter - Shops at Shadowline")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Change store")).toBeVisible();
    await expect(page.locator("text=HART")).toBeVisible();
    await expect(page.locator("text=28607")).toBeVisible();
  });

  test("store selection persists after page reload", async ({ page }) => {
    // Select store
    await page.goto("/settings");
    await page.fill('[placeholder*="zip" i]', "28607");
    await page.click('button:has-text("Find stores")');
    await page.locator("text=Harris Teeter - Shops at Shadowline").click();
    await expect(page.locator("text=Change store")).toBeVisible({ timeout: 10000 });

    // Reload and verify store is still shown
    await page.reload();
    await expect(page.locator("text=Harris Teeter - Shops at Shadowline")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Change store")).toBeVisible();
  });

  test("can clear the selected store", async ({ page }) => {
    // Set store first
    await page.goto("/settings");
    await page.fill('[placeholder*="zip" i]', "28607");
    await page.click('button:has-text("Find stores")');
    await page.locator("text=Harris Teeter - Shops at Shadowline").click();
    await expect(page.locator("text=Change store")).toBeVisible({ timeout: 10000 });

    // Click the X / remove button
    await page.click('[aria-label="Remove store"]');

    // Zip input should reappear
    await expect(page.getByPlaceholder(/zip code/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows validation error for invalid zip code", async ({ page }) => {
    await page.goto("/settings");

    await page.fill('[placeholder*="zip" i]', "123");
    await page.click('button:has-text("Find stores")');

    await expect(
      page.locator("text=/zip.*5.*digit/i").or(page.locator("text=/valid.*zip/i"))
    ).toBeVisible({ timeout: 5000 });
  });

  test("household invite code is shown on settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Household" })).toBeVisible();
    await expect(page.locator("text=Invite code")).toBeVisible();
  });
});
