# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 Astro 7 的个人静态博客 / 数字花园，构建后部署到 GitHub Pages。没有前端框架（无 React/Vue）、没有 CSS 框架、没有测试框架——全部是 Astro 组件 + 手写 CSS。

## 常用命令

```bash
npm run dev        # 开发服务器，http://localhost:4321/digital-garden/
npm run build      # astro check && astro build
npm run check      # 只做类型 / 内容 schema 校验
npm run preview    # 预览 dist/
npm run new        # 交互式创建文章或笔记
```

本项目没有测试套件。`npm run check`（即 `astro check`）是唯一的自动化校验，它同时检查 TypeScript 类型和所有 Markdown 的 frontmatter 是否符合 collection schema。改完内容或组件后跑它。

注意 `astro check` 会把 `.astro` 里的 `<script>` 当 TypeScript 检查，客户端脚本里的参数也要标类型，否则会因 `noImplicitAny` 报错。

搜索索引是 `astro build` 的产物。改完内容后 `/search/` 的结果要跑一次 `npm run build` 才会更新，`astro dev` 用的是上一次构建留下的索引。

调试 Markdown 渲染时注意内容层有缓存：改了 remark/mdast 插件但看不到效果，删掉 `.astro/` 再构建。

## 内容模型

两个 content collection，schema 定义在 `src/content.config.ts`：

| | posts | notes |
|---|---|---|
| 目录 | `src/content/posts/` | `src/content/notes/` |
| 日期字段 | `pubDate`（必填）+ `updatedDate`（可选） | `createdDate`（必填）+ `updatedDate`（可选） |
| 描述 | `description` 必填 | `description` 可选 |
| 独有字段 | — | `status`: `seedling` / `growing` / `evergreen` |
| 路由 | `/posts/<id>/` | `/notes/<id>/` |

两者都有 `tags: string[]` 和 `draft: boolean`。

`<id>` 里可以含斜杠——子目录就是归档，见「归档目录」。所以两个 collection 的详情页都是 `[...slug].astro` 而不是 `[slug].astro`。

**`draft: true` 是唯一的发布开关。** 所有查询函数（`getPublishedPosts` / `getPublishedNotes`）和所有 `getStaticPaths` 都按 `!data.draft` 过滤，草稿不会生成页面。

## 架构要点

### `src/lib/content.ts` 是内容访问的唯一入口

posts 和 notes 的字段不一样，但 UI 上（`PostCard`、`ContentLayout`、标签页、首页）需要混着渲染。这一层把差异全部吸收掉：

- `getEntryDate()` — 排序用的"最近活动时间"，posts 取 `updatedDate ?? pubDate`，notes 取 `updatedDate ?? createdDate`
- `getEntryPublishedDate()` — 首次发布时间
- `getEntryDescription()` — notes 的 description 可选，这里兜底
- `getEntryUrl()` — 按 collection 拼路径并套上 base
- `getPublishedEntries()` — 合并两个 collection 后统一按 `getEntryDate` 排序，标签页和 `getAllTags()` 都基于它

新增页面或组件时走这些函数，不要直接 `getCollection()` 后自己判断 collection 类型。类型上用 `GardenEntry`（`PostEntry | NoteEntry`），在组件里靠 `entry.collection === 'notes'` 收窄。

### base path 必须走 `withBase()`

站点部署在 `/digital-garden` 子路径下（`astro.config.mjs`，可由 `BASE_PATH` 环境变量覆盖）。所有内部链接都要用 `src/lib/site.ts` 的 `withBase('/posts/')`，写死 `href="/posts/"` 在生产环境会 404。`SITE.navLinks` 里存的是不带 base 的路径，由 `Header.astro` 渲染时套上。

这个 base 有四处独立来源，改部署路径时要一起改：

| 位置 | 取值方式 |
|---|---|
| `astro.config.mjs` | `process.env.BASE_PATH` |
| `src/lib/site.ts` 的 `withBase()` | `import.meta.env.BASE_URL` |
| `src/lib/remark-wiki-link.ts` | `process.env.BASE_PATH`（remark 插件里拿不到 `import.meta.env`） |
| `src/pages/search.astro` 的客户端脚本 | `import.meta.env.BASE_URL` |

