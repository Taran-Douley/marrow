import { STAGES, type Item, type Stage } from './stages';

/** What the player has done so far. Saved as plain JSON. */
export interface Progress {
  /** Stage ids whose boss has been beaten. */
  cleared: number[];
  /** Best rank per stage id, S to C. */
  best: Record<string, string>;
}

export const RANK_ORDER = ['C', 'B', 'A', 'S'] as const;

export const emptyProgress = (): Progress => ({ cleared: [], best: {} });

/** Read saved progress. Anything odd or missing is treated as a fresh start, never an error. */
export function parseProgress(raw: string | null): Progress {
  try {
    const value: unknown = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object') return emptyProgress();
    const { cleared, best } = value as Partial<Progress>;
    const ids = new Set(STAGES.map((s) => s.id));
    return {
      cleared: Array.isArray(cleared) ? [...new Set(cleared.filter((n): n is number => typeof n === 'number' && ids.has(n)))] : [],
      best:
        best && typeof best === 'object'
          ? Object.fromEntries(Object.entries(best).filter(([k, v]) => ids.has(Number(k)) && (RANK_ORDER as readonly string[]).includes(v as string)))
          : {},
    };
  } catch {
    return emptyProgress();
  }
}

export function withRank(p: Progress, stageId: number, rank: string): Progress {
  const old = p.best[String(stageId)];
  if (old && RANK_ORDER.indexOf(old as 'C') >= RANK_ORDER.indexOf(rank as 'C')) return p;
  return { ...p, best: { ...p.best, [String(stageId)]: rank } };
}

export function withBoss(p: Progress, stageId: number): Progress {
  return p.cleared.includes(stageId) ? p : { ...p, cleared: [...p.cleared, stageId].sort((a, b) => a - b) };
}

/** The first stage whose boss is not yet beaten, or undefined when the story is done. */
export const nextStage = (p: Progress): Stage | undefined => STAGES.find((s) => !p.cleared.includes(s.id));

export const itemsWon = (p: Progress): Item[] => STAGES.filter((s) => p.cleared.includes(s.id)).map((s) => s.boss.item);

/** One plain line for the menu, spoken and written. */
export function describeNext(p: Progress): string {
  const next = nextStage(p);
  if (!next) return 'You have won every item and the lights are back on. Pick any stage to play it again.';
  const items = itemsWon(p).length;
  const have = items === 0 ? 'No items yet.' : `${items} of ${STAGES.length} items won.`;
  return `${have} Next: stage ${next.id}, ${next.name}.`;
}

/** The story map in words, one line per place. Also used by the page for screen readers. */
export function mapLines(p: Progress): string[] {
  const next = nextStage(p);
  return STAGES.map((s) => {
    const rank = p.best[String(s.id)];
    const state = p.cleared.includes(s.id)
      ? `boss beaten, ${s.boss.item.name} won`
      : next?.id === s.id
        ? 'next'
        : 'not yet';
    return `Stage ${s.id}, ${s.name}: ${s.rule}. ${state}${rank ? `. Best rank ${rank}` : ''}.`;
  });
}

// ---- the furthest you got ------------------------------------------------------------

/**
 * The best share of a level passed in one clean stretch, without a fall, per stage (and per boss).
 * Kept apart from `Progress` in its own saved value, so older saves are not touched.
 */
export type Far = Record<string, number>;

/** The key for a level: a stage ('3'), its boss ('3b'), or free practice of a table ('t7'). */
export const farKey = (stageId: number | undefined, boss: boolean, table: number): string =>
  stageId === undefined ? `t${table}` : `${stageId}${boss ? 'b' : ''}`;

/** Read the saved bests. Anything odd is dropped, never an error. */
export function parseFar(raw: string | null): Far {
  try {
    const value: unknown = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(([k, v]) => /^(\d{1,2}b?|t\d{1,2})$/.test(k) && typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100),
    ) as Far;
  } catch {
    return {};
  }
}

/** The new set of bests, with `percent` in if it beats the one saved. */
export function withFar(far: Far, key: string, percent: number): Far {
  const p = Math.max(0, Math.min(100, Math.floor(percent)));
  return p > (far[key] ?? 0) ? { ...far, [key]: p } : far;
}

/** Share of a level passed, 0 to 100: obstacles got right so far over all of them. */
export const percentPassed = (passed: number, total: number): number =>
  total <= 0 ? 0 : Math.max(0, Math.min(100, Math.floor((passed / total) * 100)));
