# 03 — Portfolio Setup (Astro)

This document describes how the Astro application is structured, how it discovers projects, and how it generates the static pages.

The portfolio uses **Astro 7.3.x** (the current stable line as of late 2026) with `output: 'static'` and Content Collections driven by the `glob()` loader over a directory of pre-cloned `project.yml` files.

---

## 1. Goals

The Astro application in this repository must:

- Discover every `project.yml` from every indexed repository.
- Validate each one against the contract in [02](./02-project-yml-contract.md).
- Render project pages, category pages, tag pages and technology-filtered   pages automatically.
- Render cards on the index page with filtering, sorting and search.
- Embed the appropriate demo for projects that opt in.
- Produce a fully static `dist/` directory that can be served from GitHub   Pages.
- Be fast: the build should complete in well under a minute even as the   number of indexed projects grows to several dozen.

---

## 2. Stack

| Concern | Choice |
|---------|--------|
| Framework | **Astro 7.3.x** (`output: 'static'`) |
| Language | **TypeScript** (`astro/tsconfigs/strict`) |
| Content | **Content Collections** + `glob()` loader over YAML |
| Validation | **Zod** schemas (via Astro's built-in support) at build time |
| Styling | **Vanilla CSS** (or a minimal utility layer such as Open Props). No CSS framework dependency required. |
| Search | Plain `<script>` with a small in-memory index (see below). No external search service. |
| Optional islands | **Preact** if rich interactivity is ever needed (smallest bundle). React/Solid are interchangeable. |
| Demo runtime | **Pyodide** loaded on demand (see [05](./05-demo-system.md)). |
| Markdown | Built-in (Astro 7 Rust pipeline). Used for README and architecture docs. |
| Package manager | **npm** (or pnpm, if preferred). |
| Node | **20 LTS** or **22 LTS**. |

No CSS framework (Tailwind, Bootstrap, etc.) is required. The visual layer is plain CSS with custom properties, optionally aided by [Open Props](https://open-props.style/) for design tokens.

---

## 3. Directory structure

The expected directory structure once the application is scaffolded:

```
SrLampi1001.github.io/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── public/
│   ├── CNAME                       # (only if using a custom domain)
│   └── favicon.svg
├── src/
│   ├── content.config.ts           # Content Collections schema (Zod)
│   ├── content/
│   │   └── projects/               # generated; do not edit
│   ├── data/
│   │   └── projects/               # generated; pre-cloned repos live here
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── ProjectLayout.astro
│   ├── components/
│   │   ├── ProjectCard.astro
│   │   ├── ProjectFilters.astro
│   │   ├── ProjectSearch.astro
│   │   ├── TechBadge.astro
│   │   ├── CategoryList.astro
│   │   ├── TagCloud.astro
│   │   ├── DemoFrame.astro         # iframe-based demos
│   │   └── PyodideTerminal.astro   # Pyodide-based demos
│   ├── pages/
│   │   ├── index.astro
│   │   ├── projects/
│   │   │   ├── index.astro
│   │   │   └── [id].astro
│   │   ├── categories/
│   │   │   ├── index.astro
│   │   │   └── [category].astro
│   │   ├── tags/
│   │   │   ├── index.astro
│   │   │   └── [tag].astro
│   │   └── about.astro
│   ├── lib/
│   │   ├── discovery.ts            # clones repos at build time
│   │   ├── github.ts               # GitHub REST API helpers
│   │   ├── validation.ts           # schema validation helpers
│   │   └── types.ts                # generated types
│   └── styles/
│       └── global.css
├── scripts/
│   └── fetch-projects.mjs          # invoked by CI to populate src/data/projects
├── data/                           # ignored by git; populated by scripts/fetch-projects
├── docs/                           # this documentation suite
└── .github/
    └── workflows/
        ├── portfolio-build.yml     # main build & deploy
        └── validate-yml.yml        # per-repo validation (optional)
```

`src/data/projects/` and `src/content/projects/` are **generated** at build time by the discovery workflow. They are written into `.gitignore` and re-populated on every CI execution.

---

## 4. `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://SrLampi1001.github.io',
  // base is NOT needed for the user-site form (<user>.github.io)

  output: 'static', // implicit default; stated for clarity

  build: {
    format: 'directory', // produces /projects/<id>/index.html
  },

  vite: {
    // keep server warm for dev
    server: { watch: { ignored: ['**/data/**'] } },
  },

  experimental: {
    // split the data store into 10MB chunks once it grows large
    collectionStorage: 'chunked',
  },
});
```

If a custom domain is used, replace `site` with the apex domain and ensure `public/CNAME` exists (see [04](./04-deployment.md)).

---

## 5. `tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "data", "node_modules"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["./src/components/*"],
      "@layouts/*": ["./src/layouts/*"],
      "@lib/*": ["./src/lib/*"]
    }
  }
}
```

`astro check` is run in CI to fail the build on any TypeScript error.

---

## 6. Content Collections schema (`src/content.config.ts`)

The collection schema **mirrors** the contract from [02 — The `project.yml` Contract](./02-project-yml-contract.md). It is the runtime enforcement of the contract.

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const project = z.object({
  // required
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['frontend', 'backend', 'application', 'fundamentals', 'collection']),
  categories: z.array(z.string()).min(1),
  tags: z.array(z.string()),
  status: z.enum(['active', 'maintained', 'archived', 'experimental']),
  tech_stack: z.object({
    languages: z.array(z.string()).default([]),
    frameworks: z.array(z.string()).default([]),
    libraries: z.array(z.string()).default([]),
    databases: z.array(z.string()).default([]),
    infrastructure: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
  }),
  repository: z.object({
    provider: z.literal('github'),
    owner: z.string().min(1),
    name: z.string().min(1),
    branch: z.string().default('main'),
  }),

  // optional
  components: z
    .object({
      frontend: z.boolean().optional(),
      backend: z.boolean().optional(),
      database: z.boolean().optional(),
      cli: z.boolean().optional(),
      wasm: z.boolean().optional(),
    })
    .partial()
    .optional(),
  created_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deployment: z
    .object({
      frontend: deploymentEntry.optional(),
      backend: deploymentEntry.optional(),
    })
    .optional(),
  demo: demoEntry.optional(),
  documentation: z
    .object({
      readme: z.string().optional(),
      architecture: z.object({ path: z.string() }).optional(),
      api: z.object({ path: z.string() }).optional(),
    })
    .optional(),
  presentation: z
    .object({
      featured: z.boolean().default(false),
      order: z.number().int().default(0),
      thumbnail: z.string().optional(),
    })
    .optional(),
});

const deploymentEntry = z.object({
  type: z.enum([
    'github-pages',
    'cloudflare-pages',
    'cloudflare-worker',
    'vercel',
    'render',
    'other',
  ]),
  url: z.string().url().optional(),
});

const demoEntry = z.object({
  enabled: z.boolean(),
  type: z.enum(['none', 'webpage', 'api', 'python', 'terminal', 'documentation']),
  runtime: z.string().optional(),
  entrypoint: z.string().optional(),
});

const projects = defineCollection({
  loader: glob({
    pattern: '**/project.yml',
    base: './src/data/projects',
  }),
  schema: project,
});

export const collections = { projects };
```

