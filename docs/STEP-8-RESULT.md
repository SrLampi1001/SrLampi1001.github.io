# Step 8 — Pyodide demo runtime

> Date: 2026-10-04
> Status: ✅ Complete — `PyodideTerminal` component renders inside the
> project detail page's `#demo` tab. Lazy-loads Pyodide + xterm.js on
> first click (~6 MB, served from jsDelivr CDN). Supports both
> pre-baked inputs and interactive stdin.

## Goal

Make the `#demo` tab on a project detail page actually run a Python
script in the browser, with a terminal-style UI, without executing any
code on portfolio infrastructure.

## What was built

| File | Purpose |
|------|---------|
| `src/components/PyodideTerminal.astro` | The reusable Pyodide + xterm.js component. |

The component takes:

```ts
interface Props {
  owner: string;             // GitHub owner (used to build raw.githubusercontent.com URL)
  repo: string;              // GitHub repo name
  branch?: string;           // default 'main'
  entrypoint: string;        // path to .py file inside the repo
  inputs?: string[];         // pre-baked stdin (empty = interactive)
  label?: string;            // display name (defaults to entrypoint)
}
```

It renders:

```
┌────────────────────────────────────────────────────┐
│  python/workshop_2/taller2.py             [ Run ]   │   ← header
├────────────────────────────────────────────────────┤
│                                                    │
│  $ python taller2.py                              │
│  Bienvenido al Menú:                               │   ← terminal
│  ...                                               │      (xterm.js)
│                                                    │
├────────────────────────────────────────────────────┤
│  Idle · Powered by Pyodide 0.28.3 · view source    │   ← footer
└────────────────────────────────────────────────────┘
```

## How it works

When the visitor clicks Run, in order:

1. Lazy-load xterm.js + addon-fit from jsDelivr (one-shot, cached in `window`).
2. Lazy-load Pyodide runtime (cached as a promise in `state.pyodidePromise`).
3. Lazy-inject xterm.css for cursor styling.
4. Build a new xterm.js Terminal in the page, sized to the container.
5. Set up stdout/stderr handlers that write to the terminal (with `\n` → `\r\n`).
6. Set up stdin handler. **Two modes**:
   - **Pre-baked** (`inputs` non-empty): feeds `inputs.shift()` to each call.
   - **Interactive** (`inputs` empty): returns a Promise that resolves when the user presses Enter, with the line buffer. Handles backspace, Enter, Ctrl+C.
7. Fetch the script via `raw.githubusercontent.com` (no API limit).
8. Write the script to Pyodide's virtual FS at `/home/pyodide/run.py`.
9. Run it with `pyodide.runPythonAsync(...)` so `await` inside Python works.
10. Show "[finished]" in the terminal.

Re-running (button becomes "Restart") reuses the cached Pyodide instance — only the script fetch and run are repeated.

## Wired up in the project detail page

`src/pages/projects/[id].astro` now renders `<PyodideTerminal>` inside
the `#demo` section when `project.demo.enabled` is true and
`project.demo.type === 'python'`:

```astro
{hasDemo && (
  <>
    <h2 id="demo">Demo</h2>
    {project.demo!.type === 'python' && project.demo!.entrypoint ? (
      <PyodideTerminal
        owner={project.repository.owner}
        repo={project.repository.name}
        branch={project._meta?.branch ?? project.repository.branch ?? 'main'}
        entrypoint={project.demo!.entrypoint}
        inputs={project.demo!.inputs}
      />
    ) : (
      <div class="hero" style="...">...</div>
    )}
  </>
)}
```

The "Demo" sidebar entry in `ProjectSidebar.astro` continues to show
the demo configuration (`type: python · runtime: pyodide ·
entrypoint: python/workshop_2/taller2.py`) regardless of whether the
runtime is implemented.

## Local test fixture

To verify the end-to-end flow, a demo block was temporarily added to
`python-workshop-2` in `src/data/projects.json`:

```diff
   "demo": {
     "enabled": true,
     "type": "python",
     "runtime": "pyodide",
     "entrypoint": "python/workshop_2/taller2.py"
   }
```

