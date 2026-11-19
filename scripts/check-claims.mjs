#!/usr/bin/env node
// Marrow never says a game is "fully accessible", and never that a game is accessible to everyone
// (product principle 7). This checks the repository's own text for those claims. A line that says
// the claim is NOT made (it has a word like "never" or "not") is fine.
//
//   node scripts/check-claims.mjs          scan the repository, exit 1 if there is an over-claim
//
// Used by the "No over-claiming" hook, and by a test.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLAIMS = [
  /fully accessible/i,
  /completely accessible/i,
  /100% accessible/i,
  /accessible to everyone/i,
  /accessible to all\b/i,
  /accessible by everyone/i,
];

/** A line that says the claim is not made. */
const DENIAL = /\b(never|not|no|nor|don't|dont|doesn't|isn't|cannot|can't|avoid|without)\b|n't\b/i;

/** The over-claims in some text: { line, text } for each. */
export function findClaims(text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (CLAIMS.some((claim) => claim.test(line)) && !DENIAL.test(line)) found.push({ line: i + 1, text: line.trim() });
  });
  return found;
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'private', 'coverage', '__snapshots__']);
const EXTENSIONS = new Set(['.md', '.html', '.ts', '.json', '.mjs', '.txt']);

export function* textFiles(root) {
  let names;
  try {
    names = readdirSync(root);
  } catch {
    return; // the folder went away while we looked (a build replacing it): nothing to check there
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(root, name);
    let info;
    try {
      info = statSync(path);
    } catch {
      continue;
    }
    if (info.isDirectory()) yield* textFiles(path);
    else if (EXTENSIONS.has(extname(name)) && info.size < 2_000_000) yield path;
  }
}

/** Scan a folder. The script itself and its test are skipped: they have to name the claims. */
export function scan(root) {
  const out = [];
  for (const path of textFiles(root)) {
    const rel = relative(root, path).split(sep).join('/');
    if (rel === 'scripts/check-claims.mjs' || rel.endsWith('/check-claims.test.ts') || rel.endsWith('/claims.test.ts')) continue;
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    for (const hit of findClaims(text)) out.push({ file: rel, ...hit });
  }
  return out;
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const hits = scan(join(here, '..'));
  if (hits.length === 0) {
    console.log('No over-claims found.');
  } else {
    for (const h of hits) console.error(`${h.file}:${h.line}: ${h.text}`);
    console.error('\nMarrow never calls a game fully accessible, and never says it is accessible to everyone. Say what it supports, and what a person must still check.');
    process.exit(1);
  }
}
