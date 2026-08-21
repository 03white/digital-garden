import { FALLBACK_REPOS, SITE } from './site';

/**
 * 构建期拉取 GitHub 公开仓库，给首页轮播用。
 *
 * 设计前提：**这是装饰性内容，不能让构建挂掉。** 限流、离线、超时、字段变形
 * 全部退回 `FALLBACK_REPOS` 并打一条 warn，绝不 throw。
 *
 * GitHub 匿名接口是每小时 60 次/IP，GitHub Actions 的 runner 共享出口 IP，
 * 所以 CI 上有一定概率拉不到——这正是兜底存在的理由。设了 GITHUB_TOKEN
 * 环境变量的话会带上，配额提到 5000/小时。
 */

export interface RepoCard {
  name: string;
  description: string;
  url: string;
  language: string | null;
  stars: number;
  topics: string[];
}

/** 轮播里最多放几张。 */
const MAX_REPOS = 8;
const TIMEOUT_MS = 8000;

interface GitHubRepo {
  name?: unknown;
  description?: unknown;
  html_url?: unknown;
  language?: unknown;
  stargazers_count?: unknown;
  topics?: unknown;
  fork?: unknown;
  archived?: unknown;
  pushed_at?: unknown;
}

let cached: RepoCard[] | undefined;

export async function getRepos(): Promise<RepoCard[]> {
  if (cached) {
    return cached;
  }

  cached = await fetchRepos();

  return cached;
}

async function fetchRepos(): Promise<RepoCard[]> {
  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/users/${SITE.githubUser}/repos?type=owner&sort=pushed&per_page=100`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub 要求带 User-Agent，不带会直接 403。
        'User-Agent': `${SITE.githubUser}-digital-garden`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      return warnAndFallback(`GitHub API 返回 ${response.status}`);
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      return warnAndFallback('GitHub API 返回的不是数组');
    }

    const repos = payload
      .filter((repo): repo is GitHubRepo => typeof repo === 'object' && repo !== null)
      .filter((repo) => repo.fork !== true && repo.archived !== true)
      .map(toRepoCard)
      .filter((repo): repo is RepoCard => repo !== undefined);

    if (repos.length === 0) {
      return warnAndFallback('GitHub 上没有可展示的公开仓库');
    }

    // star 多的排前面，同 star 的按最近推送。
    repos.sort((a, b) => b.stars - a.stars);

    return repos.slice(0, MAX_REPOS);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return warnAndFallback(`拉取失败：${reason}`);
  }
}

function toRepoCard(repo: GitHubRepo): RepoCard | undefined {
  if (typeof repo.name !== 'string' || typeof repo.html_url !== 'string') {
    return undefined;
  }

  return {
    name: repo.name,
    description: typeof repo.description === 'string' && repo.description ? repo.description : '还没有写简介。',
    url: repo.html_url,
    language: typeof repo.language === 'string' ? repo.language : null,
    stars: typeof repo.stargazers_count === 'number' ? repo.stargazers_count : 0,
    topics: Array.isArray(repo.topics) ? repo.topics.filter((t): t is string => typeof t === 'string').slice(0, 3) : [],
  };
}

function warnAndFallback(reason: string): RepoCard[] {
  console.warn(`[github] ${reason}，首页轮播回退到 site.ts 的 FALLBACK_REPOS`);

  return FALLBACK_REPOS;
}
