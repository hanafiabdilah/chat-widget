#!/usr/bin/env node
/*
 * Copies the embed build into the backend's public folder, which is where the
 * platform serves it from:
 *
 *   nuvemchat-be-2/public/widget.js                      → https://…/widget.js
 *   nuvemchat-be-2/public/widget/pingly-chat.<hash>.js   → https://…/widget/…
 *
 * The backend repo is what gets deployed, so the built files are committed
 * there rather than built on the server — this repo has no place in the
 * deploy path and `dist-embed/` is ignored here.
 *
 *   npm run publish:embed [-- ../path/to/nuvemchat-be-2/public]
 *
 * Older bundles are kept on purpose: a visitor whose browser still has the
 * previous loader cached will ask for the bundle that loader names, and that
 * request has to keep working for the few minutes it takes to expire.
 */
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const KEEP_BUNDLES = 3;

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(root, 'dist-embed');
const target = path.resolve(root, process.argv[2] || '../nuvemchat-be-2/public');

const die = (message) => { console.error(`\n✗ ${message}\n`); process.exit(1); };

const loaderSource = path.join(outDir, 'widget.js');
try { await stat(loaderSource); } catch { die('no build found — run `npm run build:embed` first.'); }
try { await stat(target); } catch { die(`target folder does not exist: ${target}`); }

const loader = await readFile(loaderSource, 'utf8');
// The loader names exactly one bundle; everything else in there is history.
const live = loader.match(/widget\/(pingly-chat\.[a-f0-9]+\.js)/)?.[1];
if (!live) die('could not find the bundle name inside the built loader.');

await mkdir(path.join(target, 'widget'), { recursive: true });
await writeFile(path.join(target, 'widget.js'), loader);
await cp(path.join(outDir, 'widget', live), path.join(target, 'widget', live));
console.log(`\n  widget.js          → ${path.join(target, 'widget.js')}`);
console.log(`  ${live} → ${path.join(target, 'widget')}`);

const existing = (await readdir(path.join(target, 'widget')))
  .filter((name) => /^pingly-chat\.[a-f0-9]+\.js$/.test(name) && name !== live);
const dated = await Promise.all(existing.map(async (name) => ({
  name,
  at: (await stat(path.join(target, 'widget', name))).mtimeMs,
})));
const stale = dated.sort((a, b) => b.at - a.at).slice(KEEP_BUNDLES - 1);
for (const { name } of stale) {
  await rm(path.join(target, 'widget', name));
  console.log(`  removed old bundle   ${name}`);
}

console.log(`\n  Commit them in the backend repo, then: ./deploy.sh backend`);
console.log('  First time only — the Caddyfile has to route /widget.js: ./deploy.sh caddy\n');
