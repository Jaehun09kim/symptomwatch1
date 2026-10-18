import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated artifacts
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    ".data/**",
    // Local git worktrees (parallel branches checked out inside the repo)
    ".worktrees/**",
    "src/lib/db/migrations.generated.ts",
  ]),
]);

export default eslintConfig;
