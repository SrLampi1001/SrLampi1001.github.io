# Step 3 — Schema validation

> Date: 2026-10-04
> Status: ✅ Complete — both real-world `project.yml` files now
> validate against `schema/project.schema.json`. Bad input is rejected
> with a non-zero exit code. Two more divergences surfaced and were
> absorbed into the contract.

## Goal

Replace the "Contract divergences" surfacer (which was informational only)
with a **real JSON Schema + ajv validation** that:

1. Accepts both real-world `project.yml` files we have today.
2. Rejects malformed input with a clear, non-zero exit code.
3. Runs both in the browser-side smoke test page and as a CLI tool for
   CI.

## What was built

| File | Purpose |
|------|---------|
| `schema/project.schema.json` | The authoritative contract, JSON Schema draft-07. 228 lines. |
| `scripts/validate-yaml.mjs` | CLI validator. `npm run validate`. |
| `src/pages/index.astro` | Smoke test page that validates both sources via ajv. |
| `package.json` | Added `ajv`, `ajv-formats`, and the `validate` script. |

## What changed in the contract

The schema **absorbs** the five divergences from Steps 1–2 plus two new
ones surfaced by adding validation itself:

| # | Divergence | Resolution |
|---|------------|------------|
| 1 | `branch: develop` vs. GitHub default `main` | Schema treats `repository.branch` as informational; fallback rule documented but not enforced in schema. |
| 2 | Lowercase categories | Schema accepts any non-empty string. The docs example shows "Frontend" but the schema doesn't enforce casing. |
| 3 | `tools` slot used for `git/subtrees/submodules` | No change — already permissive. |
| 4 | `type: script` not in enum | Enum extended from 5 to **11 values**: `script`, `library`, `experiment`, `tool`, `tutorial`, `docs` added. |
| 5 | `documentation.documentation-folder` | Canonical form `documentation.folders[]` added; legacy `documentation.documentation-folder` form accepted as alias. |
| 6 (new) | `status` missing from main project.yml | Removed from the `required` list. Default when absent: `maintained`. Enum extended with `completed` and `wip`. |
| 7 (new) | `status: completed` in branch project.yml | Covered by enum extension in #6. |

The `enum` for `type` and `status` is the **first** thing to keep loose
as new project categories emerge. Categories and tags were already
free-form strings.

## Verified behaviour

### Happy path — both real sources validate

```
$ node scripts/validate-yaml.mjs
✅ collection root on main
        https://raw.githubusercontent.com/SrLampi1001/riwi_projects/main/project.yml (690 bytes)
✅ leaf on project/python/workshop_2
        https://raw.githubusercontent.com/SrLampi1001/riwi_projects/project/python/workshop_2/project.yml (653 bytes)

All 2 input(s) valid.
$ echo $?
0
```

### Sad path — bad YAML is rejected loudly

A throwaway bad YAML (id with spaces, empty name, type=potato,
uppercase tags, status=unknown, provider=bitbucket, no description, no
categories) was rejected with **9 distinct schema errors** and exit
code **1**:

```
❌ /tmp/bad-project.yml
   (root) must have required property 'description'
   /id must match pattern "^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$"
   /name must NOT have fewer than 1 characters
   /type must be equal to one of the allowed values
   /categories must NOT have fewer than 1 items
   /tags/0 must match pattern ...
   /tags/1 must match pattern ...
   /status must be equal to one of the allowed values
   /repository/provider must be equal to constant "github"

Validation failed for one or more inputs.
$ echo $?
1
```

This is exactly what CI needs: any bad input produces a clear error list
and a non-zero exit code.

### Build still works end-to-end

```
$ npm run build
[build] 1 page(s) built in 2.08s
[build] Complete!
```

The smoke test page renders both sources side by side with the validation
result. A green summary banner reads "All sources valid" when both
pass; red otherwise.

## Schema highlights