三个已知的 base 陷阱：

- **RSS**：`context.site` 只是域名，不含 base。频道 `<link>` 要用 `new URL(import.meta.env.BASE_URL, context.site)`，每条 item 的 `link` 要走 `getEntryUrl()`。
- **Pagefind**：`dist/` 的根就是 base 的根，索引里的 URL 不含 base，所以要 `pagefind.options({ baseUrl: import.meta.env.BASE_URL })`。
- **Pagefind 的动态 import**：`pagefind.js` 是构建产物，Vite 静态分析时还不存在，必须加 `/* @vite-ignore */`。

### 页面骨架：通栏顶栏 + 两种容器

`BaseLayout.astro` 渲染固定顶栏、`<main class="site-main">`、页脚，本身不限宽。内容宽度由 `wide` prop 决定：

- `wide`（笔记/文章的详情页、列表页、归档页）—— 页面自己渲染 `.docs-layout` 三栏。
- 默认 —— 套一层 `.page-container`（`min(100% - 2rem, 960px)` 居中），首页、标签页、关于页、搜索页走这条。

三栏是 `.docs-layout`：左 `.docs-sidebar`（归档树）、中 `.docs-main`、右 `.docs-toc`（页内目录）。没有页内目录的页面加 `.no-toc` 变两栏。两侧栏都带 `.docs-rail`（sticky + `height: calc(100vh - var(--header-h))` + 独立滚动）。栏宽和顶栏高度是 `:root` 里的 `--sidebar-w` / `--toc-w` / `--header-h`，改一处即可。

`.docs-main > *` 给每个直接子元素统一限宽居中（860px），所以归档页那种多 `<section>` 并列的结构也能左右对齐。

响应式按重要性依次让位：`≤1280px` 撤右栏 → `≤1000px` 塌成单栏、左栏变「目录」开关 → `≤980px` 撤顶栏搜索框（导航里本来就有「搜索」）→ `≤680px` 藏站名文字、导航横向滚动、主题键只剩图标。**顶栏是固定高度的，窄屏不能让它换行。**

背景图的遮罩是两层渐变叠加，实际透过率 `(1-上层α)×(1-下层α)`。改成通栏后横向梯度已拉平并整体加厚到透过率 ≈6%——以前那套右侧偏透的值是为 960px 居中布局调的，通栏下会直接压着正文。

### BaseLayout 里的四段 inline script

全站的客户端 JS 集中在 `src/layouts/BaseLayout.astro`，都是 `is:inline`（因此不进 `astro check` 的 TS 检查）：

1. `<head>` 中的第一段在页面渲染前同步执行，读 `localStorage['digital-garden-theme']`（没有则读 `prefers-color-scheme`），设置 `document.documentElement.dataset.theme`。这段不能改成异步或移到 body，否则会闪白。
2. `</body>` 前绑定 `[data-theme-toggle]` 按钮，同步图标、文案和 `aria-pressed`。
3. 窄屏首次加载时收起 `[data-folder-nav]`；以及右栏 `[data-toc]` 的阅读进度和当前章节高亮（滚动事件 + `requestAnimationFrame` 节流，取最后一个滚过顶栏的标题）。
4. `[data-meteors]` 流星雨画布，见下。

另有一段在 `RepoCarousel.astro` 里（轮播箭头/圆点/自动播放），那是普通 `<script>`，会过 TS 检查。

目录树本身**没有** JS——展开收起是原生 `<details>`。没有第 3 段脚本时，页内目录仍是一组可用的锚点链接。

### 流星雨背景

`[data-meteors]` 是一张 `position: fixed; z-index: -1` 的 canvas，夹在背景图（-2）和正文之间，全站每页都跑。

**它不只是装饰——卡片的 `backdrop-filter` 靠它才有东西可模糊。** 背景如果是一片纯色，毛玻璃就是纯开销没有效果。改动其中一个之前想想另一个。

脚本的三条纪律，删任何一条都会变成用户能感知的问题：

- `prefers-reduced-motion: reduce` 时直接不启动（并监听后续变化）。
- `visibilitychange` 时 `cancelAnimationFrame`，切走标签页不空转。
- 颜色从 `--color-accent` / `--color-accent-2` / `--color-text` 读，不写死；`MutationObserver` 盯 `data-theme`，切主题时重新取色。

