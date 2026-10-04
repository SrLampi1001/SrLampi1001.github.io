# 07 — Validation & Schema

Every `project.yml` must validate against the contract before the portfolio
will index it. Validation is enforced at two levels:

1. **In each project repository's own CI** — so authors catch errors at PR
   time.
2. **In the portfolio's build CI** — so a malformed file can never reach
   the deployed site.

This document is the canonical reference for the schema, the tooling, and
the workflows.

---

## 1. Why a schema

Without a schema:

- typos like `tehcn: [react]` silently degrade to "no tech listed";
- invalid values like `type: potato` are accepted as if valid;
- the portfolio has no defence against contracts drifting between
  repositories.

With a schema:

- the contract is **machine-checkable** and **human-discoverable** in any
  editor;
- the portfolio can refuse to publish until the file is fixed;
- contributors get inline errors and autocomplete in their IDE;
- TS types for the portfolio's Astro pages are generated from the same
  source of truth.

---

## 2. Tooling

The recommended toolchain is:

| Layer | Tool | Why |
|-------|------|-----|
| Authoritative contract | **JSON Schema draft-07** (or 2020-12) | Language-neutral; works in `ajv-cli`, VSCode, `yaml-language-server`, every other YAML-aware tool. |
| YAML parser | **`yaml`** (eemeli/yaml) v2 | Default YAML 1.2 + core schema. Most spec-compliant. |
| Validator | **`ajv` 8** + **`ajv-formats`** + **`ajv-keywords`** | Fastest in Node; draft-07 and 2020-12 support; rich format library. |
| CLI | **`ajv-cli`** | Reads `.yml` files directly with `-d`. Globs. Human-readable errors. Exits non-zero on failure. |
| TypeScript types | **`json-schema-to-typescript`** | Generates `.d.ts` from the JSON Schema; JSDoc preserved from `description`/`title`. |
| Editor support | **Red Hat `vscode-yaml`** | Autocompletion + hover + inline errors against the JSON Schema. |
| Lint (style) | **`yamllint`** | Indentation, key duplication, line length. Complements — does not replace — schema validation. |

JSON Schema is chosen over a Zod-first design because the portfolio needs
to validate YAML files across **multiple language ecosystems** (Node CI,
Python tooling, Go could be added later). JSON Schema is the lingua franca.

---

## 3. The canonical schema file

The schema lives at `schema/project.schema.json` in the portfolio
repository. It is the authoritative contract. Both the portfolio build and
the per-repo validation workflow consume it.

### 3.1 Structure

