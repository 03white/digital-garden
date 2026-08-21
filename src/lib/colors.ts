/**
 * 携带信息的颜色：标签色相和编程语言色点。
 *
 * 站点底色是中性的，颜色只出现在强调位。这个模块管的是**其中有含义的那部分**——
 * 同一个标签在任何页面都该是同一个颜色，C++ 就该是 GitHub 上那个粉色。
 * 纯装饰性的强调色（渐变、当前项高亮）走 CSS 变量，不在这里。
 */

/** 绿色被明确排除在配色之外，色相分配要跳过这一段。 */
const GREEN_START = 90;
const GREEN_END = 160;
const GREEN_SPAN = GREEN_END - GREEN_START;

/**
 * 名字 → 稳定色相。
 *
 * 饱和度和明度由 CSS 的 `--tag-s` / `--tag-l` 统一给，深浅色主题各一套，
 * 所以这里只需要产出色相，整组标签自然和谐。
 *
 * 值域是 0–89 和 160–359：中间那段绿色整体跳过，不是把它夹到边界上——
 * 夹的话所有本该是绿的标签会挤成同一个颜色。
 */
export function getTagHue(name: string) {
  // FNV-1a 的 32 位变体：短字符串上分布比 hash*31 均匀，同名必定同色。
  let hash = 0x811c9dc5;

  for (const char of name.toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const hue = hash % (360 - GREEN_SPAN);

  return hue < GREEN_START ? hue : hue + GREEN_SPAN;
}

/** GitHub linguist 的语言配色，只收本站可能出现的。缺失时回退到中性灰。 */
const LANGUAGE_COLORS: Record<string, string> = {
  'c++': '#f34b7d',
  c: '#555555',
  'c#': '#178600',
  astro: '#ff5a03',
  typescript: '#3178c6',
  javascript: '#f1e05a',
  python: '#3572a5',
  java: '#b07219',
  go: '#00add8',
  rust: '#dea584',
  html: '#e34c26',
  css: '#563d7c',
  scss: '#c6538c',
  shell: '#89e051',
  cmake: '#da3434',
  makefile: '#427819',
  lua: '#000080',
  qml: '#44a51c',
  vue: '#41b883',
  svelte: '#ff3e00',
  dockerfile: '#384d54',
  glsl: '#5686a5',
  hlsl: '#aace60',
  jupyter: '#da5b0b',
  kotlin: '#a97bff',
  swift: '#f05138',
  php: '#4f5d95',
  ruby: '#701516',
  markdown: '#083fa1',
  vim: '#199f4b',
};

const LANGUAGE_FALLBACK = '#8b8b93';

export function getLanguageColor(language: string | null | undefined) {
  if (!language) {
    return LANGUAGE_FALLBACK;
  }

  return LANGUAGE_COLORS[language.toLowerCase()] ?? LANGUAGE_FALLBACK;
}
