import {
  accessibilityReport,
  cuesAudible,
  factsFromKit,
  generateMaze,
  idealPress,
  mergeProof,
  isSolid,
  personaReport,
  proveMaze,
  reviewLevel,
  reviewLevels,
  takeoffWindow,
  windowMs,
  type Level,
  type PersonaSpec,
  type ProofResult,
  type ReviewerSpec,
  type Speed,
} from '@marrow/skeleton';
import { BriefError, PALETTES, THEMES, advise, paletteProof, parseBrief, parsePlan, planMarkdown, qualityReport, type Theme } from '@marrow/skeleton/advisor';
import { ArgumentError, buildKit, numberArg, type GameConfig } from './game';

// The tools. Each takes plain JSON and returns plain words first, then the data. Nothing here
// reads or writes a file, plays a sound or opens a window, so it is safe to run unattended.

export interface ToolResult {
  text: string;
  data: Record<string, unknown>;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(args: Record<string, unknown>): ToolResult;
}

const SPEEDS: readonly Speed[] = ['slow', 'medium', 'fast'];
const MAX_LEVELS = 1000;

const gameSchema = {
  type: 'object',
  description:
    'The game to build levels for. Leave out for the default graveyard (grave and fence). obstacles: [{name, width: [min, max]}] in running seconds. lesson: {rule: multiples|even|odd|square|prime, tables?: [..], values: [lo, hi]} adds numbers on the obstacles. timing may change airtime, beat, halfWidth, gap, firstStart, obstaclesPerLevel, landingMargin.',
  properties: {
    obstacles: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, width: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } }, required: ['name', 'width'] } },
    lesson: { type: 'object' },
    timing: { type: 'object' },
    floorsMs: { type: 'object' },
  },
} as const;

const asGame = (args: Record<string, unknown>): GameConfig => {
  const game = args.game;
  if (game === undefined) return {};
  if (typeof game !== 'object' || game === null || Array.isArray(game)) throw new ArgumentError("'game' must be an object.");
  return game as GameConfig;
};

const seedOf = (value: unknown, name = 'seed'): number => numberArg(value, name, { integer: true, min: 0, max: 0xffffffff });

function levelFromArgs(args: Record<string, unknown>, kit: ReturnType<typeof buildKit>): Level {
  if (args.level !== undefined) {
    const raw = args.level as { seed?: unknown; obstacles?: unknown };
    if (typeof raw !== 'object' || raw === null || !Array.isArray(raw.obstacles)) throw new ArgumentError("'level' needs an 'obstacles' array.");
    if (raw.obstacles.length === 0 || raw.obstacles.length > 100) throw new ArgumentError("'level.obstacles' needs from 1 to 100 obstacles.");
    return {
      seed: raw.seed === undefined ? 0 : seedOf(raw.seed, 'level.seed'),
      obstacles: raw.obstacles.map((o: Record<string, unknown>, index: number) => {
        if (typeof o !== 'object' || o === null || typeof o.kind !== 'string') throw new ArgumentError(`Obstacle ${index + 1} needs a 'kind'.`);
        return {
          index,
          kind: o.kind,
          start: numberArg(o.start, `obstacles[${index}].start`, { min: 0 }),
          width: numberArg(o.width, `obstacles[${index}].width`, { min: 0.001 }),
          ...(o.value !== undefined ? { value: numberArg(o.value, `obstacles[${index}].value`) } : {}),
          ...(o.solid === false ? { solid: false } : {}),
        };
      }),
    };
  }
  const count = args.count === undefined ? undefined : numberArg(args.count, 'count', { integer: true, min: 1, max: 100 });
  return kit.generate(seedOf(args.seed), count ? { count } : {});
}

const describeResults = (results: ProofResult[], label: string): string => {
  const failing = results.filter((r) => !r.pass);
  if (failing.length === 0) return `${label} passes all ${results.length} properties. It can be finished with one switch.`;
  const first = failing[0]!;
  return `${label} FAILS ${failing.length} of ${results.length} properties. ${first.counterexample ?? first.name} It must not be served.`;
};

const resultRows = (results: ProofResult[]) =>
  results.map((r) => ({ id: r.id, name: r.name, pass: r.pass, failures: r.failures, ...(r.counterexamples ? { counterexamples: r.counterexamples.slice(0, 5) } : {}) }));

