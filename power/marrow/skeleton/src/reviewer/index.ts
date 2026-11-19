import type { Level, Timing } from '../level';
import { SPEEDS, type OutputCommand, type Profile, type SemanticEvent, type Speed } from '../types';
import { EVENT_TYPES } from '../channels/events';
import { obstacleChances, personaName, type PersonaSpec } from '../personas';

// The persona reviewer loop (Requirement 19). Simulated players with specific needs play a level
// and say where a real player like them would fail, or could not perceive something. Each finding
// names the player, the level, the object and the cause, in plain English, so it reads as a proof
// failure. A repair is offered only to the player's own settings (such as a slower speed). The level
// itself is never made easier: a repair that does that would change the game for everyone.

export type ReviewerSpec =
  | PersonaSpec
  /** Cannot hear. Needs every cue to reach sight: a caption or a marker. */
  | { kind: 'deaf' };

export interface ReviewKit {
  readonly timing: Timing;
  levelEvents(level: Level): SemanticEvent[];
  render(event: SemanticEvent, profile?: Profile): OutputCommand[];
  newProfile(): Profile;
}

export type Repair =
  | { change: 'speed'; to: Speed; effect: string }
  | { change: 'none'; note: string };

export interface Finding {
  persona: string;
  level: number;
  /** 1-based obstacle number, or null when it is about the game as a whole. */
  obstacle: number | null;
  object: string | null;
  severity: 'blocks' | 'hard';
  cause: string;
  repair?: Repair;
}

export interface Review {
  level: number;
  speed: Speed;
  passed: boolean;
  findings: Finding[];
  summary: string;
}

export interface ReviewOptions {
  /** The speed the player is set to. Default: the kit's starting speed. */
  speed?: Speed;
  personas?: readonly ReviewerSpec[];
  /** Below this chance of clearing a jump first time, a timing persona reports it. Default 0.75. */
  minClearRate?: number;
}

export const DEFAULT_REVIEWERS: readonly ReviewerSpec[] = [
  { kind: 'perfect' },
  { kind: 'noisy', sigmaMs: 150 },
  { kind: 'audio-only' },
  { kind: 'deaf' },
];

const ORDINAL = ['first', 'second', 'third'] as const;
const pct = (n: number): number => Math.round(n * 100);

function reviewerName(spec: ReviewerSpec): string {
  return spec.kind === 'deaf' ? 'deaf player (sight only)' : personaName(spec);
}

const SPEED_ORDER: readonly Speed[] = [...SPEEDS]; // slow, medium, fast

/** The nearest slower speed at which this player clears a jump often enough, if there is one. */
function slowerSpeedThatWorks(chanceAt: (speed: Speed) => number, from: Speed, min: number): { to: Speed; chance: number } | null {
  for (let i = SPEED_ORDER.indexOf(from) - 1; i >= 0; i--) {
    const speed = SPEED_ORDER[i]!;
    const chance = chanceAt(speed);
    if (chance >= min) return { to: speed, chance };
  }
  return null;
}

/** Does every beep and every fall reason reach this sense? */
function perceptionFindings(kit: ReviewKit, level: Level, spec: ReviewerSpec, sense: 'hearing' | 'sight'): Finding[] {
  const persona = reviewerName(spec);
  // A blind player has the picture off; a deaf player has the sound on but cannot use it.
  const profile: Profile = { ...kit.newProfile(), picture: sense === 'sight' };
  const findings: Finding[] = [];
  let obstacle = 0;
  for (const event of kit.levelEvents(level)) {
    if (event.type !== EVENT_TYPES.beat) continue;
    const beat = event.data?.beat;
    if (typeof beat !== 'number' || beat > 3) continue;
    if (beat === 1) obstacle += 1;
    const reaches = kit.render(event, profile).some((c) => (c.senses as readonly string[]).includes(sense));
    if (!reaches) {
      const o = level.obstacles[obstacle - 1];
      findings.push({
        persona,
        level: level.seed,
        obstacle,
        object: o?.kind ?? null,
        severity: 'blocks',
        cause: `${persona}, level ${level.seed}, obstacle ${obstacle} (${o?.kind ?? 'object'}): the ${ORDINAL[beat - 1]} beep reaches nothing they can ${sense === 'hearing' ? 'hear' : 'see'}. Give it ${sense === 'hearing' ? 'a sound or a spoken line' : 'a caption or a marker'}.`,
        repair: { change: 'none', note: 'This is a gap in the game, not in the player\u2019s settings, so no setting fixes it.' },
      });
    }
  }
  for (const reason of ['early', 'late'] as const) {
    const event: SemanticEvent = { type: EVENT_TYPES.fallReason, at: 0, data: { reason } };
    if (!kit.render(event, profile).some((c) => (c.senses as readonly string[]).includes(sense))) {
      findings.push({
        persona,
        level: level.seed,
        obstacle: null,
        object: null,
        severity: 'blocks',
        cause: `${persona}: when they fall because they pressed ${reason}, nothing tells them by ${sense === 'hearing' ? 'sound' : 'sight'}.`,
        repair: { change: 'none', note: 'Give the fall reason a spoken line or a caption.' },
      });
    }
  }
  return findings;
}

