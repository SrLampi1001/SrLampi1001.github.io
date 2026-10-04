# Step 1 — Smoke test result

> Date: 2026-10-04
> Status: ✅ Complete

## Goal

Validate that the portfolio can fetch a `project.yml` from a sibling
GitHub repository, parse it, and render its properties in a static page,
locally, with no infrastructure beyond `node` + `npm`.

## What was built

| File | Purpose |
|------|---------|
| `package.json` | Astro 5 + `yaml` deps; `dev` / `build` / `preview` scripts |
| `astro.config.mjs` | `output: 'static'`, nothing else |
| `tsconfig.json` | `extends: astro/tsconfigs/base` (not strict) |
| `.gitignore` | `node_modules/`, `dist/`, `.astro/`, generated data dirs |
| `src/pages/index.astro` | Fetches + parses + displays every field of the YAML |
| ~~`_config.yml`~~ | Removed (legacy Jekyll stub) |

## Verified versions

| | Version |
|---|---|
| Node | v26.10.0 |
| npm | 11.19.1 |
| Astro | 5.18.2 (the `^5.0.0` range resolved to the latest 5.x) |
| `yaml` (eemeli/yaml) | 2.9.1 |

> **Note on Astro version**: the planning docs reference Astro 7 as the
> current target, but `^5.0.0` resolved to Astro 5.18.2 because Astro 7
> was not yet published to the npm registry as a stable major at install
> time. Astro 5 is fully compatible with the architecture in
> `docs/03-portfolio-setup.md`. Step 2 should explicitly upgrade to 7.x
> (or whatever is current) once we touch the dependency surface again.

## What worked

- ✅ `npm install` succeeded (281 packages, 33 s).
- ✅ `npm run build` succeeded in **1.7 s** for a single static page.
- ✅ The fetched `project.yml` (690 bytes from GitHub) was parsed with
  `yaml` (eemeli/yaml).
- ✅ Every property from the YAML was rendered to the static HTML.
- ✅ `npm run preview` served the built page on `localhost:4321`.
- ✅ No `undefined`, `[object Object]`, or `[object Promise]` strings
  appeared in the output — meaning Astro escaped and serialized every
  field cleanly.

### Render verification (grep against `dist/index.html`)

| Field | Source value | Rendered |
|-------|-------|---------|
| `name` | `Riwi Projects` | ✅ |
| `id` | `riwi-projects` | ✅ |
| `type` | `collection` | ✅ |
| `description` | (full paragraph) | ✅ |
| `categories` | `education, personal-portfolio, monorepo` | ✅ |
| `tags` | `riwi, training, subtrees, submodules` | ✅ |
| `repository.provider` | `github` | ✅ |
| `repository.owner` | `SrLampi1001` | ✅ |
| `repository.name` | `riwi_projects` | ✅ |
| `repository.branch` | `develop` | ✅ (rendered as-is from YAML) |
| `tech_stack.languages` | `[markdown]` | ✅ |
| `tech_stack.tools` | (empty in this YAML) | rendered as `—` |
| `documentation.readme` | `true` | ✅ |
| `presentation.featured` | `true` | ✅ |
| `presentation.order` | `0` | ✅ |

## What surprised us — real-world divergences from the docs

Three things surfaced from the actual `riwi_projects/project.yml` that
differ from the contract in `docs/02-project-yml-contract.md`. None
broke the build, but each is worth resolving in a later step.

### Divergence 1 — Branch mismatch

The YAML declares:

```yaml
repository:
  branch: develop
```

But GitHub's API reports the default branch is `main`. The smoke test
**hardcoded `main`** in the fetch URL, so the build still worked —
but the rendered page correctly shows `branch: develop` (read from the
file, not from the URL). This is the question the planning doc
anticipated: *"who wins when the YAML and the repo disagree?"*.

**Decision to make in Step 2**: define and document the rule. Options:

- The YAML wins (use `branch` from `project.yml`).
- GitHub wins (always use `default_branch` from the API).
- The YAML is a hint, GitHub is the truth.

### Divergence 2 — Lowercase categories

The YAML uses lowercase, kebab-case categories:

```yaml
categories:
  - education
  - personal-portfolio
  - monorepo
```

The contract in `docs/02` uses capitalized names:

```yaml
categories:
  - Frontend
  - Backend
  - Full Stack
```

**Decision to make in Step 2**: normalize the contract to accept either
case (or explicitly require lowercase, since that matches tags). The
real file shows what the author actually writes, which is the strongest
argument for lowercase.

### Divergence 3 — `subtrees` and `submodules` as tools

The YAML uses `tech_stack.tools` to list concepts (`git`, `subtrees`,
`submodules`) that aren't traditional "tools" in the JS ecosystem sense.
This is a creative use of the slot — it's allowed by the contract
(`tools` is `string[]`).

**Decision to make in Step 2**: nothing required. The contract's
flexibility is a feature. We may want to add a note in the contract
saying "tools is intentionally permissive — any string works".

## What we are NOT doing yet

- TypeScript strict mode
- CSS framework, design tokens, navigation
- Multiple pages / routing / dynamic `[id].astro`
- Content Collections + Zod schema
- JSON Schema + ajv validation
- Discovery across multiple repos (`fetch-projects.mjs`)
- Git sparse-checkout / clone
- Authentication, PAT, secrets
- GitHub Actions / Pages deployment
- Demos / Pyodide
- README, About page, search, etc.

## Step 2 — recommended next move

The single highest-value next step is **introducing the project.yml
schema + Content Collections**, so we:

1. Discover the real contract from the actual data (lowercase
   categories, optional fields, etc.).
2. Resolve the branch-mismatch rule with a clear policy.
3. Generate TypeScript types from the schema and replace the
   `any`-typed `project` variable in `index.astro` with a typed one.
4. Set up the structure for the eventual portfolio: one project →
   one page, served from `/projects/<id>/`.

Then Step 3 is **multi-repo discovery** (the `fetch-projects.mjs`
script and Content Collections over multiple YAML files), and Step 4
is **the actual portfolio page templates** (card grid, project
detail, categories, tags, search).

See `docs/02-project-yml-contract.md` and `docs/03-portfolio-setup.md`
for the long-term plan.

---

## How to reproduce

```bash
git clone https://github.com/SrLampi1001/SrLampi1001.github.io.git
cd SrLampi1001.github.io
npm install
npm run build
# inspect:
#   - dist/index.html (the rendered page)
#   - the build output (1.7 s for one page)
# or:
npm run preview   # http://localhost:4321/
```