```jsonc
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://SrLampi1001.github.io/schema/project.schema.json",
  "title": "Portfolio Project",
  "description": "Metadata contract for projects indexed by SrLampi1001.github.io",
  "type": "object",
  "additionalProperties": false,

  "required": ["id", "name", "description", "type", "categories", "tags", "status", "tech_stack", "repository"],
  "properties": {
    "id": { "$ref": "#/definitions/Id" },
    "name": { "type": "string", "minLength": 1, "maxLength": 80 },
    "description": { "type": "string", "minLength": 1, "maxLength": 600 },
    "type": { "$ref": "#/definitions/ProjectType" },
    "components": { "$ref": "#/definitions/Components" },
    "categories": { "type": "array", "items": { "type": "string" }, "minItems": 1, "uniqueItems": true },
    "tags": { "type": "array", "items": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$" }, "uniqueItems": true },
    "status": { "$ref": "#/definitions/Status" },
    "created_at": { "type": "string", "format": "date" },
    "tech_stack": { "$ref": "#/definitions/TechStack" },
    "repository": { "$ref": "#/definitions/Repository" },
    "deployment": { "$ref": "#/definitions/Deployment" },
    "demo": { "$ref": "#/definitions/Demo" },
    "documentation": { "$ref": "#/definitions/Documentation" },
    "presentation": { "$ref": "#/definitions/Presentation" }
  },

  "definitions": {
    "Id": {
      "type": "string",
      "pattern": "^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$",
      "description": "URL-safe kebab-case identifier, used in /projects/<id>/."
    },
    "ProjectType": {
      "type": "string",
      "enum": ["frontend", "backend", "application", "fundamentals", "collection"]
    },
    "Components": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "frontend": { "type": "boolean" },
        "backend":  { "type": "boolean" },
        "database": { "type": "boolean" },
        "cli":      { "type": "boolean" },
        "wasm":     { "type": "boolean" }
      }
    },
    "Status": {
      "type": "string",
      "enum": ["active", "maintained", "archived", "experimental"]
    },
    "TechStack": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "languages":      { "type": "array", "items": { "type": "string" } },
        "frameworks":     { "type": "array", "items": { "type": "string" } },
        "libraries":      { "type": "array", "items": { "type": "string" } },
        "databases":      { "type": "array", "items": { "type": "string" } },
        "infrastructure": { "type": "array", "items": { "type": "string" } },
        "tools":          { "type": "array", "items": { "type": "string" } }
      }
    },
    "Repository": {
      "type": "object",
      "additionalProperties": false,
      "required": ["provider", "owner", "name"],
      "properties": {
        "provider": { "const": "github" },
        "owner":    { "type": "string", "minLength": 1 },
        "name":     { "type": "string", "minLength": 1, "pattern": "^[A-Za-z0-9._-]+$" },
        "branch":   { "type": "string", "default": "main" }
      }
    },
    "Deployment": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "frontend": { "$ref": "#/definitions/DeploymentEntry" },
        "backend":  { "$ref": "#/definitions/DeploymentEntry" }
      }
    },
    "DeploymentEntry": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type"],
      "properties": {
        "type": { "enum": ["github-pages", "cloudflare-pages", "cloudflare-worker", "vercel", "render", "other"] },
        "url":  { "type": "string", "format": "uri" }
      },
      "anyOf": [
        { "properties": { "type": { "const": "github-pages" } }, "not": { "required": ["url"] } },
        { "properties": { "type": { "not": { "const": "github-pages" } } }, "required": ["url"] }
      ]
    },
    "Demo": {
      "type": "object",
      "additionalProperties": false,
      "required": ["enabled", "type"],
      "properties": {
        "enabled":    { "type": "boolean" },
        "type":       { "enum": ["none", "webpage", "api", "python", "terminal", "documentation"] },
        "runtime":    { "type": "string" },
        "entrypoint": { "type": "string" },
        "inputs":     { "type": "array", "items": { "type": "string" } }
      }
    },
    "Documentation": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "readme":       { "type": "string" },
        "architecture": { "type": "object", "properties": { "path": { "type": "string" } }, "required": ["path"] },
        "api":          { "type": "object", "properties": { "path": { "type": "string" } }, "required": ["path"] }
      }
    },
    "Presentation": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "featured":   { "type": "boolean", "default": false },
        "order":      { "type": "integer", "default": 0 },
        "thumbnail":  { "type": "string" }
      }
    }
  }
}
```

A working copy of this file is committed to the portfolio repo at
`schema/project.schema.json`. Every `project.yml` in every indexed repo is
validated against it.

---

## 4. Authoring a `project.yml` with full IDE support

In any project repository, drop a `.vscode/settings.json` with:

```jsonc
{
  "yaml.schemas": {
    "https://SrLampi1001.github.io/schema/project.schema.json": "project.yml"
  }
}
```

Once that is in place, the Red Hat YAML extension provides:

- **Autocompletion** for every property.
- **Hover documentation** from the JSON Schema `description`.
- **Inline errors** for typos, missing required fields, wrong types, enum
  violations.
- **Enum pickers** for `type`, `status`, `deployment.type`, `demo.type`.

This is the single biggest UX improvement for contributors — the schema
becomes an interactive form rather than a documentation reference.

---

## 5. Validating a single file from the command line

```bash
# install once
npm install -D ajv-cli ajv-formats ajv-keywords

# validate a single file
npx ajv validate \
  -s schema/project.schema.json \
  -d project.yml \
  -c ajv-formats \
  -c ajv-keywords \
  --errors=text \
  --all-errors
```

The `--all-errors` flag collects every error rather than stopping at the
first; this is the recommended mode for portfolio work.

For multiple files (typical for monorepos):

```bash
npx ajv validate \
  -s schema/project.schema.json \
  -d "**/project.yml" \
  -c ajv-formats \
  -c ajv-keywords \
  --errors=text \
  --all-errors
```

---

## 6. The per-repo CI workflow

Every project repository should run validation in CI. The canonical
workflow:

`.github/workflows/validate-project.yml` (in each project repo):

