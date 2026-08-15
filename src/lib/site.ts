export const SITE = {
  title: '03white 的数字花园',
  description: '一个持续生长的个人知识花园，记录技术、阅读、项目与思考。',
  author: '03white',
  github: 'https://github.com/03white/digital-garden',
  navLinks: [
    { href: '/', label: '首页' },
    { href: '/posts/', label: '文章' },
    { href: '/notes/', label: '笔记' },
    { href: '/tags/', label: '标签' },
    { href: '/about/', label: '关于' },
  ],
};

export function withBase(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${base}${normalizedPath}`;
}
