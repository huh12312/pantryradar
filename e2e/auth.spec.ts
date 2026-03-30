import { test } from "@playwright/test";

/**
 * E2E Tests: Authentication Flow
 *
 * These are skeleton tests that will be implemented once the auth UI exists.
 * Following TDD principles: tests are written first, implementation comes later.
 */

test.describe("Authentication Flow", () => {
  test.describe("Sign Up", () => {
    test.skip("should sign up with email and create household", async ({ page }) => {
      // Navigate to sign up page
      // Fill in email
      // Fill in password
      // Fill in household name
      // Submit form
      // Expect to be redirected to dashboard
      // Expect household to be created
      // Expect user to be logged in
    });

    test.skip("should validate email format", async ({ page }) => {
      // Navigate to sign up page
      // Enter invalid email
      // Submit form
      // Expect validation error
    });

    test.skip("should require password", async ({ page }) => {
      // Navigate to sign up page
      // Leave password empty
      // Submit form
      // Expect validation error
    });

    test.skip("should require household name", async ({ page }) => {
      // Navigate to sign up page
      // Leave household name empty
      // Submit form
      // Expect validation error
    });
  });

  test.describe("Sign In", () => {
    test.skip("should sign in with existing credentials", async ({ page }) => {
      // Navigate to sign in page
      // Fill in email
      // Fill in password
      // Submit form
      // Expect to be redirected to dashboard
      // Expect to see user's items
    });

    test.skip("should show error for invalid credentials", async ({ page }) => {
      // Navigate to sign in page
      // Fill in wrong email/password
      // Submit form
      // Expect error message
    });

    test.skip("should remember user session", async ({ page, context }) => {
      // Sign in
      // Close browser
      // Reopen browser
      // Expect to still be logged in
    });
  });

  test.describe("Sign Out", () => {
    test.skip("should sign out successfully", async ({ page }) => {
      // Sign in first
      // Click sign out button
      // Expect to be redirected to sign in page
      // Expect session to be cleared
    });
  });
});
