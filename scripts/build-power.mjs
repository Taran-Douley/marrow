#!/usr/bin/env node
// Assemble the Marrow Kiro power in power/marrow.
//
//   npm run build --workspace mcp/level-forge     (once, to make the MCP server bundle)
//   node scripts/build-power.mjs
//
// The hand-written files of the power (plugin.json, mcp.json, README.md, skills/*/SKILL.md, the
// install script, templates/hooks) are left alone. This only refreshes the generated parts, from the
// repository, so the power can never drift from the code it ships:
//
//   skeleton/                                           the runtime (source only, no tests)
//   mcp/level-forge.js                                  the MCP server, one self-contained file
//   skills/build-an-accessible-game/references/         steering and guides
//   templates/agents/                                   the three agents, made portable
//   LICENSE

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const out = resolve(outArg >= 0 ? process.argv[outArg + 1] : join(root, 'power', 'marrow'));

const bundle = join(root, 'mcp', 'level-forge', 'dist', 'main.js');
if (!existsSync(bundle)) {
  console.error('The MCP server is not built. Run:  npm run build --workspace mcp/level-forge');
  process.exit(1);
}
if (!existsSync(join(out, 'plugin.json'))) {
  console.error(`${out} has no plugin.json. It holds the hand-written files of the power.`);
  process.exit(1);
}

/** Replace one generated path, never touching anything outside the power. */
function fresh(relative) {
  const path = resolve(out, relative);
  if (!path.startsWith(out + sep)) throw new Error(`Refusing to touch ${path}: it is outside ${out}.`);
  rmSync(path, { recursive: true, force: true });
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

// ---- the runtime --------------------------------------------------------------------------------
const skeleton = fresh('skeleton');
cpSync(join(root, 'skeleton', 'src'), join(skeleton, 'src'), { recursive: true });
const pkg = JSON.parse(readFileSync(join(root, 'skeleton', 'package.json'), 'utf8'));
writeFileSync(
  join(skeleton, 'package.json'),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      license: 'MIT',
      type: 'module',
      main: pkg.main,
      types: pkg.types,
      exports: pkg.exports,
      scripts: { typecheck: 'tsc --noEmit' },
      devDependencies: { '@types/node': pkg.devDependencies['@types/node'], typescript: pkg.devDependencies.typescript },
    },
    null,
    2,
  ) + '\n',
);
const tsconfig = JSON.parse(readFileSync(join(root, 'skeleton', 'tsconfig.json'), 'utf8'));
tsconfig.include = ['src'];
writeFileSync(join(skeleton, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
writeFileSync(
  join(skeleton, 'README.md'),
  `# Marrow runtime

The Marrow kit: events in, accessible output out, and a property-based proof that levels can be finished with one switch.

- \`@marrow/skeleton\`: the core (no DOM): \`createKit\`, the proof, personas, the reviewer, the accessibility report.
- \`@marrow/skeleton/web\`: the web adapter (sound, speech, captions, haptics, input, storage, offline).
- \`@marrow/skeleton/vite\`: a Vite plugin that writes the offline service worker.

Guides are in the power's \`skills/build-an-accessible-game/references/\`. Licence: MIT.
`,
);

// ---- the MCP server -----------------------------------------------------------------------------
cpSync(bundle, fresh(join('mcp', 'level-forge.js')));

// ---- references ---------------------------------------------------------------------------------
const references = fresh(join('skills', 'build-an-accessible-game', 'references'));
mkdirSync(references, { recursive: true });
for (const [from, to] of [
  ['.kiro/steering/product.md', 'product.md'],
  ['.kiro/steering/accessibility.md', 'accessibility.md'],
  ['.kiro/steering/tech.md', 'tech.md'],
  ['.kiro/steering/structure.md', 'structure.md'],
  ['docs/customisation.md', 'customisation.md'],
  ['docs/genres.md', 'genres.md'],
  ['docs/voices.md', 'voices.md'],
]) {
  // The steering files carry "inclusion" front matter for Kiro. In a skill's references they are plain notes.
  const text = readFileSync(join(root, from), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  writeFileSync(join(references, to), text);
}

// ---- agents -------------------------------------------------------------------------------------
// The repository's agents read this repository's steering files. In another project those files
// are not there, so the `resources` block is dropped; the skill's references carry the same rules.
const agents = fresh(join('templates', 'agents'));
mkdirSync(agents, { recursive: true });
for (const name of readdirSync(join(root, '.kiro', 'agents'))) {
  const text = readFileSync(join(root, '.kiro', 'agents', name), 'utf8').replace(/^resources:\r?\n(?:[ \t]+-.*\r?\n)+/m, '');
  writeFileSync(join(agents, name), text);
}

cpSync(join(root, 'LICENSE'), fresh('LICENSE'));

console.log(`Power refreshed in ${out}`);
