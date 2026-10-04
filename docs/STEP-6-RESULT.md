# Step 6 — Per-project, category, and tag pages

> Date: 2026-10-04
> Status: ✅ Complete — the portfolio now has real per-project
> detail pages, per-category pages, and per-tag pages. **154 static
> HTML pages** are built in ~2 seconds.

## Goal

Turn the single-page portfolio index into a real multi-page site:

- `src/pages/projects/[id].astro` — one page per discovered project
- `src/pages/categories/[category].astro` — one page per distinct category
- `src/pages/categories/index.astro` — list of all categories
- `src/pages/tags/[tag].astro` — one page per distinct tag
- `src/pages/tags/index.astro` — tag cloud

## What got built

| File | Purpose |
|------|---------|
| `src/styles/global.css` | Shared design tokens, layout primitives, typography. |
| `src/lib/projects.ts` | Data-access layer: load, filter, group, find-by-id, related. |
| `src/components/SiteHeader.astro` | Primary nav with active-state highlight. |
| `src/components/ProjectCard.astro` | Reusable card used on home + category + tag + collection pages. |
| `src/components/ProjectHero.astro` | Project detail hero (title, description, status, chips). |
| `src/components/ProjectSidebar.astro` | Repo / deployment / status / components side panel. |
| `src/pages/projects/[id].astro` | Per-project detail (hero + tab strip + sidebar + related). |
| `src/pages/categories/[category].astro` | Per-category listing. |
| `src/pages/categories/index.astro` | All categories with counts. |
| `src/pages/tags/[tag].astro` | Per-tag listing. |
| `src/pages/tags/index.astro` | Tag cloud. |
| `src/pages/index.astro` | Updated home page with header, hero, sections, links. |

## Page distribution

| Route | Pages |
|-------|-------|
| `/` | 1 (home) |
| `/projects/` | 31 (one per discovered project) |
| `/categories/` | 24 (1 index + 23 distinct categories) |
| `/tags/` | 98 (1 index + 97 distinct tags) |
| **Total** | **154** |

Build time: **~2.0 s** for all 154 static pages.

## What each page renders

### Home (`/`)

- **Header** with primary nav (SrLampi1001 / Projects / Categories / Tags).
- **Validation banner** (green when all 31 projects pass; red otherwise).
- **Stats bar** (31 projects · 5 collections · 23 categories · 97 tags · 0 errors).
- **Hero** for the root collection (`★ Riwi Projects`) with description, categories, and counts.
- **★ Featured** grid (the 3 featured sub-collections: ai-workflows, python, webprojects).
- **One section per top-level collection** (5 of them): description + "View collection →" link + grid of leaf cards.
- **Standalone projects** section (currently empty since all leaves are in collections).
- **Browse by category / tag** chips (first 30 each, with link to the index pages).

### Per-project (`/projects/<id>/`)

- Header.
- **Hero** (name, description, type, status, categories, tags, repo link, branch).
- **Tab strip**: `#overview` `#tech` `#demo` (if enabled) `#docs` (if referenced) `#related`.
- **Sidebar** (right column on desktop, below on mobile): Repository, Deployment (one entry per slot, including non-standard slots like `docusaurus`), Status indicator, Demo (if any), Components.
- **Overview** section: description + a "What this includes" chip row of declared components.
- **Tech stack** section: dl listing of every populated `tech_stack.*` slot, with chips per item.
- **Demo** section: only when `project.demo.enabled` is true. Records the demo config; the actual interactive runtime lands in step 8.
- **Docs** section: only when `documentation` is present. Lists README + architecture + API + folders references.
- **Related projects** grid: up to 3 other projects ranked by shared categories (×2 weight) + shared tags.

### Per-category (`/categories/<category>/`)

- Header.
- Title "Category: <category>".
- Count of projects.
- Grid of `ProjectCard`s, each linking to its detail page.

### Categories index (`/categories/`)

- Header.
- Title "Categories".
- Tag cloud of all 23 categories, each with a count badge.

### Per-tag (`/tags/<tag>/`)

Same structure as per-category but for tags.

### Tags index (`/tags/`)

Same as categories index but for the 97 tags.

## Component contracts

