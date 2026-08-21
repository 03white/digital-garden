import { slug as githubSlug } from 'github-slugger';

/**
 * Wiki 链接语法：
 *
 * - `[[cmake预设]]`               链接到文件名为 cmake预设.md 的内容
 * - `[[cmake预设|CMake 预设文件]]`  自定义显示文本
 *
 * 这个模块只做纯字符串解析，不碰文件系统，因此 `lib/content.ts` 和构建期的
 * remark 插件可以共用同一套规则。
 */

const WIKI_LINK_PATTERN = /\[\[([^[\]|]+?)(?:\|([^[\]]*?))?\]\]/g;

const FENCED_CODE_PATTERN = /^(?:```|~~~)[\s\S]*?^(?:```|~~~)[^\n]*$/gm;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;

export interface WikiLink {
  target: string;
  display: string;
}

export type WikiSegment = { type: 'text'; value: string } | ({ type: 'link' } & WikiLink);

/**
 * Astro 的 glob loader 生成 entry.id 的方式是把路径每一段丢给 github-slugger，
 * 再用 `/` 连接。它会转小写但保留 CJK，所以 `CPP11异步回调.md` 的 id 是
 * `cpp11异步回调`。这里必须用同一个函数，否则 wiki 链接会解析不到目标。
 */
export function normalizeTarget(target: string) {
  return target
    .trim()
    .split('/')
    .filter(Boolean)
    .map((segment) => githubSlug(segment))
    .join('/');
}

export interface WikiIndex<T> {
  byId: Map<string, T>;
  /** 键是 id 的最后一段；值为 null 表示这个文件名在全站重复，不能省略路径。 */
  byBasename: Map<string, T | null>;
}

/**
 * 建一份 wiki 链接的查找表。传入的 `[id, value]` 顺序即优先级，后面的覆盖前面的
 * （全站是 posts 先、notes 后）。
 */
export function createWikiIndex<T>(items: Iterable<readonly [string, T]>): WikiIndex<T> {
  const byId = new Map<string, T>(items);
  const basenameOwners = new Map<string, string>();
  const byBasename = new Map<string, T | null>();

  for (const [id, value] of byId) {
    const basename = id.split('/').pop() ?? id;
    const owner = basenameOwners.get(basename);

    if (owner !== undefined && owner !== id) {
      byBasename.set(basename, null);
      continue;
    }

    basenameOwners.set(basename, id);
    byBasename.set(basename, value);
  }

  return { byId, byBasename };
}

/**
 * 解析 `[[目标]]`：先按完整路径精确匹配，未命中再按文件名找。
 *
 * 文件名回退是为了让内容能自由挪进文件夹而不打断已有链接——`[[async-callback]]`
 * 在文件被移到 `cpp/` 之后仍然有效。代价是文件名重复时必须写全路径，这种情况
 * 返回 `ambiguous`，由调用方给出更具体的提示。
 */
export function resolveWikiTarget<T>(target: string, index: WikiIndex<T>) {
  const normalized = normalizeTarget(target);
  const exact = index.byId.get(normalized);

  if (exact !== undefined) {
    return { entry: exact, ambiguous: false };
  }

  // 带斜杠说明作者写的就是完整路径，没命中就是没命中，不该再退回文件名匹配。
  if (normalized.includes('/')) {
    return { entry: undefined, ambiguous: false };
  }

  const byBasename = index.byBasename.get(normalized);

  return { entry: byBasename ?? undefined, ambiguous: byBasename === null };
}

/** 把一段纯文本切成普通文本和 wiki 链接交替出现的片段。 */
export function splitByWikiLink(value: string): WikiSegment[] {
  const segments: WikiSegment[] = [];
  const pattern = new RegExp(WIKI_LINK_PATTERN.source, 'g');
  let lastIndex = 0;

  for (const match of value.matchAll(pattern)) {
    const target = match[1].trim();

    if (!target) {
      continue;
    }

    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    }

    segments.push({ type: 'link', target, display: match[2]?.trim() || target });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', value: value.slice(lastIndex) });
  }

  return segments;
}

/**
 * 从整篇 Markdown 原文里抽出所有 wiki 链接，用来建反向链接索引。
 *
 * 必须先剥掉代码块和行内代码：这是个 C++ 博客，`[[nodiscard]]` 这类属性
 * 不能被当成 wiki 链接。（渲染侧不需要这一步，remark 插件只访问 text 节点，
 * code / inlineCode 节点天然不会被碰到。）
 */
export function parseWikiLinks(markdown: string | undefined): WikiLink[] {
  if (!markdown) {
    return [];
  }

  const prose = markdown.replace(FENCED_CODE_PATTERN, '').replace(INLINE_CODE_PATTERN, '');

  return splitByWikiLink(prose).filter((segment): segment is { type: 'link' } & WikiLink => segment.type === 'link');
}
