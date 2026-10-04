# 05 — Demo System (Pyodide & Terminals)

Some indexed projects are CLI-style programs written in Python or other
languages. The portfolio's demo system lets visitors run those programs in
their own browser, with a terminal-like UI, **without** executing any code on
portfolio infrastructure.

The intended runtime is **Pyodide + WebAssembly**, with **xterm.js** as the
terminal UI. This document explains how it fits together, the trade-offs of
each choice, and the recommended pattern.

---

## 1. Goals and non-goals

### 1.1 Goals

- Run pre-existing Python scripts from the indexed repositories in the
  visitor's browser.
- Provide a familiar terminal-like UI (`xterm.js`) so the experience feels
  like a real CLI.
- Capture only the **inputs** the original Python program asks for (e.g.
  *"Ingrese un número: 25"*); never let the visitor submit new code.
- Reuse the same runtime across every demo so each one is just "load this
  script and run it."
- Load the ~6 MB Python runtime **on demand**, so the rest of the portfolio
  stays fast.

### 1.2 Non-goals

- Allowing the visitor to write arbitrary Python code (this is **out of
  scope** — see [10 — Security Model](./10-security-model.md)).
- Replacing a server-side runtime. Pyodide has no `subprocess`, no real
  filesystem, and limited networking. Anything that requires those should be
  hosted on a backend provider.
- Running untrusted code. Every script the portfolio loads is already public
  on GitHub and is reviewed through Git history.

---

## 2. Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Python runtime | **Pyodide** | The most mature in-browser CPython implementation; the de facto standard for browser-based Python. |
| Version | Current stable on jsDelivr (see [section 3](#3-version-and-cdn)) | Tracks the upstream CPython release cadence. |
| CDN | `https://cdn.jsdelivr.net/pyodide/<version>/full/` | Official recommendation; HTTP-cached by browsers globally. |
| Terminal UI | **xterm.js** (`@xterm/xterm`) | The industry standard; used by VS Code, Pyodide's own console, and most browser-based terminals. |
| Fit addon | `@xterm/addon-fit` | Keeps the terminal sized to its container. |
| Script loading | `fetch()` + write to MEMFS + `exec` | Single source of truth — Python files stay in their repository. |
| Web Worker | Optional, recommended for production | Keeps the main thread responsive during execution. |

PyScript was considered and rejected for the initial system. It is a
meta-framework that owns the HTML/JS plumbing; for a portfolio that already
has a full Astro app, it is an unnecessary layer. Direct Pyodide gives finer
control.

---

## 3. Version and CDN

Use the current stable Pyodide release. Pyodide's CDN is recommended for two
reasons:

1. **Browser HTTP cache**: returning visitors load the runtime from cache
   instead of re-downloading ~6 MB.
2. **Correctness**: Pyodide expects to find a coherent set of files at the
   `indexURL`. A mismatched `indexURL` causes "broken behaviour" per the
   official docs.

```js
const PYODIDE_VERSION = '0.28.3'; // pin to a known version
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
```

> **Version note**: Pyodide is currently mid-transition between the
> legacy 0.27/0.28/0.29 lines and a new 314.x numbering scheme aligned with
> CPython. Either line works. For the initial implementation, pin a specific
> version (e.g. `0.28.3` or the current latest) and update deliberately.

`loadPyodide()` is async:

```js
import { loadPyodide } from `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;

const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX });
```

---

## 4. The wrapper component

`src/components/PyodideTerminal.astro` is the reusable Astro component that
embeds a Pyodide terminal in a project page.

### 4.1 UI structure

```astro
---
// src/components/PyodideTerminal.astro
interface Props {
  /** Path to the .py file in the project repo, e.g. "python/calculadora.py" */
  entrypoint: string;
  /** Optional pre-baked inputs (see section 7) */
  inputs?: string[];
}

const { entrypoint, inputs = [] } = Astro.props;
---

<div class="pyodide-terminal" data-entrypoint={entrypoint} data-inputs={JSON.stringify(inputs)}>
  <div class="terminal-header">
    <span class="terminal-title">{entrypoint}</span>
    <button class="terminal-run" type="button">Run</button>
  </div>
  <div class="terminal-body" data-terminal></div>
</div>