This file is the **single source of truth** for what a `project.yml` is allowed to contain. The same Zod schema is used by:

- the Astro build (validates every project as it is read);
- the per-repo CI validation action (so authors catch errors early);
- the local CLI tool `npm run validate` (so editors can lint).

---

## 7. Discovery workflow

The Astro build does **not** fetch repositories on its own. A pre-build step populates `./src/data/projects/` with one directory per indexed repository:

```text
src/data/projects/
├── react-todo/                 # repo: SrLampi1001/react-todo
│   └── project.yml
├── fastapi-api/
│   └── project.yml
└── riwi_projects/
    ├── project.yml             # collection
    ├── python/
    │   └── project.yml         # subproject
    └── javascript/
        └── project.yml
```

### 7.1 `scripts/fetch-projects.mjs`

A Node script that, given a list of repositories, clones (or fetches) each one into `src/data/projects/<repo-name>/`. Implementation outline:

```js
import { $ } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOS = [
  'SrLampi1001/react-todo',
  'SrLampi1001/fastapi-api',
  'SrLampi1001/riwi_projects',
  // ... add as projects grow
];

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/data/projects'
);

await $`mkdir -p ${ROOT}`;

// shallow clone (depth 1) in parallel; sparse-checkout keeps project.yml only
await Promise.all(
  REPOS.map(async (repo) => {
    const dir = path.join(ROOT, repo.split('/')[1]);
    await $`git clone --depth 1 --filter=blob:none --sparse https://github.com/${repo}.git ${dir}`;
    await $`git -C ${dir} sparse-checkout set 'project.yml' '*/project.yml'`;
    await $`git -C ${dir} checkout`;
  })
);
```

`sparse-checkout` keeps only the `project.yml` files (at any depth), which is exactly what the portfolio needs. The clones are shallow (`--depth 1`) to minimise data transfer.

### 7.2 Calling it

```bash
# locally (only if you want to test with real data)
node scripts/fetch-projects.mjs

