# 00 — Getting Started

This document is the practical entry point. It tells you what is currently in place in the `SrLampi1001.github.io` repository, what tooling is required to work on it, and the very first commands to run after cloning the repository.

> The portfolio is in an early stage. The repository currently contains only a legacy Jekyll stub (left over from before the migration plan). The Astro-based implementation described in the rest of the documentation will be added incrementally.

---

## 1. Current state of the repository

```
SrLampi1001.github.io/
├── _config.yml       # Legacy Jekyll configuration
├── README.md         # Brief placeholder description
└── docs/             # This documentation suite
```

There is no Astro project, no `package.json`, and no build pipeline yet. Adding the Astro application is the first implementation milestone; see [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md).

The legacy `_config.yml` and `README.md` will be removed once the Astro application is in place.

---

## 2. Prerequisites

To work on this portfolio locally you need:

| Tool | Minimum version | Why |
|------|-----------------|-----|
| **Node.js** | 20.x LTS (or newer) | Astro requires Node 18.20+ / 20.3+ / 22+. |
| **npm** | 10.x (bundled with Node) | Package manager. pnpm or yarn are fine alternatives. |
| **Git** | 2.30+ | Version control; required by the discovery workflow. |
| **A modern browser** | Any evergreen browser | For previewing the site and any Pyodide demos. |

Recommended additions:

| Tool | Purpose |
|------|---------|
| **VS Code** with the **Astro** extension | Syntax highlighting and inline errors for `.astro` files. |
| **nvm** (or `fnm`) | Switching between Node versions per project. |
| **GitHub CLI (`gh`)** | Triggering repository_dispatch events locally for testing. |

---

## 3. Local clone

```bash
git clone https://github.com/SrLampi1001/SrLampi1001.github.io.git
cd SrLampi1001.github.io
```

---

## 4. Local install (once Astro is added)

This command will apply once the Astro project has been scaffolded per [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md):

```bash
npm install
```

This installs:

- `astro`
- `typescript`
- `@astrojs/check`
- `@astrojs/sitemap`
- `js-yaml` and `yaml`
- `ajv` and `ajv-formats`
- `pyodide` (for the demo system)
- dev dependencies: `@types/node`, `vitest`, etc.

---

## 5. Local development

Once installed:

```bash
npm run dev
```

This starts the Astro dev server on `http://localhost:4321` with hot module replacement. Project pages, filters and search all work locally against the project metadata cached under `src/data/projects/`.

---

## 6. Local production build

```bash
npm run build
```

The static output is written to `./dist`. You can preview it locally before publishing with:

```bash
npm run preview
```

---

## 7. Deploying

The portfolio deploys automatically through a GitHub Actions workflow on every push to `main`. See [04 — Deployment & GitHub Pages](./04-deployment.md) and [08 — CI/CD & Automation](./08-ci-cd.md) for the full pipeline.

To trigger a rebuild manually:

```bash
gh workflow run portfolio-build.yml
```

---

## 8. Project status checklist

Use this checklist to track the work remaining before the platform is fully operational:

- [ ] Remove legacy Jekyll files.
- [ ] Scaffold Astro project (see [03](./03-portfolio-setup.md)).
- [ ] Define the canonical `project.yml` JSON Schema (see [02](./02-project-yml-contract.md)).
- [ ] Implement project discovery (see [03](./03-portfolio-setup.md)).
- [ ] Implement project pages and cards.
- [ ] Implement categories, tags, technology filters and search.
- [ ] Add the Pyodide demo runtime (see [05](./05-demo-system.md)).
- [ ] Wire GitHub Pages deployment with a custom domain (see [04](./04-deployment.md)).
- [ ] Add validation workflow (see [07](./07-validation.md)).
- [ ] Add cross-repo auto-discovery (see [08](./08-ci-cd.md)).

---

## 9. Where to go next

- If you are **implementing**, jump to [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md).
- If you are **adding a new project**, jump to [02 — The `project.yml` Contract](./02-project-yml-contract.md).
- If you want to understand the **bigger picture**, read [01 — Architecture](./01-architecture.md) first.
