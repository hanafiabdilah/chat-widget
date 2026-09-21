#!/usr/bin/env node
/*
 * Builds the two files a site needs: the loader it pastes, and the hashed
 * bundle the loader pulls in.
 *
 *   dist-embed/widget.js                          → served at /widget.js
 *   dist-embed/widget/pingly-chat.<hash>.js       → served at /widget/…
 *
 * The hash is why this is a script and not two npm commands: the loader has
 * to be built *after* the bundle, with the bundle's final name compiled into
 * it. That is what lets the bundle be cached forever while the address in
 * everyone's HTML stays the same.
 *
 *   npm run build:embed
 */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(root, 'dist-embed');

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const report = (label, contents) =>
  console.log(`  ${label.padEnd(34)} ${kb(contents.length).padStart(9)}  (${kb(gzipSync(contents).length)} gzipped)`);

await rm(outDir, { recursive: true, force: true });
await mkdir(path.join(outDir, 'widget'), { recursive: true });

console.log('\n▶ bundle');
await build({ configFile: path.join(root, 'vite.embed.config.js') });

const bundlePath = path.join(outDir, 'pingly-chat.js');
const bundle = await readFile(bundlePath);
// Eight hex characters: enough that a changed build never reuses a name, short
// enough to read out loud when someone asks which version is live.
const hash = createHash('sha256').update(bundle).digest('hex').slice(0, 8);
const bundleName = `pingly-chat.${hash}.js`;
await writeFile(path.join(outDir, 'widget', bundleName), bundle);
await rm(bundlePath);

console.log('\n▶ loader');
process.env.PINGLY_BUNDLE = `widget/${bundleName}`;
await build({ configFile: path.join(root, 'vite.loader.config.js') });

const loader = await readFile(path.join(outDir, 'widget.js'));

console.log('\n  built:');
report('widget.js', loader);
report(`widget/${bundleName}`, bundle);
console.log('\n  publish with: npm run publish:embed\n');
