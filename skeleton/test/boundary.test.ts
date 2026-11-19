import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  coreFiles,
  findDomGlobal,
  importSpecifiers,
  pointsIntoAdapters,
} from './helpers/boundary';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

// Requirements 20.1 and 20.5: the core has no DOM or engine dependency and
// never imports from an adapter.

describe('core boundary', () => {
  const files = coreFiles(SRC);

  it('finds core files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('core never imports from adapters (20.5)', () => {
    const offenders = files
      .filter((f) => importSpecifiers(f.text).some(pointsIntoAdapters))
      .map((f) => f.path);
    expect(offenders, `core files importing adapters: ${offenders.join(', ')}`).toEqual([]);
  });

  it('core uses no DOM or engine globals (20.1)', () => {
    const offenders = files
      .map((f) => ({ path: f.path, hit: findDomGlobal(f.text) }))
      .filter((f) => f.hit !== null)
      .map((f) => `${f.path} uses ${f.hit}`);
    expect(offenders, offenders.join('; ')).toEqual([]);
  });
});

describe('boundary checker catches violations', () => {
  it('flags static, re-export and dynamic imports of adapters', () => {
    const code = [
      "import { webAdapter } from './adapters/web';",
      "export * from '../adapters/web/audio';",
      "const m = await import('adapters/web');",
    ].join('\n');
    const specs = importSpecifiers(code);
    expect(specs).toHaveLength(3);
    expect(specs.every(pointsIntoAdapters)).toBe(true);
  });

  it('does not flag unrelated imports', () => {
    expect(importSpecifiers("import { a } from './profile';").some(pointsIntoAdapters)).toBe(false);
  });

  it('flags a DOM global in code but not in a comment', () => {
    expect(findDomGlobal('const c = new AudioContext();')).toBe('AudioContext');
    expect(findDomGlobal('// uses document here\nconst x = 1;')).toBeNull();
    expect(findDomGlobal('/* window */ const y = 2;')).toBeNull();
  });

  it('ignores a DOM word inside message text but still sees real use inside ${ }', () => {
    expect(findDomGlobal("const s = 'the take-off window closes';")).toBeNull();
    expect(findDomGlobal('const s = `the window is ${n} ms`;')).toBeNull();
    expect(findDomGlobal('const s = `title: ${document.title}`;')).toBe('document');
    expect(findDomGlobal('const s = "navigator"; const t = navigator.vibrate;')).toBe('navigator');
  });
});
