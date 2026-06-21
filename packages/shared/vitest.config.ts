import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/*.config.*", "dist/", "node_modules/"],
      // This package is mostly Zod schemas / constants / types, so the
      // function-coverage metric is not meaningful here; gate on the others.
      thresholds: {
        lines: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
