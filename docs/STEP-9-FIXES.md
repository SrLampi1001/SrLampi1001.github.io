# Step 9 fixes — Pyodide stdin, terminal disposal, deploy branch

> Date: 2026-10-04
> Status: ✅ Three bugs fixed; deploy now works on the `main` branch.

The first deploy of Step 9 went out cleanly (no build failures) but the
Pyodide demo failed at runtime. This doc captures the three problems,
their root causes, and the fixes.

## Bug 1 — `OSError: [Errno 29] I/O error` from Python's `input()`

### Root cause

The original `PyodideTerminal.astro` returned a **Promise** from the
stdin callback:

```js
pyodide.setStdin({
  stdin: () => new Promise((resolve) => { /* ... */ }),
  isatty: true,
});
```

But Pyodide 0.28's stdin handler is **fully synchronous**. From the
official docs
(<https://pyodide.org/en/stable/usage/streams.html>):

> `stdin` should be a zero-argument function which should return one
> of:
> 1. A string which represents a full line of text (it will have a
>    newline appended if it does not already end in one).
> 2. An array buffer or Uint8Array containing utf8 encoded characters
> 3. A number between 0 and 255 which indicates one byte of input
> 4. `undefined` or `null` which indicates EOF.

Returning a Promise was returned to Python's `_read_stdin` as-is. The
Promise object is not a string, so Python's `input()` raised the
fallback `OSError: I/O error`.

### Fix

Use a **synchronous queue**. Each call to Python's `input()` consumes
one entry:

```js
const stdinQueue: string[] = [...inputs]; // pre-populated

pyodide.setStdin({
  stdin: () => stdinQueue.shift() ?? null,
  isatty: false,
});
```

The fixture in `src/data/projects.json` now provides six pre-baked
inputs that drive `taller2.py` through a realistic flow (add a
product → list inventory → exit):

```json
"demo": {
  "enabled": true,
  "type": "python",
  "runtime": "pyodide",
  "entrypoint": "python/workshop_2/taller2.py",
  "inputs": ["1", "Demo Product", "9.99", "3", "2", "5"]
}
```

### Future work for true interactive stdin

The synchronous stdin handler means the user must pre-supply all
inputs — `input()` calls can't be answered mid-execution.

Pyodide **does** support a `read` callback that can block, and a
Web Worker can run Pyodide in the background while the main thread
captures keystrokes. Implementing this is a follow-up (Step 10).

## Bug 2 — Re-running stacks new terminals in the same container

### Root cause

The original `Run` click handler created a new xterm.js Terminal on
every click. xterm.js doesn't deduplicate against the same parent
container, so multiple terminals stacked inside the single `.demo-body`
div, overflowing the box.

### Fix

Track each container's terminal in a `WeakMap<HTMLElement, { term,
fit }>` and dispose it before creating a new one:

```js
const prev = containerState.get(body);
if (prev) {
  try { prev.fit.dispose(); } catch {}
  try { prev.term.dispose(); } catch {}
  containerState.delete(body);
}
body.replaceChildren();  // wipe any leftover DOM

const term = new Terminal({ /* ... */ });
// ... open, fit, store back in the WeakMap
containerState.set(body, { term, fit });
```

The `Retry` / `Restart` buttons now work cleanly: clicking "Run" a
second time disposes the previous terminal and mounts a fresh one.

## Bug 3 — Line breaks not rendered properly in xterm.js

### Root cause

xterm.js's default behaviour for `\n` depends on the
`convertEol` option. Without it, `\n` alone is not treated as a
line break — only `\r\n` is. The original handler was converting
`\n` to `\r\n` correctly, but combined with xterm.js's default,
some renderers were inconsistent.

### Fix

Set `convertEol: true` on the Terminal so a single `\n` advances the
cursor properly:

```js
const term = new Terminal({
  // ...
  convertEol: true,
  scrollback: 5000,
});
```

Also increased the terminal height from 360 px to 480 px and the
scrollback to 5000 lines so taller scripts render comfortably.

## Bug 4 — Deploy didn't fire on `develop`

### Root cause

The workflow had:

```yaml
on:
  push:
    branches: [develop]
```

But the live portfolio was being served from `main`, not `develop`.
Pushes to `develop` don't deploy because GitHub Pages is configured
to publish from `main`.

### Fix

Change the workflow trigger to `main`:

```yaml
on:
  push:
    branches: [main]
```

This matches what the user did locally to make the deploy fire.

## Files changed

| | |
|---|---|
| `src/components/PyodideTerminal.astro` | Rewrote stdin to use a sync queue; added terminal disposal via WeakMap; set `convertEol: true`; increased height/scrollback. |
| `src/data/projects.json` | Fixture now includes `demo.inputs` (six pre-baked lines that drive taller2.py through a meaningful run). |
| `.github/workflows/deploy.yml` | `branches: [develop]` → `branches: [main]`. |

## Verified

- `npm run build`: 154 pages in ~2.4 s.
- `npx astro check`: 0 errors.
- `data-inputs="[\"1\",\"Demo Product\",\"9.99\",\"3\",\"2\",\"5\"]"` is rendered on the page, which Pyodide's stdin callback will consume one entry at a time when the user clicks **Run**.

## What still doesn't work (deferred)

- **True interactive stdin** (user types in response to mid-script
  `input()` calls): Pyodide 0.28's sync stdin can't support this.
  Requires running Pyodide in a Web Worker so a busy-wait doesn't
  freeze the page.
- **The pre-baked inputs are static** — there's no UI for the visitor
  to override them. For demos with predictable flows this is fine; for
  open-ended scripts it's not.