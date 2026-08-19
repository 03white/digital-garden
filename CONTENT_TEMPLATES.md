# 文章模板使用说明

这个项目已经内置了创建内容的脚本，推荐用脚本生成新文章，再参考模板补充结构，避免手写 frontmatter 出错。

## 快速创建文章

交互式创建：

```bash
npm run new
```

直接创建一篇草稿文章：

```bash
npm run new:post -- --title 文章标题 --slug my-new-post --description 文章摘要。 --tags blog,astro --draft
```

直接创建并发布：

```bash
npm run new:post -- --title 文章标题 --slug my-new-post --description 文章摘要。 --tags blog,astro --publish
```

只预览、不写入文件：

```bash
npm run new:post -- --title 文章标题 --slug my-new-post --description 文章摘要。 --tags blog,astro --dry-run
```

## 参数说明

- `--title`：文章标题，可以写中文。
- `--slug`：文件路径和 URL 片段，建议用小写英文、数字和短横线。
- `--description`：文章摘要，会显示在列表页和 SEO 描述里。
- `--tags`：标签，用英文逗号分隔，例如 `astro,blog`。
- `--draft`：保存为草稿，生成 `draft: true`，不会发布。
- `--publish`：直接发布，生成 `draft: false`。
- `--dry-run`：只看生成效果，不创建文件。

## 备用模板

我已经放了几份草稿模板在 `src/content/posts/templates/`：

- `src/content/posts/templates/tutorial-post.md`：教程文章。
- `src/content/posts/templates/project-retrospective.md`：项目复盘。
- `src/content/posts/templates/debugging-notes.md`：问题排查。
- `src/content/posts/templates/reading-post.md`：读书 / 资料笔记文章。

这些文件都是 `draft: true`，不会出现在正式站点里。使用时可以复制一份到 `src/content/posts/` 下，改文件名、标题、摘要、标签和正文，写完后把 `draft` 改成 `false`。

示例：

```powershell
Copy-Item src\content\posts\templates\tutorial-post.md src\content\posts\my-tutorial.md
```

然后编辑 `src/content/posts/my-tutorial.md`：

```yaml
title: 我的教程标题
description: 这篇文章的摘要。
pubDate: 2026-08-17
tags: [tutorial, astro]
draft: true
```

写完确认要发布时：

```yaml
draft: false
```

## 建议流程

1. 用 `npm run new:post` 生成文章骨架。
2. 如果不知道怎么组织正文，复制对应模板里的小标题结构。
3. 写作时先保持 `draft: true`。
4. 本地运行 `npm run dev` 预览。
5. 发布前改成 `draft: false`。
