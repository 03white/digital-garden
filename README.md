# Digital Garden

一个基于 Astro 的 GitHub Pages 静态博客 / 数字花园项目。

## 技术栈

- Astro：静态站点框架。
- Markdown / MDX：内容写作格式。
- Astro Content Collections：文章和笔记元数据约束。
- GitHub Actions + GitHub Pages：自动构建和部署。

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

当前项目默认配置了 `base: /digital-garden`，本地访问地址通常是：

```text
http://localhost:4321/digital-garden/
```

构建生产版本：

```bash
npm run build
```

预览构建结果：

```bash
npm run preview
```

## 写文章

在 `src/content/posts` 中新增 Markdown 文件：

```md
---
title: 新文章标题
description: 文章摘要。
pubDate: 2026-08-15
tags: [astro, blog]
draft: false
---

这里是正文。
```

文章会生成到 `/posts/<文件名>/`。

## 写笔记

在 `src/content/notes` 中新增 Markdown 文件：

```md
---
title: 新笔记标题
description: 笔记摘要。
createdDate: 2026-08-15
updatedDate: 2026-08-15
tags: [digital-garden]
status: seedling
draft: false
---

这里是笔记正文。
```

笔记状态可选：

- `seedling`：种子。
- `growing`：生长中。
- `evergreen`：常青。

笔记会生成到 `/notes/<文件名>/`。

## GitHub Pages 配置

当前 `astro.config.mjs` 默认适配仓库名为 `digital-garden` 的 GitHub Pages 项目页：

```js
export default defineConfig({
  site: process.env.SITE ?? 'https://03white.github.io',
  base: process.env.BASE_PATH ?? '/digital-garden',
});
```

站点地址通常是：

```text
https://03white.github.io/digital-garden/
```

如果以后改成用户主页仓库 `03white.github.io`，通常需要移除 `base` 配置。

## 自动部署

`.github/workflows/deploy.yml` 会在推送到 `main` 分支时自动构建并部署到 GitHub Pages。

还需要在 GitHub 仓库中进入：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

并将 Source 设置为 `GitHub Actions`。

## 项目文档

- `一般需求分析.md`
- `详细设计.md`
