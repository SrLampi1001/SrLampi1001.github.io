# 10 — Security Model

The portfolio executes some project code in the browser and intentionally does **not** execute arbitrary user-submitted code on the server. This document is the explicit, conservative statement of what is and is not safe to run, and what is never allowed under any circumstance.

---

## 1. Two distinct execution models

The portfolio clearly separates two scenarios that look superficially similar but have completely different threat profiles.

### 1.1 Controlled project execution

- **What runs:** Python or other source files that are already inside the   indexed GitHub repository.
- **Who controls the source:** the project author, reviewed through Git   history and CI.
- **What the visitor provides:** only program inputs (e.g. *"Ingrese un   número: 25"*).
- **Where it runs:** the visitor's own browser, via Pyodide + WebAssembly.
- **Risk class:** low. The code is already public, signed-in via Git, and   executes entirely on the visitor's machine.

### 1.2 Arbitrary code execution

- **What runs:** Python (or other language) source code submitted by the   visitor at runtime.
- **Who controls the source:** the visitor.
- **What the visitor provides:** the entire source file.
- **Where it runs:** somewhere that has access to CPU, memory, filesystem,   network, process creation.
- **Risk class:** high. This is, by definition, a remote-code-execution   primitive.

The portfolio **only implements scenario 1.1**. Scenario 1.2 is explicitly out of scope for the initial system. The remainder of this document explains why and what would be required if it were ever introduced.

---

## 2. Why controlled project execution is safe

When the visitor opens a Pyodide demo, the following are all true:

- The Python source code was already public on GitHub before the visitor   opened the page.
- The portfolio does not allow the visitor to modify the script.
- The visitor may provide only the inputs that the original Python program   asked for (via `input()`).
- All execution happens in the visitor's own browser tab.
- The browser sandboxes the execution through WebAssembly:
  - no real filesystem;
  - no network access (unless explicitly granted by the user via     `pyodide.openURL` and similar);
  - no process creation;
  - no native code execution beyond what Pyodide bundles.

If a malicious Python file did reach the repo, it would already be a problem for the GitHub project itself, regardless of whether the portfolio demos it.

---

## 3. Why arbitrary code execution is dangerous

If the portfolio ever accepted a Python file from the visitor and ran it on portfolio infrastructure, the visitor would have:

- read access to any environment variables, secrets or credentials on that   host;
- ability to spawn subprocesses, write files, open network connections;
- ability to mine cryptocurrency or send spam from the portfolio's IPs;
- ability to pivot to other internal services if any are reachable.

This is not a hypothetical risk; it is the entire point of executing arbitrary code. There is no way to make it safe without substantial additional infrastructure.

---

## 4. What would be required to support arbitrary code execution

If this functionality is ever introduced, **all** of the following must be true. Skipping any one of them creates a serious vulnerability.

### 4.1 Sandboxed execution environment

A dedicated, isolated runtime per execution. Acceptable options include:

- **Firecracker** microVMs on a dedicated host.
- **gVisor** (user-space kernel) containers.
- **Docker** with strict seccomp/AppArmor profiles, *only* as a defense in   depth — never as the sole isolation.

The runtime must be ephemeral: a fresh instance per submission, destroyed immediately after.

### 4.2 Hard resource limits

Enforced by the host, not by the code itself:

- CPU time (e.g. 2 seconds wall clock).
- Memory (e.g. 128 MB).
- File size (e.g. 1 MB written).
- Output size (e.g. 64 KB stdout).
- Network: **deny by default**, with an explicit allow-list if any.

### 4.3 No filesystem access beyond the submission

The runtime should mount only the submitted source file and a clean scratch directory. No access to `/etc`, `/home`, `/var`, secrets, etc.

### 4.4 No network access by default

Most languages do not need the network for typical beginner programs. If a submission needs network access, it must be opt-in and audited.

### 4.5 No process creation / no native code execution

Forbid subprocess spawning, `os.system`, `exec`, `dlopen` of arbitrary shared libraries, etc.

### 4.6 Quotas and rate limits

- Per-IP quotas on submissions per minute.
- Per-IP quotas on total execution time per day.
- A global concurrency cap on simultaneous executions.

### 4.7 Observability

- Every execution logs: timestamp, source hash, exit code, resource use,   truncated stdout/stderr.
- An automated alerting system flags executions that look like exploits   (e.g. attempts to read `/etc/passwd`, suspicious network activity, etc.).

### 4.8 A separate, dedicated host

Arbitrary code execution must **never** run on the same host as:

- the portfolio website;
- any internal API;
- any database;
- any CI worker that has access to secrets.

### 4.9 A normal API server must never directly `eval` user input

This rule is absolute and is not subject to "temporary" exceptions. The following are forbidden regardless of context:

```text
# forbidden in any backend code
eval(user_input)
exec(user_input)
os.system(user_input)
subprocess.run(user_input, shell=True)
child_process.exec(user_input)
```

This applies whether the input is Python, JavaScript, SQL, shell or anything else.

---

## 5. The current state of the platform

Today the portfolio supports:

- **Controlled project execution** via Pyodide + WebAssembly (scenario 1.1).
- **Read-only APIs** via embedded iframes or API explorers that point at the   project's own deployment (no execution on the portfolio host).

The portfolio does **not** currently support arbitrary code execution, and nothing in the architecture requires it. If it is ever added, this document will be updated alongside the design with a full threat model and explicit approval.

---

## 6. Visitor-facing trust boundary

For visitors of the portfolio, the trust model is:

> **You may freely run any project demo in your own browser. The portfolio never executes your input on its own servers.**

If you ever see a portfolio page asking you to paste code into a server-side form, that is **not part of this platform** and should be reported.

---

## 7. Where to go next

- For how controlled execution is implemented: [05 — Demo System (Pyodide & Terminals)](./05-demo-system.md)
- For how the portfolio talks to backends: [06 — Backend Integration](./06-backend-integration.md)
- For how the portfolio itself is hosted (static-only): [04 — Deployment & GitHub Pages](./04-deployment.md)