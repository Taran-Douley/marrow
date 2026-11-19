#!/usr/bin/env node
// One command from a fresh clone to both games open in the browser.
//
//   npm run setup                 check Node, install, build, start both games, open them
//   npm run setup -- --no-start   everything but starting the games (for CI, or a slow machine)
//   npm run setup -- --no-open    start the games but do not open a browser
//   npm run play                  the quick way to test the newest code: start both games now (no build)
//
// It uses only Node's own modules, so it works before anything is installed. Every failure says
// what to do next.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const windows = process.platform === 'win32';
const npm = windows ? 'npm.cmd' : 'npm';
const NEED = [20, 19];
const GAMES = [
  { name: 'Ghastly Moves', dir: 'apps/ghastly-moves', port: 5173, what: 'a maths rhythm game: press on the fourth beat' },
  { name: 'Séance Escape', dir: 'apps/seance-escape', port: 5174, what: 'a haunted house you escape by sound: press when you hear the way you want' },
];

const say = (line = '') => console.log(line);
const step = (n, text) => say(`\n[${n}/4] ${text}`);
function stop(problem, todo) {
  say(`\nSetup stopped: ${problem}`);
  for (const line of [].concat(todo)) say(`  -> ${line}`);
  say('Then run  npm run setup  again.');
  process.exit(1);
}
function run(cmd, cmdArgs, cwd = root) {
  // npm needs a shell on Windows; node itself must not have one (its path may contain spaces).
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: windows && cmd !== process.execPath });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, error: r.error };
}
const lastLines = (text, n = 8) => text.replace(/\x1b\[[0-9;]*m/g, '').trim().split('\n').slice(-n).map((l) => `     ${l}`).join('\n');

// ---- 1. Node --------------------------------------------------------------------------
step(1, 'Checking Node.');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < NEED[0] || (major === NEED[0] && minor < NEED[1])) {
  stop(`Marrow needs Node ${NEED.join('.')} or later. This is Node ${process.versions.node}.`, [
    'Install the LTS version from https://nodejs.org (or run  nvm install --lts  if you use nvm).',
    'Close and reopen your terminal, and check with  node --version.',
  ]);
}
if (!run(npm, ['--version']).ok) stop('npm could not be found.', 'npm comes with Node. Reinstall Node from https://nodejs.org.');
say(`  Node ${process.versions.node}: good.`);

// `npm run play`: the quick way to test the newest code. It installs only if nothing is installed yet,
// skips the build (the dev servers run straight from the source, with live reload), and starts both games.
const quick = args.has('--quick');
if (quick && existsSync(join(root, 'node_modules'))) {
  say('\n[2/4] Already installed. (Run  npm run setup  for a full install and build.)');
  say('[3/4] No build needed: the games run straight from the source and reload as you save.');
} else {
// ---- 2. install ---------------------------------------------------------------------
step(2, 'Installing (this can take a minute the first time).');
const install = run(npm, existsSync(join(root, 'package-lock.json')) && !existsSync(join(root, 'node_modules')) ? ['ci', '--no-audit', '--no-fund'] : ['install', '--no-audit', '--no-fund']);
if (!install.ok) {
  stop(`npm could not install the packages.\n${lastLines(install.out)}`, [
    'Check you are online (or behind a proxy, set it with  npm config set proxy ...).',
    'If it says EACCES or EPERM, close any editor or server using this folder, then delete the node_modules folder.',
  ]);
}
say('  Installed.');

// ---- 3. build -------------------------------------------------------------------------
step(3, 'Building both games, and checking they use only the public API.');
const imports = run(process.execPath, [join(root, 'scripts', 'check-imports.mjs')]);
if (!imports.ok) stop(`a game reaches inside the kit.\n${lastLines(imports.out)}`, 'Change those imports to come from @marrow/skeleton, as the message says.');
for (const g of GAMES) {
  const built = run(npm, ['run', 'build', '--workspace', g.dir]);
  if (!built.ok) {
    stop(`${g.name} did not build.\n${lastLines(built.out)}`, [
      `Run  npm run build --workspace ${g.dir}  to see the whole message.`,
      'If you changed a file, the line it names is the place to look.',
    ]);
  }
  say(`  ${g.name}: built.`);
}
}

if (args.has('--no-start')) {
  say('\nReady. Start a game with  npm run dev --workspace apps/ghastly-moves  (or apps/seance-escape).');
  process.exit(0);
}

// ---- 4. start -------------------------------------------------------------------------
step(4, 'Starting both games.');
/** The first free port from `want`, on this machine only. */
const freePort = (want) =>
  new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(freePort(want + 1)));
    probe.once('listening', () => probe.close(() => done(want)));
    probe.listen(want, '127.0.0.1');
  });

const children = [];
const quit = () => {
  for (const c of children) c.kill();
  process.exit(0);
};
process.on('SIGINT', quit);
process.on('SIGTERM', quit);

for (const g of GAMES) {
  g.port = await freePort(g.port);
  const viteArgs = ['vite', '--host', '127.0.0.1', '--port', String(g.port), '--strictPort', ...(args.has('--no-open') ? [] : ['--open'])];
  const child = spawn(windows ? 'npx.cmd' : 'npx', viteArgs, { cwd: join(root, g.dir), stdio: ['ignore', 'pipe', 'pipe'], shell: windows });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      say(`\n${g.name} stopped unexpectedly.\n${lastLines(output)}`);
      say(`  -> Start it alone with  npm run dev --workspace ${g.dir}  to see why.`);
    }
  });
  children.push(child);
}
await new Promise((r) => setTimeout(r, 2500));

say('\nBoth games are running. They should have opened in your browser:');
for (const g of GAMES) say(`  ${g.name.padEnd(14)} http://127.0.0.1:${g.port}/   ${g.what}`);
say('\nIn each game: press any key. That is the only control. Escape comes back to the menu.');
say('\nNext step, with Kiro: open this folder in Kiro and ask');
say('  "Add a crypt obstacle to Ghastly Moves."');
say('Kiro makes apps/ghastly-moves/src/objects/crypt.ts. A hook puts it in the game, its tests and its');
say('docs, and runs the proof. Make it too wide to jump and the proof says why, in plain words.');
say('\nPress Ctrl+C to stop both games.');
