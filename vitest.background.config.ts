import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/background/**/*.test.ts"],
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
  },
});