dpr 封顶 2，流星 18 颗。实测 1440×900 下稳定 60fps、最差单帧 16.8ms。改这两个数之前先量一下。

### 配色：中性底 + 青紫强调

配色全部走 `src/styles/global.css` 里的 CSS 自定义属性：`:root` 是深色值，`html[data-theme='light']` 覆盖成浅色。新增颜色时两个块都要加，组件里只引用 `var(--color-*)`，不要写死色值。

底色是中性黑白灰，**颜色只出现在强调位**：`--color-accent`（青）→ `--color-accent-2`（紫），合成 `--gradient-accent`，用在大标题渐变字、按钮、进度条、轮播圆点、当前项高亮（`--color-accent-soft`）、链接悬停。

**绿色被明确排除**（用户不喜欢），连标签的哈希色相都跳过 90–160 这一段——见 `lib/colors.ts` 的 `getTagHue()`。注意那里是**跳过**而不是夹到边界，夹的话所有本该是绿的标签会挤成同一个颜色。

带信息的颜色在 `src/lib/colors.ts`，和纯装饰的 CSS 变量分开：

- `getTagHue(name)` —— 标签名哈希成固定色相，同名在任何页面同色。饱和度/明度由 `--tag-s` / `--tag-l` 按主题统一给，组件只传 `style="--tag-h:…"`。
- `getLanguageColor(lang)` —— GitHub linguist 的官方语言色，给仓库卡片的语言点。

三个由此而来的约束：

- **正文链接必须有下划线**（`.prose a:not(.wiki-link)`）。链接默认色和正文同色，靠悬停才变强调色。
- **`.eyebrow` 用 `--color-muted` 而不是 accent**，否则它和紧跟其后的渐变 h1 打架。
- **渐变字要 `color: transparent` + `background-clip: text`**，所以那条规则里不能再设 `color`；另外加了 `padding-bottom` 免得字形下沿被裁。

### 首页的 GitHub 轮播：拉不到也不能挂

`src/lib/github.ts` 在**构建期**调 GitHub API 取 `SITE.githubUser` 的公开仓库（滤掉 fork 和 archived，按 star 排序取前 8）。

**这是装饰性内容，任何失败都退回 `site.ts` 的 `FALLBACK_REPOS` 并打一条 warn，绝不 throw。** 匿名接口是 60 次/小时/IP，而 GitHub Actions 的 runner 共享出口 IP，CI 上有真实概率拉不到——兜底就是为这个存在的。设了 `GITHUB_TOKEN` 环境变量会自动带上，配额提到 5000/小时。

`src/components/RepoCarousel.astro` 的滚动完全由 CSS 负责（`overflow-x` + `scroll-snap-type`），触摸滑动和惯性都是原生的；脚本只做点箭头 `scrollBy` 一格和同步圆点。两个坑：

- **仓库简介长度不可控**（现有仓库里就有 239 字的），flex 行里所有卡片会被最高那张拉齐。`.repo-card-desc` 必须 `line-clamp: 3`，否则整排卡片变成 450px 高的巨块。
- **末尾几张卡永远同屏**，滚不到「它在最左边」的位置，对应圆点点了没反应。所以圆点数量按 `maxScroll / step` 算出可达位置数，多余的用 `hidden` 藏掉，随 resize 重算。

自动播放每 4.2 秒一格、到头绕回开头。**暂停条件必须齐全**：悬停（`pointerenter`）、键盘聚焦（`focusin`）、标签页切走（`visibilitychange`）、`prefers-reduced-motion`，以及一屏就放得下时压根不启动。少一条就会出现「用户正在看/正在操作，它自己跑了」。

### 站点常量集中在 `src/lib/site.ts`

标题、描述、作者、GitHub 链接、导航项都在 `SITE` 里，改站点信息改这一处。文件夹的中文显示名也在这里（`FOLDER_LABELS`）。

### 归档目录：文件夹即 id 即 URL

