import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: [".next/**", ".open-next/**", "coverage/**", "playwright-report/**", "test-results/**"],
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/features/*/**"],
          message: "App routes must import a feature through its public index.ts entry point.",
        }],
      }],
    },
  },
  {
    files: ["features/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/features/resume/**", "@/features/applications/**"],
          message: "Shared modules cannot depend on product-specific features.",
        }],
      }],
    },
  },
  {
    files: ["features/resume/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/features/applications/**"],
          message: "Resume modules cannot import application feature internals.",
        }],
      }],
    },
  },
  {
    files: ["features/applications/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/features/resume/**"],
          message: "Application modules cannot import resume feature internals.",
        }],
      }],
    },
  },
];

export default config;
