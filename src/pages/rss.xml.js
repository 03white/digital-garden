import rss from '@astrojs/rss';
import { SITE } from '../lib/site';
import { getEntryDescription, getEntryPublishedDate, getEntryUrl, getPublishedPosts } from '../lib/content';

export async function GET(context) {
  const posts = await getPublishedPosts();

  return rss({
    title: `${SITE.title} · 文章`,
    description: SITE.description,
    // context.site 只是站点域名（不含 base），拼上 BASE_URL 才是花园首页，
    // 否则 RSS 频道的 <link> 会指向 03white.github.io 根目录。
    // item 的 link 走 getEntryUrl()，本身已经带了 base。
    site: new URL(import.meta.env.BASE_URL, context.site),
    items: posts.map((post) => ({
      title: post.data.title,
      description: getEntryDescription(post),
      pubDate: getEntryPublishedDate(post),
      link: getEntryUrl(post),
      categories: post.data.tags,
    })),
    customData: '<language>zh-CN</language>',
  });
}
