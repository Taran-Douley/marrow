import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  AREAS,
  BriefError,
  PALETTES,
  THEMES,
  advise,
  briefTemplate,
  buildFromPlan,
  generatedModule,
  paletteProof,
  parseBrief,
  parsePlan,
  planMarkdown,
  qualityReport,
  suggestionsFor,
  type Decision,
  type Plan,
} from '../src/advisor';
import { createKit } from '../src/kit';

const HAUNTED_RUNNER = `# Game brief
Name: Grave Dash
Genre: endless runner
Theme: spooky graveyard
Controls: one press
Features:
- obstacles to jump
- a boss at the end
- coins to collect
`;

describe('the brief', () => {
  it('reads the fields, and finds the genre and theme from everyday words', () => {
    const b = parseBrief(HAUNTED_RUNNER);
    expect(b).toMatchObject({ name: 'Grave Dash', genre: 'runner', theme: 'haunted', controls: 'one press', engine: 'browser' });
    expect(b.features).toEqual(['obstacles to jump', 'a boss at the end', 'coins to collect']);
  });

  it('an unknown genre or theme falls back, and says what was written', () => {
    const b = parseBrief('Name: X\nGenre: rhythm-roguelike-sim\nTheme: candy');
    expect(b.genre).toBe('rhythm');
    expect(parseBrief('Name: X\nGenre: farming sim').genre).toBe('other');
    expect(parseBrief('Name: X\nGenre: farming sim').genreAsWritten).toBe('farming sim');
    expect(parseBrief('Name: X\nTheme: candy').themeAsWritten).toBe('candy');
  });

  it('no name: says what to add, with a line to copy', () => {
    expect(() => parseBrief('Genre: runner')).toThrow(BriefError);
    expect(() => parseBrief('Genre: runner')).toThrow('The brief needs a name. Add a line like:  Name: My Game');
  });

  it('the template is a brief that reads', () => {
    expect(parseBrief(briefTemplate('Bat Dash'))).toMatchObject({ name: 'Bat Dash', genre: 'runner', theme: 'haunted' });
  });
});

describe('suggestions that fit the game', () => {
  it('every suggestion has a title, why, who it helps, a guideline and a how, and never names a disability', () => {
    for (const genre of ['runner', 'rhythm', 'maze', 'shooter', 'story', 'racing', 'puzzle', 'platformer', 'quiz', 'card', 'other']) {
      for (const s of suggestionsFor(parseBrief(`Name: X\nGenre: ${genre}\nFeatures:\n- a boss\n- a timer\n- dialogue\n- coins\n- chat`))) {
        for (const text of [s.title, s.why, s.helps, s.guideline, s.how.detail]) expect(text.length, `${genre} ${s.id}`).toBeGreaterThan(5);
        expect(`${s.title} ${s.why} ${s.helps}`.toLowerCase(), s.id).not.toMatch(/\b(blind|deaf|disab|impair|handicap|suffer)/);
        expect(`${s.title} ${s.why}`.toLowerCase(), s.id).not.toMatch(/fully accessible/);
      }
    }
  });

  it('covers every area of a game that has the features for it', () => {
    const areas = new Set(suggestionsFor(parseBrief('Name: X\nGenre: runner\nFeatures:\n- a boss\n- dialogue')).map((s) => s.area));
    expect([...areas].sort()).toEqual(AREAS.map((a) => a.id).sort());
  });

  it('follows the genre: a shooter gets aim help by hand; a maze gets hints and placed sound; a rhythm game gets the coach', () => {
    const ids = (genre: string) => suggestionsFor(parseBrief(`Name: X\nGenre: ${genre}`)).map((s) => s.id);
    expect(ids('shooter')).toContain('aim-help');
    expect(suggestionsFor(parseBrief('Name: X\nGenre: shooter')).find((s) => s.id === 'aim-help')?.how.kind).toBe('by-hand');
    expect(ids('maze')).toEqual(expect.arrayContaining(['hints', 'placed-sound', 'sound-guide']));
    expect(ids('rhythm')).toEqual(expect.arrayContaining(['coach', 'timing-help', 'music-steps-aside']));
    expect(ids('card')).not.toContain('timing-help');
  });

  it('follows the features: a boss is warned with the theme’s danger sound; a timer can be switched off', () => {
    const s = suggestionsFor(parseBrief(HAUNTED_RUNNER));
    expect(s.find((x) => x.id === 'boss-warning')?.title).toBe('Every boss attack warned with a rising moan and a caption, before it lands');
    expect(s.find((x) => x.id === 'pickups')?.title).toMatch(/a music-box ting/);
    expect(suggestionsFor(parseBrief('Name: X\nFeatures:\n- a time limit')).map((x) => x.id)).toContain('timer');
  });

  it('the sounds it suggests fit the theme', () => {
    const cue = (theme: string) => suggestionsFor(parseBrief(`Name: X\nGenre: runner\nTheme: ${theme}`)).find((x) => x.id === 'themed-cues')!.title;
    expect(cue('haunted')).toBe('Countdown cues as a low church bell and a thin glass chime');
    expect(cue('space')).toBe('Countdown cues as a sonar ping and a bright console blip');
    expect(cue('forest')).toMatch(/a bird call/);
    expect(cue('underwater')).toMatch(/a bubble pop/);
  });

  it('outside Marrow’s patterns or engines, it says the work is yours, and that no proof pattern exists yet', () => {
    const s = suggestionsFor(parseBrief('Name: X\nGenre: platformer\nEngine: Unity'));
    expect(s.find((x) => x.id === 'one-switch')?.how.kind).toBe('by-hand');
    expect(s.find((x) => x.id === 'finishable')?.how.detail).toMatch(/Marrow has no proof pattern for platformer games yet/);
  });
});