<script>
  // Lazy-import Pyodide on first click
  let pyodidePromise: Promise<any> | null = null;
  async function getPyodide() {
    if (!pyodidePromise) {
      const { loadPyodide } = await import(
        'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs'
      );
      pyodidePromise = loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/',
      });
    }
    return pyodidePromise;
  }

  for (const root of document.querySelectorAll('.pyodide-terminal')) {
    const button = root.querySelector('.terminal-run') as HTMLButtonElement;
    const body = root.querySelector('[data-terminal]') as HTMLElement;
    const entrypoint = (root as HTMLElement).dataset.entrypoint!;
    const inputs = JSON.parse((root as HTMLElement).dataset.inputs || '[]');

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Loading Python runtime…';

      const pyodide = await getPyodide();
      const term = new (window as any).Terminal({ cols: 80, rows: 24 });
      const fit = new (window as any).FitAddon.FitAddon();
      term.loadAddon(fit);
      term.open(body);
      fit.fit();

      // Wire stdout/stderr to xterm.js
      pyodide.setStdout({
        batched: (s: string) => term.write(s.replace(/\n/g, '\r\n')),
      });
      pyodide.setStderr({
        batched: (s: string) =>
          term.write('\x1b[31m' + s.replace(/\n/g, '\r\n') + '\x1b[0m'),
      });

      // Wire stdin: feed pre-baked inputs one by one
      pyodide.setStdin({
        stdin: () => inputs.shift() ?? '',
        isatty: false,
      });

      // Fetch and run the script
      const url = entrypoint.startsWith('http')
        ? entrypoint
        : `${import.meta.env.PUBLIC_PROJECTS_BASE ?? ''}/${entrypoint}`;
      const src = await (await fetch(url)).text();
      pyodide.FS.writeFile('/home/pyodide/run.py', src);

      try {
        await pyodide.runPythonAsync(`
          import sys
          sys.argv = ['${entrypoint}']
          exec(open('/home/pyodide/run.py').read())
        `);
      } catch (err: any) {
        term.write('\r\n\x1b[31m' + String(err) + '\x1b[0m\r\n');
      }

      button.textContent = 'Run again';
      button.disabled = false;
    });
  }
</script>
```

This is a single component used by every Python demo in the portfolio. The
component is decoupled from the `.py` file: the page that includes it just
passes an `entrypoint` path and (optionally) a list of `inputs`.

---

## 5. Serving Python source files

The portfolio needs to serve the actual `.py` files from each project
repository. Three patterns, in order of preference:

### 5.1 Raw GitHub URLs (simplest, recommended initially)

```text
https://raw.githubusercontent.com/SrLampi1001/riwi_projects/main/python/calculadora.py
```

Pros: zero build work; the URL is computed from `repository.owner`,
`repository.name`, `repository.branch` and the entrypoint.

Cons: requires network access to `raw.githubusercontent.com`. Most browsers
will permit this from a GitHub Pages-hosted portfolio.

### 5.2 Pre-bundled at build time

For projects that should always work even without external connectivity, the
discovery workflow can fetch the `.py` files into `src/data/projects/...` (the
same shallow clone that fetches `project.yml`), and the Astro build copies
them to `dist/python/<repo>/<path>.py`.

This requires `scripts/fetch-projects.mjs` to also `--sparse-checkout` the
referenced `entrypoint` files. The threshold for adopting this pattern is
when a project's demo should be reachable offline or behind a corporate
firewall that blocks GitHub.

### 5.3 Inline in the HTML

Only acceptable for trivial one-liners. Loses the "Python file in repo"
mental model and is hard to maintain.

For the initial system, **5.1** is the recommended default. The Astro build
does not need to know about `.py` files at all.

---

## 6. Capturing `stdout`

Pyodide ships `setStdout({ batched })` which receives the Python output
**one line at a time**. The handler converts `\n` to `\r\n` because xterm.js
expects CR+LF.

```js
pyodide.setStdout({
  batched: (s) => term.write(s.replace(/\n/g, '\r\n')),
});

pyodide.setStderr({
  batched: (s) => term.write('\x1b[31m' + s.replace(/\n/g, '\r\n') + '\x1b[0m'),
});
```

The batched handler is the right choice for a terminal UI. The alternative
"raw" handler returns one byte at a time and is meant for non-terminal
destinations; the "write" handler returns a `Uint8Array` chunk.

For most beginner Python programs (`print("Hola, mundo")`,
`print(f"Resultado: {x}")`), batched is more than sufficient.

---

## 7. Capturing `stdin` for `input()`

Python's `input()` in the browser is non-trivial because there is no real
stdin. Pyodide's `setStdin()` API takes a handler that returns the next
line of input (or `null` for EOF).

### 7.1 Pre-baked inputs (recommended for portfolio demos)

For each demo, declare the inputs the program needs **in `project.yml`**. The
terminal UI feeds them one at a time:

```yaml
# in project.yml
demo:
  enabled: true
  type: python
  runtime: pyodide
  entrypoint: python/calculadora.py
  inputs:
    - "5"
    - "+"
    - "3"
```

```js
pyodide.setStdin({
  stdin: () => inputs.shift() ?? '',
  isatty: false,
});
```

The script runs deterministically. The visitor sees the prompts and the
outputs scroll past, exactly as if they had typed the inputs themselves.

### 7.2 Interactive input via the terminal (advanced)

If the visitor should be able to type inputs themselves, the stdin handler
becomes a promise that resolves when the user presses Enter:

```js
let stdinResolve: ((s: string) => void) | null = null;

