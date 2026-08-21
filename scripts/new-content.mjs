import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const contentTypes = new Set(['post', 'note']);
const noteStatuses = new Set(['seedling', 'growing', 'evergreen']);
const args = parseArgs(process.argv.slice(2));
const today = formatDate(new Date());
const canPrompt = Boolean(input.isTTY);

let prompts;

if (args.help) {
  printHelp();
  process.exit(0);
}

try {
  const contentType = await resolveContentType(args.type);
  const title = await resolveRequiredText('title', '标题');
  const generatedSlug = slugify(title);
  const slug = await resolveSlug(generatedSlug);
  const description = await resolveText('description', '摘要', defaultDescription(contentType));
  const tags = await resolveTags();
  const draft = await resolveDraft();
  const filePath = path.join('src', 'content', contentType === 'post' ? 'posts' : 'notes', `${slug}.md`);

  if (existsSync(filePath)) {
    throw new Error(`文件已存在：${filePath}`);
  }

  const content = contentType === 'post'
    ? buildPostTemplate({ title, description, tags, draft })
    : await buildNoteTemplate({ title, description, tags, draft });

  if (args.dryRun) {
    console.log(`将创建：${filePath}`);
    console.log('--- 文件内容预览 ---');
    console.log(content);
  } else {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');

    console.log(`已创建 ${contentType === 'post' ? '文章' : '笔记'}：${filePath}`);
    console.log('预览前可以运行：npm run dev');
  }
} finally {
  prompts?.close();
}

function parseArgs(rawArgs) {
  const parsedArgs = {
    positional: [],
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const currentArg = rawArgs[index];

    if (!currentArg.startsWith('--')) {
      parsedArgs.positional.push(currentArg);
      continue;
    }

    const [rawKey, inlineValue] = currentArg.slice(2).split('=', 2);
    const key = rawKey.trim();

    if (key === 'draft') {
      parsedArgs.draft = true;
      continue;
    }

    if (key === 'publish') {
      parsedArgs.draft = false;
      continue;
    }

    if (key === 'dry-run') {
      parsedArgs.dryRun = true;
      continue;
    }

    if (key === 'help') {
      parsedArgs.help = true;
      continue;
    }

    parsedArgs[key] = inlineValue ?? rawArgs[index + 1];

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  const [possibleType, possibleTitle] = parsedArgs.positional;

  if (contentTypes.has(possibleType)) {
    parsedArgs.type = possibleType;
    parsedArgs.title ??= possibleTitle;
  } else {
    parsedArgs.title ??= possibleType;
  }

  return parsedArgs;
}

async function resolveContentType(value) {
  if (contentTypes.has(value)) {
    return value;
  }

  if (!canPrompt) {
    return 'post';
  }

  const answer = await ask('类型 post/note（默认 post）：');
  const contentType = answer.trim() || 'post';

  if (!contentTypes.has(contentType)) {
    throw new Error('类型只能是 post 或 note');
  }

  return contentType;
}

async function resolveRequiredText(argName, label) {
  const value = args[argName] ?? await ask(`${label}：`);
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`${label}不能为空`);
  }

  return trimmedValue;
}

async function resolveText(argName, label, fallback) {
  if (args[argName] !== undefined) {
    return args[argName].trim();
  }

  const value = await ask(`${label}（默认：${fallback}）：`);

  return value.trim() || fallback;
}

async function resolveSlug(generatedSlug) {
  if (args.slug) {
    return validateSlug(args.slug);
  }

  const promptText = generatedSlug ? `文件名 slug（默认 ${generatedSlug}）：` : '文件名 slug（建议英文/数字/短横线）：';
  const answer = await ask(promptText);

  return validateSlug(answer.trim() || generatedSlug);
}

async function resolveTags() {
  if (args.tags === undefined && !canPrompt) {
    return [];
  }

  const rawTags = args.tags ?? await ask('标签，用英文逗号分隔（可空）：');

  return rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function resolveDraft() {
  if (typeof args.draft === 'boolean') {
    return args.draft;
  }

  if (!canPrompt) {
    return true;
  }

  const answer = await ask('保存为草稿？Y/n（默认 Y）：');
  const normalizedAnswer = answer.trim().toLowerCase();

  return normalizedAnswer !== 'n' && normalizedAnswer !== 'no';
}

async function buildNoteTemplate({ title, description, tags, draft }) {
  const status = await resolveStatus();

  return `---
title: ${yamlString(title)}
description: ${yamlString(description)}
createdDate: ${today}
updatedDate: ${today}
tags: ${yamlArray(tags)}
status: ${status}
draft: ${draft}
---

这里开始写笔记内容。

## 相关想法

- 
`;
}

function buildPostTemplate({ title, description, tags, draft }) {
  return `---
title: ${yamlString(title)}
description: ${yamlString(description)}
pubDate: ${today}
tags: ${yamlArray(tags)}
draft: ${draft}
---

这里开始写正文。

## 背景


## 正文


## 总结

`;
}

async function resolveStatus() {
  const value = args.status ?? (canPrompt ? await ask('笔记状态 seedling/growing/evergreen（默认 seedling）：') : 'seedling');
  const status = value.trim() || 'seedling';

  if (!noteStatuses.has(status)) {
    throw new Error('笔记状态只能是 seedling、growing 或 evergreen');
  }

  return status;
}

function defaultDescription(contentType) {
  return contentType === 'post' ? '这篇文章的简短摘要。' : '这条笔记的简短摘要。';
}

function validateSlug(value) {
  const slug = value.trim().toLowerCase();

  if (!slug) {
    throw new Error('slug 不能为空，建议使用英文、数字和短横线');
  }

  // 斜杠是归档目录分隔符：cpp/async-callback 会落到 src/content/<type>/cpp/ 下，
  // URL 也跟着变成 /notes/cpp/async-callback/。逐段校验顺便挡掉 `cpp//x`、`cpp/` 这类写法。
  if (slug.split('/').some((segment) => !/^[a-z0-9][a-z0-9-_]*$/.test(segment))) {
    throw new Error('slug 每一段都只能是小写英文、数字、短横线或下划线，用 / 分隔归档目录，例如 cpp/async-callback');
  }

  return slug;
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function yamlString(value) {
  return JSON.stringify(value);
}

function yamlArray(values) {
  return `[${values.map(yamlString).join(', ')}]`;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

async function ask(question) {
  prompts ??= createInterface({ input, output });

  return prompts.question(question);
}

function printHelp() {
  console.log(`用法：
  npm run new
  npm run new:post -- "My New Post"
  npm run new:note -- "My New Note"
  npm run new:post -- --title "My New Post" --slug my-new-post --tags astro,blog --publish
  npm run new:note -- --title "异步回调" --slug cpp/async-callback   # 归档到 cpp/ 目录

参数：
  --title <title>          标题
  --slug <slug>            文件名，小写英文、数字和短横线；用 / 分隔归档目录
  --description <text>     摘要
  --tags <tag1,tag2>       标签，用英文逗号分隔
  --draft                  生成草稿 draft: true
  --publish                直接发布 draft: false
  --status <status>        笔记状态：seedling、growing、evergreen
  --dry-run                只预览，不写入文件
  --help                   显示帮助
`);
}
