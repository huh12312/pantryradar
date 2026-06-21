import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "src/test/**", "**/*.config.*", "src/main.tsx"],
      // Baseline ratchet set just under current coverage to prevent regressions.
      // Raise toward the 80% target as untested flows (HouseSelector, SettingsPage,
      // Sidebar) gain tests.
      thresholds: {
        statements: 59,
        branches: 50,
        functions: 48,
        lines: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