const generateLevelTool: Tool = {
  name: 'generate_level',
  description:
    'Generate one level from a seed: the same seed always gives the same level. Returns each obstacle with its start, width, take-off window and ideal press, and the window in milliseconds at each speed.',
  inputSchema: {
    type: 'object',
    properties: { seed: { type: 'integer', minimum: 0 }, count: { type: 'integer', minimum: 1, maximum: 100 }, game: gameSchema },
    required: ['seed'],
  },
  run(args) {
    const kit = buildKit(asGame(args));
    const level = kit.generate(seedOf(args.seed), args.count === undefined ? {} : { count: numberArg(args.count, 'count', { integer: true, min: 1, max: 100 }) });
    const obstacles = level.obstacles.map((o) => {
      const w = takeoffWindow(o, kit.timing);
      return {
        index: o.index + 1,
        kind: o.kind,
        start: round(o.start),
        width: round(o.width),
        ...(o.value !== undefined ? { value: o.value } : {}),
        jump: isSolid(o),
        ...(isSolid(o)
          ? {
              takeoffFrom: round(w.a),
              takeoffTo: round(w.b),
              idealPress: round(idealPress(o, kit.timing)),
              windowMs: Object.fromEntries(SPEEDS.map((s) => [s, Math.round(windowMs(o, s, kit.timing))])),
            }
          : {}),
      };
    });
    const jumps = obstacles.filter((o) => o.jump).length;
    return {
      text: `Level ${level.seed}: ${level.obstacles.length} obstacles, ${jumps} to jump. Times are running seconds; real time is running time divided by the speed rate.`,
      data: { seed: level.seed, obstacles },
    };
  },
};

const proveLevelTool: Tool = {
  name: 'prove_level',
  description:
    'Run the proof on one level (by seed, or a hand-made level). Checks it can be finished with one switch, the cues are unambiguous, every object has sound, speech and caption, and the take-off windows are wide enough. A failure comes back as a plain-English counterexample. A level that fails must not be served.',
  inputSchema: {
    type: 'object',
    properties: {
      seed: { type: 'integer', minimum: 0 },
      level: { type: 'object', description: 'A hand-made level: {seed?, obstacles: [{kind, start, width, value?, solid?}]}. Use instead of seed.' },
      game: gameSchema,
    },
  },
  run(args) {
    const kit = buildKit(asGame(args));
    const level = levelFromArgs(args, kit);
    const label = args.level !== undefined ? 'This level' : `Level ${level.seed}`;
    const results = kit.prove(level, label);
    const passed = results.every((r) => r.pass);
    return { text: describeResults(results, label), data: { passed, results: resultRows(results) } };
  },
};

const proveManyTool: Tool = {
  name: 'prove_many',
  description:
    'Run the proof on a run of seeds, for example 200 levels, and report how many pass, which properties fail where, and the narrowest take-off window at each speed. This is the "finishable with one switch" number for a game.',
  inputSchema: {
    type: 'object',
    properties: { from: { type: 'integer', minimum: 0 }, count: { type: 'integer', minimum: 1, maximum: MAX_LEVELS }, game: gameSchema },
    required: ['count'],
  },
  run(args) {
    const kit = buildKit(asGame(args));
    const from = args.from === undefined ? 1 : seedOf(args.from, 'from');
    const count = numberArg(args.count, 'count', { integer: true, min: 1, max: MAX_LEVELS });
    const failing: { seed: number; counterexample: string }[] = [];
    const perProperty = new Map<number, { name: string; failed: number }>();
    const narrowest: Record<Speed, number> = { slow: Infinity, medium: Infinity, fast: Infinity };
    for (let i = 0; i < count; i++) {
      const seed = from + i;
      const level = kit.generate(seed);
      const results = kit.prove(level, `Level ${seed}`);
      for (const r of results) {
        const entry = perProperty.get(r.id) ?? { name: r.name, failed: 0 };
        if (!r.pass) entry.failed += 1;
        perProperty.set(r.id, entry);
      }
      const bad = results.find((r) => !r.pass);
      if (bad) failing.push({ seed, counterexample: bad.counterexample ?? bad.name });
      for (const o of level.obstacles.filter(isSolid)) {
        for (const s of SPEEDS) narrowest[s] = Math.min(narrowest[s], windowMs(o, s, kit.timing));
      }
    }
    const passing = count - failing.length;
    const windows = Object.fromEntries(SPEEDS.map((s) => [s, Number.isFinite(narrowest[s]) ? Math.round(narrowest[s]) : null]));
    return {
      text:
        `${passing} of ${count} levels (seeds ${from} to ${from + count - 1}) pass every property.` +
        (failing.length > 0 ? ` First failure: ${failing[0]!.counterexample}` : '') +
        ` Narrowest take-off window: ${windows.slow} ms at Slow, ${windows.medium} ms at Medium, ${windows.fast} ms at Fast.`,
      data: {
        levels: count,
        passing,
        failing: failing.slice(0, 20),
        properties: [...perProperty.entries()].map(([id, p]) => ({ id, name: p.name, failedLevels: p.failed })),
        narrowestWindowMs: windows,
      },
    };
  },
};

