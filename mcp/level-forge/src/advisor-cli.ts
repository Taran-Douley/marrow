import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  BriefError,
  PALETTES,
  THEMES,
  advise,
  briefTemplate,
  buildFromPlan,
  generatedModule,
  parseBrief,
  parsePlan,
  planMarkdown,
  type Theme,
} from '@marrow/skeleton/advisor';

// The advisor from the command line. Bundled with the kit into one file, so it runs with plain node.
//
//   node advisor.js advise  <brief.md>   make or update accessibility-plan.md next to the brief, keeping decisions
//   node advisor.js build   <brief.md>   build the accepted plan into src/accessibility.generated.ts
//   node advisor.js palette <theme>      show a theme's sounds
//   node advisor.js new     <brief.md>   write a starter brief

const [command, target] = process.argv.slice(2);
const say = (line = ''): void => console.log(line);
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

function readBrief(path: string) {
  if (!existsSync(path)) fail(`There is no brief at ${path}. Make one with:  npm run advise -- new ${path}`);
  try {
    return parseBrief(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error instanceof BriefError) return fail(`${path}: ${error.message}`);
    throw error;
  }
}

const planPath = (brief: string): string => join(dirname(brief), 'accessibility-plan.md');

switch (command) {
  case 'new': {
    const path = resolve(target ?? 'brief.md');
    if (existsSync(path)) fail(`${path} already exists. Edit it, then run:  npm run advise -- advise ${relative(process.cwd(), path)}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, briefTemplate());
    say(`Wrote a starter brief to ${path}. Fill it in, then run:  npm run advise -- advise ${relative(process.cwd(), path)}`);
    break;
  }
  case 'advise': {
    const path = resolve(target ?? 'brief.md');
    const brief = readBrief(path);
    const out = planPath(path);
    const previous = existsSync(out) ? parsePlan(readFileSync(out, 'utf8'), brief) : undefined;
    const plan = advise(brief, previous);
    writeFileSync(out, planMarkdown(plan));
    const count = (pred: (i: (typeof plan.items)[number]) => boolean): number => plan.items.filter(pred).length;
    say(`${brief.name} (${brief.genre}, ${brief.theme}): ${plan.items.length} suggestions in ${relative(process.cwd(), out)}.`);
    say(`  ${count((i) => i.decision === 'accepted')} accepted, ${count((i) => i.decision === 'rejected')} rejected, ${count((i) => i.decision === 'undecided')} to decide.`);
    if (count((i) => i.isNew) > 0) say(`  New since last time: ${plan.items.filter((i) => i.isNew).map((i) => i.id).join(', ')}.`);
    if (count((i) => i.noLongerFits) > 0) say(`  No longer fit the brief (kept, as you had decided): ${plan.items.filter((i) => i.noLongerFits).map((i) => i.id).join(', ')}.`);
    if (brief.genreAsWritten) say(`  "${brief.genreAsWritten}" is not a genre Marrow knows, so the advice is general. Known: runner, rhythm, platformer, quiz, maze, puzzle, shooter, racing, card, story.`);
    if (brief.themeAsWritten) say(`  "${brief.themeAsWritten}" has no sound palette yet, so sounds use the neutral one. Palettes: ${THEMES.join(', ')}.`);
    say('Next: tick [x] or reject [-] each item (or ask the accessibility designer in Kiro), then run  npm run advise -- build ' + relative(process.cwd(), path));
    break;
  }
  case 'build': {
    const path = resolve(target ?? 'brief.md');
    const brief = readBrief(path);
    const planFile = planPath(path);
    if (!existsSync(planFile)) fail(`There is no plan yet. Run first:  npm run advise -- advise ${relative(process.cwd(), path)}`);
    const plan = parsePlan(readFileSync(planFile, 'utf8'), brief);
    const built = buildFromPlan(plan, brief);
    const out = join(dirname(path), 'src', 'accessibility.generated.ts');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, generatedModule(built, plan));
    say(`Built ${relative(process.cwd(), out)} from ${plan.items.filter((i) => i.decision === 'accepted').length} accepted suggestions.`);
    for (const d of built.done) say(`  done: ${d}`);
    for (const t of built.todo) say(`  to do in your code: ${t.title}. ${t.how}`);
    say('Pass it to the kit:  createKit({ ...ACCESSIBILITY.kit, ...yours })  or  createGame({ title, objects, kit: ACCESSIBILITY.kit })');
    say('Then check how it plays: the proof runs on every level, and the quality report shows the bots’ results.');
    break;
  }
  case 'palette': {
    const theme = (target ?? 'neutral') as Theme;
    if (!THEMES.includes(theme)) fail(`No palette called '${target}'. Palettes: ${THEMES.join(', ')}.`);
    const p = PALETTES[theme];
    say(`${theme}: ${p.mood}`);
    for (const [role, s] of Object.entries(p.sounds)) say(`  ${role.padEnd(9)} ${s.words}`);
    break;
  }
  default:
    say('The Marrow accessibility advisor.');
    say('  npm run advise -- new <folder>/brief.md       write a starter brief');
    say('  npm run advise -- advise <folder>/brief.md    make or update the plan, keeping your decisions');
    say('  npm run advise -- build <folder>/brief.md     build what you accepted');
    say(`  npm run advise -- palette <theme>             show a theme's sounds (${THEMES.join(', ')})`);
    if (command) process.exit(1);
}
