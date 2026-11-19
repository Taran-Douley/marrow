import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Remove // and block comments so words in comments are not flagged. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Module specifiers named in import/export-from/dynamic import statements. */
export function importSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
  for (const match of code.matchAll(pattern)) {
    if (match[1] !== undefined) found.push(match[1]);
  }
  return found;
}

/** True when a specifier points into an adapters folder. */
export function pointsIntoAdapters(specifier: string): boolean {
  return /(^|\/)adapters(\/|$)/.test(specifier);
}

const DOM_GLOBALS =
  /\b(document|window|navigator|localStorage|sessionStorage|AudioContext|speechSynthesis|requestAnimationFrame|HTMLElement|CanvasRenderingContext2D)\b/;

/**
 * Remove the text of string and template literals, so words in messages are
 * not flagged. Code inside `${ ... }` is kept, because it can use a global.
 */
export function stripStrings(source: string): string {
  return source
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, (template) => {
      const inner = [...template.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1] ?? '');
      return ` ${inner.join(' ; ')} `;
    })
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

/** First DOM or engine global used in the code (comments and string text ignored), or null. */
export function findDomGlobal(source: string): string | null {
  const hit = DOM_GLOBALS.exec(stripStrings(stripComments(source)));
  return hit?.[1] ?? null;
}

/** All .ts files under a folder, as paths relative to it. */
export function listTsFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts')) out.push(relative(root, full));
    }
  };
  walk(root);
  return out;
}

/** Core files are everything in src/ except src/adapters/. */
export function coreFiles(srcRoot: string): { path: string; text: string }[] {
  return listTsFiles(srcRoot)
    .filter((p) => p.split(sep)[0] !== 'adapters')
    .map((p) => ({ path: p, text: readFileSync(join(srcRoot, p), 'utf8') }));
}
