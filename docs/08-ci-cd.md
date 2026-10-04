# 08 — CI/CD & Automation

This document describes the end-to-end pipeline that keeps the portfolio up
to date with changes in every indexed project. It covers:

- the four triggers that fire the portfolio rebuild;
- the discovery workflow that fetches `project.yml` files from sibling
  repositories;
- the build, validation and deployment steps;
- per-repo validation workflows;
- credential management;
- caching and rate-limit hygiene.

---

## 1. The pipeline at a glance

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                       Triggers (defence in depth)                   │
  │                                                                     │
  │  • push to main                (low-latency, only what CI sees)     │
  │  • repository_dispatch         (sibling repo notifies us directly)  │
  │  • schedule: every 6 hours     (backstop for missed events)         │
  │  • workflow_dispatch           (manual rerun)                       │
  └────────────────────────────────┬────────────────────────────────────┘
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                           Build job                                 │
  │                                                                     │
  │  1. checkout SrLampi1001.github.io                                  │
  │  2. fetch sibling project.yml files via shallow clone               │
  │  3. validate every project.yml against schema                       │
  │  4. cross-validate (uniqueness, demo.required fields)               │
  │  5. install npm dependencies                                        │
  │  6. astro check       (TypeScript)                                  │
  │  7. astro build       (static output → dist/)                       │
  └────────────────────────────────┬────────────────────────────────────┘
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                          Deploy job                                 │
  │                                                                     │
  │  actions/deploy-pages@v5 → SrLampi1001.github.io                    │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## 2. The deploy workflow (portfolio repo)

The portfolio's main workflow is `.github/workflows/deploy.yml`:

```yaml
name: Deploy portfolio

on:
  push:
    branches: [main]
  workflow_dispatch:
  repository_dispatch:
    types: [project-updated]
  schedule:
    # Every 6 hours, minute-offset to dodge the top-of-hour load spike.
    - cron: '17 */6 * * *'

permissions:
  contents: read
  pages: write
  id-token: write

# Avoid piling up overlapping runs.
concurrency:
  group: portfolio-build
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Fetch sibling project.yml files
        env:
          CROSS_REPO_PAT: ${{ secrets.CROSS_REPO_PAT }}
        run: node scripts/fetch-projects.mjs

      - name: Validate every project.yml
        run: |
          npx ajv validate \
            -s schema/project.schema.json \
            -d "src/data/projects/**/project.yml" \
            -c ajv-formats \
            -c ajv-keywords \
            --errors=text \
            --all-errors

      - name: Cross-field validation
        run: node scripts/cross-validate.mjs

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx astro check

      - name: Build
        uses: withastro/action@v6

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

Notes:

- The validation step **runs before** `npm install`. This means even a
  malformed sibling `project.yml` is reported with a clean error, not
  buried inside an Astro build failure.
- `concurrency.cancel-in-progress: true` ensures rapid back-to-back pushes
  don't double-build.
- The `github-pages` environment (Settings → Environments) is required by
  `actions/deploy-pages`. If it doesn't exist yet, create it.

---

## 3. The four triggers

### 3.1 `push` to `main`

The lowest-latency trigger. Runs the workflow whenever a commit lands on
the portfolio repo's default branch. This catches:

- direct edits to the portfolio's own source (rare, but possible);
- the cron and `repository_dispatch` workflows committing back any change
  (e.g. updating the data cache).

### 3.2 `repository_dispatch` from sibling repos

This is the event-driven trigger. When a sibling project's CI finishes
successfully, it sends a dispatch to the portfolio repo:

```yaml
# in a sibling repo's CI workflow
- name: Notify portfolio
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  uses: peter-evans/repository-dispatch@v4
  with:
    token: ${{ secrets.PORTFOLIO_DISPATCH_PAT }}
    repository: SrLampi1001/SrLampi1001.github.io
    event-type: project-updated
    client-payload: |
      {
          "repo": "${{ github.repository }}",
          "ref":  "${{ github.ref }}"
        }
```

The receiving workflow only needs the trigger — it doesn't read the
payload; it re-fetches everything anyway. The payload is useful only for
debugging.

#### Sending the dispatch

- The sender's CI must use a PAT (or GitHub App installation token) with
  `Contents: write` on the portfolio repo.
- Each sibling repo stores this token as the secret
  `PORTFOLIO_DISPATCH_PAT`.
- The receiving workflow file **must be on the default branch** of the
  portfolio repo for the dispatch to fire. This is a hard GitHub
  requirement.

#### When to use

Use `repository_dispatch` whenever you want **immediate** updates after a
sibling change. It is the lowest-latency path.

### 3.3 `schedule` (cron)

```yaml
schedule:
  - cron: '17 */6 * * *'
