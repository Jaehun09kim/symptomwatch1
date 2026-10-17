import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "src"),
      // `server-only` throws outside React Server Components; tests run server code directly.
      "server-only": resolve(process.cwd(), "tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    maxWorkers: 2,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.{test,spec}.{ts,tsx}"],
          setupFiles: ["tests/helpers/jest-dom.ts"],
        },
      },
    ],
  },
});
