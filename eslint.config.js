import eslint from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  eslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ["dist/", "node_modules/", ".astro/"],
  },
];
