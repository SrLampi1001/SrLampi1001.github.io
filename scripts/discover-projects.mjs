#!/usr/bin/env node
/**
 * Discover project.yml files across all (or allow-listed) repos of a
 * GitHub user and emit two JSON manifests:
 *
 *   src/data/projects.json   -- array of validated projects (each
 *                              augmented with _meta: { repo, path, branch, … })
 *   src/data/errors.json     -- array of per-file errors
 *
 * For each repo the algorithm:
 *   1. Lists every public repo for the user.
 *   2. Filters by data/projects.json (allow-list) if present.
 *   3. For each enabled repo, fetches the root project.yml on the default
 *      branch via the Contents API.
 *   4. If root project.yml exists, asks the Git Trees API for a
 *      recursive listing of files on the default branch.
 *   5. Filters the tree for paths ending in "/project.yml" (and the
 *      root "project.yml"). This finds nested projects in monorepos
 *      and collections like riwi_projects.
 *   6. Fetches every nested project.yml via the Contents API.
 *   7. Validates each against schema/project.schema.json (ajv).
 *   8. Cross-validates that all project ids are unique; collisions go
 *      into errors.json.
 *
 * Outputs go to src/data/projects.json and src/data/errors.json.
 *
 * Usage:
 *   node scripts/discover-projects.mjs
 *   node scripts/discover-projects.mjs --quiet
 *   GITHUB_TOKEN=ghp_xxx node scripts/discover-projects.mjs   # 5000 req/hr
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as YAML from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'schema/project.schema.json');
const ALLOWLIST_PATH = path.join(ROOT, 'data/projects.json');
const OUT_DIR = path.join(ROOT, 'src/data');
const OUT_PROJECTS = path.join(OUT_DIR, 'projects.json');
const OUT_ERRORS = path.join(OUT_DIR, 'errors.json');

const USER = process.env.PORTFOLIO_USER || 'SrLampi1001';
const TOKEN = process.env.GITHUB_TOKEN;
const QUIET = process.argv.includes('--quiet');

function log(...args) {
  if (!QUIET) console.log(...args);
}
function warn(...args) {
  if (!QUIET) console.warn(...args);
}

function ghHeaders() {
  const h = {
    'User-Agent': 'srlampi1001-portfolio-discoverer',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

async function ghFetch(url) {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} -- ${url}\n${body.slice(0, 200)}`);
  }
  return res.json();
}

async function listRepos(user) {
  const all = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/users/${user}/repos?per_page=100&page=${page}&type=public&sort=full_name`;
    const data = await ghFetch(url);
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
    if (page > 10) {
      warn(`Stopping pagination at page ${page} (safety limit).`);
      break;
    }
  }
  return all;
}

async function readAllowlist() {
  try {
    await access(ALLOWLIST_PATH, constants.F_OK);
  } catch {
    return null;
  }
  const text = await readFile(ALLOWLIST_PATH, 'utf8');
  const list = JSON.parse(text);
  return new Set(list.filter((e) => e.enabled !== false).map((e) => e.repo));
}

async function fetchProjectYmlFromContentsApi(owner, name, branch, filePath) {
  // Prefer raw.githubusercontent.com for per-file fetches: it serves
  // from a CDN and does not count against the GitHub REST API's
  // secondary rate limit. The Contents API is only used for the
  // initial tree-walk.
  const url = `https://raw.githubusercontent.com/${owner}/${name}/${encodeURIComponent(branch)}/${filePath}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'srlampi1001-portfolio-discoverer' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${filePath}`);
  return res.text();
}

async function getRecursiveTree(owner, name, branch) {
  // The default branch's recursive tree lists every file in the repo
  // in a single API call. For monorepos like riwi_projects this is
  // the easiest way to find every nested project.yml.
  const url = `https://api.github.com/repos/${owner}/${name}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const data = await ghFetch(url);
  if (data.truncated) {
    warn(`  ⚠️  Tree for ${owner}/${name}@${branch} was truncated by the server. Nested file walks may be incomplete.`);
  }
  return Array.isArray(data.tree) ? data.tree : [];
}

function projectYmlPathsFromTree(treeEntries) {
  // Returns every path that ends in 'project.yml' at any level.
  // Includes root 'project.yml' (no slash) and nested ones.
  return treeEntries
    .filter((e) => e.type === 'blob' && e.path.endsWith('project.yml'))
    .map((e) => e.path)
    .sort(); // root first, then alphabetic
}

async function discoverRepo(owner, name, defaultBranch, validate) {
  // 1. Fetch root project.yml. If absent and the repo isn't expected
  //    to have nested files, return empty.
  const rootText = await fetchProjectYmlFromContentsApi(owner, name, defaultBranch, 'project.yml');
  if (rootText === null) {
    return { projects: [], errors: [], noYml: true };
  }

  // 2. Get the recursive tree to find every nested project.yml.
  let treePaths = ['project.yml'];
  try {
    const tree = await getRecursiveTree(owner, name, defaultBranch);
    treePaths = projectYmlPathsFromTree(tree);
  } catch (e) {
    // If the tree API fails, fall back to root-only.
    warn(`  ⚠️  Tree fetch failed for ${owner}/${name}: ${e instanceof Error ? e.message : String(e)}. Falling back to root-only.`);
  }

  // 3. Fetch + validate each project.yml.
  const projects = [];
  const errors = [];

  for (const filePath of treePaths) {
    const label = `${owner}/${name}@${defaultBranch}:${filePath}`;
    try {
      const text = await fetchProjectYmlFromContentsApi(owner, name, defaultBranch, filePath);
      if (text === null) {
        errors.push({
          repo: `${owner}/${name}`,
          path: filePath,
          branch: defaultBranch,
          stage: 'fetch',
          detail: 'File listed in tree but Contents API returned 404',
        });
        continue;
      }

      let doc;
      try {
        doc = YAML.parse(text);
      } catch (e) {
        errors.push({
          repo: `${owner}/${name}`,
          path: filePath,
          branch: defaultBranch,
          stage: 'yaml',
          detail: e instanceof Error ? e.message : String(e),
        });
        continue;
      }

      const projectObj = doc && typeof doc === 'object' && 'project' in doc ? doc.project : doc;
      const ok = validate(projectObj);
      if (!ok) {
        errors.push({
          repo: `${owner}/${name}`,
          path: filePath,
          branch: defaultBranch,
          stage: 'schema',
          detail: (validate.errors ?? []).map((e) => {
            const where = e.instancePath || '(root)';
            return `${where} ${e.message ?? 'invalid'}`;
          }),
        });
        continue;
      }

      projects.push({
        ...projectObj,
        _meta: {
          repo: `${owner}/${name}`,
          path: filePath,
          branch: defaultBranch,
          url: `https://github.com/${owner}/${name}`,
          html_url: `https://github.com/${owner}/${name}`,
          // Parent collection id is the dirname of the path
          // (e.g. 'python/workshop_1/project.yml' → parent 'python').
          parent_path: filePath === 'project.yml' ? null : filePath.split('/').slice(0, -1).join('/'),
        },
      });
    } catch (e) {
      errors.push({
        repo: `${owner}/${name}`,
        path: filePath,
        branch: defaultBranch,
        stage: 'fetch',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { projects, errors, noYml: false };
}

function crossValidateUniqueIds(projects, errors) {
  const seen = new Map();
  for (const project of projects) {
    if (seen.has(project.id)) {
      errors.push({
        repo: project._meta?.repo,
        path: project._meta?.path,
        branch: project._meta?.branch,
        stage: 'cross-id',
        detail: `Duplicate project id "${project.id}" (also at ${seen.get(project.id)})`,
      });
    } else {
      seen.set(project.id, `${project._meta?.repo}:${project._meta?.path}`);
    }
  }
}

async function main() {
  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const allowlist = await readAllowlist();
  if (allowlist) {
    log(`Allow-list active: ${allowlist.size} repos included.`);
  } else {
    log(`No allow-list found; including all of ${USER}'s public repos.`);
  }

  log(`Listing repos for ${USER}...`);
  const repos = await listRepos(USER);
  log(`Found ${repos.length} public repos.`);

  const filtered = allowlist
    ? repos.filter((r) => allowlist.has(r.full_name))
    : repos;

  if (filtered.length === 0) {
    log(`No repos match the allow-list; nothing to discover.`);
  }

  const projects = [];
  const errors = [];
  let noYmlCount = 0;
  let totalFiles = 0;

  for (const repo of filtered) {
    log(`Discovering ${repo.owner.login}/${repo.name}...`);
    try {
      const { projects: found, errors: errs, noYml } = await discoverRepo(
        repo.owner.login,
        repo.name,
        repo.default_branch,
        validate,
      );
      if (noYml) {
        noYmlCount++;
        log(`  (no project.yml)`);
        continue;
      }
      totalFiles += found.length + errs.length;
      for (const p of found) log(`  ✅ ${p._meta.path}`);
      for (const e of errs) warn(`  ❌ ${e.path} [${e.stage}]`);
      projects.push(...found);
      errors.push(...errs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warn(`  ⚠️  ${repo.owner.login}/${repo.name}: ${msg}`);
      errors.push({
        repo: `${repo.owner.login}/${repo.name}`,
        stage: 'fetch',
        detail: msg,
      });
    }
  }

  // Cross-validation: project id uniqueness.
  crossValidateUniqueIds(projects, errors);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_PROJECTS, JSON.stringify(projects, null, 2) + '\n');
  await writeFile(OUT_ERRORS, JSON.stringify(errors, null, 2) + '\n');

  log('');
  log(`Discovered ${projects.length} valid project(s) across ${filtered.length - noYmlCount} repo(s).`);
  log(`Repos without project.yml: ${noYmlCount}.`);
  log(`Total project.yml files inspected: ${totalFiles}.`);
  if (errors.length > 0) {
    log(`Errors: ${errors.length}`);
    for (const e of errors) {
      const detail = Array.isArray(e.detail) ? e.detail.join('; ') : e.detail;
      log(`  ❌ ${e.repo}${e.path ? '/' + e.path : ''} [${e.stage}] ${detail}`);
    }
  }
  log(`Wrote ${path.relative(ROOT, OUT_PROJECTS)} and ${path.relative(ROOT, OUT_ERRORS)}.`);
}

main().catch((e) => {
  console.error('discover crashed:', e);
  process.exit(1);
});