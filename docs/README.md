# SrLampi1001 Portfolio — Documentation

This directory contains the architectural and operational documentation for the **SrLampi1001 Project Portfolio Platform**.

The platform is a centralized, automatically maintained index of every public software project authored by [SrLampi1001](https://github.com/SrLampi1001). It is hosted at:

```
https://SrLampi1001.github.io
```

The portfolio is implemented with **Astro**, deployed as a fully static site through **GitHub Pages**, and consumes `project.yml` files from each project repository to render project pages, cards, categories, tags and filters.

The portfolio **does not own the projects it indexes**. Each project remains independently built, deployed and runnable on whatever technology stack is most appropriate for it.

---

## Reading order

If this is your first time here, read the documents in the order below. Later sections assume you have read earlier ones.

| # | Document | Purpose |
|---|----------|---------|
| 1 | [00 — Getting Started](./00-getting-started.md) | Prerequisites, local setup, first build, first deploy. |
| 2 | [01 — Architecture](./01-architecture.md) | High-level conceptual architecture and the separation of responsibilities. |
| 3 | [02 — The `project.yml` Contract](./02-project-yml-contract.md) | The metadata schema every indexed project must provide. |
| 4 | [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md) | How the Astro application is structured and how it discovers projects. |
| 5 | [04 — Deployment & GitHub Pages](./04-deployment.md) | How the portfolio is published, custom domain, environment configuration. |
| 6 | [05 — Demo System (Pyodide & Terminals)](./05-demo-system.md) | Browser-based Python execution and terminal-like UIs for project demos. |
| 7 | [06 — Backend Integration](./06-backend-integration.md) | Supabase, Cloudflare Workers, Render, Vercel — when and why each is used. |
| 8 | [07 — Validation & Schema](./07-validation.md) | Validating `project.yml` files with JSON Schema, CI integration. |
| 9 | [08 — CI/CD & Automation](./08-ci-cd.md) | GitHub Actions workflows for auto-discovery, rebuilds and cross-repo triggers. |
| 10 | [09 — Monorepos & Collections](./09-monorepos.md) | How a single repository can expose multiple indexed sub-projects. |
| 11 | [10 — Security Model](./10-security-model.md) | What is and is not safe to execute in the browser, and what is never allowed. |
| | [references/resources.md](./references/resources.md) | External links, libraries and tools referenced throughout the docs. |

---

## Core principle

> **The portfolio indexes projects; it does not own them.**

Every constraint in this documentation is in service of that principle.

A React project remains a React project. A FastAPI service remains a FastAPI service. A Python CLI remains a Python program. A Docusaurus site remains a Docusaurus site.

The portfolio provides a single, consistent way to **discover**, **understand** and **interact with** these projects, without forcing any of them to migrate to a particular framework.

---

## Project status

This is the documentation phase of the platform. The implementation will be built incrementally according to the architecture described here. See [00 — Getting Started](./00-getting-started.md) for what you can do *today*.