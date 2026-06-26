import { defineConfig } from "vitest/config";

// Local config keeps the test run hermetic to this package (so vitest never
// resolves a config from an ancestor directory).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
