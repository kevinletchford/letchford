// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import glsl from 'vite-plugin-glsl'

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
    trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss(),         
              glsl()],
  },

  integrations: [react()],
});