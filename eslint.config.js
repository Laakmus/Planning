import eslint from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  eslint.configs.recommended,
  // TypeScript (.ts/.tsx) — wcześniej nie były lintowane wcale
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      "dist/",
      "node_modules/",
      ".astro/",
      ".claude/",
      "playwright-report/",
      "test-results/",
      // Prototypy/mockupy HTML i TSX (nie są częścią aplikacji)
      "test/",
    ],
  },
  {
    // Tylko kod React (Playwright fixtures też używają funkcji `use`)
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    rules: {
      // Nieużywane zmienne z prefiksem _ są celowe (np. destrukturyzacja)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Testy — mocki Supabase/Astro często wymagają luźnych typów
    files: ["**/__tests__/**", "src/test/**", "e2e/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Skrypty k6 — globalne zmienne runtime k6
    files: ["tests/load/**/*.js"],
    languageOptions: {
      globals: { __ENV: "readonly", __VU: "readonly", __ITER: "readonly", console: "readonly" },
    },
  },
];
