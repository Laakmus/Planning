import eslint from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  eslint.configs.recommended,
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
    ],
  },
  {
    // Skrypty k6 — globalne zmienne runtime k6
    files: ["tests/load/**/*.js"],
    languageOptions: {
      globals: { __ENV: "readonly", __VU: "readonly", __ITER: "readonly", console: "readonly" },
    },
  },
];