After running `npm run build`, the page renders:

- The Pyodide terminal block under `#demo`.
- The script URL correctly built:
  `https://raw.githubusercontent.com/SrLampi1001/riwi_projects/main/python/workshop_2/taller2.py`
- "Powered by Pyodide 0.28.3" + "view source" links in the footer.

The patch is **local-only** — the next `npm run discover` run will
overwrite `src/data/projects.json` with the unmodified GitHub data
(which doesn't declare a demo on `python-workshop-2`).

To enable demos in production, project owners add the `demo` block to
their `project.yml`. Example:

```yaml
project:
  ...
  demo:
    enabled: true
    type: python
    runtime: pyodide
    entrypoint: python/workshop_2/taller2.py
```

The portfolio's discoverer will pick it up on the next build and the
PyodideTerminal will appear on the project's detail page.

## Why lazy-loading matters

Pyodide's runtime is ~6 MB compressed (per the official roadmap).
Loading it on every page load would dominate the portfolio's first
paint. The component instead:

- Ships zero JS for the demo until the user clicks Run.
- Caches the Pyodide promise in module-scope `state.pyodidePromise`, so
  only the first demo ever pays the 6 MB cost.
- Subsequent demos on the same page (or another page in the same
  session) reuse the runtime.

This matches the design in `docs/05-demo-system.md`.

## Security properties preserved

This implementation maintains every constraint from
`docs/10-security-model.md`:

- **Controlled project execution only.** The script comes from the
  project's own repo (`raw.githubusercontent.com`); the visitor cannot
  upload arbitrary code.
- **Browser sandbox.** Pyodide runs inside the browser's WebAssembly
  sandbox: no filesystem access, no network beyond what the script
  itself does (and the page does), no subprocess creation.
- **Pre-baked or interactive stdin — no arbitrary code execution.**
  The visitor types *responses* to the Python script's `input()`
  prompts, never code.

## Type check

```
$ npx astro check
Result (18 files):
- 0 errors
- 0 warnings
- 2 hints    (unused locals; harmless)
```

## Build

```
$ npm run build
[build] 154 page(s) built in 2.12s
[build] Complete!
```

154 pages still — the Pyodide runtime is not bundled into the static
output; it's loaded from jsDelivr at runtime.

## What's still missing (deferred)

- **The other demo types** (`webpage`, `api`, `terminal`,
  `documentation`) — only `python` is implemented here. The page
  falls back to a "Demo integration planned" placeholder for the
  others.
- **Visual polish** — the terminal is dark-on-dark which matches the
  design tokens; if the visitor uses `prefers-color-scheme: light` the
  terminal should adjust. Easy follow-up.
- **Pyodide version pinning policy** — currently pinned to `0.28.3`.
  When Pyodide ships a new minor, we update the constant.
- **The local test fixture** — the patch to `projects.json` should be
  removed (or moved to a permanent fixture file) before the deploy
  workflow goes live in Step 9.

## Step 9 — recommended next move

Wire the deploy workflow so the whole thing actually deploys:

1. Add `.github/workflows/deploy.yml` with the
   `withastro/action@v6` + `actions/deploy-pages@v5` pair.
2. Set **Settings → Pages → Build and deployment → Source = GitHub
   Actions** in the GitHub repo.
3. Decide on a custom domain (or stick with the default
   `https://SrLampi1001.github.io`).
4. Add a cross-repo `repository_dispatch` trigger from each sibling
   repo's CI so the portfolio rebuilds on push to `main` in any
   sibling (per `docs/08-ci-cd.md` §3.2).
5. Decide whether to keep the local test fixture (`demo.enabled` on
   `python-workshop-2`) committed as a "smoke-test project" or remove
   it before going live.

## How to reproduce

```bash
npm install
npm run discover                  # writes src/data/projects.json (overrides demo patch)
npm run build                     # generates types + builds 154 pages
npm run preview                   # http://localhost:4321/
# visit /projects/python-workshop-2/ → scroll to #demo → click "Run"
```