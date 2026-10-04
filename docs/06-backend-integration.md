# 06 — Backend Integration

The portfolio itself is fully static — no application server, no database on the portfolio side. But the **projects** it indexes frequently have backend components, and the portfolio may want to display view counts, comments or likes on top of them.

This document covers:

- when each provider is the right choice (Supabase, Cloudflare, Render,   Vercel, custom);
- the patterns for letting the static portfolio talk to those backends   safely;
- what belongs in `project.yml` versus what belongs in the project's own   deployment configuration.

---

## 1. What lives where

| Concern | Lives in |
|---------|----------|
| Portfolio site HTML/CSS/JS | This repo (`SrLampi1001.github.io`) |
| Project source code | Each project's own repo |
| Project API / backend runtime | The project's own deployment (Render, Cloudflare, etc.) |
| Portfolio-level metadata (likes, comments, view counts) | Optional: a portfolio-owned backend (Supabase) |
| Authentication for portfolio owners | Supabase (GitHub OAuth preferred) |

The portfolio **does not own the project's runtime**. A project that already deploys to Render keeps deploying to Render; the portfolio just learns the URL from `project.yml` and links to it.

---

## 2. Provider matrix

| Provider | Best for | Free tier | Caveats |
|----------|----------|-----------|---------|
| **GitHub Pages** | Static frontends, docs | Unlimited for public repos | No backend, no custom server. This is what the *portfolio itself* uses. |
| **Cloudflare Pages** | Static frontends, JAMstack | Unlimited requests, 500 builds/mo | Faster global edge than GH Pages; supports Functions for lightweight backends. |
| **Cloudflare Workers** | Stateless API endpoints, edge logic | 100k req/day | Not a full Node.js runtime; V8 isolates. Good for JSON APIs, not for heavy compute. |
| **Vercel** | Next.js / SSR frontends, serverless functions | 100 GB bandwidth, 100k invocations | Easy GitHub integration; can host both frontend and API. |
| **Render** | Long-running backends, Docker containers | 750 hrs/mo free, sleeps after 15 min idle | Slow cold starts on free tier; good fit for FastAPI, Express, .NET, etc. |
| **Supabase** | Postgres DB + Auth + Storage + Realtime + Edge Functions | 500 MB DB, 1 GB storage, 50k MAU, **7-day inactivity pause** | Tied to Postgres; needs cron ping or paid plan to avoid pause. |

For the portfolio itself, the recommended split is:

- **Portfolio site** → GitHub Pages (this repo).
- **Portfolio-level data** (likes, view counts) → Supabase, **only if** the   features are worth the maintenance.
- **Each project's backend** → whatever the project author picked. The   portfolio only consumes the URL.

---

## 3. GitHub Pages (this repo's home)

This is the deployment target for the portfolio. See [04 — Deployment & GitHub Pages](./04-deployment.md) for the full setup. The short version:

- The portfolio is a static Astro build.
- Deployment uses `withastro/action@v6` + `actions/deploy-pages@v5`.
- Custom domain (optional) is configured in the Pages UI, not via a   committed `CNAME` file.

---

## 4. Supabase (portfolio-level persistence)

If the portfolio grows features like project view counts, likes or comments, Supabase is a natural fit. The architecture decision is whether to do it at all — these features are nice-to-have, not core.

### 4.1 Client

Pin to the current stable `@supabase/supabase-js` v2 line:

```bash
npm install @supabase/supabase-js
```

