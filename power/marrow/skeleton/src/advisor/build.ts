import type { KitConfig } from '../kit';
import type { ProfilePatch } from '../types';
import type { Brief } from './brief';
import { PALETTES } from './palette';
import { accepted, type Plan, type PlanItem } from './plan';

// Building what was agreed (Requirement A6). Only settings: the plan never edits game logic. What
// Marrow can build goes into a kit patch and profile defaults; what the game's own code must do is a
// to-do with its how-to, never claimed as done.

export interface Built {
  /** Pass to createKit, or as `kit` to createGame: { ...built.kit, ...yourOwn }. */
  kit: KitConfig;
  /** Starting settings for new players. */
  profile: ProfilePatch;
  /** Event presentations for the palette's other roles, if the game emits them: palette-reward, palette-danger, palette-tick. */
  events: NonNullable<KitConfig['events']>;
  /** What was built, in words. */
  done: string[];
  /** Accepted items the game's own code must do. */
  todo: { id: string; title: string; how: string }[];
}

export function buildFromPlan(plan: Plan, brief: Brief): Built {
  const palette = PALETTES[brief.theme];
  const items = accepted(plan);
  const on = (key: string): PlanItem | undefined => items.find((i) => i.how.kind === 'from-plan' && i.how.builds === key);
  const kit: KitConfig = {};
  const profile: ProfilePatch = {};
  const events: Built['events'] = {};
  const done: string[] = [];

  if (on('palette')) {
    const s = palette.sounds;
    kit.voices = [
      { label: s.cueLow.words, hz: s.cueLow.hz, wave: s.cueLow.wave },
      { label: s.cueHigh.words, hz: s.cueHigh.hz, wave: s.cueHigh.wave },
    ];
    const recipe = (r: typeof s.step) => ({ hz: r.hz, wave: r.wave, ...(r.gain !== undefined ? { gain: r.gain } : {}), ...(r.shape ? { shape: r.shape } : {}) });
    kit.audio = { recipes: { jumped: recipe(s.step), landed: recipe(s.step), fall: recipe(s.fall) } };
    events['palette-reward'] = { caption: 'Reward', sound: { ...recipe(s.reward), role: 'reward' }, haptic: [40, 30, 80] };
    events['palette-danger'] = { caption: 'Danger', sound: { ...recipe(s.danger), role: 'effect' }, haptic: [100, 40, 100], priority: 'critical' };
    events['palette-tick'] = { decorative: true, sound: { ...recipe(s.tick), role: 'effect' } };
    done.push(`Sounds from the ${palette.theme} palette: objects without a sound of their own count down with ${s.cueLow.words} and ${s.cueHigh.words}; jumps and landings are ${s.step.words}; a fall is ${s.fall.words}.`);
  }
  if (on('coach')) {
    kit.coach = true;
    done.push('The coach is offered in the settings (off until a player picks a lead).');
  }
  if (on('assist')) {
    done.push('Timing help is offered in the menu. Its note can ask for it on by default: write "on by default" in the note.');
    if (/on by default/i.test(on('assist')!.note)) done.push('Timing help starts on for new players.');
  }
  if (on('announce')) {
    profile.announce = /minimal/i.test(on('announce')!.note) ? 'minimal' : 'normal';
    done.push(`Announcements start at ${profile.announce}; players change it in the settings.`);
  }
  if (Object.keys(events).length > 0) kit.events = events;
  // New players start with these settings: the kit's defaults are the profile a new player gets.
  if (Object.keys(profile).length > 0) kit.defaults = { ...profile };

  const todo = items.filter((i) => i.how.kind === 'by-hand').map((i) => ({ id: i.id, title: i.title, how: i.how.detail }));
  return { kit, profile, events, done, todo };
}

/** Whether timing help should start on, from the plan. Games with a timing-help switch read this. */
export const assistByDefault = (plan: Plan): boolean => accepted(plan).some((i) => i.id === 'timing-help' && /on by default/i.test(i.note));

/** The built settings as a TypeScript module the game imports. Written by `npm run advise -- build`. */
export function generatedModule(built: Built, plan: Plan): string {
  const json = (v: unknown): string => JSON.stringify(v, null, 2);
  return [
    `// Made by the Marrow advisor from ${plan.game}'s accessibility plan. Do not edit: change the plan and build again.`,
    "import type { KitConfig, ProfilePatch } from '@marrow/skeleton';",
    '',
    '/** Pass to createKit or createGame: { ...ACCESSIBILITY.kit, ...yourOwnSettings }. */',
    `export const ACCESSIBILITY: { kit: KitConfig; profile: ProfilePatch; assistByDefault: boolean } = ${json({ kit: built.kit, profile: built.profile, assistByDefault: assistByDefault(plan) })};`,
    '',
    '/** What was built, and what your code still has to do. */',
    `export const BUILT = ${json(built.done)};`,
    `export const TODO = ${json(built.todo)};`,
    '',
  ].join('\n');
}
