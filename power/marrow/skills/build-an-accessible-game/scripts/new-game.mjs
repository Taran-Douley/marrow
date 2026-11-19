#!/usr/bin/env node
// Make a new, complete, accessible game you can run at once.
//
//   node new-game.mjs <folder> [--kiro]
//
//   folder   a new or empty folder for the game
//   --kiro   also copy the proof hooks and the three agents into <folder>/.kiro/
//
// Then:  cd <folder>  &&  npm install  &&  npm run dev
//
// The game is Bat Dash: one file, src/main.ts, with a proved level, a one-switch menu, settings,
// first-run setup, the coach, sound, speech, captions and vibration. Change it into your own game.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const power = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const kiro = args.includes('--kiro');
const folder = args.find((a) => !a.startsWith('--'));
if (!folder) {
  console.error('Say where to make the game, for example:  node new-game.mjs ../my-game');
  process.exit(1);
}
const target = resolve(folder);
if (existsSync(target) && readdirSync(target).length > 0) {
  console.error(`${target} already has files in it. Pick a new or empty folder.`);
  process.exit(1);
}

const starter = join(power, 'templates', 'starter');
const runtime = join(power, 'skeleton');
for (const [what, path] of [['starter game', join(starter, 'src', 'main.ts')], ['runtime', join(runtime, 'src', 'index.ts')]]) {
  if (!existsSync(path)) {
    console.error(`The ${what} is missing from this power (looked for ${path}).`);
    process.exit(1);
  }
}

mkdirSync(target, { recursive: true });
cpSync(starter, target, { recursive: true });
cpSync(runtime, join(target, 'marrow'), { recursive: true });

if (kiro) {
  for (const kind of ['hooks', 'agents']) {
    const from = join(power, 'templates', kind);
    if (!existsSync(from)) continue;
    const to = join(target, '.kiro', kind);
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from)) if (statSync(join(from, name)).isFile()) cpSync(join(from, name), join(to, name));
  }
}

console.log(`Made a new game in ${target}.`);
console.log('Next:');
console.log(`  cd "${target}"`);
console.log('  npm install');
console.log('  npm run dev');
console.log('Then open the address it prints, press any key, and play. Your game is src/main.ts.');