const DEFAULT_PERSONAS: PersonaSpec[] = [
  { kind: 'perfect' },
  { kind: 'noisy', sigmaMs: 100 },
  { kind: 'noisy', sigmaMs: 150 },
  { kind: 'noisy', sigmaMs: 250 },
  { kind: 'audio-only' },
];

function personasFrom(value: unknown): PersonaSpec[] {
  if (value === undefined) return DEFAULT_PERSONAS;
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) throw new ArgumentError("'personas' needs from 1 to 10 entries.");
  return value.map((p: Record<string, unknown>, i) => {
    if (p?.kind === 'perfect') return { kind: 'perfect' } as const;
    if (p?.kind === 'noisy') return { kind: 'noisy', sigmaMs: numberArg(p.sigmaMs, `personas[${i}].sigmaMs`, { min: 0, max: 2000 }) } as const;
    if (p?.kind === 'audio-only') return p.sigmaMs === undefined ? ({ kind: 'audio-only' } as const) : ({ kind: 'audio-only', sigmaMs: numberArg(p.sigmaMs, `personas[${i}].sigmaMs`, { min: 0, max: 2000 }) } as const);
    throw new ArgumentError(`personas[${i}].kind must be 'perfect', 'noisy' or 'audio-only'.`);
  });
}

const simulatePersonaTool: Tool = {
  name: 'simulate_persona',
  description:
    'Playtest levels with simulated players, headless: a perfect one-switch player, players with timing error (100, 150, 250 ms by default) and an audio-only player who hears only the beeps. Returns the chance of clearing a jump on the first try, and of finishing a level without a fall, at each speed. Estimates only: it does not replace testing with disabled players.',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'integer', minimum: 0 },
      count: { type: 'integer', minimum: 1, maximum: 200 },
      speeds: { type: 'array', items: { enum: ['slow', 'medium', 'fast'] } },
      personas: { type: 'array', items: { type: 'object', properties: { kind: { enum: ['perfect', 'noisy', 'audio-only'] }, sigmaMs: { type: 'number' } }, required: ['kind'] } },
      game: gameSchema,
    },
  },
  run(args) {
    const kit = buildKit(asGame(args));
    const from = args.from === undefined ? 1 : seedOf(args.from, 'from');
    const count = args.count === undefined ? 50 : numberArg(args.count, 'count', { integer: true, min: 1, max: 200 });
    const speeds = args.speeds === undefined ? SPEEDS : (args.speeds as unknown[]).map((s) => {
      if (s !== 'slow' && s !== 'medium' && s !== 'fast') throw new ArgumentError("'speeds' may only hold 'slow', 'medium' and 'fast'.");
      return s;
    });
    const levels = Array.from({ length: count }, (_, i) => kit.generate(from + i));
    const rows = personaReport(levels, personasFrom(args.personas), speeds, kit.timing).map((r) => ({
      persona: r.persona,
      speed: r.speed,
      clearRate: pct(r.meanClearRate),
      cleanLevelRate: pct(r.cleanLevelRate),
      hardest: r.hardest,
    }));
    const lines = rows.map((r) => `${r.persona} at ${r.speed}: ${r.clearRate}% of jumps cleared first try, ${r.cleanLevelRate}% of levels with no fall.`);
    return { text: `${count} levels, estimated:\n${lines.join('\n')}`, data: { levels: count, from, rows } };
  },
};

