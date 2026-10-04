# 02 — The `project.yml` Contract

Every indexed project must provide a `project.yml` file. This file is the
**human-defined metadata contract** that the portfolio reads to know how to
represent the project.

The contract is deliberately small, declarative and stable. Most operational
information (last commit, creation date, deployment URL when the project uses
GitHub Pages, etc.) is *not* stored in the YAML — it is derived from GitHub or
from the deployment provider at build time. The YAML only contains things that
require human judgment.

---

## 1. File location

- One `project.yml` at the **root** of a project repository for single-project repos.
- One `project.yml` per **subproject folder** for monorepos/collections (see [09](./09-monorepos.md)).
- The schema is the same in both cases.

The portfolio assumes that any `project.yml` it finds inside an indexed
repository represents one indexable project.

---

## 2. Schema at a glance

```yaml
project:

  id: my-project
  name: My Project
  description: >
    One-paragraph human-readable description of the project.

  type: application
  categories:
    - Full Stack
    - Education
  tags:
    - react
    - typescript
    - fastapi
    - postgresql

  status: active
  created_at: 2025-08-14

  tech_stack:
    languages:
      - TypeScript
      - Python
    frameworks:
      - React
      - FastAPI
    libraries:
      - Pydantic
    databases:
      - PostgreSQL
    infrastructure:
      - Docker
    tools:
      - GitHub Actions

  repository:
    provider: github
    owner: SrLampi1001
    name: my-project
    branch: main

  deployment:
    frontend:
      type: github-pages
    backend:
      type: cloudflare-worker
      url: https://my-project-api.example.workers.dev

  demo:
    enabled: true
    type: webpage
    runtime: static
    entrypoint: dist/index.html

  documentation:
    readme: README.md
    architecture:
      path: docs/architecture.md
    api:
      path: docs/api.md

  presentation:
    featured: false
    order: 0
    thumbnail: assets/thumbnail.png
```

---

## 3. Field reference

Each subsection below describes one top-level key of the contract. Required
fields are marked **(required)**.

### 3.1 `project.id` (required)

A short, URL-safe identifier. Lowercase, kebab-case, ASCII.

```yaml
id: my-project
```

Used to build URLs like `/projects/my-project/` and to look the project up in
the index.

### 3.2 `project.name` (required)

The display name. Free-form but should be human-readable.

```yaml
name: My Project
```

### 3.3 `project.description` (required)

One or two sentences that summarise what the project does. Used as the card
subtitle and as the `<meta name="description">` of the project page.

```yaml
description: >
  A calculator that runs entirely in the browser using Pyodide,
  with a terminal-style UI for entering inputs.
```

### 3.4 `project.type` (required)

The project's primary nature. One of:

```text
frontend       - browser UI, no server
backend        - server / API only
application    - full-stack or otherwise complex
fundamentals   - language-learning, algorithm practice, exercises
collection     - monorepo of multiple subprojects
```

If the project is genuinely hybrid, prefer `application` and use
`components` to describe the parts (see below).

### 3.5 `project.components` (optional)

A bag of flags describing which major parts the project includes. Useful when
`type` alone is too coarse.

```yaml
components:
  frontend: true
  backend: true
  database: true
```

Recognised flags (all optional, all default to `false`):

- `frontend`
- `backend`
- `database`
- `cli`
- `wasm`

### 3.6 `project.categories` (required)

A list of broad portfolio classifications. Categories are intentionally
controlled — keep this list small. Recommended set:

```text
Frontend
Backend
Full Stack
AI
DevOps
Fundamentals
Algorithms
Education
Experiments
```

Example:

```yaml
categories:
  - Full Stack
  - Education
```

### 3.7 `project.tags` (required)

A list of fine-grained searchable characteristics. Tags are free-form and may
include technology names, concepts or descriptors.

```yaml
tags:
  - react
  - typescript
  - fastapi
  - postgresql
  - jwt
  - docker
```

Use lowercase, kebab-case for consistency.

### 3.8 `project.status` (required)

One of:

```text
active        - under active development
maintained    - stable, accepting fixes
archived      - frozen, kept online but not developed
experimental  - early / proof-of-concept
```

### 3.9 `project.created_at` (optional)

ISO 8601 date (`YYYY-MM-DD`). This is the date the project *conceptually*
started, which may differ from the repository creation date.

If omitted, the portfolio falls back to the GitHub repository creation date.

The portfolio also computes `updated_at` from GitHub's latest commit; this is
not stored in `project.yml`.

### 3.10 `project.tech_stack` (required)

A structured description of the technologies used. Sub-keys:

| Key | What goes here |
|-----|----------------|
| `languages` | Programming languages used in source files. |
| `frameworks` | Major runtimes/frameworks (React, FastAPI, Astro). |
| `libraries` | Notable third-party libraries. |
| `databases` | Persistent stores (PostgreSQL, Redis, Supabase). |
| `infrastructure` | Hosting, container, orchestration (Docker, Cloudflare). |
| `tools` | Build/CI/linting tools (GitHub Actions, ESLint). |

All sub-keys default to `[]` and may be omitted entirely.

```yaml
tech_stack:
  languages:
    - Python
  frameworks:
    - FastAPI
  libraries:
    - Pydantic
  databases:
    - PostgreSQL
  infrastructure:
    - Docker
  tools:
    - GitHub Actions
```

The portfolio renders this as technology filters. Example: "Show me all
projects where `languages` includes `Python` and `databases` includes
`PostgreSQL`."

### 3.11 `project.repository` (required)

Describes where the source code lives. Only GitHub is currently supported.

```yaml
repository:
  provider: github
  owner: SrLampi1001
  name: my-project
  branch: main
```

Fields:

- `provider` (required): currently always `github`.
- `owner` (required): the GitHub owner (user or org).
- `name` (required): the repository name.
- `branch` (optional): the branch to track. Defaults to `main`.

The portfolio derives the canonical GitHub URL and the GitHub Pages URL (when
applicable) from these fields — there is no need to repeat them.

### 3.12 `project.deployment` (optional)

Describes external deployments of the project. Both `frontend` and `backend`
are optional.

```yaml
deployment:
  frontend:
    type: github-pages
  backend:
    type: cloudflare-worker
    url: https://my-project-api.example.workers.dev
```

Recognised `type` values:

| Type | Notes |
|------|-------|
| `github-pages` | Implicit URL is derived. `url` is not needed. |
| `cloudflare-pages` | URL required. |
| `cloudflare-worker` | URL required. |
| `vercel` | URL required. |
| `render` | URL required. |
| `other` | Free-form. URL required. |

If a project follows the standard GitHub Pages convention, the portfolio can
derive the URL from `repository.owner` + `repository.name`. An explicit `url`
is only required when the project uses another deployment location.

### 3.13 `project.demo` (optional)

Describes how the portfolio should present interactive functionality. A
project can have a deployment without having an embedded demo, and vice
versa.

```yaml
demo:
  enabled: true
  type: webpage
```

Recognised `type` values:

| Type | What it means |
|------|---------------|
| `none` | No interactive demo. The portfolio just shows the project page. |
| `webpage` | Embed the deployed frontend in an iframe. |
| `api` | Embed an interactive API explorer for the backend. |
| `python` | Run a Python script in the browser via Pyodide. |
| `terminal` | Run any language in a terminal-style sandbox (Pyodide, WASM, etc.). |
| `documentation` | Embed a documentation site in an iframe. |

Additional fields depending on type:

- `runtime`: identifier of the runtime (e.g. `pyodide`, `static`).
- `entrypoint`: path or URL the demo should load.

Example (Python demo):

```yaml
demo:
  enabled: true
  type: python
  runtime: pyodide
  entrypoint: python/calculadora.py
```

Example (static webpage demo):

```yaml
demo:
  enabled: true
  type: webpage
  runtime: static
  entrypoint: dist/index.html
```

### 3.14 `project.documentation` (optional)

References to in-repo documentation that the portfolio should render.

```yaml
documentation:
  readme: README.md
  architecture:
    path: docs/architecture.md
  api:
    path: docs/api.md
```

Paths are relative to the project repository root. The portfolio fetches the
content at build time and renders it inside the project page.

### 3.15 `project.presentation` (optional)

Hints for how the project should be visually presented in the portfolio.

```yaml
presentation:
  featured: true
  order: 10
  thumbnail: assets/thumbnail.png
```

Fields:

- `featured` (default `false`): if `true`, appears in the "Featured projects" carousel.
- `order` (default `0`): integer used to sort projects inside categories. Lower numbers come first.
- `thumbnail` (optional): path to a thumbnail image inside the repo. The portfolio falls back to a default if missing.

---

## 4. Three categories of metadata

The fields above intentionally fall into three categories:

### 4.1 Human-owned (in `project.yml`)

- name, description, type, components;
- categories, tags, status;
- tech_stack;
- demo configuration;
- presentation preferences;
- documentation references.

### 4.2 GitHub-owned (derived at build time)

- repository existence;
- repository creation date (`created_at` fallback);
- latest commit date (`updated_at`);
- canonical GitHub URL;
- default branch;
- language statistics (for fallback tech hints);
- stars, forks (for future widgets).

### 4.3 Provider-owned (derived from deployment)

- whether the deployment is reachable;
- deployment URL when not on GitHub Pages;
- status indicator colour.

The portfolio combines these sources instead of duplicating them.

---

## 5. Validation

Every `project.yml` is validated against a JSON Schema before it can be
indexed. Invalid YAML never silently makes it into the portfolio.

Schema validation is enforced both:

- **in the project repository's own CI** (so authors catch errors early);
- **in the portfolio's CI** (so the portfolio never publishes broken metadata).

See [07 — Validation & Schema](./07-validation.md) for the canonical JSON
Schema, the AJV-based validator, and how the workflow is wired.

---

## 6. Minimal valid example

A project repository may legally contain *only* a `project.yml` with the
required fields. Everything else is optional:

```yaml
project:
  id: hello-world
  name: Hello World
  description: A minimal example project.
  type: fundamentals
  categories: [Education]
  tags: [beginner]
  status: active
  tech_stack:
    languages: [Python]
  repository:
    provider: github
    owner: SrLampi1001
    name: hello-world
    branch: main
```

This is enough for the portfolio to render a project page.

---

## 7. Full example

```yaml
project:
  id: riwi-calculadora
  name: Riwi Calculadora
  description: >
    A small CLI-style calculator implemented in Python, exposed as a
    Pyodide demo in the portfolio.
  type: fundamentals
  categories: [Education, Fundamentals]
  tags: [python, cli, calculator]
  status: active
  created_at: 2024-09-01

  tech_stack:
    languages: [Python]
    frameworks: []
    libraries: []
    databases: []
    infrastructure: []
    tools: []

  repository:
    provider: github
    owner: SrLampi1001
    name: riwi_projects
    branch: main

  demo:
    enabled: true
    type: python
    runtime: pyodide
    entrypoint: python/calculadora.py

  presentation:
    featured: false
    order: 100
```

---

## 8. Where to go next

- The Astro app that consumes this contract: [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md)
- Validation tooling: [07 — Validation & Schema](./07-validation.md)
- Monorepos / collections (multiple `project.yml` per repo): [09 — Monorepos & Collections](./09-monorepos.md)