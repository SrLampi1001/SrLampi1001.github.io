# Step 5 — Monorepo / collection walk

> Date: 2026-10-04
> Status: ✅ Complete — the discoverer walks every `project.yml` in
> a monorepo's recursive tree and the page renders all 31 discovered
> projects grouped by their top-level collection.

## Goal

When a project's `type` is `collection`, recursively find every nested
`project.yml` file in the same repo and validate each independently.

The motivating example is `riwi_projects`, which has **31**
`project.yml` files spread across a tree of nested collections
(`python/`, `webprojects/`, `ai_workflows/`, …) and leaf projects.

## What the discoverer does now

```
For each enabled repo:
  1. Fetch root project.yml on the default branch.
  2. Get the recursive tree of the default branch
     (one API call: GET /git/trees/{branch}?recursive=1).
  3. Filter the tree for paths ending in '/project.yml'
     or the root 'project.yml'.
  4. Fetch each via raw.githubusercontent.com (no API rate limit
     pressure).
  5. Validate each against schema/project.schema.json (ajv).
  6. Cross-validate unique project ids across the whole portfolio.
  7. Write src/data/projects.json + src/data/errors.json.
```

## Discovered: 31 valid projects, 0 errors

```
$ npm run discover

Discovering SrLampi1001/riwi_projects...
  ✅ ai_workflows/ai_assessment_test_1/project.yml
  ✅ ai_workflows/ai_assessment_test_2/project.yml
  ✅ ai_workflows/ai_assessment_test_simulacrum/project.yml
  ✅ ai_workflows/project.yml
  ✅ infrastructure/project.yml
  ✅ low_code/project.yml
  ✅ project.yml
  ✅ python/assessment_test_1/project.yml
  ✅ python/assessment_test_1_simulacrum/project.yml
  ✅ python/grades_management_workshop/project.yml
  ✅ python/mini-projects/project.yml
  ✅ python/project.yml
  ✅ python/user_story_1/project.yml
  ✅ python/user_story_2/project.yml
  ✅ python/user_story_3/project.yml
  ✅ python/workshop_1/project.yml
  ✅ python/workshop_2/project.yml
  ✅ webprojects/assessment_test_2/project.yml
  ✅ webprojects/assessment_test_3/project.yml
  ✅ webprojects/assessment_test_3_simulacrum/project.yml
  ✅ webprojects/assessment_test_4/project.yml
  ✅ webprojects/docusaurus_documentation/project.yml
  ✅ webprojects/express_mysql_practice/project.yml
  ✅ webprojects/form_only_css_html/project.yml
  ✅ webprojects/kfc/project.yml
  ✅ webprojects/project.yml
  ✅ webprojects/simple_storage/project.yml
  ✅ webprojects/user_story_4/project.yml
  ✅ webprojects/user_story_5/project.yml
  ✅ webprojects/user_story_6/project.yml
  ✅ webprojects/user_story_7/project.yml

Discovered 31 valid project(s) across 1 repo(s).
Repos without project.yml: 0.
Total project.yml files inspected: 31.
```

## What the data actually looks like

| Metric | Value |
|--------|-------|
| Total projects | 31 |
| Collections | 6 (riwi-projects, python, ai-workflows, webprojects, infrastructure, low-code) |
| Leaves | 25 |
| Distinct `type` values | 8 (`script`, `web-app`, `collection`, `static-site`, `automation`, `cli`, `api`, `documentation`) |
| Distinct `status` values | 4 (`completed`, `(none — optional)`, `incomplete`, `in progress`) |
| Unique `id`s | 31 / 31 (cross-validation passes) |

## Six more divergences absorbed into the schema

The recursive walk surfaced types and statuses that hadn't appeared in
the first two smoke-test files. Each was absorbed into the schema:

| # | Divergence | Resolution |
|---|------------|------------|
| 8 | `type: documentation` not in enum | Added |
| 9 | `type: static-site` not in enum | Added |
| 10 | `type: cli` not in enum | Added |
| 11 | `type: automation` not in enum | Added |
| 12 | `type: api` not in enum | Added |
| 13 | `type: web-app` not in enum | Added |
| 14 | `status: incomplete` not in enum | Added |
| 15 | `status: in progress` not in enum | Added (note: multi-word status is allowed) |
| 16 | `status: in-progress` not in enum | Added (canonical kebab-case form) |
| 17 | `tech_stack.ai` sub-key not modelled | Added as a new sub-slot alongside `tools`, `databases`, etc. |
| 18 | `deployment.docusaurus` slot name not allowed | Deployment now allows any kebab-case slot name via `patternProperties` |
| 19 | `deployment.<slot>.type: static-site` not in DeploymentType | Added |
| 20 | `deployment.<slot>.active: true` extra property | Added as optional boolean |

That's a lot. But the cumulative pattern is the same: real-world data
keeps showing us where the contract was too strict.

## Schema additions (delta vs. Step 3)

```diff
   "ProjectType": { "enum": [
     ...existing...
+    "documentation",
+    "static-site",
+    "cli",
+    "automation",
+    "api",
+    "web-app"
   ]},
   "Status": { "enum": [
     ...existing...
+    "incomplete",
+    "in-progress",
+    "in progress"
   ]},
   "DeploymentType": { "enum": [
     ...existing...
+    "static-site"
   ]},
   "TechStack": { "properties": {
     ...existing...
+    "ai": { "type": "array", "items": { "$ref": "#/definitions/LanguageString" } }
   }},
   "DeploymentEntry": { "properties": {
     "type": { "$ref": "#/definitions/DeploymentType" },
     "url":  { "type": "string", "format": "uri" },
+    "active": { "type": "boolean", "description": "..." }
   }},
   "Deployment": {
     "properties": {
       "frontend": { "$ref": "#/definitions/DeploymentEntry" },
       "backend":  { "$ref": "#/definitions/DeploymentEntry" }
     },
+    "patternProperties": {
+      "^[a-z][a-z0-9-]*$": { "$ref": "#/definitions/DeploymentEntry" }
+    },
     "additionalProperties": false
   }
```

