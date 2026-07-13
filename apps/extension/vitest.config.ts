import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    // Use vmThreads pool to avoid cold disk I/O worker timeout issue.
    // Default forks pool spawns a new process per test file; on a nearly-full
    // disk, happy-dom import takes 2m41s per worker, exceeding the 60s connect
    // timeout. vmThreads shares the same Node process and avoids the per-worker
    // startup overhead (documented in 02-04-SUMMARY.md).
    pool: "vmThreads",
  },
});
