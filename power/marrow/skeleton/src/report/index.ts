import type { Channel, ChannelId } from '../types';

// The accessibility feature list (Requirement 14). It is made from what the kit actually guarantees:
// the channels that are on, and the proof properties that pass. It maps those to the 24 tags of the
// ESA Accessible Games Initiative, and for every tag says one of three things:
//
//   supported  the kit guarantees what the tag asks for, and nothing that supports it is failing
//   check      the kit provides the feature, but the tag has criteria a person must confirm
//   no         not claimed, with the reason (not built, does not apply, or a proof is failing)
//
// It never calls a game "fully accessible". It states what is supported.

export const ESA_TAGS = [
  'Multiple Volume Controls',
  'Mono Sound',
  'Stereo Sound',
  'Surround Sound',
  'Narrated Menus',
  'Difficulty Levels',
  'Save Anytime',
  'Basic Input Remapping',
  'Full Input Remapping',
  'Stick Inversion',
  'Playable without Button Holds',
  'Playable without Rapid Button Presses',
  'Playable with Keyboard Only',
  'Playable with Mouse Only',
  'Playable with Buttons Only',
  'Playable with Touch Only',
  'Playable without Motion Controls',
  'Playable without Touch Controls',
  'Chat Speech-to-Text & Text-to-Speech',
  'Clear Text',
  'Large Text',
  'Large & Clear Subtitles',
  'Color Alternatives',
  'Camera Comfort',
] as const;

export type EsaTag = (typeof ESA_TAGS)[number];
export type TagStatus = 'supported' | 'check' | 'no';

export interface TagEntry {
  tag: EsaTag;
  status: TagStatus;
  /** Why: what guarantees it, what to confirm, or why it is not claimed. */
  note: string;
}

export interface AccessibilityFacts {
  game?: string;
  /** Channels that are switched on. */
  channels: readonly ChannelId[];
  /** One result per proof property, taken over the levels or houses checked. A property fails if it fails anywhere. */
  proof: readonly { id: number; name?: string; pass: boolean }[];
  /** Some event is placed in space (a pan or a direction). */
  spatialEvents?: boolean;
  /** Events carry a direction all the way round (an angle), not just left and right. */
  directionalSound?: boolean;
  /** The game's menus are spoken and written. */
  narratesMenus?: boolean;
  /** The ways a player can press the switch. The web adapter gives all four. */
  input?: { keyboard?: boolean; pointer?: boolean; touch?: boolean; gamepad?: boolean };
  /** The game needs motion controls (a gyroscope, a camera). */
  usesMotionControls?: boolean;
  /** The picture has a camera that moves (a first-person view). */
  cameraMotion?: boolean;
}

export interface AccessibilityReport {
  game: string;
  supported: TagEntry[];
  check: TagEntry[];
  notClaimed: TagEntry[];
  /** One honest paragraph for a store page. */
  statement: string;
  /** A human-readable page, in Markdown. */
  markdown: string;
  proof: { id: number; name?: string; pass: boolean }[];
}

/** Take the worst result for each property across many runs: it passes only if it passed every time. */
export function mergeProof(runs: readonly (readonly { id: number; name: string; pass: boolean }[])[]): { id: number; name: string; pass: boolean }[] {
  const merged = new Map<number, { id: number; name: string; pass: boolean }>();
  for (const run of runs) {
    for (const r of run) {
      const seen = merged.get(r.id);
      merged.set(r.id, { id: r.id, name: r.name, pass: (seen?.pass ?? true) && r.pass });
    }
  }
  return [...merged.values()].sort((a, b) => a.id - b.id);
}

const TIMING_IDS = [1, 2, 3, 4, 5, 6];
const NAVIGATION_IDS = [201, 202, 203, 204, 205, 206];

