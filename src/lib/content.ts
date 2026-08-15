import { getCollection, type CollectionEntry } from 'astro:content';
import { withBase } from './site';

export type PostEntry = CollectionEntry<'posts'>;
export type NoteEntry = CollectionEntry<'notes'>;
export type GardenEntry = PostEntry | NoteEntry;

export async function getPublishedPosts() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);

  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getPublishedNotes() {
  const notes = await getCollection('notes', ({ data }) => !data.draft);

  return notes.sort((a, b) => getEntryDate(b).valueOf() - getEntryDate(a).valueOf());
}

export async function getPublishedEntries() {
  const [posts, notes] = await Promise.all([getPublishedPosts(), getPublishedNotes()]);

  return [...posts, ...notes].sort((a, b) => getEntryDate(b).valueOf() - getEntryDate(a).valueOf());
}

export async function getAllTags() {
  const entries = await getPublishedEntries();
  const tagCounts = new Map<string, number>();

  for (const entry of entries) {
    for (const tag of entry.data.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function getEntriesByTag(tag: string) {
  const entries = await getPublishedEntries();

  return entries.filter((entry) => entry.data.tags.includes(tag));
}

export function getEntryDate(entry: GardenEntry) {
  if (entry.collection === 'posts') {
    return entry.data.updatedDate ?? entry.data.pubDate;
  }

  return entry.data.updatedDate ?? entry.data.createdDate;
}

export function getEntryPublishedDate(entry: GardenEntry) {
  if (entry.collection === 'posts') {
    return entry.data.pubDate;
  }

  return entry.data.createdDate;
}

export function getEntryDescription(entry: GardenEntry) {
  return entry.data.description ?? '这是一条仍在生长中的花园笔记。';
}

export function getEntryUrl(entry: GardenEntry) {
  const collectionPath = entry.collection === 'posts' ? 'posts' : 'notes';

  return withBase(`/${collectionPath}/${entry.id}/`);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getNoteStatusLabel(status: NoteEntry['data']['status']) {
  const labels = {
    seedling: '种子',
    growing: '生长中',
    evergreen: '常青',
  };

  return labels[status];
}
