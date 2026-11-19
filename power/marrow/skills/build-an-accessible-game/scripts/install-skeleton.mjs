#!/usr/bin/env node
// Copy the Marrow runtime into a project.
//
//   node install-skeleton.mjs [folder] [--kiro] [--force]
//
//   folder   where to put the runtime (default ./marrow)
//   --kiro   also copy the proof hooks and the three agents into .kiro/ (never overwrites a file)
//   --force  put the runtime in a folder that already has files in it

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const power = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const target = resolve(args.find((a) => !a.startsWith('--')) ?? 'marrow');

const source = join(power, 'skeleton');
if (!existsSync(join(source, 'src', 'index.ts'))) {
  console.error(`The runtime is missing from this power (looked in ${source}).`);
  process.exit(1);
}
if (existsSync(target) && readdirSync(target).length > 0 && !flags.has('--force')) {
  console.error(`${target} already has files in it. Pick another folder, or add --force.`);
  process.exit(1);
}
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`Copied the Marrow runtime to ${target}.`);
const fromHere = relative(process.cwd(), target).replace(/\\/g, '/') || '.';
console.log(`Next: add  "@marrow/skeleton": "file:./${fromHere}"  to your package.json, then run npm install.`);

if (flags.has('--kiro')) {
  const copyMissing = (from, to) => {
    if (!existsSync(from)) return 0;
    mkdirSync(to, { recursive: true });
    let n = 0;
    for (const name of readdirSync(from)) {
      const out = join(to, name);
      if (statSync(join(from, name)).isFile() && !existsSync(out)) {
        cpSync(join(from, name), out);
        n += 1;
      }
    }
    return n;
  };
  const hooks = copyMissing(join(power, 'templates', 'hooks'), resolve('.kiro', 'hooks'));
  const agents = copyMissing(join(power, 'templates', 'agents'), resolve('.kiro', 'agents'));
  console.log(`Copied ${hooks} hook file(s) and ${agents} agent file(s) into .kiro/. Existing files were left alone.`);
}
