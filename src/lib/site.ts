export const SITE = {
  title: '03white 的数字花园',
  description: '一个持续生长的个人知识花园，记录技术、阅读、项目与思考。',
  author: '03white',
  /** 首页轮播按这个用户名去 GitHub 拉公开仓库。 */
  githubUser: '03white',
  github: 'https://github.com/03white/digital-garden',
  navLinks: [
    { href: '/', label: '首页' },
    { href: '/posts/', label: '文章' },
    { href: '/notes/', label: '笔记' },
    { href: '/tags/', label: '标签' },
    { href: '/search/', label: '搜索' },
    { href: '/about/', label: '关于' },
  ],
};

/**
 * 文件夹归档的显示名。键是归一化后的**完整**路径（不是单段），
 * 所以 `cpp/async` 和 `python/async` 可以取不同的名字。
 *
 * 目录名本身受 slug 规则约束只能是小写英文，中文标题靠这张表补上。
 * 没配也不报错，直接回退到目录名——新建文件夹不必先来这里登记。
 */
export const FOLDER_LABELS: Record<string, string> = {
  cpp: 'C++',
  'build-tools': '构建工具',
};

export function getFolderLabel(folderPath: string) {
  return FOLDER_LABELS[folderPath] ?? folderPath.split('/').pop() ?? folderPath;
}

/**
 * GitHub API 拉不到时用的兜底仓库列表（限流、离线、被墙都会走到这里）。
 *
 * 构建**不会**因为拉不到而失败，只会退回这张表并打一条 warn。想让首页轮播
 * 在任何情况下都有内容，就把想展示的项目手写在这里；API 正常时会被真实数据覆盖。
 */
export const FALLBACK_REPOS = [
  {
    name: 'digital-garden',
    description: '这个站点本身：Astro 静态博客 / 数字花园。',
    url: 'https://github.com/03white/digital-garden',
    language: 'Astro',
    stars: 0,
    topics: ['astro', 'blog'],
  },
];

export function withBase(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${base}${normalizedPath}`;
}
