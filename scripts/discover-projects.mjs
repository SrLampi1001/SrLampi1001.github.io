#!/usr/bin/env node
/**
 * Discover project.yml files across all (or allow-listed) repos of a
 * GitHub user and emit two JSON manifests:
 *
 *   src/data/projects.json   -- array of validated projects (each
 *                              augmented with _meta: { repo, path, url })
 *   src/data/errors.json     -- array of per-file errors (no project.yml,
 *                              HTTP errors, YAML parse errors, schema
 *                              validation failures)
 *
 * Usage:
 *   node scripts/discover-projects.mjs                  # discover all
 *   node scripts/discover-projects.mjs --quiet          # less console output
 *   GITHUB_TOKEN=ghp_xxx node scripts/discover-projects.mjs   # higher rate limit
 *
 * Rate-limit notes:
 *   - Unauthenticated: 60 req/hour per IP.
 *   - Authenticated (GITHUB_TOKEN): 5,000 req/hour.
 *   - The script makes 1 + N requests (1 for the user/repos list, then
 *     1 per repo to try the root project.yml). For 9 repos that's 10
 *     requests -- well under the unauthenticated budget.
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

async function ghFetchRaw(url) {
  const res = await fetch(url, { headers: { ...ghHeaders(), Accept: 'application/vnd.github.raw' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} -- ${url}`);
  return res.text();
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
    return null; // no file = include all repos
  }
  const text = await readFile(ALLOWLIST_PATH, 'utf8');
  const list = JSON.parse(text);
  return new Set(list.filter((e) => e.enabled !== false).map((e) => e.repo));
}

async function fetchProjectYml(owner, name, branch) {
  // Use the Contents API for accurate 404 handling and rate-limit
  // friendliness. The raw URL would also work but doesn't tell us
  // about rate limits as cleanly.
  const url = `https://api.github.com/repos/${owner}/${name}/contents/project.yml?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (!json.content) return null;
  // Contents API returns base64 content. Decode.
  const decoded = Buffer.from(json.content, 'base64').toString('utf8');
  return decoded;
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
  } else {
    log(`Discovering project.yml in ${filtered.length} repos...`);
  }

  const projects = [];
  const errors = [];
  let noYmlCount = 0;

  for (const repo of filtered) {
    const label = `${repo.owner.login}/${repo.name}`;
    try {
      const ymlText = await fetchProjectYml(repo.owner.login, repo.name, repo.default_branch);
      if (ymlText === null) {
        noYmlCount++;
        continue;
      }

      let doc;
      try {
        doc = YAML.parse(ymlText);
      } catch (e) {
        errors.push({
          repo: label,
          path: 'project.yml',
          branch: repo.default_branch,
          stage: 'yaml',
          detail: e instanceof Error ? e.message : String(e),
        });
        continue;
      }

      const projectObj = doc && typeof doc === 'object' && 'project' in doc ? doc.project : doc;
      const ok = validate(projectObj);
      if (!ok) {
        errors.push({
          repo: label,
          path: 'project.yml',
          branch: repo.default_branch,
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
          repo: label,
          path: 'project.yml',
          branch: repo.default_branch,
          url: repo.html_url,
          html_url: repo.html_url,
          description: repo.description ?? null,
          language: repo.language ?? null,
          pushed_at: repo.pushed_at ?? null,
          stargazers_count: repo.stargazers_count ?? 0,
          default_branch: repo.default_branch,
        },
      });
      log(`  ✅ ${label} (${repo.default_branch})`);
    } catch (e) {
      errors.push({
        repo: label,
        stage: 'fetch',
        detail: e instanceof Error ? e.message : String(e),
      });
      warn(`  ⚠️  ${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_PROJECTS, JSON.stringify(projects, null, 2) + '\n');
  await writeFile(OUT_ERRORS, JSON.stringify(errors, null, 2) + '\n');

  log('');
  log(`Discovered ${projects.length} valid project(s).`);
  log(`Repos without project.yml: ${noYmlCount}.`);
  if (errors.length > 0) {
    log(`Errors: ${errors.length}`);
    for (const e of errors) {
      const detail = Array.isArray(e.detail) ? e.detail.join('; ') : e.detail;
      log(`  ❌ ${e.repo} [${e.stage}] ${detail}`);
    }
  }
  log(`Wrote ${path.relative(ROOT, OUT_PROJECTS)} and ${path.relative(ROOT, OUT_ERRORS)}.`);
}

main().catch((e) => {
  console.error('discover crashed:', e);
  process.exit(1);
});