describe('palettes', () => {
  it('every theme’s palette passes its proof: cues differ in pitch and timbre, and sit above the music', () => {
    for (const t of THEMES) expect(paletteProof(PALETTES[t]).counterexamples ?? [], t).toEqual([]);
  });
  it('a palette that breaks the rules is named in plain words', () => {
    const bad = { ...PALETTES.haunted, sounds: { ...PALETTES.haunted.sounds, cueHigh: { words: 'a second bell', hz: 300, wave: 'triangle' as const } } };
    const r = paletteProof(bad);
    expect(r.counterexamples).toEqual([
      "Palette 'haunted': both cues are triangle waves. Two cues must differ in timbre as well as pitch.",
      "Palette 'haunted': the cues (a low church bell, a second bell) are only 0.3 semitones apart. They need at least 3.",
    ]);
  });
});

describe('the plan', () => {
  const brief = parseBrief(HAUNTED_RUNNER);

  it('round-trips every decision and note (property-based)', () => {
    const base = advise(brief);
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom<Decision>('undecided', 'accepted', 'rejected'), fc.string({ maxLength: 30 }).map((s) => s.replace(/[\r\n]/g, ' ').trim())), { minLength: base.items.length, maxLength: base.items.length }), (marks) => {
        const plan: Plan = { ...base, items: base.items.map((i, n) => ({ ...i, decision: marks[n]![0], note: marks[n]![1] })) };
        const back = parsePlan(planMarkdown(plan), brief);
        expect(back.items.map((i) => [i.id, i.decision, i.note])).toEqual(plan.items.map((i) => [i.id, i.decision, i.note]));
      }),
      { numRuns: 100 },
    );
  });

  it('when the game changes, decisions are kept, new ideas are marked new, and agreed ones that no longer fit are kept and marked', () => {
    const first = advise(brief);
    first.items.find((i) => i.id === 'boss-warning')!.decision = 'accepted';
    first.items.find((i) => i.id === 'mono')!.decision = 'rejected';
    first.items.find((i) => i.id === 'mono')!.note = 'Stereo matters to our puzzle.';
    // The boss is cut, and dialogue is added.
    const changed = parseBrief(HAUNTED_RUNNER.replace('- a boss at the end', '- dialogue with a ghost'));
    const next = advise(changed, first);
    expect(next.items.find((i) => i.id === 'mono')).toMatchObject({ decision: 'rejected', note: 'Stereo matters to our puzzle.', isNew: false });
    expect(next.items.find((i) => i.id === 'speaker-names')).toMatchObject({ decision: 'undecided', isNew: true });
    expect(next.items.find((i) => i.id === 'boss-warning')).toMatchObject({ decision: 'accepted', noLongerFits: true });
    const md = planMarkdown(next);
    expect(md).toMatch(/`speaker-names` .* \*\*new\*\*/);
    expect(md).toMatch(/`boss-warning` .* \*\*no longer fits the brief\*\*/);
    expect(md).toMatch(/does not replace testing with disabled players/);
    expect(md).not.toMatch(/makes? (the|your) game fully accessible/i);
  });
});