`src/content/notes/cpp/tools/valgrind.md` 的 `entry.id` 是 `cpp/tools/valgrind`，URL 是 `/notes/cpp/tools/valgrind/`，归档路径是 `cpp/tools`。**没有 `category` 之类的 frontmatter 字段**——三者同源，不会漂移。

- `src/lib/folder-tree.ts` —— 纯数据变换（和 `wiki-links.ts` 同样的定位，不碰文件系统）。`buildFolderTree()` / `findFolder()` / `flattenFolderPaths()` / `isAncestorPath()` / `getFolderTrail()`。
- `src/lib/content.ts` 的 `getFolderTree(collection)` —— 建树入口，**模块级缓存**，理由和 `backlinkGraph` 一样：侧边栏几乎每页都渲染，不缓存就是 O(n²)。
- `src/components/FolderNav.astro` / `FolderTree.astro` —— 侧边栏。`FolderTree` 用 `Astro.self` 递归，展开收起是原生 `<details>`，**零客户端 JS**；当前条目的祖先目录在服务端就带上 `open`，不会闪。
- `src/components/FolderArchive.astro` —— 归档页主体（面包屑 + 子目录卡片 + 条目列表）。
- `src/components/TocRail.astro` —— 右栏页内目录。标题来自 `render(entry)` 的 `headings`；Sätteri 的 heading-ids 插件用 github-slugger 生成 slug 并写成元素 id，所以锚点天然对得上，不需要自己加 id。
- `src/components/Breadcrumb.astro` —— 面包屑，条目页和归档页共用。最后一段是「你在这里」的胶囊，归档页要传**父路径**（自己由 current 表示）。

侧边栏的行是 `.folder-row`：点文件夹名进归档页，点行内其它地方（图标、计数、右侧箭头）展开收起。高亮样式钩子是 `data-current`，不是 `aria-current`——因为目录行的链接是 `<summary>` 里的 `<a>`，而高亮要作用在整行上。

`[...slug].astro` 一条路由同时出条目页和归档页，靠 props 里是 `folder` 还是条目二选一。**文件夹路径和条目 id 撞车时条目优先**，归档页跳过并 warn——否则 Astro 会直接报重复路由。

目录名受 slug 规则约束只能是小写英文，中文名靠 `site.ts` 的 `FOLDER_LABELS` 补（键是完整路径，如 `'cpp/async'`）。没配就回退目录名，不报错。**别用中文目录名**，理由和中文文件名一样：会产生 percent-encoded 的 URL。

### 双向链接：一套规则，两个消费方

正文里的 `[[文件名]]` 会在构建期变成真链接，被链接的页面底部自动长出「被以下内容引用」。

- `src/lib/wiki-links.ts` —— 纯字符串解析，不碰文件系统。`normalizeTarget()` / `parseWikiLinks()` / `splitByWikiLink()` / `createWikiIndex()` / `resolveWikiTarget()` 都在这里，是下面两个消费方的唯一真相来源。
- `src/lib/remark-wiki-link.ts` —— **渲染**。扫文件系统建索引，把 `[[x]]` 换成 `<a class="wiki-link">` 或 `<span class="wiki-link-broken">`。
- `src/lib/content.ts` 的 `getBacklinkGraph()` —— **反向链接 + 断链警告**。基于 `getPublishedEntries()`，草稿天然被排除。

**id 归一化必须和 Astro 一致。** glob loader 生成 `entry.id` 的方式是把路径每一段丢给 `github-slugger` 的 `slug()` 再用 `/` 连接（`node_modules/astro/dist/content/utils.js:272`）。它转小写但保留 CJK——所以 `CPP11异步回调.md` 的 id 是 `cpp11异步回调`。任何要和 id 比对的地方都得走 `normalizeTarget()`，不要手写 slugify。

同名冲突时 notes 覆盖 posts。这个顺序在插件的索引和 `getBacklinkGraph()` 里各写了一次，改动时要一起改，否则链接指向和反向链接会对不上。

**`[[x]]` 可以省略归档路径。** `resolveWikiTarget()` 先按完整 id 精确匹配，未命中再按文件名（id 最后一段）找——所以把文件挪进文件夹不会打断已有链接。代价是文件名在全站重复时必须写全路径，这种情况 `createWikiIndex()` 会把该文件名标成 `null`，警告文案是「文件名不唯一，请写完整路径」。目标里带斜杠时不做这个回退：作者写的就是完整路径，没命中就是没命中。