```jsonc
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "id", "name", "description", "type", "categories",
    "tags", "tech_stack", "repository"
    // note: "status" removed (Step 3 divergence #6)
  ],
  "properties": {
    "id":            { "$ref": "#/definitions/Id" },
    "name":          { "type": "string", "minLength": 1, "maxLength": 80 },
    "description":   { "type": "string", "minLength": 1, "maxLength": 600 },
    "type":          { "$ref": "#/definitions/ProjectType" },
    "categories":    { "type": "array", "items": { "type": "string" }, "minItems": 1, "uniqueItems": true },
    "tags":          { "type": "array", "items": { "$ref": "#/definitions/Slug" }, "uniqueItems": true },
    "status":        { "$ref": "#/definitions/Status" },
    "tech_stack":    { "$ref": "#/definitions/TechStack" },
    "repository":    { "$ref": "#/definitions/Repository" },
    "deployment":    { "$ref": "#/definitions/Deployment" },
    "demo":          { "$ref": "#/definitions/Demo" },
    "documentation": { "$ref": "#/definitions/Documentation" },
    "presentation":  { "$ref": "#/definitions/Presentation" }
  }
}
```

Notable design choices:

- **`additionalProperties: false`** everywhere — typos like `tehcn:` or
  `demo.typ` are caught.
- **`$ref` / `definitions`** — shared sub-schemas (`DocumentationFolder`,
  `DeploymentEntry`, `TechStack`) live once and are reused.
- **One enum per place that allows multiple values** — the type enum,
  the status enum, the deployment-type enum, and the demo-type enum all
  live in `definitions`.
- **Deployment's URL is conditional** — `github-pages` types are not
  allowed to specify a URL (it's derived); other types require one.
  Enforced with `anyOf`.
- **Documentation accepts both canonical and legacy** — `folders[]` is
  the canonical name; `documentation-folder` is the legacy alias.
  Both work; the docs prefer `folders`.
- **`ajv-formats`** adds `date` and `uri` formats to the standard ones
  already in draft-07.

## Why the schema wraps under `project:`

The actual YAML files have a top-level `project:` key (matching the
contract's example). The schema, however, validates the **inner**
project object. The validator script does the unwrapping:

```js
const projectObj = doc && typeof doc === 'object' && 'project' in doc
  ? doc.project
  : doc;
const ok = validate(projectObj);
```

This keeps the schema focused on the project itself, not on its YAML
envelope. Future tooling (e.g. a JSON loader) could bypass the YAML
parser entirely and validate a plain JSON object against the same
schema.

## Smoke test page now does

1. Fetch both sources.
2. Parse each YAML.
3. Validate each against the schema (ajv).
4. Render a results table with HTTP status, byte count, validation
   outcome, and a list of errors.
5. Render the property breakdown for each source that parsed.
6. Display a green/red summary banner.
7. List the seven contract decisions at the bottom so a reader can see
   why each file passes.

## Step 4 — recommended next move

The contract is now load-bearing (CI will fail on bad input). The next
priority is **multi-project discovery** so we can stop hardcoding the
two smoke-test sources:

1. Promote the `SOURCES` list in `scripts/validate-yaml.mjs` to a real
   discovery step (e.g. via `GET /users/SrLampi1001/repos`).
2. Add nested `project.yml` discovery for monorepos / collections
   (walk every directory under `src/data/projects/<repo>/`).
3. Replace the in-page `ajv.compile` with **Content Collections** so the
   validated data flows through Astro's type-safe collection API.
4. Generate TypeScript types from the schema (`json-schema-to-typescript`)
   and remove the `any`-typed `project` variables in `index.astro`.
5. Add the `withastro/action` deploy workflow (we already have the
   full design in `docs/04-deployment.md` and `docs/08-ci-cd.md`).

Once those are in place, the smoke test page itself can be deleted and
replaced by the real portfolio routes (`/projects/<id>/`,
`/categories/<slug>/`, etc.).

## How to reproduce

```bash
npm install
npm run validate          # both real sources — should pass
npm run build             # smoke test page renders
npm run preview           # http://localhost:4321/

# try a deliberately bad file:
cat > /tmp/bad.yml <<EOF
project:
  id: "Invalid ID"
  type: potato
EOF
node scripts/validate-yaml.mjs /tmp/bad.yml
echo $?   # 1
```