pyodide.setStdin({
  stdin: () =>
    new Promise((resolve) => {
      stdinResolve = resolve;
    }),
  isatty: true,
});

// On xterm.js onData:
term.onData((data) => {
  const code = data.charCodeAt(0);
  if (code === 13) {
    // Enter
    stdinResolve?.(buffer);
    buffer = '';
    stdinResolve = null;
    term.write('\r\n');
  } else if (code === 127) {
    // Backspace
    if (buffer.length > 0) {
      buffer = buffer.slice(0, -1);
      term.write('\b \b');
    }
  } else {
    buffer += data;
    term.write(data);
  }
});
```

This is more work but gives a true terminal feel. Useful when the demo is
"look at this calculator; type things into it."

### 7.3 `input()` blocks the main thread

`runPython()` (synchronous) blocks until `input()` resolves. With async
stdin, the script runs forever waiting. The fix is to use
`runPythonAsync()` and make `input()` async in Python:

```js
await pyodide.runPythonAsync(`
  import builtins
  import sys

  async def input(prompt=""):
    if prompt:
        sys.stdout.write(prompt)
        sys.stdout.flush()
    return await _js_input()

  builtins.input = input
`);
```

Or run Pyodide in a Web Worker. For the initial implementation, the
pre-baked inputs pattern (7.1) avoids all of this.

---

## 8. Loading strategy

Pyodide is ~6 MB compressed. Loading it on every page would slow the entire
portfolio. Instead:

1. **Lazy import.** The `pyodide.mjs` module is imported only when the user
   clicks **Run** on a terminal.
2. **Cache the instance.** Once loaded, the same `pyodide` object is reused
   across every demo. The first demo pays the load cost; subsequent demos are
   instant.
4. **Browser HTTP cache.** The Pyodide files are fetched from jsDelivr. Most
   users have visited a Pyodide-using site before and the files are already
   in cache.
5. **Service worker (optional).** A service worker can pre-cache the
   Pyodide files for guaranteed offline demos.

The pattern in [section 4](#4-the-wrapper-component) does this with the
`pyodidePromise` singleton:

```js
let pyodidePromise: Promise<any> | null = null;
async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({ indexURL: PYODIDE_INDEX });
  }
  return pyodidePromise;
}
```

---

## 9. Other demo types

### 9.1 `demo.type: webpage`

Embed the deployed frontend in an `<iframe>`:

```astro
<iframe src={deploymentUrl} title={project.name} loading="lazy" />
```

The portfolio does not need to know what the page is doing — it just
embeds it. The deployment URL is fetched from `project.yml` or derived from
the GitHub Pages convention.

### 9.2 `demo.type: api`

Embed an API explorer that points at the backend. The simplest possible
implementation is a small form that issues a request and renders the JSON
response. A more sophisticated option is a hosted OpenAPI explorer
(Stoplight Elements, Scalar) loaded from a CDN.

### 9.3 `demo.type: terminal`

Same as Python, but the runtime is configurable. Future runtimes could
include MicroPython, JavaScript (via QuickJS or similar), or other WASM
runtimes. The contract does not change.

### 9.4 `demo.type: documentation`

Embed the project's documentation site in an iframe, or render the
project's `docs/` folder as Markdown at build time and include it inline.

### 9.5 `demo.type: none`

No demo. The project page just shows metadata, links and a README.

---

## 10. Security recap

The Pyodide runtime is sandboxed in the browser by WebAssembly. It cannot
access the user's filesystem, cannot open arbitrary TCP connections, cannot
spawn subprocesses. The only attack surface is the user's own browser.

The portfolio does **not** allow the visitor to submit code. The portfolio
ships pre-baked scripts and feeds them pre-baked or live-typed inputs.

This is the boundary documented in
[10 — Security Model](./10-security-model.md). Re-read that document before
introducing any feature that lets visitors write code.

---

## 11. Reference implementation

The single best reference for wiring Pyodide to xterm.js is Pyodide's own
`console-v2.html`:

```
https://cdn.jsdelivr.net/npm/pyodide@0.28.3/console-v2.html
```

It is a ~300-line HTML file that demonstrates:

- lazy module import;
- xterm.js with the fit addon;
- batched stdout/stderr handlers;
- async stdin via a queue;
- history and tab completion.

Use it as a starting point when extending the portfolio's terminal beyond
the basic pre-baked inputs pattern.

---

## 12. Where to go next

- Security model: [10 — Security Model](./10-security-model.md)
- How the demo type is declared: [02 — The `project.yml` Contract](./02-project-yml-contract.md)
- How the backend services connect (e.g. a Pyodide demo talking to Supabase): [06 — Backend Integration](./06-backend-integration.md)