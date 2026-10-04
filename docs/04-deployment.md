# 04 — Deployment & GitHub Pages

The portfolio is a fully static site. There is no application server in the portfolio itself. Hosting is therefore trivial: build with Astro, deploy with GitHub Pages.

This document covers:

- the deployment workflow (`withastro/action` + `actions/deploy-pages`);
- the GitHub Pages configuration;
- custom domains and HTTPS;
- environment configuration (public vs. preview).

---

## 1. Hosting model

```
┌──────────────────────────────┐
│  GitHub Actions workflow     │
│  (this repo)                 │
│                              │
│  1. checkout                 │
│  2. fetch sibling repos      │
│  3. npm install              │
│  4. astro build              │
│  5. upload artifact          │
└──────────────┬───────────────┘
               │
               ▼
       actions/deploy-pages
               │
               ▼
┌──────────────────────────────┐
│      GitHub Pages            │
│  SrLampi1001.github.io       │
│  (or custom domain)          │
└──────────────────────────────┘
```

There is no runtime server. There is no Node.js process. The HTML, CSS, JavaScript and Pyodide assets are served straight from GitHub's edge.

---

## 2. Recommended workflow file

The official Astro team publishes a GitHub Action that runs the build and uploads the output as a Pages artifact. Combined with `actions/deploy-pages`, this is the documented recommendation.

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:
  repository_dispatch:
    types: [project-updated]
  schedule:
    # Backstop: every 6 hours, minute offset to avoid the top-of-hour spike
    - cron: '17 */6 * * *'

permissions:
  contents: read
  pages: write
  id-token: write

# Cancel overlapping runs so we don't build twice for back-to-back pushes.
concurrency:
  group: portfolio-build
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Pull `project.yml` from every sibling repo into src/data/projects/.
      - name: Fetch sibling project metadata
        run: node scripts/fetch-projects.mjs
        env:
          CROSS_REPO_PAT: ${{ secrets.CROSS_REPO_PAT }}

      - uses: withastro/action@v6

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

The four triggers (`push`, `workflow_dispatch`, `repository_dispatch`, `schedule`) form a defence-in-depth pattern — see [08 — CI/CD & Automation](./08-ci-cd.md) for the rationale.

### 2.1 Notes on the actions

- **`actions/checkout@v4`** — checkout this repository. v4 is the current   stable line recommended by the `withastro/action` example; v5 / v7 exist   with Node 24 runtime if you want to track newer versions.
- **`withastro/action@v6`** — composite action that installs Node 24,   installs dependencies from the lockfile, runs the build command, and   uploads the artifact. It auto-detects npm / pnpm / yarn / bun via the   lockfile.
- **`actions/deploy-pages@v5`** — official GitHub Pages deploy action. Runs   on Node 24, uses the `pages: write` and `id-token: write` permissions,   and polls the Pages deployment API with backoff + jitter.
- **Concurrency** — `cancel-in-progress: true` ensures that if a new push   arrives while a build is in flight, the old build is cancelled rather   than running twice.

---

## 3. Required GitHub repository settings

In the GitHub UI for `SrLampi1001.github.io`:

1. **Settings → Pages → Build and deployment → Source**: select **GitHub    Actions**. (Not "Deploy from a branch".)
2. **Settings → Pages → Custom domain**: enter your domain (if applicable).    See [section 6](#6-custom-domains) below.
3. **Settings → Pages → Enforce HTTPS**: tick this once the certificate is    issued.
4. **Settings → Environments → github-pages**: create the environment if it    does not already exist (the deploy job references it).

The `permissions` block in the workflow file grants the least-privilege permissions needed for Pages deployments:

```yaml
permissions:
  contents: read   # checkout this repo
  pages: write     # create the Pages deployment
  id-token: write  # OIDC for verification
```

---

## 4. Environment configuration

The portfolio reads a small number of public configuration values. There is **no** secret material in the portfolio (it is fully static).

### 4.1 Public environment variables

Variables that affect the build are exposed via `import.meta.env.PUBLIC_*` (in Astro, the `PUBLIC_` prefix is required for client-side access):

```env
# .env (committed; not secret)
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx...
PUBLIC_PYODIDE_VERSION=0.28.3
```

These are baked into the JS bundle at build time. They are public by design; the `sb_publishable_*` key is the new (rotating) anon key format, which is safe to expose when paired with proper RLS — see [06 — Backend Integration](./06-backend-integration.md).

### 4.2 Secrets

The only secret this workflow needs is the cross-repo PAT used by `scripts/fetch-projects.mjs`:

```yaml
env:
  CROSS_REPO_PAT: ${{ secrets.CROSS_REPO_PAT }}
```

Create this secret at **Settings → Secrets and variables → Actions**. The PAT should be a fine-grained token with `Contents: read` on the resource owner. See [08 — CI/CD & Automation](./08-ci-cd.md) for the full PAT configuration.

---

## 5. Custom domains

### 5.1 DNS records

If you want to use `example.com` (or `www.example.com`):

**Apex (`example.com`)** — four `A` records pointing to GitHub Pages IPs:

| Type | Host | Value |
|------|------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

**IPv6 (recommended)** — four `AAAA` records:

| Type | Host | Value |
|------|------|-------|
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

**`www` subdomain** — one `CNAME`:

| Type | Host | Value |
|------|------|-------|
| CNAME | `www` | `SrLampi1001.github.io.` |

GitHub automatically redirects apex ↔ `www` once both are set.

### 5.2 Pages settings

After the DNS records propagate:

1. **Settings → Pages → Custom domain** → enter the domain → **Save**.
2. Wait for the certificate to be issued (Let's Encrypt; can take up to 24    hours, usually minutes).
3. Tick **Enforce HTTPS**.

### 5.3 With the "GitHub Actions" publishing source, **no `CNAME` file is needed.**

Unlike branch-based publishing, the "GitHub Actions" source reads the custom domain from the Pages settings UI, not from a committed file. Do **not** add a `public/CNAME` file in your Astro project when using `actions/deploy-pages` — doing so is harmless but unnecessary, and can confuse the deployment if the file contains a stale domain.

---

## 6. Preview deployments

GitHub Pages does not natively support per-PR preview URLs the way Netlify or Vercel do. If you need previews, common patterns are:

1. **Cloudflare Pages** — move the deployment there. Cloudflare Pages supports    per-branch preview URLs natively and is a free static host.
2. **Manual preview workflow** — add a separate workflow that runs on PR    open, builds the site, and uploads the artifact somewhere viewable. Not    trivial; usually not worth it for a personal portfolio.

For the initial implementation, deployments are tied to `main` only.

---

## 7. What gets shipped

After `npm run build`, the Astro output lives in `./dist`:

```
dist/
├── index.html                     # /
├── projects/
│   └── <id>/index.html            # /projects/<id>/
├── categories/
│   └── <category>/index.html      # /categories/<category>/
├── tags/
│   └── <tag>/index.html           # /tags/<tag>/
├── about/index.html
├── search-index.json              # client-side search data
├── _astro/                        # hashed JS / fonts / CSS bundles
└── favicon.svg
```

The Pyodide runtime is **not** shipped in this directory. It is loaded on demand from the jsDelivr CDN the first time the user opens a demo — see [05 — Demo System (Pyodide & Terminals)](./05-demo-system.md).

---

## 8. Operational runbook

If a deploy fails:

1. Check the Actions tab — most failures are clear from the logs.
2. If the failure is in `scripts/fetch-projects.mjs`, the most likely cause    is the `CROSS_REPO_PAT` being expired or revoked. Rotate the secret.
3. If the failure is in `astro build`, run `npm run build` locally with the    same data fetch to reproduce.
4. If the failure is in `actions/deploy-pages`, check the GitHub Status page    for Pages incidents.

If a deploy succeeds but the site looks wrong:

1. Check `src/data/projects/` is populated (CI runs `fetch-projects.mjs`    first).
2. Check that any new project files validate against the schema (see    [07 — Validation & Schema](./07-validation.md)).
3. Hard-refresh the browser to bypass cache.

---

## 9. Where to go next

- How the build is triggered: [08 — CI/CD & Automation](./08-ci-cd.md)
- The Astro app that produces the build: [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md)
- The contract that has to validate before deployment: [07 — Validation & Schema](./07-validation.md)