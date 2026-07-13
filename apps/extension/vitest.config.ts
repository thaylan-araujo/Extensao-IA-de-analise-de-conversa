import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    // singleFork: run all test files in one worker process to avoid the cold-disk
    // I/O issue (happy-dom import can take 2m41s per worker on a full disk —
    // documented in 02-04-SUMMARY.md). A single fork imports happy-dom once and
    // re-uses the same process for all test files. In Vitest 4, this is a
    // top-level option (poolOptions was removed in v4 — see migration guide).
    singleFork: true,
  },
});
