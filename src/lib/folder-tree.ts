import type { GardenEntry } from './content';
import { getFolderLabel } from './site';

/**
 * 归档目录树。
 *
 * 「文件夹」不是一个额外的 frontmatter 字段，而就是 `src/content/<collection>/` 下的
 * 真实目录：`notes/cpp/async.md` 的 `entry.id` 是 `cpp/async`，URL 是 `/notes/cpp/async/`，
 * 归档路径是 `cpp`。三者同源，不会漂移。
 *
 * 和 `wiki-links.ts` 一样，这个模块只做纯数据变换、不碰文件系统也不查 collection，
 * 因此侧边栏、归档页和 `getStaticPaths()` 可以共用同一套规则。
 */

export interface FolderNode {
  /** 归一化后的完整路径，根节点是空串。 */
  path: string;
  /** 路径最后一段，根节点是空串。 */
  name: string;
  /** 显示名，走 `FOLDER_LABELS`。 */
  label: string;
  /** 子目录，按 label 排序。 */
  folders: FolderNode[];
  /** 直属条目，保持传入顺序（调用方已按 `getEntryDate` 降序排好）。 */
  entries: GardenEntry[];
  /** 含所有子目录的递归条目总数。 */
  count: number;
}

/** `cpp/async/callback` -> `['cpp', 'async']`；根目录下的条目得到 `[]`。 */
export function getFolderSegments(id: string) {
  return id.split('/').filter(Boolean).slice(0, -1);
}

/** `cpp/async/callback` -> `cpp/async`；根目录下的条目得到空串。 */
export function getFolderPath(id: string) {
  return getFolderSegments(id).join('/');
}

/** 判断 `folderPath` 是不是 `descendantPath` 自己或它的祖先——决定 `<details open>`。 */
export function isAncestorPath(folderPath: string, descendantPath: string) {
  if (folderPath === '') {
    return true;
  }

  return descendantPath === folderPath || descendantPath.startsWith(`${folderPath}/`);
}

function createNode(path: string): FolderNode {
  return {
    path,
    name: path.split('/').pop() ?? '',
    label: path === '' ? '' : getFolderLabel(path),
    folders: [],
    entries: [],
    count: 0,
  };
}

/**
 * 把一批条目按 id 里的目录层级折成一棵树。
 *
 * 条目顺序原样保留，所以传进来的数组必须已经排好序；文件夹则按 label 排，
 * 让侧边栏的目录顺序稳定、和内容更新时间无关。
 */
export function buildFolderTree(entries: GardenEntry[]): FolderNode {
  const root = createNode('');
  const nodes = new Map<string, FolderNode>([['', root]]);

  for (const entry of entries) {
    let current = root;
    let path = '';

    for (const segment of getFolderSegments(entry.id)) {
      path = path === '' ? segment : `${path}/${segment}`;

      let next = nodes.get(path);

      if (!next) {
        next = createNode(path);
        nodes.set(path, next);
        current.folders.push(next);
      }

      current = next;
    }

    current.entries.push(entry);
  }

  sortAndCount(root);

  return root;
}

/** 递归排序子目录并回填 count，返回该子树的条目总数。 */
function sortAndCount(node: FolderNode) {
  node.folders.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
  node.count = node.entries.length + node.folders.reduce((total, folder) => total + sortAndCount(folder), 0);

  return node.count;
}

/** 深度优先列出所有文件夹路径（不含根），给 `getStaticPaths()` 生成归档页用。 */
export function flattenFolderPaths(node: FolderNode): string[] {
  return node.folders.flatMap((folder) => [folder.path, ...flattenFolderPaths(folder)]);
}

export function findFolder(node: FolderNode, path: string): FolderNode | undefined {
  if (node.path === path) {
    return node;
  }

  for (const folder of node.folders) {
    if (isAncestorPath(folder.path, path)) {
      return findFolder(folder, path);
    }
  }

  return undefined;
}

/** 面包屑用：`cpp/async` -> `[{ path: 'cpp', ... }, { path: 'cpp/async', ... }]`。 */
export function getFolderTrail(path: string) {
  const segments = path.split('/').filter(Boolean);

  return segments.map((_, index) => {
    const trailPath = segments.slice(0, index + 1).join('/');

    return { path: trailPath, label: getFolderLabel(trailPath) };
  });
}