# in CI (before the Astro build):
- run: node scripts/fetch-projects.mjs
```

`src/data/projects/` is in `.gitignore` and never committed. The CI runner re-clones on every build.

---

## 8. Dynamic routing: project pages

`src/pages/projects/[id].astro` renders one page per project. It uses Astro's `getStaticPaths()` to enumerate every project in the collection:

```astro
---
import { getCollection } from 'astro:content';
import ProjectLayout from '@layouts/ProjectLayout.astro';

export async function getStaticPaths() {
  const projects = await getCollection('projects');
  return projects.map((entry) => ({
    params: { id: entry.data.id },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();
---

<ProjectLayout project={entry.data}>
  <Content />
</ProjectLayout>
```

> **Note on `entry.render()`** — this works for Markdown content. For YAML content (which is what we have), `render()` returns `{ Content }` only when the file is Markdown. For YAML-only collections, `getStaticPaths` is sufficient and `entry.render()` is not required. See [Astro docs on Content Layer](https://docs.astro.build/en/guides/content-collections/) for the current pattern.

---

## 9. Index page with cards and filters

`src/pages/index.astro` is the homepage. It loads every project, sorts them, and renders cards plus a small client-side filter/search.

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '@layouts/BaseLayout.astro';
import ProjectCard from '@components/ProjectCard.astro';

const projects = await getCollection('projects');
const sorted = projects
  .map((p) => p.data)
  .sort((a, b) => {
    const fa = a.presentation?.featured ? -1000 : 0;
    const fb = b.presentation?.featured ? -1000 : 0;
    return fa - fb + (a.presentation?.order ?? 0) - (b.presentation?.order ?? 0);
  });
---

<BaseLayout title="SrLampi1001 — Projects">
  <h1>Projects</h1>
  <input type="search" id="project-search" placeholder="Search projects…" />

  <section id="project-grid">
    {sorted.map((p) => <ProjectCard project={p} />)}
  </section>

  <script>
    // tiny client-side filter
    const grid = document.getElementById('project-grid');
    const search = document.getElementById('project-search');
    const cards = Array.from(grid.querySelectorAll('article[data-tags]'));

    search?.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      for (const card of cards) {
        const haystack = (card.dataset.tags + ' ' + card.textContent).toLowerCase();
        card.hidden = q && !haystack.includes(q);
      }
    });
  </script>
</BaseLayout>
```

This is intentionally **zero-framework**: plain `<script>` with no dependencies. The total JavaScript sent to the client for the index page is typically under 2 KB.

---

## 10. Tag, category and technology pages

Each of these is generated the same way:

```astro
---
// src/pages/categories/[category].astro
import { getCollection } from 'astro:content';
import BaseLayout from '@layouts/BaseLayout.astro';
import ProjectCard from '@components/ProjectCard.astro';

export async function getStaticPaths() {
  const projects = await getCollection('projects');
  const categories = new Set<string>();
  for (const { data } of projects) {
    for (const c of data.categories) categories.add(c);
  }
  return [...categories].map((category) => ({
    params: { category },
    props: {
      projects: projects.filter((p) => p.data.categories.includes(category)),
    },
  }));
}

const { category } = Astro.params;
const { projects } = Astro.props;
---

<BaseLayout title={`Category: ${category}`}>
  <h1>{category}</h1>
  <section>
    {projects.map((p) => <ProjectCard project={p.data} />)}
  </section>
</BaseLayout>
```

The same pattern is used for `/tags/[tag]`, and for technology-filtered pages (`/tech/[language]`).

---

## 11. View transitions

`<ClientRouter />` (the modern successor to `<ViewTransitions />`) is included in the root layout to give smooth page transitions:

```astro
---
// src/layouts/BaseLayout.astro
import { ClientRouter } from 'astro:transitions';
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <ClientRouter />
  </head>
  <body>
    <slot />
  </body>
</html>
```

Note: if you later enable `experimental.csp` (added in Astro 6+), `<ClientRouter />` is incompatible. Use the browser-native `@view-transition` CSS rule instead.

---

## 12. Search

For a portfolio of dozens of projects, the lightest search is a JSON dump of the project index plus a small client-side matcher. At build time, generate `public/search-index.json`:

```js
// scripts/build-search-index.mjs
import { getCollection } from 'astro:content';
import fs from 'node:fs/promises';

const projects = await getCollection('projects');
const index = projects.map((p) => ({
  id: p.data.id,
  name: p.data.name,
  description: p.data.description,
  tags: p.data.tags,
  categories: p.data.categories,
  languages: p.data.tech_stack.languages,
}));

await fs.writeFile('public/search-index.json', JSON.stringify(index));
```

The index page lazy-fetches `search-index.json` and runs a fuzzy match client-side. For the expected scale this is more than fast enough and avoids embedding an entire search library.

---

## 13. Sitemap and metadata

`@astrojs/sitemap` generates `sitemap-index.xml` automatically from the output of `getStaticPaths`. Install:

```bash
npx astro add sitemap
```

Add it to `astro.config.mjs`:

```js
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://SrLampi1001.github.io',
  integrations: [sitemap()],
});
```

`<meta>` tags for each project page come from the project description and name, rendered in the `<head>` of `ProjectLayout.astro`.

---

## 14. Build performance

For a portfolio growing to 50+ projects, the build should remain well under 30 seconds on GitHub Actions runners. Key levers:

- **Content Collections cache** — Astro caches the parsed collection to   `.astro/data-store.json` between builds. With pre-cloned repos under   `src/data/projects/`, the cache keeps rebuilds fast when only one repo   changed.
- **Shallow clones** — the discovery script uses `--depth 1 --filter=blob:none`   to minimise transfer.
- **Sparse checkout** — only `project.yml` files are checked out, not full   source trees.
- **Parallel clones** — `Promise.all` in the discovery script.
- **`experimental.collectionStorage: 'chunked'`** — keeps the data store   under any threshold once it grows large.

For very large collections, monitor Astro's [`experimental.incrementalBuild`](https://astro.build/blog/astro-720) flag, which returns a `cacheKey` from `getStaticPaths` to skip unchanged pages.

---

## 15. Where to go next

- For how the build output is deployed: [04 — Deployment & GitHub Pages](./04-deployment.md)
- For how the Astro app talks to GitHub: [08 — CI/CD & Automation](./08-ci-cd.md)
- For the validation pipeline: [07 — Validation & Schema](./07-validation.md)
- For the Pyodide demo runtime: [05 — Demo System (Pyodide & Terminals)](./05-demo-system.md)