export function accessibilityReport(facts: AccessibilityFacts): AccessibilityReport {
  const on = (c: ChannelId): boolean => facts.channels.includes(c);
  const byId = new Map(facts.proof.map((p) => [p.id, p]));
  const failing = facts.proof.filter((p) => !p.pass);
  const input = { keyboard: true, pointer: true, touch: true, gamepad: true, ...facts.input };

  const failingAmong = (ids: readonly number[]): { id: number; name?: string } | undefined => failing.find((p) => ids.includes(p.id));
  const timing = TIMING_IDS.some((id) => byId.has(id));
  const navigation = NAVIGATION_IDS.some((id) => byId.has(id));
  const finishableFailure = failingAmong([...TIMING_IDS, ...NAVIGATION_IDS]);
  const finishable = (timing || navigation) && !finishableFailure;
  const finishableWhy = finishable
    ? `${[timing ? 'the timing proof (1 to 6)' : '', navigation ? (byId.has(205) ? 'the house proof, ritual included (201 to 206)' : 'the house proof (201 to 204)') : ''].filter(Boolean).join(' and ')} passes, so it can be finished with one switch`
    : finishableFailure
      ? `proof property ${finishableFailure.id}${finishableFailure.name ? ` (${finishableFailure.name})` : ''} is failing`
      : 'no finishability proof was given';
  const cuesFailure = failingAmong([13]);
  const sensesFailure = failingAmong([8]);

  const entries: TagEntry[] = [];
  const add = (tag: EsaTag, status: TagStatus, note: string): void => void entries.push({ tag, status, note });

  // ---- sound
  add(
    'Multiple Volume Controls',
    on('sound') || on('speech') ? 'check' : 'no',
    on('sound') || on('speech')
      ? 'Separate volumes exist for beeps and effects, for speech and for music. Wind and room tone share the music volume, so confirm that meets the tag\u2019s separate ambient control.'
      : 'There is no sound or speech channel.',
  );
  add('Mono Sound', on('sound') ? 'supported' : 'no', on('sound') ? 'A mono option centres every sound.' : 'The sound channel is off.');
  add(
    'Stereo Sound',
    !on('sound') ? 'no' : !facts.spatialEvents ? 'no' : cuesFailure ? 'no' : 'supported',
    !on('sound')
      ? 'The sound channel is off.'
      : !facts.spatialEvents
        ? 'No important cue depends on where it comes from, so the tag does not apply.'
        : cuesFailure
          ? 'Proof property 13 (cues audible over the music) is failing.'
          : 'Placed sounds are panned left and right, and made quieter and duller with distance.',
  );
  add(
    'Surround Sound',
    !on('sound') ? 'no' : !facts.directionalSound ? 'no' : cuesFailure ? 'no' : 'supported',
    !on('sound')
      ? 'The sound channel is off.'
      : !facts.directionalSound
        ? 'No cue is placed in every direction, so there is nothing a surround mix adds.'
        : cuesFailure
          ? 'Proof property 13 (cues audible over the music) is failing.'
          : 'Cues carry a direction all the way round, ahead and behind included, played with a 3D head-related panner where the browser has one.',
  );
  add(
    'Narrated Menus',
    on('speech') && facts.narratesMenus && !sensesFailure ? 'supported' : 'no',
    !on('speech')
      ? 'The speech channel is off.'
      : !facts.narratesMenus
        ? 'The game\u2019s menus are not spoken.'
        : sensesFailure
          ? 'Proof property 8 (every event reaches two senses) is failing.'
          : 'Menus and options are spoken, and every spoken line is also written to a live text region for screen readers. The voice can be turned off to avoid double speech.',
  );

  // ---- difficulty, saving, remapping
  add('Difficulty Levels', 'no', 'Speed changes the timing only. The tag asks for changes such as enemy health, damage or lives, which this kit does not offer.');
  add('Save Anytime', 'no', 'Not claimed. Progress is saved at the end of a stage, not at any moment.');
  add('Basic Input Remapping', 'no', 'Any key, click, tap or gamepad button is the switch, so there is nothing to remap. The tag asks for a remapping option, so it is not claimed.');
  add('Full Input Remapping', 'no', 'Not claimed, for the same reason as basic remapping.');
  add('Stick Inversion', 'no', 'Does not apply: there are no sticks to invert.');

  // ---- input
  add(
    'Playable without Button Holds',
    finishable ? 'supported' : 'no',
    finishable ? `Key repeat is ignored and no hold is ever needed; ${finishableWhy}.` : `Not claimed: ${finishableWhy}.`,
  );
  add(
    'Playable without Rapid Button Presses',
    finishable ? 'supported' : 'no',
    finishable ? `One press at a time with time between, and nothing to mash; ${finishableWhy}.` : `Not claimed: ${finishableWhy}.`,
  );
  add(
    'Playable with Keyboard Only',
    finishable && input.keyboard ? 'supported' : 'no',
    finishable && input.keyboard ? `Any key is the switch, and the menus are ordinary controls; ${finishableWhy}.` : `Not claimed: ${finishable ? 'keyboard input is off' : finishableWhy}.`,
  );
  add(
    'Playable with Mouse Only',
    finishable && input.pointer ? 'check' : 'no',
    finishable && input.pointer
      ? 'A click anywhere is the switch, but Escape (back to the menu) is a key. Confirm the whole game can be played with the mouse alone.'
      : `Not claimed: ${finishable ? 'pointer input is off' : finishableWhy}.`,
  );
  add('Playable with Buttons Only', 'no', 'A gamepad button works as the switch during play, but the settings menus need a pointer or keyboard, so it is not claimed.');
  add(
    'Playable with Touch Only',
    finishable && input.touch ? 'check' : 'no',
    finishable && input.touch
      ? 'A tap anywhere is the switch, but Escape (back to the menu) is a key. Confirm the whole game can be played by touch alone.'
      : `Not claimed: ${finishable ? 'touch input is off' : finishableWhy}.`,
  );
  add(
    'Playable without Motion Controls',
    facts.usesMotionControls ? 'no' : 'supported',
    facts.usesMotionControls ? 'The game uses motion controls.' : 'The game uses no motion controls.',
  );
  add(
    'Playable without Touch Controls',
    finishable && input.keyboard ? 'supported' : 'no',
    finishable && input.keyboard ? `It can be played with the keyboard, so touch is not needed; ${finishableWhy}.` : `Not claimed: ${finishable ? 'keyboard input is off' : finishableWhy}.`,
  );
  add('Chat Speech-to-Text & Text-to-Speech', 'no', 'Does not apply: there is no chat.');

  // ---- visual
  add(
    'Clear Text',
    'check',
    'The font is Atkinson Hyperlegible with sans-serif fallbacks, and the themes meet 4.5:1 contrast. Confirm the default text height meets the tag (26 px at 1080p).',
  );
  add('Large Text', 'check', 'A text size setting scales the text. Confirm it reaches the size the tag asks for.');
  add(
    'Large & Clear Subtitles',
    on('captions') ? 'check' : 'no',
    on('captions')
      ? 'Every spoken line is also written as a caption, with a size setting. The tag covers spoken dialogue and asks for an adjustable background and no overlap with the game; confirm both.'
      : 'The captions channel is off.',
  );
  add(
    'Color Alternatives',
    'check',
    'Information is carried by words and shapes as well as colour, and there is a colour-blind palette. Confirm no meaning rests on colour alone.',
  );
  add(
    'Camera Comfort',
    facts.cameraMotion ? 'check' : 'supported',
    facts.cameraMotion
      ? 'The view has a moving camera. A reduced-motion setting cuts the glide and the head bob. Confirm it meets the tag.'
      : 'The game has a fixed camera and no camera control.',
  );

  const supported = entries.filter((e) => e.status === 'supported');
  const check = entries.filter((e) => e.status === 'check');
  const notClaimed = entries.filter((e) => e.status === 'no');
  const game = facts.game ?? 'This game';

  const names = (list: TagEntry[]): string => list.map((e) => e.tag).join(', ');
  const statement =
    `${game} supports these ESA Accessible Games Initiative tags: ${supported.length ? names(supported) : 'none yet'}.` +
    (check.length ? ` It provides, but a person must confirm against the tag\u2019s criteria: ${names(check)}.` : '') +
    ' This lists supported features. It is not a claim that the game is accessible to everyone, and it does not replace testing with disabled players.';

  const row = (e: TagEntry): string => `| ${e.tag} | ${e.note.replace(/\|/g, '/')} |`;
  const table = (title: string, intro: string, list: TagEntry[]): string =>
    list.length ? `## ${title}\n\n${intro}\n\n| Tag | Why |\n|---|---|\n${list.map(row).join('\n')}\n` : `## ${title}\n\nNone.\n`;
  const proofLines = facts.proof.map((p) => `- ${p.pass ? 'Pass' : '**FAIL**'}: ${p.id}${p.name ? ` ${p.name}` : ''}`);
  const markdown = [
    `# Accessibility features: ${game}`,
    '',
    statement,
    '',
    table('Supported', 'The kit guarantees these, and the proof properties behind them pass.', supported),
    table('Provided, to confirm', 'The feature exists. The tag has criteria a person must check.', check),
    table('Not claimed', 'Not built, not applicable, or a proof is failing.', notClaimed),
    '## Proof properties behind this list',
    '',
    proofLines.length ? proofLines.join('\n') : 'No proof results were given, so no input tag is claimed.',
    '',
    '*Made from the kit\u2019s guarantees, never by hand. Tags are the 24 of the ESA Accessible Games Initiative (2025).*',
    '',
  ].join('\n');

  return { game, supported, check, notClaimed, statement, markdown, proof: [...facts.proof] };
}

/** What the report needs to know about a kit, so it can be built straight from one. */
export interface ReportKit {
  readonly channels: readonly Channel[];
  readonly events: { list(): string[]; presentation(type: string): { spatial?: boolean } | undefined };
}

/** Facts from a kit: its channels, and whether it places events in space or speaks its menu. Add what only the game knows. */
export function factsFromKit(
  kit: ReportKit,
  proof: AccessibilityFacts['proof'],
  extras: Partial<Omit<AccessibilityFacts, 'channels' | 'proof'>> = {},
): AccessibilityFacts {
  const types = kit.events.list();
  return {
    channels: kit.channels.map((c) => c.id),
    proof,
    spatialEvents: types.some((t) => kit.events.presentation(t)?.spatial === true),
    narratesMenus: types.includes('menu') || types.includes('story-menu'),
    ...extras,
  };
}
