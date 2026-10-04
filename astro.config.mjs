// @ts-check
import { defineConfig } from 'astro/config';

// Minimal config for the smoke test.
// Step 1: no integrations, no site URL, no adapters.
// Steps 2+: add `site`, sitemap, integrations as needed.
export default defineConfig({
  output: 'static',
});