function timingFindings(kit: ReviewKit, level: Level, spec: PersonaSpec, speed: Speed, min: number): Finding[] {
  const persona = reviewerName(spec);
  const here = obstacleChances(level, spec, speed, kit.timing);
  const out: Finding[] = [];
  for (const c of here) {
    if (c.chance >= min) continue;
    const fix = slowerSpeedThatWorks(
      (s) => obstacleChances(level, spec, s, kit.timing).find((x) => x.index === c.index)?.chance ?? 0,
      speed,
      min,
    );
    out.push({
      persona,
      level: level.seed,
      obstacle: c.index + 1,
      object: c.kind,
      severity: c.chance === 0 ? 'blocks' : 'hard',
      cause: `${persona}, level ${level.seed}, obstacle ${c.index + 1} (${c.kind}): clears it first time ${pct(c.chance)}% of the time at ${speed}. The take-off window is ${Math.round(c.windowMs)} ms.`,
      repair: fix
        ? { change: 'speed', to: fix.to, effect: `Offer ${fix.to} to this player: the chance rises from ${pct(c.chance)}% to ${pct(fix.chance)}%.` }
        : {
            change: 'none',
            note: 'No speed setting fixes this. It needs a design change to the obstacle, and a wider window would change the level for everyone, so it is not offered as a repair.',
          },
    });
  }
  return out;
}

/** Run the reviewer personas over one level. */
export function reviewLevel(kit: ReviewKit, level: Level, options: ReviewOptions = {}): Review {
  const speed = options.speed ?? kit.newProfile().speed;
  const min = options.minClearRate ?? 0.75;
  const findings: Finding[] = [];
  for (const spec of options.personas ?? DEFAULT_REVIEWERS) {
    if (spec.kind === 'deaf') findings.push(...perceptionFindings(kit, level, spec, 'sight'));
    else {
      findings.push(...timingFindings(kit, level, spec, speed, min));
      if (spec.kind === 'audio-only') findings.push(...perceptionFindings(kit, level, spec, 'hearing'));
    }
  }
  const passed = findings.length === 0;
  const first = findings[0];
  return {
    level: level.seed,
    speed,
    passed,
    findings,
    summary: passed
      ? `Level ${level.seed} at ${speed}: every reviewer can play it and perceive it.`
      : `Level ${level.seed} at ${speed}: ${findings.length} finding${findings.length === 1 ? '' : 's'}. First: ${first!.cause}`,
  };
}

/** Review many levels and gather the result. */
export function reviewLevels(kit: ReviewKit, levels: readonly Level[], options: ReviewOptions = {}): { reviewed: number; clean: number; findings: Finding[]; summary: string } {
  const reviews = levels.map((l) => reviewLevel(kit, l, options));
  const findings = reviews.flatMap((r) => r.findings);
  const clean = reviews.filter((r) => r.passed).length;
  return {
    reviewed: reviews.length,
    clean,
    findings,
    summary: `${clean} of ${reviews.length} levels have no findings.${findings[0] ? ` First: ${findings[0].cause}` : ''}`,
  };
}