const proveHouseTool: Tool = {
  name: 'prove_house',
  description:
    'Prove a haunted house (the navigation pattern) can be escaped with one switch: the exit is reachable, the shortest route is never caught with spare steps, the phantom starts far enough away, and every passage works both ways. With relics, also that fetching them the best way and running the chase is never caught, and that relics and hiding places sit in reachable rooms.',
  inputSchema: {
    type: 'object',
    properties: {
      seed: { type: 'integer', minimum: 0 },
      width: { type: 'integer', minimum: 4, maximum: 30 },
      height: { type: 'integer', minimum: 4, maximum: 30 },
      ghostEvery: { type: 'integer', minimum: 1 },
      margin: { type: 'integer', minimum: 0 },
      minGhostStart: { type: 'integer', minimum: 0 },
      relics: { type: 'integer', minimum: 0, maximum: 5, description: 'Relics to find before the exit opens (adds the ritual proof, 205 and 206).' },
    },
    required: ['seed'],
  },
  run(args) {
    const opt = (name: string, min: number, max: number): number | undefined =>
      args[name] === undefined ? undefined : numberArg(args[name], name, { integer: true, min, max });
    const seed = seedOf(args.seed);
    const options = Object.fromEntries(
      Object.entries({
        width: opt('width', 4, 30),
        height: opt('height', 4, 30),
        ghostEvery: opt('ghostEvery', 1, 10),
        margin: opt('margin', 0, 20),
        minGhostStart: opt('minGhostStart', 0, 60),
        relics: opt('relics', 0, 5),
      }).filter(([, v]) => v !== undefined),
    );
    let results: ProofResult[];
    try {
      results = proveMaze(generateMaze(seed, options), `House ${seed}`);
    } catch (error) {
      throw new ArgumentError(error instanceof Error ? error.message : String(error));
    }
    const passed = results.every((r) => r.pass);
    return { text: describeResults(results, `House ${seed}`), data: { passed, results: resultRows(results) } };
  },
};


const reviewersFrom = (value: unknown): ReviewerSpec[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) throw new ArgumentError("'personas' needs from 1 to 10 entries.");
  return value.map((p: Record<string, unknown>, i) => (p?.kind === 'deaf' ? ({ kind: 'deaf' } as const) : personasFrom([p])[0]!));
};

const reviewLevelTool: Tool = {
  name: 'review_level',
  description:
    'The persona reviewer loop. Simulated players with specific needs (perfect one-switch, timing error, audio-only, deaf) play a level and report every place a real player like them would fail or could not perceive a cue. Each finding names the player, level, object and cause in plain English. A repair is offered only to that player\u2019s own settings (a slower speed); the level itself is never made easier. Give a seed, or a count of levels.',
  inputSchema: {
    type: 'object',
    properties: {
      seed: { type: 'integer', minimum: 0 },
      count: { type: 'integer', minimum: 1, maximum: 200, description: 'Review this many levels starting at seed (default 1).' },
      speed: { enum: ['slow', 'medium', 'fast'] },
      personas: { type: 'array', items: { type: 'object', properties: { kind: { enum: ['perfect', 'noisy', 'audio-only', 'deaf'] }, sigmaMs: { type: 'number' } }, required: ['kind'] } },
      minClearRate: { type: 'number', minimum: 0, maximum: 1 },
      game: gameSchema,
    },
  },
  run(args) {
    const kit = buildKit(asGame(args));
    const seed = args.seed === undefined ? 1 : seedOf(args.seed);
    const count = args.count === undefined ? 1 : numberArg(args.count, 'count', { integer: true, min: 1, max: 200 });
    const speed = args.speed === undefined ? 'slow' : args.speed;
    if (speed !== 'slow' && speed !== 'medium' && speed !== 'fast') throw new ArgumentError("'speed' must be 'slow', 'medium' or 'fast'.");
    const personas = reviewersFrom(args.personas);
    const options = {
      speed: speed as Speed,
      ...(personas ? { personas } : {}),
      ...(args.minClearRate === undefined ? {} : { minClearRate: numberArg(args.minClearRate, 'minClearRate', { min: 0, max: 1 }) }),
    };
    if (count === 1) {
      const review = reviewLevel(kit, kit.generate(seed), options);
      return { text: review.summary, data: { passed: review.passed, speed: review.speed, findings: review.findings } };
    }
    const levels = Array.from({ length: count }, (_, i) => kit.generate(seed + i));
    const result = reviewLevels(kit, levels, options);
    return { text: result.summary, data: { reviewed: result.reviewed, clean: result.clean, findings: result.findings.slice(0, 30), totalFindings: result.findings.length } };
  },
};

