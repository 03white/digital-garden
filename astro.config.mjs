import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';
import { satteri } from '@astrojs/markdown-satteri';
import wikiLinkPlugin from './src/lib/remark-wiki-link';

const base = process.env.BASE_PATH ?? '/digital-garden';

export default defineConfig({
  site: process.env.SITE ?? 'https://03white.github.io',
  base,
  integrations: [sitemap(), pagefind()],
  markdown: {
    // Astro 7 起 Sätteri 是默认的 Markdown 处理器，扩展点是 mdast/hast 插件，
    // 而不是旧的 markdown.remarkPlugins（那条路要另外装 @astrojs/markdown-remark）。
    processor: satteri({ mdastPlugins: [wikiLinkPlugin] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