```

The schedule event is **delayed** under high load — GitHub explicitly
warns that jobs queued near the top of an hour may be dropped. The
`17 */6` form offsets the minute to avoid the worst contention.

The schedule is a **backstop**. It catches:

- sibling repos that did not configure the dispatch;
- manual edits in the GitHub web UI (which don't fire CI);
- new sibling repos added since the last build.

It is the safety net that makes the system self-correcting.

### 3.4 `workflow_dispatch`

Manual rerun. Useful for:

- forcing an immediate rebuild after fixing a sibling repo;
- running the build against a non-`main` branch for testing.

Triggers from the GitHub UI or via `gh workflow run portfolio-build.yml`.

### 3.5 Why four triggers

| Trigger | Latency | Reliability | Cost |
|---------|---------|-------------|------|
| `push` | seconds | medium (only fires for portfolio repo) | per-push |
| `repository_dispatch` | seconds | medium (requires every sibling to opt in) | per-event |
| `schedule` (cron) | up to ~3h | one max | every 6h |
| `workflow_dispatch` | manual | highest | manual |

The portfolio should run reliably with **any** one of these, but using all
four gives the best UX with the lowest operational risk.

---

## 4. Discovery: fetching sibling `project.yml` files

### 4.1 The script: `scripts/fetch-projects.mjs`

```js
#!/usr/bin/env node
import { $ } from 'execa';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// REPOS is generated or maintained by hand.
// Option A: hand-curated list (simplest, recommended initially).
const REPOS = [
  'SrLampi1001/react-todo',
  'SrLampi1001/fastapi-api',
  'SrLampi1001/riwi_projects',
  // ...
];

// Option B: auto-discover via GitHub API.
//   const REPOS = await fetch('https://api.github.com/users/SrLampi1001/repos?per_page=100')
//     .then(r => r.json())
//     .then(rs => rs.map(r => r.full_name)
//       .filter(n => /* heuristic: has project.yml or matches a topic */));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../src/data/projects');
await fs.rm(ROOT, { recursive: true, force: true });
await fs.mkdir(ROOT, { recursive: true });

const token = process.env.CROSS_REPO_PAT;
if (!token) throw new Error('CROSS_REPO_PAT is required to clone sibling repositories.');

// Clone in parallel, sparse-checkout the project.yml files.
await Promise.all(
  REPOS.map(async (repo) => {
    const dir = path.join(ROOT, repo.split('/')[1]);
    await $`git clone --depth 1 --filter=blob:none --sparse https://x-access-token:${token}@github.com/${repo}.git ${dir}`;
    await $`git -C ${dir} sparse-checkout set --no-cone 'project.yml' '*/project.yml'`;
    await $`git -C ${dir} checkout`;
  })
);

console.log(`Fetched ${REPOS.length} repos into ${ROOT}`);
```

The script is idempotent: it deletes `src/data/projects/` and recreates
it on every run. The CI runner starts clean.

### 4.2 Sparse checkout

`--sparse` + `sparse-checkout set 'project.yml' '*/project.yml'`
restricts the checkout to only `project.yml` files at any depth. This
keeps disk and time down:

- A monorepo with 50,000 files still only checks out its `project.yml`s.
- Clones take seconds, not minutes.
- `src/data/projects/<repo>/` is small and easy to inspect when
  debugging.

### 4.3 API rate-limit hygiene

`--filter=blob:none` plus sparse checkout avoids the GitHub Contents API
entirely — the clones use the git protocol, not the REST API. This means
**no rate-limit pressure** for the discovery step itself, even with 100+
siblings.

The Contents API is only needed if you decide to fetch `project.yml`
files without cloning (e.g. for a super-shallow webhook handler). For
the standard workflow, clone + sparse-checkout is the right choice.

### 4.4 Auto-discovery vs curated list

There are two ways to populate `REPOS`:

- **Hand-curated list**: simple, predictable, lets you opt out of indexing
  a sibling without deleting its `project.yml`. Recommended for the
  initial system.
- **Auto-discovery** via `GET /users/SrLampi1001/repos?per_page=100`:
  convenient at scale, but requires additional filtering to decide which
  repos should appear (e.g. by topic, by presence of `project.yml`, by
  inclusion in a topic or org label).

A pragmatic compromise: maintain the list in a `data/projects.json`
file in the portfolio repo, with a manual "include" toggle per repo:

```json
[
  { "repo": "SrLampi1001/react-todo", "enabled": true },
  { "repo": "SrLampi1001/riwi_projects", "enabled": true }
]
```

This file is committed, reviewed in PRs, and serves as the explicit
allow-list.

---

## 5. Validation steps

### 5.1 Per-file schema validation

The deploy workflow runs `ajv-cli` against every fetched `project.yml`:

```bash
npx ajv validate \
  -s schema/project.schema.json \
  -d "src/data/projects/**/project.yml" \
  -c ajv-formats \
  -c ajv-keywords \
  --errors=text \
  --all-errors
