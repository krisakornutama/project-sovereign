import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  output: 'static',
  adapter: undefined,
  site: 'https://sovereignoriginshop.dpdns.org',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    css: {
      postcss: {
        plugins: [
          await import('@tailwindcss/postcss').then(m => m.default()),
        ],
      },
    },
  },
});