**断链只警告不报错**，因为花园里「先埋链接、之后再补内容」是常态。

### Markdown 处理器是 Sätteri，不是 remark

Astro 7 起默认处理器是 Sätteri，扩展点是 `markdown.processor: satteri({ mdastPlugins })`。老的 `markdown.remarkPlugins` 仍可用，但要另外装 `@astrojs/markdown-remark` 退回 unified 处理器——本项目没走这条路。

写 Sätteri 插件时注意：**访问器是从 Rust 侧回调的，`console.log` / `console.warn` 和 `context.report()` 都不会出现在构建输出里**，插件模块的模块级状态也不和 `astro.config.mjs` 共享（是两个模块实例）。所以插件只管渲染，需要打日志的诊断放在 `lib/content.ts` 那种跑在主构建进程里的代码中。

只订阅 `text` 节点意味着 `code` / `inlineCode` 天然不会被碰到——代码块里的 `[[nodiscard]]` 是安全的。

## 内容写作约定

推荐用脚本生成骨架，避免手写 frontmatter 出错：

```bash
npm run new:post -- --title "文章标题" --slug my-new-post --tags cmake,cpp --publish
npm run new:note -- --title "笔记标题" --slug my-note --status growing
npm run new:post -- --title "预览" --slug preview --dry-run
npm run new:note -- --title "异步回调" --slug cpp/async-callback   # 归档到 cpp/ 目录
```

脚本默认生成 `draft: true`，`--publish` 才是 `draft: false`。`--slug` 的**每一段**都只接受小写英文、数字、短横线和下划线，`/` 是归档目录分隔符（`scripts/new-content.mjs` 的 `validateSlug` 会逐段校验，顺带挡掉 `cpp//x`、`cpp/` 这类写法）。目录不存在会自动创建。

非 TTY 环境（比如脚本里调用）必须显式传 `--description`，否则会卡在交互提问上报错。

**中文标题必须显式传 `--slug`。** `slugify()` 会把非 ASCII 字符全部剥掉，中文标题会得到空 slug 并报错。历史上有文件直接用中文命名（`src/content/posts/cmake预设.md`），能构建但会产生 percent-encoded 的 URL，新文件不要这样。

## 已知的坑

- **`src/content/posts/templates/` 在 posts collection 的 glob 范围内**（`**/*.{md,mdx}`）。那几个模板会被当成真正的 post 加载和校验，只靠 `draft: true` 挡着不发布。复制模板去写新文章，不要直接把模板本身改成 `draft: false`；改动模板 frontmatter 时它同样要通过 posts schema 校验。也正因为它们是草稿，归档树里不会出现 `templates` 这个文件夹。wiki 链接插件另外用 `IGNORED_ROOT_DIRECTORIES` 挡了它，但**只挡 collection 根下那一层**——深层的 `templates/` 是合法归档目录。
- **部分源文件带 UTF-8 BOM**（`src/content.config.ts`、多数 `.astro` 文件、部分 `.md`）。编辑时保留原样，不要刻意增删。
- **标签没有归一化**，大小写和粒度靠人工保持一致（现有标签里已经同时存在 `CPP` 和 `CPP11`）。新增标签前先看 `/tags/` 页面有没有现成的。
- **挪动已发布的文件会改 URL**。归档路径是 id 的一部分，把 `notes/foo.md` 移进 `notes/cpp/` 后旧地址就 404 了。站内的 `[[foo]]` 靠文件名回退仍然有效，但外部链接会断——没有重定向机制。
- **`[[` 和 C++ 属性冲突**。这是个 C++ 博客，散文里裸写 `[[nodiscard]]` 会被当成 wiki 链接（渲染成灰色断链）。代码块和行内代码里安全，所以正文提到属性时记得加反引号。

## 部署

`.github/workflows/deploy.yml` 在 push 到 `main` 时用 `withastro/action@v5` 构建并部署到 GitHub Pages。注意 action 内部自己跑构建，**不会执行 `astro check`**，所以类型和 schema 问题只有本地 `npm run build` 能提前发现。
