#!/usr/bin/env node
// The accessibility advisor, from this repository.
//
//   npm run advise -- new <folder>/brief.md       write a starter brief
//   npm run advise -- advise <folder>/brief.md    make or update the plan next to it, keeping your decisions
//   npm run advise -- build <folder>/brief.md     build what you accepted into <folder>/src/accessibility.generated.ts
//   npm run advise -- palette <theme>             show a theme's sounds
//   npm run advise -- advise-all                  update every plan in apps/ and examples/ (what the Kiro hook runs)
//
// It runs the advisor bundled in the Kiro power (power/marrow/mcp/advisor.js), which needs nothing installed.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = [join(root, 'power', 'marrow', 'mcp', 'advisor.js'), join(root, 'mcp', 'level-forge', 'dist', 'advisor.js')].find(existsSync);
if (!cli) {
  console.error('The advisor is not built yet. Run:  npm run build --workspace mcp/level-forge  then  node scripts/build-power.mjs');
  process.exit(1);
}
const args = process.argv.slice(2);
if (args[0] === 'advise-all') {
  const briefs = ['apps', 'examples'].flatMap((f) => (existsSync(join(root, f)) ? readdirSync(join(root, f)).map((g) => join(root, f, g, 'brief.md')) : [])).filter(existsSync);
  let status = 0;
  for (const b of briefs) status ||= spawnSync(process.execPath, [cli, 'advise', b], { stdio: 'inherit' }).status ?? 1;
  if (briefs.length === 0) console.log('No brief.md found in apps/ or examples/. Make one with:  npm run advise -- new apps/<game>/brief.md');
  process.exit(status);
}
const r = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
