#!/usr/bin/env node
// The power benchmark (Requirement 16): the same three prompts, built once without the Marrow power and
// once with it, scored by the same black-box audit.
//
//   node benchmark/run.mjs
//
// Put each build's output folder (the one with index.html, for Vite `dist/`) at
//   benchmark/builds/<prompt>/without/   and   benchmark/builds/<prompt>/with/
// The procedure is in benchmark/README.md. A missing build is reported as missing, never guessed.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKS, audit, toMarkdown } from './audit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTS = ['runner', 'quiz', 'rhythm'];
const SIDES = ['without', 'with'];

const results = [];
for (const prompt of PROMPTS) {
  for (const side of SIDES) {
    const dir = join(here, 'builds', prompt, side);
    if (!existsSync(join(dir, 'index.html'))) {
      results.push({ prompt, side, missing: true });
      continue;
    }
    const r = await audit(dir, `${prompt}, ${side} the power`);
    results.push({ prompt, side, passed: r.passed, total: r.total, checks: r.checks.map(({ id, pass, note }) => ({ id, pass, note })), errors: r.errors, detail: toMarkdown(r) });
  }
}

const cell = (prompt, side) => {
  const r = results.find((x) => x.prompt === prompt && x.side === side);
  return r.missing ? 'not built yet' : `${r.passed} of ${r.total}`;
};
const table = [
  '| Prompt | Without the power | With the power |',
  '|---|---|---|',
  ...PROMPTS.map((p) => `| ${p} | ${cell(p, 'without')} | ${cell(p, 'with')} |`),
].join('\n');

const perCheck = [
  '| Check | Without (of 3) | With (of 3) |',
  '|---|---|---|',
  ...CHECKS.map((c) => {
    const count = (side) => {
      const built = results.filter((r) => r.side === side && !r.missing);
      return built.length === 0 ? '-' : `${built.filter((r) => r.checks.find((x) => x.id === c.id)?.pass).length} of ${built.length}`;
    };
    return `| ${c.name} | ${count('without')} | ${count('with')} |`;
  }),
].join('\n');

const out = join(here, 'results');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ date: new Date().toISOString(), checks: CHECKS, results }, null, 2));
writeFileSync(
  join(out, 'results.md'),
  [
    '# Power benchmark results',
    '',
    'The same three prompts, built without and with the Marrow power, scored by the same black-box audit (14 checks a player can observe). The "without" column is reported as it is.',
    '',
    table,
    '',
    '## By check',
    '',
    perCheck,
    '',
    '## Each build',
    '',
    ...results.filter((r) => !r.missing).map((r) => r.detail),
    '',
    'The audit counts what it can observe in a simulated browser. It cannot hear or see, so it is a floor, not a verdict, and it does not replace testing with disabled players.',
    '',
  ].join('\n'),
);
console.log(table);
console.log(`\nWritten: benchmark/results/results.md and results.json`);
