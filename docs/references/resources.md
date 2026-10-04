# References

External documentation, libraries and tools referenced throughout the SrLampi1001 portfolio documentation. All links verified at the time of writing.

---

## Astro

- [Astro homepage](https://astro.build) — current stable release
- [Astro 7 release announcement](https://astro.build/blog/astro-7) — Rust compiler, Vite 8, Rolldown
- [Configuration reference](https://docs.astro.build/en/reference/configuration-reference/)
- [TypeScript guide](https://docs.astro.build/en/guides/typescript/) — including `astro/tsconfigs/strict`
- [Content Collections](https://docs.astro.build/en/guides/content-collections/) — `getCollection()` and the Content Layer
- [Content Loader API](https://docs.astro.build/en/reference/content-loader-reference/) — custom loaders and `glob()` / `file()`
- [View Transitions](https://docs.astro.build/en/guides/view-transitions/) — now via `<ClientRouter />` in `astro:transitions`
- [Deploy to GitHub Pages](https://docs.astro.build/en/guides/deploy/github/) — official recipe
- [Astro sitemap integration](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- [`withastro/action` repository](https://github.com/withastro/action)

## Pyodide

- [Pyodide homepage](https://pyodide.org/)
- [Quickstart](https://pyodide.org/en/stable/usage/quickstart.html)
- [Downloading and deploying](https://pyodide.org/en/stable/usage/downloading-and-deploying.html) — `indexURL` and CDN notes
- [Loading custom Python code](https://pyodide.org/en/stable/usage/loading-custom-python-code.html) — fetch + VFS + exec pattern
- [Streams API (`setStdout`, `setStderr`, `setStdin`)](https://pyodide.org/en/stable/usage/streams.html)
- [Web Worker integration](https://pyodide.org/en/stable/usage/webworker.html)
- [JS API reference](https://pyodide.org/en/stable/usage/api/js-api.html)
- [FAQ](https://pyodide.org/en/stable/usage/faq.html) — including "Why can't I import a file I just wrote to the FS?"
- [Roadmap](https://pyodide.org/en/stable/project/roadmap.html) — sizes and load times
- [Changelog](https://pyodide.org/en/stable/project/changelog.html)
- [`console-v2.html`](https://cdn.jsdelivr.net/npm/pyodide@0.28.3/console-v2.html) — reference xterm.js + Pyodide console

## xterm.js

- [xterm.js homepage](https://xtermjs.org/)
- [GitHub repository](https://github.com/xtermjs/xterm.js)
- [Releases](https://github.com/xtermjs/xterm.js/releases) — major v6 (Dec 2025), stable v5.4 line
- [npm: `@xterm/xterm`](https://www.npmjs.com/package/@xterm/xterm)
- [Pyodide issue tracking xterm.js integration](https://github.com/pyodide/pyodide/issues/5760)

## PyScript (considered, not adopted for initial system)

- [PyScript documentation](https://docs.pyscript.net/2026.7.2/)
- [Terminal user guide](https://docs.pyscript.net/2026.7.2/user-guide/terminal/)

## Supabase

- [Supabase homepage](https://supabase.com)
- [`@supabase/supabase-js` on npm](https://www.npmjs.com/package/@supabase/supabase-js)
- [Supabase docs](https://supabase.com/docs)
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys) — `sb_publishable_...` / `sb_secret_...`
- [Choosing a server package](https://supabase.com/docs/guides/auth/choosing-a-server-package)
- [Row L Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — non-negotiable for static sites
- [GitHub OAuth provider](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [Magic links / OTP](https://supabase.com/docs/guides/auth/auth-magic-link)
- [Anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Pricing](https://supabase.com/pricing) — 500 MB DB, 1 GB storage, 50k MAU on Free
- [Billing & spend caps](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [CVE-2025-48757 writeup (Lovable RLS bypass)](https://www.bleek.dev/cve-2025-48757)

## GitHub Actions & Pages

- [GitHub Actions: events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) — including the explicit confirmation that `workflow_run` is **same-repo only**
- [`actions/checkout`](https://github.com/actions/checkout) — `repository` and `sparse-checkout` parameters
- [`actions/deploy-pages`](https://github.com/actions/deploy-pages) — official Pages deployment
- [`peter-evans/repository-dispatch`](https://github.com/peter-evans/repository-dispatch) — cross-repo dispatch sender
- [`actions/cache`](https://github.com/actions/cache)
- [GitHub Pages: configuring a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages: troubleshooting custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages)
- [GitHub REST API: repos](https://docs.github.com/en/rest/repos/repos)
- [GitHub REST API: contents](https://docs.github.com/en/rest/repos/contents)
- [Fine-grained personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)
- [`GrantBirki/json-yaml-validate`](https://github.com/marketplace/actions/json-yaml-validate) — third-party YAML/JSON validation Action (alternative to `ajv-cli`)

## YAML & JSON Schema

- [`yaml` (eemeli/yaml) v2](https://eemeli.org/yaml/) — YAML 1.2 + core schema
- [`ajv` JSON Schema validator](https://ajv.js.org/)
- [`ajv-formats`](https://ajv.js.org/packages/ajv-formats.html)
- [`ajv-errors`](https://ajv.js.org/packages/ajv-errors.html)
- [`ajv-keywords`](https://github.com/ajv-validator/ajv-keywords)
- [`ajv-cli`](https://github.com/ajv-validator/ajv-cli)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
- [JSON Schema specification index](https://json-schema.org/specification)
- [`json-schema-to-typescript`](https://github.com/bcherny/json-schema-to-typescript)
- [Red Hat `vscode-yaml`](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)
- [`yaml-language-server`](https://github.com/redhat-developer/yaml-language-server)
- [`yamllint`](https://yamllint.readthedocs.io/)

## Backend providers (alternatives to Supabase)

- [PocketBase](https://pocketbase.io) — single-binary SQLite + Auth + Storage
- [Cloudflare D1](https://www.cloudflare.com/products/d1/) — SQLite at the edge
- [Neon](https://neon.tech) — serverless Postgres with branching
- [Upstash](https://upstash.com) — serverless Redis + QStash
- [Firebase](https://firebase.google.com/) — Google's BaaS

## Hosting providers for project backends

- [Render](https://render.com) — long-running containers, free tier with cold starts
- [Vercel](https://vercel.com) — Next.js / SSR / serverless functions
- [Cloudflare Pages](https://pages.cloudflare.com) — static + Workers
- [Cloudflare Workers](https://workers.cloudflare.com) — V8 isolate edge functions
- [Fly.io](https://fly.io) — global application platform
- [Railway](https://railway.app) — simple PaaS

## Reference architectures

- [Docusaurus frontmatter validation](https://docusaurus.io/docs/markdown-features#front-matter) — closest precedent for required YAML metadata
- [Kubernetes manifests](https://kubernetes.io/docs/concepts/overview/working-with-objects/) — canonical example of JSON-Schema-driven YAML
- [Kubernetes YAML schema in `yaml-language-server`](https://github.com/redhat-developer/yaml-language-server#kubernetes)

## Security references

- [WebAssembly sandboxing for AI agents (NVIDIA developer blog)](https://developer.nvidia.com/blog/sandboxing-agentic-ai-workflows-with-webassembly/)
- [CVE-2025-68668 — n8n Pyodide sandbox escape](https://www.penligent.ai/hackinglabs/cve-2025-68668-deep-dive-the-n8n-pyodide-sandbox-escape-ai-infrastructure-risk/) — relevant only as a counter-example; not applicable to client-side Pyodide in a browser
- [OWASP Cheat Sheet: input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

---

*This file is regenerated whenever a dependency or recommendation changes. If a link breaks or a tool is superseded, please update this document and the relevant upstream link.*