## Rate-limit handling

The recursive tree + 31 content fetches is **1 + 31 = 32 API calls**
if we used the Contents API for content. The GitHub REST API's
unauthenticated limit is **60 req/hour**, so 32 calls is borderline.
A repeated run quickly exhausts the budget.

Step 5 mitigates by switching per-file content fetches to
`raw.githubusercontent.com`, which is served from a CDN and does
**not** count against the REST API limit. After this change, only
**2 API calls** touch the REST API per repo:

1. `GET /users/{user}/repos` — list repos for the user.
2. `GET /repos/{owner}/{name}/git/trees/{branch}?recursive=1` — list files.

This is well within the unauthenticated budget and will easily survive
many reruns in a local dev session.

A token via `GITHUB_TOKEN` raises the limit to 5000 req/hour for
production CI use. Documented in the script header.

## Cross-validation: unique project IDs

The discoverer now also cross-validates that every project's `id` is
unique across the entire portfolio. Collisions are appended to
`errors.json` with `stage: "cross-id"`.

Currently: 31/31 unique IDs. No collisions.

This catches a class of bug that per-file schema validation cannot —
two different projects declaring the same `id` would silently collide in
the URL space (`/projects/<id>/`).

## Page rendering

The page now groups the 31 discovered projects by their top-level
collection:

- **Hero**: `Riwi Projects` (the root collection) with description,
  categories and a count of sub-collections / leaves.
- **5 collection sections**, each with the collection's description
  and a grid of leaf cards:
  - AI workflows (3 leaves)
  - Infrastructure (0 leaves)
  - Low code (0 leaves)
  - Python projects (10 leaves)
  - Web projects (12 leaves)
- **3 utility sections**: How discovery works, Project types chips,
  All categories chips.

Each card shows the project's name, description, type, status,
categories, languages, and a link to its GitHub repo.

The rendered HTML is ~36 KB (single static page, no JS).

## What didn't go smoothly

### 1. The recursive walk was rate-limited once

The first attempt used the Contents API for every file (31 calls).
Combined with the listing call, we hit the 60-req/hour limit and
saved an incomplete result before being throttled. The fix was the
raw-URL migration above.

### 2. The grouping logic in the page was wrong initially

First version used `byParent.get(collection._meta.path)` to find
children. But children's `parent_path` is the **immediate parent
directory** (e.g. `python/workshop_1`), not the collection's path
(e.g. `python/project.yml`). Fixed by switching to path-prefix
matching: a project X is a descendant of collection C if
`X._meta.parent_path.startsWith(C._meta.parent_path + '/')`.

### 3. The root collection was initially invisible

First version of the page didn't render the root collection anywhere
because it's the only project with `parent_path: null`. Fixed by
adding an explicit hero block for it.

## What's now true about the system

- All 31 real-world `project.yml` files validate against the schema.
- The schema has been refined **13 times** based on real data
  (Steps 1, 2, 3, 4, 5 — see `docs/STEP-{1..4}-RESULT.md` for the
  earlier ones).
- The page is no longer a smoke test — it's a real portfolio index
  for 31 projects across 6 collections.
- Adding a new project requires only:
  1. `project.yml` in the repo (or any nested subdirectory).
  2. `npm run discover` (or push to `main` once CI is wired).
  3. `npm run build`.

## Step 6 — recommended next move

Step 6 should turn this from "one big index page" into a real
portfolio with per-project pages:

1. Add `src/pages/projects/[id].astro` for individual project detail
   pages (the `ProjectHero`, `ProjectSidebar`, `ProjectTabs`
   components from `docs/11-frontend-contract.md`).
2. Add `src/pages/categories/[category].astro` and
   `src/pages/tags/[tag].astro` so the categories and tags become
   filterable routes.
3. Generate TypeScript types from the schema with
   `json-schema-to-typescript` and replace the `any`-typed interfaces
   in `index.astro` with the generated ones.
4. Wire the GitHub Actions deploy workflow (`withastro/action@v6` +
   `actions/deploy-pages@v5`) so the whole thing deploys to
   `https://SrLampi1001.github.io` automatically.
5. Cache the tree API result so rebuilds don't re-walk repos that
   haven't changed (Actions cache + `If-None-Match` for the API).

## How to reproduce

```bash
npm install
npm run discover          # walks the recursive tree, validates, writes JSON
npm run build             # renders index.html
npm run preview           # http://localhost:4321/

# all-in-one:
npm run build:full
```

Expected output: 31 projects rendered in 6 sections (5 sub-collections
plus the root hero).

## Files changed in this step

| | | Lines |
|---|----------|-------|
| Modified | `schema/project.schema.json` | 228 → 264 |
| Modified | `scripts/discover-projects.mjs` | 195 → 270 |
| Modified | `src/pages/index.astro` | 268 → 365 |
| New | `docs/STEP-5-RESULT.md` | this file |

Step 5 keeps the file footprint minimal: ~110 net new lines of code
plus a 13-divergence schema expansion. The page now genuinely looks
like a portfolio index.