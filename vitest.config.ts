import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run against shared sources, so they never depend on a stale build.
const sharedSrc = fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@czyzyk/shared": sharedSrc } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["packages/*/src/**/*.test.ts", "services/*/src/**/*.test.ts", "services/*/eval/**/*.test.ts", "scripts/**/*.test.ts"],
          exclude: ["**/*.db.test.ts", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["supabase/tests/**/*.test.ts", "services/*/src/**/*.db.test.ts", "tests/**/*.db.test.ts", "scripts/**/*.db.test.ts"],
          environment: "node",
          // Every db test file creates its own database, but they share one server.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      "apps/pwa/vitest.config.ts",
    ],
  },
});