const a11yReportTool: Tool = {
  name: 'a11y_report',
  description:
    'The accessibility feature list, made from what the game actually guarantees: which channels are on and which proof properties pass. Maps to the 24 ESA Accessible Games Initiative tags as supported, provided-but-to-confirm, or not claimed (with the reason). Never claims a tag whose proof is failing or whose channel is off, and never says a game is fully accessible. Returns Markdown and JSON.',
  inputSchema: {
    type: 'object',
    properties: {
      levels: { type: 'integer', minimum: 1, maximum: 300, description: 'How many levels to prove (default 50).' },
      navigation: { type: 'boolean', description: 'Also prove haunted houses (the navigation pattern).' },
      directionalSound: { type: 'boolean', description: 'Cues are placed all the way round (an angle), not just left and right.' },
      spatialEvents: { type: 'boolean' },
      narratesMenus: { type: 'boolean', description: 'The menus are spoken and written. Default true.' },
      cameraMotion: { type: 'boolean' },
      name: { type: 'string' },
      game: gameSchema,
    },
  },
  run(args) {
    const kit = buildKit(asGame(args));
    const count = args.levels === undefined ? 50 : numberArg(args.levels, 'levels', { integer: true, min: 1, max: 300 });
    const levels = Array.from({ length: count }, (_, i) => kit.generate(i + 1));
    const runs = levels.map((l) => kit.prove(l));
    const proof: { id: number; name: string; pass: boolean }[] = mergeProof(runs);
    proof.push({ id: 13, name: 'Cues audible over ambience', pass: levels.every((l) => cuesAudible(kit.renderLevel(l)).pass) });
    proof.push({ id: kit.proveEvents().id, name: kit.proveEvents().name, pass: kit.proveEvents().pass });
    if (args.navigation === true) {
      const houses = Array.from({ length: 20 }, (_, i) => proveMaze(generateMaze(i + 1), `House ${i + 1}`));
      proof.push(...mergeProof(houses));
    }
    const flag = (name: string): boolean | undefined => (args[name] === undefined ? undefined : args[name] === true);
    const facts = factsFromKit(kit, proof.sort((a, b) => a.id - b.id), {
      ...(typeof args.name === 'string' ? { game: args.name } : {}),
      ...(flag('directionalSound') !== undefined ? { directionalSound: flag('directionalSound')! } : {}),
      ...(flag('spatialEvents') !== undefined ? { spatialEvents: flag('spatialEvents')! } : {}),
      narratesMenus: args.narratesMenus === undefined ? true : args.narratesMenus === true,
      ...(flag('cameraMotion') !== undefined ? { cameraMotion: flag('cameraMotion')! } : {}),
    });
    const report = accessibilityReport(facts);
    const failing = report.proof.filter((p) => !p.pass);
    return {
      text: `${report.statement}${failing.length ? ` Failing proof properties: ${failing.map((p) => p.id).join(', ')}.` : ''}`,
      data: {
        supported: report.supported,
        toConfirm: report.check,
        notClaimed: report.notClaimed,
        proof: report.proof,
        statement: report.statement,
        markdown: report.markdown,
      },
    };
  },
};
const round = (n: number): number => Math.round(n * 1000) / 1000;
const pct = (n: number): number => Math.round(n * 1000) / 10;

// ---- the advisor: for any game, in any engine --------------------------------------------------

const textArg = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.trim() === '') throw new ArgumentError(`'${name}' must be text.`);
  if (value.length > 50_000) throw new ArgumentError(`'${name}' is too long (50,000 characters at most).`);
  return value;
};

