import { getCollection, type CollectionEntry } from 'astro:content';
import { buildFolderTree, getFolderPath, type FolderNode } from './folder-tree';
import { withBase } from './site';
import { createWikiIndex, normalizeTarget, parseWikiLinks, resolveWikiTarget } from './wiki-links';

export type PostEntry = CollectionEntry<'posts'>;
export type NoteEntry = CollectionEntry<'notes'>;
export type GardenEntry = PostEntry | NoteEntry;
export type GardenCollection = GardenEntry['collection'];

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

const folderTrees = new Map<GardenCollection, FolderNode>();

/**
 * 某个 collection 的归档目录树。
 *
 * 和 `backlinkGraph` 一样做模块级缓存：侧边栏几乎每个页面都要渲染这棵树，
 * 每页重建会变成 O(n²)。
 */
export async function getFolderTree(collection: GardenCollection) {
  const cached = folderTrees.get(collection);

  if (cached) {
    return cached;
  }

  const entries = collection === 'posts' ? await getPublishedPosts() : await getPublishedNotes();
  const tree = buildFolderTree(entries);

  folderTrees.set(collection, tree);

  return tree;
}

/** 条目所在的归档路径，根目录下的条目返回空串。 */
export function getEntryFolderPath(entry: GardenEntry) {
  return getFolderPath(entry.id);
}

/** 归档页地址；根目录退化成 collection 的列表页。 */
export function getFolderUrl(collection: GardenCollection, folderPath: string) {
  return withBase(folderPath === '' ? `/${collection}/` : `/${collection}/${folderPath}/`);
}

let backlinkGraph: Map<string, GardenEntry[]> | undefined;

/**
 * 建一张「被谁引用」的表：key 是被引用条目的 `collection/id`，value 是引用它的条目。
 *
 * 基于 `getPublishedEntries()` 而不是扫文件系统，草稿因此天然被排除。整张图只建一次，
 * 否则每个页面都重算会变成 O(n²)。
 */
async function getBacklinkGraph() {
  if (backlinkGraph) {
    return backlinkGraph;
  }

  const [posts, notes] = await Promise.all([getPublishedPosts(), getPublishedNotes()]);
  // 顺序要和 wiki 链接插件的索引一致（posts 先、notes 后覆盖），
  // 否则两个 collection 里有同名文件时，链接指向和反向链接会对不上。
  const entries: GardenEntry[] = [...posts, ...notes];
  const index = createWikiIndex(entries.map((entry) => [normalizeTarget(entry.id), entry] as const));
  const draftIndex = await getDraftIndex();
  const graph = new Map<string, GardenEntry[]>();

  for (const source of entries) {
    const seen = new Set<string>();

    for (const link of parseWikiLinks(source.body)) {
      const { entry: target, ambiguous } = resolveWikiTarget(link.target, index);

      if (!target) {
        // 断链只警告，不让构建失败——花园里「先埋链接、之后再补内容」是常态。
        const reason = ambiguous
          ? '文件名不唯一，请写完整路径'
          : resolveWikiTarget(link.target, draftIndex).entry
            ? '目标仍是草稿'
            : '找不到目标';
        console.warn(`[wiki-link] ${source.filePath ?? getEntryKey(source)}：[[${link.target}]] ${reason}`);
        continue;
      }

      // 忽略指向自己的链接，以及同一篇里对同一目标的重复引用。
      if (target.id === source.id || seen.has(target.id)) {
        continue;
      }

      seen.add(target.id);
      const key = getEntryKey(target);
      graph.set(key, [...(graph.get(key) ?? []), source]);
    }
  }

  backlinkGraph = graph;

  return graph;
}

/** 用来区分「目标不存在」和「目标存在但还是草稿」，只影响警告文案。 */
async function getDraftIndex() {
  const [allPosts, allNotes] = await Promise.all([getCollection('posts'), getCollection('notes')]);

  return createWikiIndex(
    [...allPosts, ...allNotes]
      .filter(({ data }) => data.draft)
      .map((entry) => [normalizeTarget(entry.id), entry] as const),
  );
}

function getEntryKey(entry: GardenEntry) {
  return `${entry.collection}/${entry.id}`;
}

export async function getBacklinks(entry: GardenEntry) {
  const graph = await getBacklinkGraph();

  return graph.get(getEntryKey(entry)) ?? [];
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
