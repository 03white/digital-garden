import rss from '@astrojs/rss';
import { SITE } from '../../lib/site';
import { getEntryDate, getEntryDescription, getEntryUrl, getPublishedNotes } from '../../lib/content';

export async function GET(context) {
  const notes = await getPublishedNotes();

  return rss({
    title: `${SITE.title} · 笔记`,
    description: '花园里持续生长的笔记，内容会反复修改。',
    site: new URL(import.meta.env.BASE_URL, context.site),
    items: notes.map((note) => ({
      title: note.data.title,
      description: getEntryDescription(note),
      // 笔记用最后更新时间，这样重新耕耘过的笔记会在订阅器里重新浮上来。
      pubDate: getEntryDate(note),
      link: getEntryUrl(note),
      categories: note.data.tags,
    })),
    customData: '<language>zh-CN</language>',
  });
}