describe('building the plan', () => {
  const brief = parseBrief(HAUNTED_RUNNER);
  const plan = advise(brief);
  for (const i of plan.items) i.decision = 'accepted';
  plan.items.find((i) => i.id === 'timing-help')!.note = 'on by default please';

  it('builds the palette, the coach and the defaults, and lists hand work as to-dos', () => {
    const built = buildFromPlan(plan, brief);
    expect(built.kit.voices?.map((v) => v.hz)).toEqual([294, 587]);
    expect(built.kit.coach).toBe(true);
    expect(built.kit.audio?.recipes?.fall?.hz).toBe(120);
    expect(built.todo.map((t) => t.id)).toEqual(plan.items.filter((i) => i.how.kind === 'by-hand').map((i) => i.id));
    expect(built.todo.map((t) => t.id)).toContain('boss-warning');
    expect(built.done.join(' ')).toMatch(/Timing help starts on for new players/);
    expect(generatedModule(built, plan)).toMatch(/export const ACCESSIBILITY: \{ kit: KitConfig; profile: ProfilePatch; assistByDefault: boolean \} = \{/);
  });

  it('a game built from the plan passes every proof it passed before, and every event still reaches two senses', () => {
    const built = buildFromPlan(plan, brief);
    const before = createKit();
    const after = createKit(built.kit);
    for (const kit of [before, after]) kit.defineObstacle('grave', { width: [0.16, 0.3] });
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(before.prove(before.generate(seed)).every((r) => r.pass)).toBe(true);
      expect(after.prove(after.generate(seed)).filter((r) => !r.pass).map((r) => r.counterexample)).toEqual([]);
    }
    expect(after.proveEvents().counterexamples ?? []).toEqual([]);
    expect(after.registry.get('grave')!.sound).toEqual({ hz: 294, wave: 'triangle' }); // the church bell
  });

  it('a rejected item is not built', () => {
    const p = advise(brief);
    for (const i of p.items) i.decision = i.id === 'coach' ? 'rejected' : 'accepted';
    expect(buildFromPlan(p, brief).kit.coach).toBeUndefined();
  });
});

describe('the quality report', () => {
  it('gives a verdict per speed, the most helpful change, and says bots do not judge fun', () => {
    const kit = createKit();
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    const r = qualityReport(kit, [1, 2, 3, 4, 5].map((s) => kit.generate(s)), 'Grave Dash');
    expect(r.proved).toBe(5);
    expect(r.bySpeed.slow.verdict).toBe('good');
    expect(['hard', 'too hard']).toContain(r.bySpeed.fast.verdict);
    expect(r.advice.join(' ')).toMatch(/Fast (is|are) hard for a player with 250 ms of timing error: offer timing help and the coach/);
    expect(r.markdown).toMatch(/not whether it is fun/);
  });
});

describe('ESA tags', () => {
  const all = suggestionsFor(parseBrief('Name: X\nGenre: shooter\nFeatures:\n- a boss\n- a timer\n- dialogue\n- coins\n- chat\n- checkpoints\n- a story'))
    .concat(suggestionsFor(parseBrief('Name: Y\nGenre: rhythm\nFeatures:\n- lessons\n- music')))
    .concat(suggestionsFor(parseBrief('Name: Z\nGenre: racing')));

  it('every suggestion lists its ESA tags, and every tag is one of the 24', async () => {
    const { ESA_TAGS } = await import('../src/report');
    for (const s of all) {
      expect(Array.isArray(s.esa), s.id).toBe(true);
      for (const t of s.esa) expect(ESA_TAGS as readonly string[], `${s.id}: ${t}`).toContain(t);
    }
  });

  it('tags the ones that match, and says plainly when no tag covers an idea', () => {
    const tags = (id: string) => all.find((s) => s.id === id)!.esa;
    expect(tags('no-holds')).toEqual(['Playable without Button Holds', 'Playable without Rapid Button Presses']);
    expect(tags('mono')).toEqual(['Mono Sound']);
    expect(tags('multiplayer-chat')).toEqual(['Chat Speech-to-Text & Text-to-Speech']);
    expect(tags('coach')).toEqual([]);
    const md = planMarkdown(advise(parseBrief('Name: Y\nGenre: rhythm')));
    expect(md).toMatch(/`mono` [\s\S]*?- ESA tag: Mono Sound\./);
    expect(md).toMatch(/`coach` [\s\S]*?- ESA tag: none \(no ESA tag covers this yet\)\./);
  });
});
