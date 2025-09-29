// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import glsl from 'vite-plugin-glsl'

import react from "@astrojs/react";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss(),         
              glsl()],
  },

  integrations: [react()],
  adapter: cloudflare(),
});