Or via CDN for the smallest possible footprint:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
```

The publishable key (`sb_publishable_...`) is the modern equivalent of the old `anon` key. It is safe to embed in client code **as long as RLS is correctly enforced** on every exposed table.

### 4.2 Row Level Security — non-negotiable

Every table in an exposed schema must have RLS enabled, with policies scoped to the smallest possible role and operation. The CVE-2025-48757 incident (and similar) happened because RLS was off on tables the publishable key could read.

Hard rules from the current Supabase docs:

1. **Enable RLS on every table in an exposed schema.**
2. **Revoke default grants, then re-grant narrowly.** RLS filters rows; it    does not revoke SQL privileges.
3. **Write a separate policy per operation.** Avoid `FOR ALL`; one bad    branch can silently open `INSERT` to anonymous.
4. **Always name the role in `TO`.** `TO authenticated`, `TO anon`, etc.
5. **For UPDATE, use both `USING` and `WITH CHECK`.** `USING` filters which    rows; `WITH CHECK` prevents changing the user/owner column.
6. **Use `(select auth.uid())` not `auth.uid()`** — the subselect is    cached per statement (`initPlan`), the function call is not. Order of    magnitude faster.
7. **Index every column that appears in a policy.**
8. **`FORCE ROW LEVEL SECURITY`** on tables used by `SECURITY DEFINER`    functions.
9. **Views don't get RLS by default.** Use `security_invoker = true` on    Postgres 15+ or revoke access from public roles.

### 4.3 Example: project likes

```sql
create table public.project_likes (
  project_id text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.project_likes enable row level security;
alter table public.project_likes force row level security;

-- Anyone may count likes
create policy "likes_read" on public.project_likes
  for select to anon, authenticated using (true);

-- Only authenticated may like
create policy "likes_insert" on public.project_likes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- A user may remove their own like
create policy "likes_delete" on public.project_likes
  for delete to authenticated
  using ((select auth.uid()) = user_id);
```

The service role key (`sb_secret_...`) **never** ships in client code. It bypasses RLS and is only used server-side.

### 4.4 Auth for portfolio features

For a GitHub-themed site, **GitHub OAuth** is the obvious choice. Visitors can comment and like with their existing GitHub identity, and you can show their GitHub username + avatar in the UI.

Setup outline:

1. Create a GitHub OAuth App at `https://github.com/settings/developers`.    Callback: `https://<ref>.supabase.co/auth/v1/callback`.
2. Paste Client ID + Secret into Supabase → Authentication → Providers →    GitHub.
3. In the browser: `supabase.auth.signInWithOAuth({ provider: 'github' })`.

If the portfolio wants to let visitors **browse anonymously** (view counts, for example) without forcing sign-in, **anonymous sign-ins** are a good fit and are now stable. Pair with Cloudflare Turnstile or hCaptcha to prevent abuse.

### 4.5 Free-tier gotcha: the 7-day pause

A Supabase free-tier project is paused after ~7 days of low database activity. For a portfolio that gets sporadic traffic, this means the API will become unreachable without warning.

Two options:

- **Heartbeat cron**: a GitHub Actions cron hits a tiny endpoint on the   Supabase project (e.g. a `select 1` against a heartbeat table) every 3   days. Cheap and reliable.
- **Upgrade to Pro ($25/mo)**: no pauses, more storage, longer log   retention. Justifiable once the portfolio is mature.

The heartbeat cron is the recommended path while the project is small.

### 4.6 Edge Functions — only when needed

Supabase Edge Functions are Deno scripts running globally. For the portfolio they are useful for:

- bumping view counts atomically (avoids exposing the table to direct   writes);
- rate-limiting anonymous actions by IP;
- proxying the GitHub API server-side to bypass the lower `GITHUB_TOKEN`   rate limit;
- sending transactional email for comment notifications.

For the initial system, every writable interaction can be an RPC (`security definer`) instead of an Edge Function. Add Edge Functions only when the RPC pattern is too restrictive.

---

## 5. Cloudflare Pages / Workers

Cloudflare Pages is a strong static-host alternative to GitHub Pages, with the bonus of built-in Workers for lightweight backends. The portfolio **currently uses** GitHub Pages; nothing about the architecture prevents moving to Pages later.

Cloudflare Workers are V8 isolates, not Node.js. They are ideal for:

- stateless JSON APIs;
- request rewriting;
- small transformations on the edge.

They are **not** suitable for:

- long-running computations (CPU time limits);
- anything that needs Node.js APIs (`fs`, etc.);
- WebSocket-heavy applications.

A FastAPI project should not be deployed to Workers; it should go to Render, Fly.io or Railway instead.

---

## 6. Render / Fly.io / Railway — for project backends

These are the right answer for backend-only projects (FastAPI, Express, Django, .NET, etc.) that need a long-running process. Render's free tier is the lowest entry cost but has cold starts after 15 minutes of idle. Fly.io and Railway are paid but cheap and reliable.

The portfolio's role with respect to these is just: read the URL from `project.yml`, link to it.

```yaml
deployment:
  backend:
    type: render
    url: https://my-project.onrender.com
```

The portfolio does not deploy, monitor or restart the backend. The project's own CI does that.

---

## 7. Vercel — for SSR frontends and serverless

Vercel is the obvious choice for Next.js, SvelteKit, Astro SSR, or any project that wants serverless functions tightly integrated with a frontend. The free tier covers small projects comfortably.

The portfolio treats a Vercel-deployed project identically to a Cloudflare-Pages-deployed one: read the URL, link to it.

---

## 8. Pyodide + Supabase (a fun combination)

The Pyodide demo runtime can talk to Supabase via the public REST endpoint, using `fetch()`. A small Python script in the browser can:

- fetch the latest 10 comments on a project;
- run a `pandas`/`numpy` analysis on cached data;
- render the result in the terminal.

Caveats:

- Pyodide + `supabase-py` is not officially tested; `httpx` works in   Pyodide but async APIs may need `pyodide-http` patching.
- Always use the **publishable** key, never the service role.
- RLS applies even from Pyodide; treat it as another browser client.

This is more demonstrative than useful — but for a portfolio, that's the point.

---

## 9. The "no backend" baseline

If the Supabase tier or any other backend is not justified yet, the portfolio works perfectly without one. The only thing it loses is:

- live view counts;
- likes;
- comments;
- any per-visitor personalised data.

These are all *additions*, not prerequisites. The core system — discovery, indexing, presentation, demos — is fully static.

---

## 10. Where to go next

- How the static site is hosted: [04 — Deployment & GitHub Pages](./04-deployment.md)
- How demos (including ones that talk to backends) work: [05 — Demo System (Pyodide & Terminals)](./05-demo-system.md)
- The contract that declares deployment URLs: [02 — The `project.yml` Contract](./02-project-yml-contract.md)