import type { Brief } from './brief';
import { AREAS, suggestionsFor, type Area, type Suggestion } from './suggestions';

// The plan (Requirements A4 and A5): every suggestion with the developer's decision and note, as a
// Markdown checklist the developer edits by hand or with Kiro. When the brief changes, a new plan is
// made and every decision on a suggestion that still applies is kept.

export type Decision = 'undecided' | 'accepted' | 'rejected';

export interface PlanItem extends Suggestion {
  decision: Decision;
  note: string;
  /** Suggested for the first time in this plan. */
  isNew: boolean;
  /** Was suggested before, but no longer applies to the game as described. Kept so nothing agreed is lost. */
  noLongerFits: boolean;
}

export interface Plan {
  game: string;
  genre: string;
  theme: string;
  items: PlanItem[];
}

const MARK: Record<Decision, string> = { undecided: ' ', accepted: 'x', rejected: '-' };
const HOW_WORDS = { 'built-in': 'Built into Marrow', 'from-plan': 'Marrow builds it from this plan', 'by-hand': 'Your code' } as const;

/** A plan for a brief. Pass the plan as it was to keep every decision and note. */
export function advise(brief: Brief, previous?: Plan): Plan {
  const before = new Map((previous?.items ?? []).map((i) => [i.id, i]));
  const now = suggestionsFor(brief);
  const ids = new Set(now.map((s) => s.id));
  const items: PlanItem[] = now.map((s) => {
    const old = before.get(s.id);
    return { ...s, decision: old?.decision ?? 'undecided', note: old?.note ?? '', isNew: previous !== undefined && !old, noLongerFits: false };
  });
  // A suggestion that no longer applies stays if the developer had decided on it, marked as such.
  for (const old of previous?.items ?? []) {
    if (!ids.has(old.id) && old.decision !== 'undecided') items.push({ ...old, isNew: false, noLongerFits: true });
  }
  return { game: brief.name, genre: brief.genre, theme: brief.theme, items };
}

/** The plan as Markdown. `[x]` accepted, `[ ]` undecided, `[-]` rejected. Anything after "Note:" is kept. */
export function planMarkdown(plan: Plan): string {
  const counts = { accepted: 0, rejected: 0, undecided: 0 };
  for (const i of plan.items) counts[i.decision] += 1;
  const lines = [
    `# Accessibility plan: ${plan.game}`,
    '',
    `Genre: ${plan.genre}. Theme: ${plan.theme}. ${counts.accepted} accepted, ${counts.rejected} rejected, ${counts.undecided} to decide.`,
    '',
    'Mark each item `[x]` to accept, `[-]` to reject, or leave `[ ]` to decide later. Add a note after "Note:" on the line under an item. Then ask Kiro (the accessibility designer) to talk it through, or run `npm run advise -- build` to build what you accepted.',
    '',
  ];
  const byArea = (area: Area): PlanItem[] => plan.items.filter((i) => i.area === area);
  for (const area of AREAS) {
    const items = byArea(area.id);
    if (items.length === 0) continue;
    lines.push(`## ${area.title}`, '');
    for (const i of items) {
      const flags = [i.isNew ? '**new**' : '', i.noLongerFits ? '**no longer fits the brief**' : ''].filter(Boolean).join(' ');
      lines.push(`- [${MARK[i.decision]}] \`${i.id}\` ${i.title}${flags ? ` ${flags}` : ''}`);
      lines.push(`  - Why: ${i.why}`);
      lines.push(`  - Helps: ${i.helps}.`);
      lines.push(`  - How: ${HOW_WORDS[i.how.kind]}. ${i.how.detail}`);
      lines.push(`  - Guideline: ${i.guideline}.`);
      lines.push(`  - ESA tag: ${i.esa.length > 0 ? i.esa.join(', ') : 'none (no ESA tag covers this yet)'}.`);
      lines.push(`  - Note: ${i.note}`);
    }
    lines.push('');
  }
  lines.push(
    '---',
    '',
    'This plan helps the game work for more players. It does not make the game "fully accessible", and it does not replace testing with disabled players.',
    '',
  );
  return lines.join('\n');
}

/**
 * Read a plan back from Markdown: the decision and note of every item, by id. The rest of the item is
 * made again from the brief, so the developer only ever edits the boxes and the notes.
 */
export function parsePlan(markdown: string, brief: Brief): Plan {
  const decisions = new Map<string, { decision: Decision; note: string }>();
  let last: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const item = /^- \[([ xX-])\] `([a-z0-9-]+)`/.exec(line);
    if (item) {
      const mark = item[1]!.toLowerCase();
      last = item[2]!;
      decisions.set(last, { decision: mark === 'x' ? 'accepted' : mark === '-' ? 'rejected' : 'undecided', note: '' });
      continue;
    }
    const note = /^\s+- Note:\s?(.*)$/.exec(line);
    if (note && last) decisions.get(last)!.note = note[1]!.trim();
  }
  // Items no longer suggested are rebuilt from what the plan said about them.
  const known = advise(brief);
  const items: PlanItem[] = known.items.map((i) => ({ ...i, ...(decisions.get(i.id) ?? {}) }));
  for (const [id, d] of decisions) {
    if (items.some((i) => i.id === id) || d.decision === 'undecided') continue;
    const title = new RegExp(`^- \\[[ xX-]\\] \`${id}\` (.*?)(?: \\*\\*.*)?$`, 'm').exec(markdown)?.[1] ?? id;
    items.push({ id, area: 'features', title, why: '', helps: '', guideline: '', esa: [], how: { kind: 'by-hand', detail: '' }, ...d, isNew: false, noLongerFits: true });
  }
  return { ...known, items };
}

/** The accepted items, for building. */
export const accepted = (plan: Plan): PlanItem[] => plan.items.filter((i) => i.decision === 'accepted' && !i.noLongerFits);
