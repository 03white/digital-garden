import { defineConfig } from 'astro/config';

const base = process.env.BASE_PATH ?? '/digital-garden';

export default defineConfig({
  site: process.env.SITE ?? 'https://03white.github.io',
  base,
});
