# Step 9 fixes (round 2) — stdout bytes + script visibility

> Date: 2026-10-04
> Status: ✅ Two more bugs fixed.

After the first round of fixes (Step 9 fixes round 1) the deploy
worked but the demo still had issues:

1. "The python process starts and immediately finishes."
2. "The broken line breaks still persist."

This is the second round of fixes.

## Bug 1 — script appears to finish immediately / no visible output

### Root cause

The `batched` stdout handler from Pyodide 0.28 has this contract
([docs](https://pyodide.org/en/stable/usage/streams.html)):

> A batched handler receives a string which is either:
> 1. a complete line of text **with the newline removed** or
> 2. a partial line of text that was flushed.

So **batched strips the trailing newline from each line**. With
xterm.js's default `convertEol: false`, those stripped lines all
collapse onto the same row. From the user side, the entire script
output appears as one long horizontal line that scrolls past very
quickly — they perceive it as "starts and immediately finishes".

### Fix

Switched from `batched` to the **`write`** handler, which gives the
raw bytes including newlines. We then convert `\n` → `\r\n`
ourselves:

```js
pyodide.setStdout({
  write: (buffer: Uint8Array) => {
    term.write(bytesToTerminalString(buffer));
    return buffer.length;
  },
});

function bytesToTerminalString(buf: Uint8Array): string {
  const decoded = new TextDecoder().decode(buf);
  return decoded.replace(/\r?\n/g, '\r\n');
}
```

The same approach for stderr (with red ANSI colour):

```js
pyodide.setStderr({
  write: (buffer: Uint8Array) => {
    term.write('\x1b[31m' + bytesToTerminalString(buffer) + '\x1b[0m');
    return buffer.length;
  },
});
```

### Why this works

- `write` receives the raw byte buffer, including any `\n` characters.
- `TextDecoder().decode(buf)` decodes UTF-8 to a JS string with `\n`
  intact.
- The replace converts lone `\n` or `\r\n` to `\r\n`, which xterm.js
  renders as a proper line break (cursor to start of next line).

## Bug 2 — process appears to finish with nothing visible

### Root cause

Once bug 1 is fixed, the output appears correctly. The script runs
through its 6 pre-baked inputs (`['1', 'Demo Product', '9.99', '3',
'2', '5']`) and exits — that's about 0.5 seconds total, so the user
might still see "nothing happened".

### Fix: diagnostic prints

Two diagnostic prints were added inside the `runPythonAsync` call:

```python
print('[debug] about to exec run.py', flush=True)
exec(open('/home/pyodide/run.py').read())
print('[debug] run.py returned, stdin queue remaining:', N, flush=True)
```

If the user sees only the first debug line but not the second, the
script body raised an exception (likely EOFError when stdin empties,
or a Python-level error inside taller2.py itself).

If they see both, stdout works and the script completed successfully.

If they see neither, `runPythonAsync` itself failed (very rare).

The `flush=True` ensures the debug prints are emitted immediately
rather than being buffered.

The terminal height was also bumped from 480 → 540 px to give more
vertical room.

## What still doesn't work

- **True interactive stdin** (user typing in response to mid-script
  `input()` calls). Pyodide 0.28's sync stdin can't support this
  without running in a Web Worker.
- **Pre-baked inputs are still static.** For predictable flows this is
  fine; for open-ended scripts it isn't.

## Files changed

| | |
|---|---|
| `src/components/PyodideTerminal.astro` | stdout/stderr switched to `write` handler with raw bytes + `\n` → `\r\n` conversion; diagnostic prints added; terminal height 480 → 540 px. |

## How to verify locally

```bash
npm run build
npm run preview
# visit /projects/python-workshop-2/ → click Run
# expected terminal output:
#     === Python demo ===
#      Script: https://...taller2.py
#      Inputs queued: 6
#
#      [debug] about to exec run.py
#      <newline>
#      Bienvenido al Menú:... (multi-line menu)
#      :: 1
#      ingrese un nombre... Demo Product
#      ingrese un precio... 9.99
#      Ingrese una cantidad... 3
#      Producto Demo Product registrado con exito
#      <menu again>
#      :: 2
#      <inventory table>
#      <menu again>
#      :: 5
#      [debug] run.py returned, stdin queue remaining: 0
#      [finished]
```