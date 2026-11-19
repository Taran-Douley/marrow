#!/usr/bin/env node
// Games use the kit only through its public API (structure.md). This fails, naming the file and the
// line, if a game reaches into the kit's own folders.
//
//   node scripts/check-imports.mjs
//
// Allowed: '@marrow/skeleton', '@marrow/skeleton/web', '@marrow/skeleton/vite', '@marrow/skeleton/catalogue', '@marrow/skeleton/advisor'.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = new Set(['@marrow/skeleton', '@marrow/skeleton/web', '@marrow/skeleton/vite', '@marrow/skeleton/catalogue', '@marrow/skeleton/advisor']);
const skeleton = join(root, 'skeleton') + sep;

const folders = ['apps', 'examples']
  .filter((f) => existsSync(join(root, f)))
  .flatMap((f) => readdirSync(join(root, f)).map((g) => join(root, f, g)))
  .concat([join(root, 'power', 'marrow', 'templates', 'starter')])
  .filter((d) => existsSync(d) && statSync(d).isDirectory());

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'marrow') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(name)) files.push(path);
  }
};
for (const d of folders) for (const sub of ['src', 'test']) if (existsSync(join(d, sub))) walk(join(d, sub));

const problems = [];
const pattern = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(pattern)) {
        const spec = m[1] ?? m[2];
        const where = `${relative(root, file)}:${i + 1}`;
        if (spec.startsWith('@marrow/skeleton') && !PUBLIC.has(spec)) {
          problems.push(`${where} imports '${spec}'. Use '@marrow/skeleton' (or /web, /vite, /catalogue, /advisor) instead.`);
        } else if (spec.startsWith('.') && resolve(dirname(file), spec).startsWith(skeleton)) {
          problems.push(`${where} reaches into the kit with '${spec}'. Import it from '@marrow/skeleton' instead.`);
        }
      }
    });
}

if (problems.length > 0) {
  console.error(`Games must use only the kit's public API. ${problems.length} import(s) reach inside it:`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("If the game needs something that is not public, add it to skeleton/src/index.ts (or the web index) and import it from there.");
  process.exit(1);
}
console.log(`Public API only: ${files.length} files in the games, examples and starter checked.`);
