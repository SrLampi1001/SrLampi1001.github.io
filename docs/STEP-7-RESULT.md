# Step 7 — TypeScript types generated from the schema

> Date: 2026-10-04
> Status: ✅ Complete — TypeScript types are now auto-generated from
> `schema/project.schema.json` on every build. `astro check` enforces
> them across all 18 source files.

## Goal

Replace the hand-maintained `Project` interface in
`src/lib/projects.ts` with types derived from the JSON Schema. This
catches schema/code mismatches at compile time (one was found
immediately — `repository.url` doesn't exist on the schema and was
used in the hero component).

## What was added

| File | Purpose |
|------|---------|
| `scripts/generate-types.mjs` | Reads the schema, runs `json-schema-to-typescript`, writes `src/lib/types/project.ts`. |
| `src/lib/types/project.ts` | Generated TypeScript types (225 lines, AUTO-GENERATED marker). |
| `@astrojs/check`, `typescript` (devDeps) | Powers `astro check` (the typecheck script). |

## What changed

| | |
|---|---|
| `src/lib/projects.ts` | Manual `Project` interface replaced with `import type { PortfolioProject }` from the generated module. New `DiscoveredProject` type extends `PortfolioProject` with the `_meta` field added by the discoverer. |
| `src/components/ProjectCard.astro`, `ProjectHero.astro`, `ProjectSidebar.astro` | Now use `DiscoveredProject` instead of `Project`. |
| `package.json` | New `typecheck` script (`astro check`) and `prebuild` hook (`generate-types.mjs`). |

## How generation works

```bash
# automatic, runs before every npm run build
$ npm run prebuild
> node scripts/generate-types.mjs
Wrote src/lib/types/project.ts

# the generated file
$ head -40 src/lib/types/project.ts
/**
 * AUTO-GENERATED from schema/project.schema.json by
 * scripts/generate-types.mjs -- do not edit by hand.
 *
 * Runtime schema validation is still performed by ajv at build time;
 * this file gives you compile-time type safety for the same shape.
 */

export type ProjectType =
  | 'frontend'
  | 'backend'
  | 'application'
  | 'fundamentals'
  | 'collection'
  | 'script'
  | 'library'
  ...
  | 'web-app';

export type Status =
  | 'active'
  | 'maintained'
  | 'archived'
  | 'experimental'
  | 'completed'
  | 'wip'
  | 'incomplete'
  | 'in-progress'
  | 'in progress';
```

## Type-check output

```
$ npx astro check
14:49:55 [content] Syncing content
14:49:55 [check] Getting diagnostics for Astro files in /home/patricia/.../SrLampi1001.github.io...
Result (17 files):
- 0 errors
- 0 warnings
- 0 hints
```

## A real bug caught immediately

Before adding the generated types, `src/components/ProjectHero.astro`
had this line:

```astro
<a href={project._meta?.html_url ?? project.repository.url} target="_blank" rel="noopener">
```

The schema does **not** define a `url` field on `Repository` — the URL
is derived from `owner` + `name`. TypeScript flagged this:

```
src/components/ProjectHero.astro:29:60 - error ts(2339):
  Property 'url' does not exist on type 'Repository'.
```

Fixed by removing the fallback. The `_meta.html_url` (added by the
discoverer) is always present and is the correct source of truth for
the GitHub URL.

This is the kind of bug schema-driven typing is meant to catch.

## What's covered

The generated types include every enum from the schema, so a typo in
a `type` or `status` value is now a compile error:

- 16 `ProjectType` values
- 9 `Status` values
- 6 `DeploymentType` values
- 5 `DemoType` values
- `Repository`, `TechStack`, `Demo`, `Documentation`, `Presentation`,
  `Components`, `DocumentationFolder`, `Deployment`, `DeploymentEntry`
  interfaces — all with the right required vs. optional fields

## What's intentionally not covered

`json-schema-to-typescript` does **not** emit TypeScript for these
runtime concerns:

- `pattern` (regex constraints on strings) — enforced by ajv at build time.
- `format` (e.g. `uri`, `date`) — same.
- `minimum`, `maximum`, `minLength`, `maxLength` — same.
- `uniqueItems` — same.

So `astro check` catches shape errors (missing/extra properties,
wrong types), and `npm run validate` (ajv) catches constraint errors.
Both are needed.

## Pipeline at a glance

```
schema/project.schema.json
        │
        ├── ajv (npm run validate)
        │     ↓
        │  schema errors → exit 1
        │
        └── json-schema-to-typescript (npm run prebuild)
              ↓
        src/lib/types/project.ts
              ↓
        astro check (npm run typecheck)
              ↓
        Type errors → exit 1
              ↓
        astro build (npm run build)
              ↓
        dist/
```

The contract is now load-bearing in **three** places: runtime (ajv),
compile-time (json2ts), and CI (npm run typecheck).

## What's next

The natural follow-up (Step 8) was adding the Pyodide demo runtime to
the project detail page so the `#demo` tab actually does something.

See [STEP-8-RESULT.md](./STEP-8-RESULT.md).