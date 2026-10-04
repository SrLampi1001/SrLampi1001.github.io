# Step 2 — Non-default branch fetch

> Date: 2026-10-04
> Status: ✅ Complete — branch fetch works, two new contract
> divergences discovered.

## The hypothesis we tested

> "It could happen that accessing branches other than `main` is more
> complicated." — the user, before the test.

## The answer

**No.** Accessing a non-default branch from raw.githubusercontent.com is
**not** more complicated. The branch name is just a path segment:

```
https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path-to-file>
```

Branch names containing slashes (like `project/python/workshop_2`) work
**as-is, with no URL encoding**. We verified this end-to-end:

| | Result |
|---|---|
| Branch exists | ✅ `project/python/workshop_2` (verified via GitHub API) |
| URL with slashes | ✅ accepted by raw.githubusercontent.com |
| HTTP status | ✅ 200 |
| Bytes fetched | 653 |
| `npm run build` | ✅ 1.5 s |
| Project data rendered | ✅ all 11 properties |
| No `[object Object]` / `undefined` | ✅ none |

## URL encoding rule for branches

| Branch name | Raw URL segment | Notes |
|-------------|-----------------|-------|
| `main` | `main` | trivial |
| `develop` | `develop` | trivial |
| `feature/foo` | `feature/foo` | as written |
| `project/python/workshop_2` | `project/python/workshop_2` | as written — works |
| `user/joão` | `user/jo%C3%A3o` | non-ASCII → percent-encode |
| `branch?with#fragments` | needs encoding for `?` and `#` | rare, careful |

The only cases that need URL encoding are:

1. Non-ASCII characters in the branch name.
2. `?`, `#`, or other URL-significant characters.

Both are rare in practice for human-readable branch names like
`project/python/workshop_2`.

**Conclusion**: branch access is no harder than default-branch access.
We can proceed with the same `fetch()` pattern for any branch.

## Two new contract divergences discovered

The actual `project.yml` on the non-main branch is **structurally
different** from the one on `main`. Surfaced by a small "Contract
divergences" walker added to the smoke test page:

### Divergence 4 — `type: script` is not in the contract enum

The contract's `type` enum is:

```text
frontend | backend | application | fundamentals | collection
```

The new file declares:

```yaml
type: script
```

`script` is not in the enum. It's a reasonable new value (a small
single-script project), but the contract should be extended to include it
or to allow arbitrary strings.

**Decision needed in Step 3**: extend the enum, or relax it to
`type: string`.

### Divergence 5 — `documentation.documentation-folder`

The new file declares a sub-key inside `documentation` that doesn't
exist in the contract:

```yaml
documentation:
  readme: true
  documentation-folder:
    - path: python/workshop_2
```

The contract currently only models `documentation.readme`,
`documentation.architecture`, and `documentation.api`. The
`documentation-folder` shape (a list of `{path: …}`) is a new idea:
"this project has additional documentation folders inside the repo."

**Decision needed in Step 3**: add `documentation.folders[]` (array of
`{path}`) to the contract.

## Why these divergences are a *good* sign

These are exactly the kinds of findings the smoke test was designed to
surface. The portfolio's `project.yml` contract is being used by:

- the **root** of `riwi_projects` (the collection) on `main`, and
- a **leaf** project (`python/workshop_2`) on a project branch,

…with subtly different shapes. This is exactly the reality we have to
support. Catching it now — before any schema validation is in place —
saves a lot of pain later.

## What the page now does

`src/pages/index.astro` was extended to:

1. Fetch from a non-default branch (`project/python/workshop_2`).
2. Render a "Contract divergences" section at the bottom whenever the
   fetched project's structure contains keys or values not modelled in
   `docs/02-project-yml-contract.md`. The walker is recursive and
   surfaces nested keys like `documentation.documentation-folder`.

This makes the smoke test a **living contract divergence detector**.
Every new branch we point it at will surface contract gaps.

## Step 3 — recommended next move

Step 3 should focus on **the contract itself**, not on more fetching.
The divergences from Steps 1 + 2 give us a real-world picture of the
contract:

1. Extend `type` enum to include `script` (and probably a few more
   values like `library`, `tool`, `experiment`).
2. Add `documentation.folders[]` to the contract.
3. Decide on the branch-mismatch rule (YAML `branch: develop` vs.
   GitHub default `main`) — recommend "GitHub wins, YAML is a hint".
4. Normalise the categories casing rule (accept either form).
5. Only then: introduce JSON Schema validation + Zod parsing +
   Content Collections so the divergences become validation errors
   instead of pages with surprise sections.

## How to reproduce

```bash
# fetch from main branch (Step 1)
git checkout b3adfcd -- src/pages/index.astro  # restore main branch

# fetch from non-main branch (Step 2)
git checkout main -- src/pages/index.astro    # current commit
npm install
npm run build
# inspect:
#   - dist/index.html (look for "Contract divergences" section)
#   - HTTP 200, 653 bytes
#   - the branch segment in the URL contains slashes
```