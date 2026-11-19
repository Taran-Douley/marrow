#!/usr/bin/env node
// Wire every object file into its game, then run the proof.
//
//   node scripts/wire-objects.mjs           wire only
//   node scripts/wire-objects.mjs --prove   wire, then prove (what the Kiro hook runs)
//
// An object file is apps/<game>/src/objects/<name>.ts whose default export is a preset:
//
//   import { preset } from '@marrow/skeleton/catalogue';
//   export default preset({ name: 'crypt', width: [0.2, 0.3] });
//
// For each game with such files, this writes:
//   src/objects/index.generated.ts      the list the game's kit puts in its registry
//   test/objects.generated.test.ts      a proof test for each object, alone and in the game
//   docs/objects-<game>.md              the game's own objects, with their sound, words and buzz
// Then, with --prove, it runs that test and says, in plain words, what passed and what to fix.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prove = process.argv.includes('--prove');
const GENERATED = new Set(['index.generated.ts', 'index.ts']);

const write = (path, text) => {
  if (existsSync(path) && readFileSync(path, 'utf8') === text) return false;
  writeFileSync(path, text);
  return true;
};

let failed = false;
let wired = 0;
for (const game of readdirSync(join(root, 'apps'))) {
  const dir = join(root, 'apps', game, 'src', 'objects');
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !GENERATED.has(f))
    .filter((f) => /export\s+default\s+preset\s*\(/.test(readFileSync(join(dir, f), 'utf8')))
    .sort();
  const names = files.map((f) => basename(f, '.ts'));
  const ident = (n) => n.replace(/[^a-zA-Z0-9]+(\w)/g, (_, c) => c.toUpperCase()).replace(/^\d/, '_$&');

  write(
    join(dir, 'index.generated.ts'),
    [
      '// Made by scripts/wire-objects.mjs. Do not edit: add a file to src/objects/ whose default export is a',
      "// preset, and the Kiro hook (or `node scripts/wire-objects.mjs`) puts it here, in the kit, the tests and the docs.",
      "import type { ObjectPreset } from '@marrow/skeleton/catalogue';",
      ...names.map((n) => `import ${ident(n)} from './${n}';`),
      '',
      `export const OBJECTS: readonly ObjectPreset[] = [${names.map(ident).join(', ')}];`,
      '',
    ].join('\n'),
  );

  write(
    join(root, 'apps', game, 'test', 'objects.generated.test.ts'),
    [
      '// Made by scripts/wire-objects.mjs. Do not edit.',
      "import { describe, expect, it } from 'vitest';",
      "import { createKit } from '@marrow/skeleton';",
      "import { catalogueMarkdown, useObject } from '@marrow/skeleton/catalogue';",
      "import { OBJECTS } from '../src/objects/index.generated';",
      '',
      `describe('${game}: objects wired from src/objects', () => {`,
      "  it('every object has a sound, words, a caption and a buzz, and every event reaches two senses', () => {",
      '    for (const o of OBJECTS) {',
      '      const kit = createKit();',
      '      useObject(kit, o);',
      "      expect(kit.proveEvents().counterexamples ?? [], o.name).toEqual([]);",
      '    }',
      '  });',
      '',
      "  it('every obstacle, alone, makes levels that pass the whole proof', () => {",
      "    for (const o of OBJECTS.filter((x) => x.kind === 'obstacle')) {",
      '      const kit = createKit();',
      '      useObject(kit, o);',
      '      for (let seed = 1; seed <= 20; seed++) {',
      '        const failing = kit.prove(kit.generate(seed), `Level ${seed}`).filter((r) => !r.pass);',
      '        expect(failing.map((r) => r.counterexample), o.name).toEqual([]);',
      '      }',
      '    }',
      '  });',
      '',
      "  it('the list of objects in docs/ is up to date', async () => {",
      `    const heading = { title: 'Objects in ${game}', made: 'Made by scripts/wire-objects.mjs from apps/${game}/src/objects/, never by hand.' };`,
      `    await expect(catalogueMarkdown(OBJECTS, heading)).toMatchFileSnapshot('../../../docs/objects-${game}.md');`,
      '  });',
      '});',
      '',
    ].join('\n'),
  );

  wired += names.length;
  console.log(names.length === 0 ? `${game}: no object files to wire.` : `${game}: wired ${names.join(', ')}.`);
  if (!prove) continue;

  // The object alone, then the whole game with it in.
  for (const [what, args] of [
    [names.length === 0 ? 'the object list' : 'each object alone', ['vitest', 'run', 'test/objects.generated.test.ts', '-u']],
    ['every stage and boss of the game, with it in', ['vitest', 'run', 'test/stages.test.ts']],
  ]) {
    if (names.length === 0 && what !== 'the object list') continue;
    try {
      execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: join(root, 'apps', game), stdio: 'pipe', shell: process.platform === 'win32' });
      console.log(`${game}: proof passed for ${what}.`);
    } catch (error) {
      failed = true;
      const out = `${error.stdout ?? ''}${error.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');
      const reasons = [...new Set(out.split('\n').filter((l) => /(Level|Stage|[A-Z][a-z]+ \d+).*obstacle \d+ \(|^\s*[+-]?\s*"?Object '/.test(l) && !/^\s*\d+\|/.test(l)).map((l) => l.trim().replace(/^[+-]\s*"?|",?$/g, '')))].slice(0, 6);
      console.log(`${game}: the proof FAILED for ${what}. The game will refuse these levels until it is fixed:`);
      for (const r of reasons) console.log(`  - ${r}`);
      console.log(`  Fix the object file in apps/${game}/src/objects/ (often its width), save it, and the proof runs again.`);
      break;
    }
  }
}
if (prove && !failed) {
  // The game's own reports list what it guarantees: rewrite them so they include the new object.
  for (const game of readdirSync(join(root, 'apps'))) {
    const pkg = JSON.parse(readFileSync(join(root, 'apps', game, 'package.json'), 'utf8'));
    for (const script of ['report', 'proof-report']) {
      if (!pkg.scripts?.[script]) continue;
      execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], { cwd: join(root, 'apps', game), stdio: 'pipe', shell: process.platform === 'win32' });
    }
  }
  console.log(wired > 0 ? 'Reports in docs/ are up to date. The new object is in the game: start it and it can appear in any jump part.' : 'Reports in docs/ are up to date.');
}
process.exit(failed ? 1 : 0);
