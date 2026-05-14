import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    // Postgres integration tests share a single container and mutate the same table.
    // Running files in parallel causes race conditions; sequential execution is required.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