The reusable components (`ProjectCard`, `ProjectHero`, `ProjectSidebar`,
`SiteHeader`) take their data from a typed `Project` interface defined
in `src/lib/projects.ts`. The interface mirrors the schema fields we
currently render; step 7 will replace it with types generated from the
JSON Schema by `json-schema-to-typescript`.

## Routing strategy

Astro's `getStaticPaths()` enumerates every page at build time:

```ts
// src/pages/projects/[id].astro
export async function getStaticPaths() {
  return allProjects.map((p) => ({
    params: { id: p.id },
    props: { project: p },
  }));
}
```

For categories:

```ts
export async function getStaticPaths() {
  return distinctCategories().map((category) => ({
    params: { category },
    props: { category, projects: projectsByCategory(category) },
  }));
}
```

The `params` object controls the URL slug. Categories and tags are
already kebab-case strings (`education`, `personal-portfolio`,
`module-1`), so they double as URL slugs without any normalization.

## Data layer

`src/lib/projects.ts` is the single point of truth for project data.
It exports:

| Function | Purpose |
|----------|---------|
| `allProjects` | The full discovered-and-validated list. |
| `allErrors` | Discovery / validation errors. |
| `findProjectById(id)` | Look up a single project. |
| `projectsByCategory(c)` | Filter by category. |
| `projectsByTag(t)` | Filter by tag. |
| `distinctCategories()` | Sorted list of distinct categories. |
| `distinctTags()` | Sorted list of distinct tags. |
| `categoryFacets()` | `[{ name, count }]` for the categories index. |
| `tagFacets()` | `[{ name, count }]` for the tags index. |
| `relatedProjects(p, limit)` | Projects ranked by shared categories + tags. |
| `projectsByCollection()` | `{ collection, children }[]` for the home page sections. |
| `findRootCollection()` | The collection whose `parent_path` is `null`. |

All pages import from here, so queries are consistent.

## Verified

| | |
|---|---|
| `npm run build` | 154 pages in 2.0 s |
| All 31 projects reachable from `/` | ✅ |
| All 31 projects have detail pages | ✅ |
| All 23 categories have listing pages | ✅ |
| All 97 tags have listing pages | ✅ |
| Internal links resolve to existing pages | ✅ |
| `categories/education/` shows 31 projects (every project is in this category) | ✅ |

## What's still missing (out of scope for Step 6)

These are deliberate follow-ups, not bugs:

- **Per-project demo embedding** (the Pyodide terminal etc.) — Step 8.
- **Search modal** (Cmd+K) — Step 9.
- **Filters on listing pages** (currently just a flat grid) — could be
  added to categories/tags pages later.
- **A footer** with last-build timestamp, repo link, etc.
- **OG / Twitter meta tags** for sharing.
- **Per-deployment-pages URLs** (currently derived from YAML, not
  validated as live).
- **A 404 page** styled to match the rest of the site.

## What the project.yml contract is teaching us

By extracting real data into 154 separate pages, we've implicitly
stressed-tested the contract further:

- Every project has a unique `id`. ✅ 31/31.
- Every project's `categories` and `tags` are URL-safe (kebab-case
  strings). ✅ all of them.
- `documentation.documentation-folder` (the legacy alias) and
  `documentation.folders` (canonical) both work. ✅
- `deployment.<slot>` slots named anything kebab-case work. ✅

No new divergences surfaced from the rendering pipeline itself.

## Step 7 — recommended next move

Three high-value directions:

1. **Generate TypeScript types from the schema** with
   `json-schema-to-typescript`. Removes the `any`-typed fields in
   `src/lib/projects.ts` and catches mismatches between schema and code
   at build time.

2. **Wire the deploy workflow** (`withastro/action@v6` +
   `actions/deploy-pages@v5`). This is the smallest amount of code
   that makes the whole thing live on `https://SrLampi1001.github.io`.

3. **Add the Pyodide demo runtime** to the per-project detail page so
   the `#demo` tab actually does something. Step 8 from the plan.

## How to reproduce

```bash
npm install
npm run discover
npm run build
npm run preview       # http://localhost:4321/
```

Navigate to `/`, click any project card → `/projects/<id>/`. Click a
category chip → `/categories/<category>/`. Click a tag chip →
`/tags/<tag>/`.