import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { defineMdastPlugin } from 'satteri';
import { createWikiIndex, normalizeTarget, resolveWikiTarget, splitByWikiLink } from './wiki-links';

/**
 * 构建期把正文里的 `[[目标]]` 转成真正的链接。
 *
 * 这是一个 Sätteri mdast 插件（Astro 7 起 Sätteri 是默认的 Markdown 处理器）。
 * 只订阅 text 节点，所以 code / inlineCode 不会被碰到——代码块和行内代码里的
 * `[[nodiscard]]` 是安全的。
 */

const COLLECTIONS = [
  { collection: 'posts', dir: path.join('src', 'content', 'posts') },
  { collection: 'notes', dir: path.join('src', 'content', 'notes') },
] as const;

// posts/templates/ 落在 posts collection 的 glob 范围内，但它们不是真正的文章。
// 只挡 collection 根下这一个目录：文件夹现在是归档功能，深层的 templates/ 是合法归档。
const IGNORED_ROOT_DIRECTORIES = new Set(['templates']);

// base 和 astro.config.mjs 读的是同一个环境变量，改部署路径时两处要一起改。
const BASE = (process.env.BASE_PATH ?? '/digital-garden').replace(/\/$/, '');

interface IndexedEntry {
  collection: string;
  id: string;
  draft: boolean;
}

function listMarkdownFiles(directory: string, prefix = ''): string[] {
  let dirents;

  try {
    dirents = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const dirent of dirents) {
    if (dirent.isDirectory()) {
      if (prefix !== '' || !IGNORED_ROOT_DIRECTORIES.has(dirent.name)) {
        files.push(...listMarkdownFiles(path.join(directory, dirent.name), `${prefix}${dirent.name}/`));
      }

      continue;
    }

    if (/\.mdx?$/.test(dirent.name)) {
      files.push(`${prefix}${dirent.name}`);
    }
  }

  return files;
}

function readDraftFlag(filePath: string) {
  // 只看第一个 frontmatter 块，不引 YAML 库。开头的 ﻿ 是因为
  // 这个仓库里部分 Markdown 带 UTF-8 BOM。
  const frontmatter = readFileSync(filePath, 'utf8').match(/^﻿?---\r?\n([\s\S]*?)\r?\n---/);

  return frontmatter ? /^draft:\s*true\s*$/m.test(frontmatter[1]) : false;
}

/**
 * 不做缓存：内容目前只有十几个文件，每篇 Markdown 重扫一次的开销可以忽略，
 * 换来的是 astro dev 下新建文件立刻能被链接到，不用重启。
 */
function buildEntryIndex() {
  const items: (readonly [string, IndexedEntry])[] = [];

  for (const { collection, dir } of COLLECTIONS) {
    const absoluteDir = path.join(process.cwd(), dir);

    for (const relativePath of listMarkdownFiles(absoluteDir)) {
      const id = normalizeTarget(relativePath.replace(/\.mdx?$/, ''));

      items.push([
        id,
        { collection, id, draft: readDraftFlag(path.join(absoluteDir, relativePath)) },
      ] as const);
    }
  }

  // createWikiIndex 里后写的覆盖先写的，所以 COLLECTIONS 的顺序（posts 先、notes 后）
  // 决定了同名冲突的归属。getBacklinkGraph() 那边用的是同一套规则，两处要一起改。
  return createWikiIndex(items);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default defineMdastPlugin({
  name: 'wiki-link',
  text(node, context) {
    const segments = splitByWikiLink(node.value);

    if (!segments.some((segment) => segment.type === 'link')) {
      return;
    }

    const index = buildEntryIndex();

    const replacements = segments.map((segment) => {
      if (segment.type === 'text') {
        return { type: 'text' as const, value: segment.value };
      }

      const { entry, ambiguous } = resolveWikiTarget(segment.target, index);

      if (!entry || entry.draft) {
        // 这里只负责渲染成灰色虚链，不负责报警：访问器是从 Rust 侧回调的，
        // console 输出不会进到 Astro 的构建日志。断链警告由 lib/content.ts
        // 在建反向链接图时统一打出来。
        const reason = entry ? '目标仍是草稿' : ambiguous ? '文件名不唯一，请写完整路径' : '找不到目标';

        return {
          rawHtml: `<span class="wiki-link-broken" title="${escapeHtml(`${reason}：${segment.target}`)}">${escapeHtml(segment.display)}</span>`,
        };
      }

      return {
        type: 'link' as const,
        url: `${BASE}/${entry.collection}/${entry.id}/`,
        data: { hProperties: { className: ['wiki-link'] } },
        children: [{ type: 'text' as const, value: segment.display }],
      };
    });

    context.insertBefore(node, replacements);
    context.removeNode(node);
  },
});
