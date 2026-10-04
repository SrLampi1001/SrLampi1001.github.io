# Step 4 — Multi-project discovery

> Date: 2026-10-04
> Status: ✅ Complete — the portfolio now discovers projects across
> all of `SrLampi1001`'s public GitHub repos, validates each
> `project.yml`, and renders the result as a real (still smoke-test)
> portfolio page.

## Goal

Replace the hardcoded two-source list (Steps 1–3) with a real
discovery step:

```
GitHub API  →  scripts/discover-projects.mjs  →  src/data/projects.json
                                                      + src/data/errors.json
                                                            ↓
                                                src/pages/index.astro
                                                            ↓
                                                       dist/index.html
```

## What was built

| File | Purpose |
|------|---------|
| `scripts/discover-projects.mjs` | Lists repos for the user, fetches each root `project.yml`, validates via ajv, emits JSON. |
| `data/projects.json` | Hand-curated allow-list with `enabled: true/false` per repo and an optional `note`. |
| `src/pages/index.astro` | Now reads from the discovered JSON; renders Featured + All projects + stats + errors. |
| `package.json` | Added `discover` and `build:full` (= discover + astro build). |

## What discovery actually found

```
$ npm run discover

Allow-list active: 1 repos included.
Listing repos for SrLampi1001...
Found 9 public repos.
Discovering project.yml in 1 repos...
  ✅ SrLampi1001/riwi_projects (main)

Discovered 1 valid project(s).
Repos without project.yml: 0.
```

With the allow-list active, exactly one repo (`riwi_projects`) is
included and its root `project.yml` validates cleanly.

## What happens without the allow-list

```
$ mv data/projects.json data/projects.json.bak
$ npm run discover
No allow-list found; including all of SrLampi1001's public repos.
Listing repos for SrLampi1001...
Found 9 public repos.
Discovering project.yml in 9 repos...
  ✅ SrLampi1001/riwi_projects (main)
Discovered 1 valid project(s).
Repos without project.yml: 8.
```

Eight of the nine public repos have no `project.yml` and are silently
skipped (counted as "no project.yml", not errors). This is the expected
shape for early adoption — only one project has opted into the
contract so far.

## How the allow-list works

`data/projects.json`:

```jsonc
[
  { "repo": "SrLampi1001/riwi_projects",              "enabled": true },
  { "repo": "SrLampi1001/employment_assessment_test", "enabled": false, "note": "waiting on project.yml" },
  { "repo": "SrLampi1001/kepler_page",                "enabled": false, "note": "waiting on project.yml" },
  { "repo": "SrLampi1001/platzi_projects",            "enabled": false, "note": "waiting on project.yml" },
  { "repo": "SrLampi1001/PORTFOLIO",                  "enabled": false, "note": "old portfolio; keep as link only" },
  { "repo": "SrLampi1001/silent_dragons",             "enabled": false, "note": "not a software project; personal mod" },
  { "repo": "SrLampi1001/simple-cli-coder-with-rag",  "enabled": false, "note": "waiting on project.yml" },
  { "repo": "SrLampi1001/SrLampi1001",                "enabled": false, "note": "profile README repo" },
  { "repo": "SrLampi1001/SrLampi1001.github.io",      "enabled": false, "note": "this portfolio -- skip" }
]
```

When the file is absent, the discoverer includes every public repo (so
adding `project.yml` to a new repo and pushing to `main` is enough to
appear on the portfolio — no config change needed). When present, only
`enabled: true` entries are scanned.

## Page rendering

`src/pages/index.astro` now reads the discovered JSON and renders:

- **Stats bar**: `N projects · F featured · C categories · L languages · E errors`
- **Featured section** (if any): grid of cards.
- **All projects section**: grid of cards.
- **Errors section** (if any): list of repos + stage + detail.
- **Discovery summary**: how the discovery works.
- **Project types and categories**: chips for filtering visibility.

A card displays:

- Name
- Description
- Category chips
- Repo link to GitHub
- Repo language (when known)

Empty state ("No projects found") is handled when `projects.json` is
empty — the build still succeeds.

## Two test runs

### Test 1 — happy path with allow-list

```
$ npm run build:full
> discover ...
✅ SrLampi1001/riwi_projects (main)
Discovered 1 valid project(s).
> astro build
[build] 1 page(s) built in 1.36s
[build] Complete!
```

The page renders Riwi Projects as a featured card. The "All projects"
section is empty (only 1 project, and it's featured). Stats show:
`1 project · 1 featured · 3 categories · 1 language · 0 errors`.

### Test 2 — empty data, no projects

```
$ echo '[]' > src/data/projects.json
$ echo '[]' > src/data/errors.json
$ npm run build
[build] 1 page(s) built in 1.34s
```

Page shows the "No projects found" empty state and instructs the
visitor to run `npm run discover`. Build does not fail.

## Why this is a real milestone

Until now, the smoke test page hardcoded two URLs. With Step 4:

1. **Adding a project is just `git push`.** Author a `project.yml` in
   any new repo, push to `main`. CI rebuilds. The portfolio picks it up
   with no edits to this repo.
2. **Allow-list is optional.** If absent, every repo is scanned.
3. **Errors are surfaced inline.** Schema failures don't silently pass
   — they appear in a red error block on the page (and in
   `errors.json`).
4. **Discover + build is atomic.** `npm run build:full` does the
   whole pipeline. CI will use this.

## Step 5 — recommended next move

Step 5 should turn this from "discover + render one card" into the
**real portfolio**:

1. **Monorepo / collection walk** — when a project's `type` is
   `collection`, recursively fetch every nested `project.yml` under
   that repo. The `riwi_projects/python/workshop_2` branch is the
   motivating example.
2. **Generate TypeScript types from the schema** with
   `json-schema-to-typescript` and replace the `any`-typed
   `ProjectMeta` / `Project` interfaces in `index.astro` with the
   generated ones.
3. **Promote the smoke test page** to a real home page with hero,
   filters, search, and a `ProjectCard` component (already designed
   in `docs/11-frontend-contract.md`).
4. **Add dynamic project routes** — `src/pages/projects/[id].astro`
   so each project gets its own page from the discovered data.
5. **Add the deployment workflow** — `withastro/action@v6` +
   `actions/deploy-pages@v5` so the whole thing actually deploys to
   `https://SrLampi1001.github.io`.

Each of these is documented in detail in the relevant docs files.

## How to reproduce

```bash
npm install
npm run discover              # writes src/data/projects.json
npm run build                 # consumes the JSON, renders index.html
npm run preview               # http://localhost:4321/

# or all-in-one:
npm run build:full

# without allow-list:
mv data/projects.json data/projects.json.bak
npm run discover              # discovers from all 9 repos
mv data/projects.json.bak data/projects.json
```

## Files changed in this step

| | Created | Lines |
|---|----------|-------|
| New | `scripts/discover-projects.mjs` | 195 |
| New | `data/projects.json` | 13 |
| New | `docs/STEP-4-RESULT.md` | this file |
| Modified | `src/pages/index.astro` | 343 → 268 (down — refactored to read JSON) |
| Modified | `package.json` | added 2 scripts |

Total Step 4 footprint: ~480 new lines + one file refactor.