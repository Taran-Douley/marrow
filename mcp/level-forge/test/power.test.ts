import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

// The Kiro power, the hooks and the agents. These check the files Kiro reads, against the format Kiro
// documents (Agent Plugins 1.0 for the power, the v1 JSON format for hooks, Markdown with front matter
// for agents), and that the bundled MCP server really starts and answers.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const power = join(root, 'power', 'marrow');
const read = (...parts: string[]): string => readFileSync(join(...parts), 'utf8');
const json = (...parts: string[]): any => JSON.parse(read(...parts));

function front(text: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  expect(m, 'front matter').not.toBeNull();
  const fields: Record<string, string> = {};
  for (const line of m![1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]!] = kv[2]!;
  }
  return fields;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

beforeAll(() => {
  const bundle = join(root, 'mcp', 'level-forge', 'dist', 'main.js');
  if (!existsSync(bundle)) {
    execFileSync(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: join(root, 'mcp', 'level-forge'), stdio: 'ignore' });
  }
  // Refresh the generated parts of the power from the repository, so this tests what would ship.
  execFileSync(process.execPath, [join(root, 'scripts', 'build-power.mjs')], { cwd: root, stdio: 'ignore' });
}, 120_000);

describe('the power (Agent Plugins 1.0)', () => {
  it('has a valid manifest that activates on game talk', () => {
    const m = json(power, 'plugin.json');
    expect(m.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    expect(m.name).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(m.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(m.description.length).toBeGreaterThan(40);
    expect(m.author.name).toBeTruthy();
    expect(m.license).toBe('MIT');
    expect(m.keywords).toEqual(expect.arrayContaining(['game', 'accessibility', 'one-switch', 'accessible']));
  });

  it('declares the level-forge server with the plugin root, and ships the file it points at, identical to the build', () => {
    const mcp = json(power, 'mcp.json');
    const server = mcp.mcpServers['level-forge'];
    expect(server.type).toBe('stdio');
    expect(server.command).toBe('node');
    expect(server.args).toEqual(['${PLUGIN_ROOT}/mcp/level-forge.js']);
    expect(read(power, 'mcp', 'level-forge.js')).toBe(read(root, 'mcp', 'level-forge', 'dist', 'main.js'));
  });

  it('the bundled server starts from the power folder and lists all its tools', () => {
    const input = [
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}',
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      '{"jsonrpc":"2.0","id":2,"method":"tools/list"}',
      '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"prove_level","arguments":{"seed":5}}}',
    ].join('\n');
    const run = spawnSync(process.execPath, [join(power, 'mcp', 'level-forge.js')], { input, encoding: 'utf8', timeout: 30_000 });
    expect(run.status).toBe(0);
    const replies = run.stdout.trim().split('\n').map((l) => JSON.parse(l));
    expect(replies).toHaveLength(3);
    expect(replies[1].result.tools.map((t: { name: string }) => t.name)).toEqual([
      'generate_level',
      'prove_level',
      'prove_many',
      'simulate_persona',
      'review_level',
      'a11y_report',
      'prove_house',
      'advise_game',
      'sound_palette',
      'quality_report',
    ]);
    expect(replies[2].result.content[0].text).toMatch(/^Level 5 passes all/);
  });

  it('has skills whose names match their folders, each with a real description', () => {
    const dirs = readdirSync(join(power, 'skills'));
    expect(dirs.sort()).toEqual(['accessibility-report', 'add-an-object', 'build-an-accessible-game', 'prove-and-review-levels']);
    for (const dir of dirs) {
      const f = front(read(power, 'skills', dir, 'SKILL.md'));
      expect(f.name, dir).toBe(dir);
      const name = f.name!;
      const description = f.description!;
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(name.length).toBeLessThanOrEqual(64);
      expect(description.length).toBeGreaterThan(60);
      expect(description.length).toBeLessThanOrEqual(1024);
    }
  });

  it('the main skill says accessibility is the default, names the proof by pattern, and promises no more than it proves', () => {
    const text = read(power, 'skills', 'build-an-accessible-game', 'SKILL.md');
    expect(text).toMatch(/Never ask the developer whether they want it/);
    expect(text).toMatch(/properties 1 to 6/);
    expect(text).toMatch(/Never claim the kit "works for every game"/);
    expect(existsSync(join(power, 'skills', 'build-an-accessible-game', 'scripts', 'install-skeleton.mjs'))).toBe(true);
  });

  it('bundles the runtime as source, with the proof, personas, reviewer and report, and no tests or installs', () => {
    for (const p of ['index.ts', 'proof/index.ts', 'personas/index.ts', 'reviewer/index.ts', 'report/index.ts', 'adapters/web/offline.ts']) {
      expect(existsSync(join(power, 'skeleton', 'src', p)), p).toBe(true);
    }
    const names = files(power).map((f) => f.replace(power, ''));
    expect(names.filter((n) => /node_modules|[\\/]dist[\\/]|\.test\.ts$/.test(n))).toEqual([]);
    expect(json(power, 'skeleton', 'package.json').exports['./vite']).toBeTruthy();
  });

  it('carries the steering and guides as plain references, and the licence', () => {
    for (const f of ['accessibility.md', 'product.md', 'tech.md', 'structure.md', 'customisation.md', 'genres.md', 'voices.md']) {
      const text = read(power, 'skills', 'build-an-accessible-game', 'references', f);
      expect(text.length, f).toBeGreaterThan(200);
      expect(text.startsWith('---'), `${f} should have no front matter`).toBe(false);
    }
    expect(read(power, 'LICENSE')).toMatch(/MIT License/);
  });
});

const HOOK_TRIGGERS = new Set([
  'PromptSubmit', 'Stop', 'SessionStart', 'SessionEnd', 'PreCompact', 'PostCompact', 'PreToolUse', 'PermissionRequest',
  'PostToolUse', 'PostFileCreate', 'PostFileSave', 'PostFileDelete', 'PreTaskExecution', 'PostTaskExecution',
]);

function checkHookFile(path: string): void {
  const file = JSON.parse(readFileSync(path, 'utf8'));
  expect(file.version, path).toBe('v1');
  expect(Array.isArray(file.hooks) && file.hooks.length > 0, path).toBe(true);
  for (const hook of file.hooks) {
    expect(hook.name, path).toBeTruthy();
    expect(HOOK_TRIGGERS.has(hook.trigger), `${path}: trigger ${hook.trigger}`).toBe(true);
    expect(['command', 'agent']).toContain(hook.action.type);
    if (hook.action.type === 'command') expect(hook.action.command, path).toBeTruthy();
    else expect(hook.action.prompt?.length, path).toBeGreaterThan(40);
    if (hook.matcher !== undefined) expect(() => new RegExp(hook.matcher), `${path}: matcher`).not.toThrow();
    if (hook.timeout !== undefined) expect(hook.timeout).toBeGreaterThanOrEqual(0);
  }
}

describe('the hooks', () => {
  it('this repository\u2019s hooks and the power\u2019s templates follow the v1 format', () => {
    const repoHooks = readdirSync(join(root, '.kiro', 'hooks')).filter((f) => f.endsWith('.json'));
    expect(repoHooks.sort()).toEqual(['core-change-tests.json', 'no-fully-accessible.json', 'proof-on-object-save.json', 'store-list-report.json', 'usage-log-after-task.json', 'wire-new-object.json'].concat('advise-on-brief.json').sort());
    for (const f of repoHooks) checkHookFile(join(root, '.kiro', 'hooks', f));
    for (const f of readdirSync(join(power, 'templates', 'hooks'))) checkHookFile(join(power, 'templates', 'hooks', f));
  });

  it('the proof hook fires on an object file and not on an unrelated one, on both path styles', () => {
    const hook = json(root, '.kiro', 'hooks', 'proof-on-object-save.json').hooks[0];
    const re = new RegExp(hook.matcher);
    for (const yes of ['apps\\seance-escape\\src\\stages.ts', 'apps/ghastly-moves/src/kit.ts']) expect(re.test(yes), yes).toBe(true);
    for (const no of ['docs/readme.md', 'apps/ghastly-moves/test/page.test.ts', 'skeleton/src/index.ts']) expect(re.test(no), no).toBe(false);
    expect(hook.action.command).toBe('npm test --workspace apps/ghastly-moves --workspace apps/seance-escape');
    // Object files have their own hook: it wires them in, then proves them.
    for (const wire of json(root, '.kiro', 'hooks', 'wire-new-object.json').hooks) {
      const w = new RegExp(wire.matcher);
      for (const yes of ['apps/ghastly-moves/src/objects/crypt.ts', 'apps\\ghastly-moves\\src\\objects\\crypt.ts']) expect(w.test(yes), yes).toBe(true);
      for (const no of ['apps/ghastly-moves/src/objects/index.generated.ts', 'apps/ghastly-moves/src/kit.ts']) expect(w.test(no), no).toBe(false);
      expect(wire.action.command).toBe('node scripts/wire-objects.mjs --prove');
    }
  });

  it('the core hook fires on a skeleton file, and the store-list hook runs the report scripts that exist', () => {
    expect(new RegExp(json(root, '.kiro', 'hooks', 'core-change-tests.json').hooks[0].matcher).test('skeleton\\src\\report\\index.ts')).toBe(true);
    const store = json(root, '.kiro', 'hooks', 'store-list-report.json').hooks[0];
    expect(store.action.command).toBe('npm run report --workspace apps/ghastly-moves --workspace apps/seance-escape && npm run proof-report --workspace apps/ghastly-moves --workspace apps/seance-escape');
    for (const app of ['ghastly-moves', 'seance-escape']) {
      expect(json(root, 'apps', app, 'package.json').scripts.report).toMatch(/report\.test\.ts/);
      expect(json(root, 'apps', app, 'package.json').scripts['proof-report']).toMatch(/proof-report\.test\.ts/);
    }
  });
});

describe('the agents', () => {
  const names = ['accessibility-designer', 'accessibility-reviewer', 'level-designer', 'playtester'];

  it('are Markdown with front matter and a real prompt, in the repository and in the power', () => {
    for (const dir of [join(root, '.kiro', 'agents'), join(power, 'templates', 'agents')]) {
      expect(readdirSync(dir).sort()).toEqual(names.map((n) => `${n}.md`));
      for (const n of names) {
        const text = read(dir, `${n}.md`);
        const f = front(text);
        expect(f.name).toBe(n);
        expect(f.description!.length).toBeGreaterThan(40);
        expect(text.split(/^---\r?$/m)[2]!.trim().length, n).toBeGreaterThan(300);
      }
    }
  });

  it('the reviewer and the playtester can never write a file, and every agent keeps the honesty rule', () => {
    for (const n of ['accessibility-reviewer', 'playtester']) {
      const text = read(root, '.kiro', 'agents', `${n}.md`);
      expect(text).toMatch(/capability: fs_write\s+match: \["\*\*"\]\s+effect: deny/);
      expect(front(text).tools).not.toMatch(/write|shell/);
    }
    for (const n of names) expect(read(root, '.kiro', 'agents', `${n}.md`)).toMatch(/Never (say a game is|call a game) "fully accessible"|Never say a game is "fully accessible"/);
  });

  it('the power\u2019s copies do not read this repository\u2019s files', () => {
    for (const n of names) expect(read(power, 'templates', 'agents', `${n}.md`)).not.toMatch(/^resources:/m);
  });

  it('the level designer may write only in app sources, and asks before touching the kit', () => {
    const text = read(root, '.kiro', 'agents', 'level-designer.md');
    expect(text).toMatch(/match: \["apps\/\*\/src\/\*\*"[^\]]*\]\s+effect: allow/);
    expect(text).toMatch(/match: \["skeleton\/\*\*"[^\]]*\]\s+effect: ask/);
  });
});
