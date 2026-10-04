# Step 9 — Deploy workflow

> Date: 2026-10-04
> Status: ✅ Complete — `.github/workflows/deploy.yml` is in place.
> The portfolio will deploy to GitHub Pages automatically on every
> push to `develop`.

## Goal

Wire the deploy workflow so the whole portfolio actually goes live at
`https://SrLampi1001.github.io` automatically.

## What was built

`.github/workflows/deploy.yml`:

```yaml
name: Deploy portfolio

on:
  push:
    branches: [develop]
  workflow_dispatch:
  schedule:
    - cron: '17 */6 * * *'

concurrency:
  group: portfolio-deploy
  cancel-in-progress: true

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    steps:
      - checkout
      - setup-node (Node 20, npm cache)
      - npm ci
      - astro check
      - withastro/action@v6
  deploy:
    needs: build
    environment: github-pages
    steps:
      - actions/deploy-pages@v5
```

### Triggers

| Trigger | Purpose |
|---------|---------|
| `push` to `develop` | Main path. Every push to `develop` rebuilds and deploys. |
| `workflow_dispatch` | Manual rerun from the Actions UI. |
| `schedule: 17 */6 * * *` | Backstop cron. Picks up changes to sibling repos that don't trigger this workflow. |

Cross-repo `repository_dispatch` from sibling repos is **intentionally
not wired** per the user's request — to be added later.

### Permissions (least-privilege)

```yaml
permissions:
  contents: read   # checkout this repo
  pages: write     # create the Pages deployment
  id-token: write  # OIDC for verification
```

### Concurrency

```yaml
concurrency:
  group: portfolio-deploy
  cancel-in-progress: true
```

Rapid back-to-back pushes cancel in-flight builds rather than queueing.
Latest commit wins.

### Pipeline

```
push to develop (or cron, or manual)
  │
  ▼
build job:
  1. checkout (this repo)
  2. setup-node (Node 20, npm cache)
  3. npm ci                         (reproducible install)
  4. npx astro check                (types from generated schema)
  5. withastro/action@v6           (auto-runs prebuild → generate-types
                                    → astro build → upload artifact)
  │
  ▼
deploy job:
  6. actions/deploy-pages@v5       (publish to GitHub Pages)
```

## Two temporary setups for testing

### 1. Discover step is commented out

```yaml
# TEMPORARILY DISABLED so the test fixture in
# src/data/projects.json (python-workshop-2 with demo.enabled)
# is preserved. Re-enable by uncommenting after the fixture
# is removed.
#
# - name: Discover projects
#   env:
#     GITHUB_TOKEN: ${{ secrets.CROSS_REPO_PAT }}
#   run: node scripts/discover-projects.mjs
```

The deployed site uses the **committed** `src/data/projects.json`. This
preserves the test fixture (see below) through deploys.

When the user is ready to go fully live:

1. Remove the test fixture (the `demo.enabled: true` block on
   `python-workshop-2`).
2. Run `npm run discover` locally.
3. Commit the freshly-generated `src/data/projects.json`.
4. Uncomment the `Discover projects` step in `deploy.yml`.

### 2. Pyodide test fixture preserved

`src/data/projects.json` has `python-workshop-2` patched with:

```json
{
  "demo": {
    "enabled": true,
    "type": "python",
    "runtime": "pyodide",
    "entrypoint": "python/workshop_2/taller2.py"
  }
}
```

This makes the `PyodideTerminal` component render on the live site so
the user can verify Pyodide works end-to-end at
`https://www.SrLampi1001.github.io/projects/python-workshop-2/`.

**To remove the fixture** when testing is done:

1. Run `npm run discover` locally to regenerate without the patch.
2. Or manually delete the `demo` key from
   `src/data/projects.json`.
3. Commit and push.

The fixture is local to this repo, not to `SrLampi1001/riwi_projects`,
so it doesn't disturb any actual project data.

## Local branches cleaned up

| Branch | Reason |
|--------|--------|
| `feat/smoke-test-astro-build` | 4 commits behind `develop`. Was an early version of `develop` while the smoke-test work was happening. Now redundant. |
| `docs/project-documentation-base` | Older branch from the initial docs work. Its content was merged into `develop` via `Add initial documentation suite for the portfolio platform` and follow-ups. |

Both deleted locally. The remote branches
(`remotes/origin/feat/smoke-test-astro-build` etc.) are untouched —
the user can remove them via the GitHub UI if desired.

## Git state after Step 9

```
* develop                                    6dcfa18 Step 9
  main                                       8340dce Add initial Jekyll config
  remotes/origin/HEAD                        → origin/main
  remotes/origin/develop                     6dcfa18 Step 9
  remotes/origin/docs/project-documentation-base   (untouched)
  remotes/origin/main                        8340dce (untouched)
```

## What the user needs to do to actually deploy

The workflow is configured. To deploy:

1. **Push `develop` to `origin/develop`** (if not already there).
2. The workflow will run on every push to `develop`. The first run
   may take a few minutes (install + discover would normally run; with
   discover commented out, just install + check + build + publish).
3. Once the build succeeds, the `deploy` job publishes to GitHub Pages
   at `https://SrLampi1001.github.io`.
4. The URL is exposed via the workflow's `github-pages` environment
   output (`page_url`).

If something breaks:

- Check the Actions tab for logs.
- Verify `npm run build` works locally (same pipeline as CI).
- Verify `npx astro check` finds no type errors.

## How to verify the deployment

After the workflow runs:

```bash
curl -sf https://SrLampi1001.github.io/projects/python-workshop-2/ | \
  grep "pyodide-demo"
```

should return a match — that's the PyodideTerminal rendered on the live site.

## What was NOT done (deliberate)

These are deferred to follow-up steps, per the user's request:

- **Cross-repo `repository_dispatch` trigger** — each sibling repo's CI
  would notify the portfolio on push. Currently the 6-hour cron is
  the only thing picking up sibling changes.
- **`CROSS_REPO_PAT` secret** — for an authenticated discover run
  inside CI. Not needed right now because discover is commented out.
- **Custom domain** (`docs/04-deployment.md` §6 has the procedure).
- **Removal of stale remote branches** (`feat/smoke-test-astro-build`,
  `docs/project-documentation-base`) — only deleted locally.

## Step 10 — recommended next move

The most natural follow-ups now that deployment is live:

1. **Add a footer** with last-build timestamp + repo link (visible to
   visitors).
2. **Add an OG / Twitter meta tag** for sharing individual projects.
3. **Add a styled 404 page** (currently Astro's default).
4. **Make `demo.enabled` a non-fixture feature**: enable demos in
   real `project.yml` files (push to `SrLampi1001/riwi_projects` on
   `main`), remove the local fixture, and re-enable discover in CI.

## How to reproduce

```bash
# Local sanity check
npm run build
npm run preview       # http://localhost:4321/

# After pushing develop:
# Watch the Actions tab. When green, the site is live at:
#   https://SrLampi1001.github.io
```

## Full commit history on `develop`

```
6dcfa18  Step 9: GitHub Pages deploy workflow                       ← you are here
fe4359a  Step 7 + 8: generated TS types and Pyodide demo runtime
a8d2b37  Step 6: per-project, category, and tag pages
a037f47  Step 5: monorepo / collection walk
3d5be02  Step 4: multi-project discovery across GitHub repos
17965ee  Step 3: JSON Schema validation for project.yml
be87d17  Step 2: fetch project.yml from non-default branch (project/python/workshop_2)
b3adfcd  Step 1: smoke test — fetch + render project.yml from riwi_projects
```