```yaml
name: Validate project.yml

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate project.yml
        uses: actions/checkout@v4
        with:
          repository: SrLampi1001/SrLampi1001.github.io
          path: .portfolio-schema
          sparse-checkout: schema

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install --no-save ajv-cli ajv-formats ajv-keywords

      - name: Run validation
        run: |
          npx ajv validate \
            -s .portfolio-schema/schema/project.schema.json \
            -d "**/project.yml" \
            -c ajv-formats \
            -c ajv-keywords \
            --errors=text \
            --all-errors
```

This clones the portfolio repo **just for the schema file** (sparse
checkout), then validates every `project.yml` in the project repo.
Failures block merging.

---

## 7. The portfolio's own validation step

The portfolio's own deploy workflow should re-validate every `project.yml`
it has fetched, before building. See [08 — CI/CD & Automation](./08-ci-cd.md)
for the full pipeline; the validation step looks like:

```yaml
- name: Validate every fetched project.yml
  run: |
    npx ajv validate \
      -s schema/project.schema.json \
      -d "src/data/projects/**/project.yml" \
      -c ajv-formats \
      -c ajv-keywords \
      --errors=text \
      --all-errors
```

If any file fails, the build halts. **No project is silently indexed with
malformed metadata.**

---

## 8. Generating TypeScript types

Once the schema is the source of truth, the TypeScript types the Astro
pages use should be derived from it.

`package.json`:

```jsonc
{
  "scripts": {
    "schema:ts": "json2ts --input schema/project.schema.json --output src/lib/types/project.ts",
    "prebuild": "npm run schema:ts"
  }
}
```

Install:

```bash
npm install -D json-schema-to-typescript
```

The generated file (`src/lib/types/project.ts`) contains a `Project` type
that mirrors the schema, with JSDoc comments copied from each property's
`description` and `title`. `pattern`, `format`, `minimum`, `maximum` and
similar runtime constraints are dropped (ajv enforces them, not TypeScript).

---

## 9. YAML subset recommendations

The contract should be portable across YAML 1.2 parsers. The schema
validation will not catch YAML-level issues, so document this in any
contributor guide:

| Allowed | Discouraged | Forbidden |
|---------|-------------|-----------|
| Block scalars `\|`, `>` | Anchors & aliases are fine; verify they make sense in your case | Merge keys `<<` (1.1-only, confusing) |
| Flow style `{a: 1, b: 2}` | — | Multi-document streams `---` |
| Comments `# ...` | — | Custom tags `!!python/...` |
| Quoted strings (single or double) | — | Tab characters for indentation |
| Trailing commas are not allowed by YAML | — | `null`, `Yes`, `No`, `On`, `Off` as bare words (1.1 quirks) — quote them |

Stick to the **YAML 1.2 core schema** (eemeli/yaml default). Quote booleans
that should be strings; quote anything starting with a digit that isn't a
number; never use tabs.

---

## 10. Cross-field validation

Some contracts need rules that span multiple fields:

- `demo.type: python` requires `demo.entrypoint` to be set.
- `demo.type: api` requires `deployment.backend` to be set.
- `type: collection` should have at least one nested `project.yml` in the
  repo.
- All `id` values across the entire portfolio must be unique.

These are not pure JSON Schema concerns. They are implemented as a second
validation pass after the schema check:

```ts
// src/lib/validation.ts
import type { Project } from './types/project';

export function crossValidate(projects: Project[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const p of projects) {
    if (seen.has(p.id)) {
      errors.push(`Duplicate project id: ${p.id}`);
    }
    seen.add(p.id);

    if (p.demo?.enabled && p.demo.type !== 'none' && !p.demo.entrypoint) {
      errors.push(`${p.id}: demo.enabled with type=${p.demo.type} requires demo.entrypoint`);
    }
  }

  return errors;
}
```

This pass runs after `ajv` validates each file individually.

---

## 11. What "valid" means

A `project.yml` is **valid** when:

1. It parses as YAML 1.2.
2. It validates against `schema/project.schema.json` via `ajv`.
3. It passes the cross-field validation pass.
4. The `id` is unique across all `project.yml` files in the portfolio.
5. All required URLs (deployment, demo) are reachable when the build runs
   the optional liveness check.

If any of these fail, the portfolio's build halts. The contributor sees a
clear error pointing at the specific file and property.

---

## 12. Where to go next

- The CI/CD pipeline that runs this validation: [08 — CI/CD & Automation](./08-ci-cd.md)
- The portfolio application that consumes the validated data: [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md)
- The contract field-by-field: [02 — The `project.yml` Contract](./02-project-yml-contract.md)