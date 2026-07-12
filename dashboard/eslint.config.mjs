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
    // Generated Prisma client — not hand-written, not our style to enforce.
    "src/generated/**",
    // Node maintenance scripts and node:test suites intentionally use CommonJS.
    "scripts/**",
    "tests/**",
    // Static assets served as-is; any script placed here is a build artifact, not source.
    "public/**",
  ]),
  {
    rules: {
      // The dashboard still contains API-boundary payloads whose shape is supplied by Discord/Prisma.
      // Keep lint useful while these types are migrated incrementally.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      // These React 19 advisory rules are not correctness failures in the existing client boundaries.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);

export default eslintConfig;
