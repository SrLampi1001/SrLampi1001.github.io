#!/usr/bin/env node
/**
 * Generate TypeScript types from schema/project.schema.json and write
 * them to src/lib/types/project.ts. Run automatically before every
 * build via the `prebuild` npm script.
 *
 * The generated file uses `export type` syntax (no runtime code) so
 * it can be imported as a type-only module by src/lib/projects.ts.
 *
 * `pattern`, `format`, `minimum`, `uniqueItems` etc. are runtime
 * concerns that ajv enforces -- they don't appear in the TypeScript
 * output. The shape is, however, fully derived from the schema.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'schema/project.schema.json');
const OUT_PATH = path.join(ROOT, 'src/lib/types/project.ts');

async function main() {
  const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));

  const ts = await compile(schema, 'Project', {
    bannerComment: `/**
 * AUTO-GENERATED from schema/project.schema.json by
 * scripts/generate-types.mjs -- do not edit by hand.
 *
 * Runtime schema validation is still performed by ajv at build time;
 * this file gives you compile-time type safety for the same shape.
 */`,
    style: {
      singleQuote: true,
      tabWidth: 2,
      useTabs: false,
    },
    additionalProperties: false, // keep the schema's strictness
    unreachableDefinitions: true,
  });

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, ts + '\n');
  console.log(`Wrote ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((e) => {
  console.error('generate-types failed:', e);
  process.exit(1);
});