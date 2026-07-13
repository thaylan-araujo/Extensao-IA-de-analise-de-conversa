import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    // vmThreads: worker_threads instead of child_process forks — avoids the
    // 60s fork-connect timeout that fires when happy-dom cold-import takes >2min
    // on this machine. isolate: false shares the module cache across files so
    // happy-dom is imported only once per run.
    // @vitest-environment node annotations in individual test files still work.
    pool: "vmThreads",
    isolate: false,
  },
});