```

This catches:

- typos (`tehcn: [react]`, `demo.typ`);
- invalid enum values (`type: potato`);
- missing required fields;
- malformed URLs and dates;
- structural mistakes.

See [07 — Validation & Schema](./07-validation.md) for the full schema
and the per-repo CI workflow.

### 5.2 Cross-field validation

A second pass (`scripts/cross-validate.mjs`) checks invariants that the
JSON Schema cannot express:

- unique `id` across the entire portfolio;
- `demo.type: python` requires `demo.entrypoint`;
- `deployment.backend` with `type: render` requires `deployment.backend.url`;
- `repository.name` matches the directory it lives in (for monorepos).

```js
// scripts/cross-validate.mjs (sketch)
import { glob } from 'glob';
import yaml from 'yaml';
import fs from 'node:fs/promises';

const files = await glob('src/data/projects/**/project.yml');
const projects = await Promise.all(
  files.map(async (f) => yaml.parse(await fs.readFile(f, 'utf8')))
);

const errors = [];
const seen = new Set();

for (const p of projects) {
  if (seen.has(p.project.id)) errors.push(`duplicate id: ${p.project.id}`);
  seen.add(p.project.id);

  const d = p.project.demo;
  if (d?.enabled && d.type !== 'none' && !d.entrypoint) {
    errors.push(`${p.project.id}: demo requires entrypoint`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
```

---

## 6. Credentials

### 6.1 `CROSS_REPO_PAT`

A **fine-grained PAT** scoped to:

- Resource owner: your personal account (or a designated org).
- Repositories: only the sibling repos you want to include (or "All
  repositories" if you want true discovery).
- Permissions: `Contents: read` (and `Metadata: read`, which is
  auto-granted).

This token is stored at **Settings → Secrets and variables → Actions** as
`CROSS_REPO_PAT` in the portfolio repo.

Fine-grained PATs **must** have an expiration date. Set a calendar
reminder to rotate. Rotation is a one-time secret update in the GitHub
UI; no other configuration changes are needed.

### 6.2 `PORTFOLIO_DISPATCH_PAT` (in each sibling repo)

A separate PAT, stored in each sibling repo's secrets, that gives the
sibling's CI the ability to fire `repository_dispatch` at the portfolio.
Fine-grained, scoped to:

- Resource owner: your personal account.
- Repository: `SrLampi1001/SrLampi1001.github.io`.
- Permissions: `Contents: write`.

If you do not want to set up dispatch from every sibling, the schedule
trigger still keeps things up to date — the dispatch is just an
optimisation for low latency.

### 6.3 Least-privilege

The deploy workflow uses:

```yaml
permissions:
  contents: read   # checkout this repo, fetch siblings
  pages: write     # create the Pages deployment
  id-token: write  # OIDC verification
```

No `pull-requests: write`, no `issues: write`. Each step inherits the
workflow-level token and may only do what the workflow declares.

---

## 7. Per-repo validation workflow

In each sibling repo, add a workflow that validates `project.yml` against
the schema in the portfolio. This catches errors at PR time so they never
reach the portfolio.

See [07 — Validation & Schema](./07-validation.md) for the full file
and rationale.

---

## 8. Caching and incremental builds

- **Astro data store**: `.astro/data-store.json` persists parsed Content
  Collections between builds. Incremental re-builds are faster when only
  one or two projects changed.
- **GitHub Actions cache**: `actions/cache@v4` for the Astro cache and
  for ETags from any API calls. Key it by lockfile hash.
- **`concurrency.cancel-in-progress: true`**: rapid back-to-back pushes
  cancel in-flight builds rather than queueing. Most-recent-wins.

For portfolios growing past ~50 projects, also enable Astro's
`experimental.incrementalBuild` (7.2+) to skip re-rendering unchanged
pages via `getStaticPaths() cacheKey`.

---

## 9. Observability

Each deploy run is visible under the Actions tab. The validation step's
output is the canonical place to look when a project file breaks.

Recommended notifications:

- **GitHub's "Send notifications for failed workflows"** is enabled by
  default in personal repos; you get an email on every failed build.
- Optionally add a Discord/Slack webhook via a third-party Action for
  real-time alerts.

The schedule trigger ensures that intermittent failures self-heal on the
next cron tick.

---

## 10. Failure modes and runbook

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Build fails with "CROSS_REPO_PAT not set" | Secret was rotated or removed | Re-add the secret. |
| Build fails on a specific `project.yml` | That file has a schema error | Open the file; ajv output points at the line and property. |
| Portfolio is stale by 6+ hours | Schedule trigger is being dropped | Re-trigger manually with `workflow_dispatch`; check GitHub status. |
| Clone step fails for a private repo | PAT does not have access to that repo | Update PAT scope or repo visibility. |
| Rate-limit error in a step | Some step is hitting the REST API too aggressively | Add `actions/cache` for ETags; switch to git-protocol clones. |
| Build OK but site looks wrong | Caching on CDN | Hard refresh; check the build output's `_astro/` hashes. |

---

## 11. Where to go next

- The schema being validated: [07 — Validation & Schema](./07-validation.md)
- The deployment steps (Pages setup, custom domain): [04 — Deployment & GitHub Pages](./04-deployment.md)
- The contract that defines what "valid" means: [02 — The `project.yml` Contract](./02-project-yml-contract.md)