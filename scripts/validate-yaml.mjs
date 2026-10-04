#!/usr/bin/env node
/**
 * Validate one or more project.yml files against schema/project.schema.json.
 *
 * Usage:
 *   node scripts/validate-yaml.mjs                  # uses the smoke-test sources
 *   node scripts/validate-yaml.mjs path/to/a.yml [b.yml ...]
 *
 * Exit codes:
 *   0  all inputs valid
 *   1  one or more inputs invalid
 *   2  infrastructure error (network, missing file, malformed YAML)
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as YAML from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'schema/project.schema.json');

// Smoke-test sources: kept in sync with src/pages/index.astro so that
// the page and the CLI exercise the same data.
const SMOKE_SOURCES = [
  {
    label: 'collection root on main',
    url: 'https://raw.githubusercontent.com/SrLampi1001/riwi_projects/main/project.yml',
  },
  {
    label: 'leaf on project/python/workshop_2',
    url: 'https://raw.githubusercontent.com/SrLampi1001/riwi_projects/project/python/workshop_2/project.yml',
  },
];

function loadSchema() {
  return readFile(SCHEMA_PATH, 'utf8').then(JSON.parse);
}

function buildValidator(schema) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

function formatError(err) {
  const where = err.instancePath || '(root)';
  const extra = err.params ? ` ${JSON.stringify(err.params)}` : '';
  return `${where} ${err.message ?? 'invalid'}${extra}`;
}

async function validateSource(validate, source) {
  let text;
  try {
    const res = await fetch(source.url);
    if (!res.ok) {
      return { source, ok: false, stage: 'fetch', error: `HTTP ${res.status} ${res.statusText}` };
    }
    text = await res.text();
  } catch (err) {
    return { source, ok: false, stage: 'fetch', error: err instanceof Error ? err.message : String(err) };
  }

  let doc;
  try {
    doc = YAML.parse(text);
  } catch (err) {
    return { source, ok: false, stage: 'yaml', error: err instanceof Error ? err.message : String(err), bytes: text.length };
  }

  // The contract wraps the project under a `project:` key. Unwrap it
  // for validation while preserving the original document for context.
  const projectObj = doc && typeof doc === 'object' && 'project' in doc ? doc.project : doc;
  const ok = validate(projectObj);
  if (!ok) {
    return {
      source,
      ok: false,
      stage: 'schema',
      errors: (validate.errors ?? []).map(formatError),
      bytes: text.length,
    };
  }

  return { source, ok: true, bytes: text.length };
}

async function validateLocalFile(validate, file) {
  const fullPath = path.resolve(file);
  let text;
  try {
    text = await readFile(fullPath, 'utf8');
  } catch (err) {
    return { file, ok: false, stage: 'read', error: err instanceof Error ? err.message : String(err) };
  }

  let doc;
  try {
    doc = YAML.parse(text);
  } catch (err) {
    return { file, ok: false, stage: 'yaml', error: err instanceof Error ? err.message : String(err) };
  }

  const projectObj = doc && typeof doc === 'object' && 'project' in doc ? doc.project : doc;
  const ok = validate(projectObj);
  if (!ok) {
    return { file, ok: false, stage: 'schema', errors: (validate.errors ?? []).map(formatError) };
  }
  return { file, ok: true };
}

async function main() {
  const args = process.argv.slice(2);
  const schema = await loadSchema();
  const validate = buildValidator(schema);

  const results = [];
  if (args.length === 0) {
    for (const source of SMOKE_SOURCES) {
      results.push(await validateSource(validate, source));
    }
  } else {
    for (const file of args) {
      results.push(await validateLocalFile(validate, file));
    }
  }

  let hadFailure = false;
  for (const r of results) {
    const label = r.source ? `${r.source.label}\n        ${r.source.url}` : r.file;
    if (r.ok) {
      console.log(`✅ ${label}${r.bytes ? ` (${r.bytes} bytes)` : ''}`);
    } else {
      hadFailure = true;
      console.error(`❌ ${label}`);
      if (r.error) console.error(`   [${r.stage}] ${r.error}`);
      if (r.errors) for (const e of r.errors) console.error(`   ${e}`);
    }
  }

  if (hadFailure) {
    console.error(`\nValidation failed for one or more inputs.`);
    process.exit(1);
  } else {
    console.log(`\nAll ${results.length} input(s) valid.`);
  }
}

main().catch((err) => {
  console.error('validate-yaml crashed:', err);
  process.exit(2);
});