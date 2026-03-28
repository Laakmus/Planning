// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),

  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        // @sentry/node i powiązane moduły Node.js — tylko server-side, wykluczamy z client bundla
        external: [
          "@sentry/node",
          "@sentry/node-core",
        ],
      },
    },
  },

  integrations: [react()]
});