const adviseGameTool: Tool = {
  name: 'advise_game',
  description:
    'Suggest accessibility features for a game, in any engine, that fit its genre, theme and features. Give the brief (plain lines: Name, Genre, Theme, Controls, Engine, Players, and a Features list). Give the current plan (Markdown) too, and every decision and note in it is kept: new suggestions are marked new, and accepted ones that no longer fit are kept and marked. Returns the plan as Markdown, and what Marrow builds versus what the game must do by hand.',
  inputSchema: {
    type: 'object',
    properties: { brief: { type: 'string' }, plan: { type: 'string', description: 'The current accessibility-plan.md, to keep its decisions.' } },
    required: ['brief'],
  },
  run(args) {
    let brief;
    try {
      brief = parseBrief(textArg(args.brief, 'brief'));
    } catch (error) {
      if (error instanceof BriefError) throw new ArgumentError(error.message);
      throw error;
    }
    const previous = args.plan === undefined ? undefined : parsePlan(textArg(args.plan, 'plan'), brief);
    const plan = advise(brief, previous);
    const kinds = { 'built-in': 0, 'from-plan': 0, 'by-hand': 0 };
    for (const i of plan.items) kinds[i.how.kind] += 1;
    const text =
      `${brief.name} (${brief.genre}, ${brief.theme}): ${plan.items.length} suggestions. ` +
      `${kinds['built-in']} are built into Marrow, ${kinds['from-plan']} Marrow builds from the plan, ${kinds['by-hand']} are for the game's own code.` +
      (plan.items.some((i) => i.isNew) ? ` New: ${plan.items.filter((i) => i.isNew).map((i) => i.id).join(', ')}.` : '') +
      (plan.items.some((i) => i.noLongerFits) ? ` No longer fit (kept): ${plan.items.filter((i) => i.noLongerFits).map((i) => i.id).join(', ')}.` : '');
    return { text, data: { markdown: planMarkdown(plan), items: plan.items.map((i) => ({ id: i.id, area: i.area, title: i.title, esa: i.esa, how: i.how.kind, decision: i.decision, isNew: i.isNew, noLongerFits: i.noLongerFits })) } };
  },
};

const soundPaletteTool: Tool = {
  name: 'sound_palette',
  description: `The sounds that fit a theme (${THEMES.join(', ')}): two countdown cues, steps, a reward, danger, a menu tick, a fall and an ambience, each with words and a synthesis recipe. Every palette passes a proof: the cues differ in pitch and timbre and stay above the music.`,
  inputSchema: { type: 'object', properties: { theme: { enum: [...THEMES] } }, required: ['theme'] },
  run(args) {
    const theme = args.theme as Theme;
    if (!THEMES.includes(theme)) throw new ArgumentError(`'theme' must be one of: ${THEMES.join(', ')}.`);
    const p = PALETTES[theme];
    const proof = paletteProof(p);
    return {
      text: `${theme}: ${p.mood}\n${Object.entries(p.sounds).map(([role, s]) => `${role}: ${s.words}`).join('\n')}\nPalette proof: ${proof.pass ? 'passed' : proof.counterexample}`,
      data: { palette: p, proof },
    };
  },
};

const qualityReportTool: Tool = {
  name: 'quality_report',
  description:
    'How a game plays, from proofs and simulated players: levels proved; jumps cleared first time with 150 and 250 ms of timing error and by sound only; levels finished clean; a verdict per speed; the longest wait; whether speech can be followed; and the change that would help most. It shows whether a game can be finished and how it plays, not whether it is fun.',
  inputSchema: { type: 'object', properties: { from: { type: 'integer', minimum: 0 }, count: { type: 'integer', minimum: 1, maximum: 100 }, game: gameSchema } },
  run(args) {
    const kit = buildKit(asGame(args));
    const from = args.from === undefined ? 1 : seedOf(args.from, 'from');
    const count = args.count === undefined ? 20 : numberArg(args.count, 'count', { integer: true, min: 1, max: 100 });
    const r = qualityReport(kit, Array.from({ length: count }, (_, i) => kit.generate(from + i)));
    return {
      text: `${r.proved} of ${r.levels} levels proved. Slow ${r.bySpeed.slow.verdict}, Medium ${r.bySpeed.medium.verdict}, Fast ${r.bySpeed.fast.verdict}.\n${r.advice.join('\n')}`,
      data: { markdown: r.markdown, bySpeed: r.bySpeed, longestQuietSeconds: r.longestQuietSeconds, speechFollowable: r.speechFollowable },
    };
  },
};

export const TOOLS: readonly Tool[] = [
  generateLevelTool,
  proveLevelTool,
  proveManyTool,
  simulatePersonaTool,
  reviewLevelTool,
  a11yReportTool,
  proveHouseTool,
  adviseGameTool,
  soundPaletteTool,
  qualityReportTool,
];
