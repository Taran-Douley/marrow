import { PERK_IDS, isPerkId, lineMs, type PerkId } from '@marrow/skeleton';

// Relics carry over (spec seance-runs, R7). Each relic found in a run can give one perk for the next run. The player
// chooses one by scanning (no time limit, one switch). The mechanics are in skeleton/src/navigation/perks.ts; the
// words, and which relic gives which perk, are here.

export interface PerkWords {
  id: PerkId;
  /** The relic that gives it, by index in RELICS (content.ts). */
  relic: number;
  relicName: string;
  name: string;
  /** What it does, in plain words. */
  does: string;
}

/** The perk table. The relic order is the order of RELICS: the Silver Candle, the Locket, the Planchette. */
export const PERK_TABLE: readonly PerkWords[] = [
  {
    id: 'soft-steps',
    relic: 0,
    relicName: 'the Silver Candle',
    name: 'Soft steps',
    does: 'Every noise you make is one step quieter, so the phantom hears you from less far away.',
  },
  {
    id: 'free-ask',
    relic: 1,
    relicName: 'the Locket',
    name: 'A free look',
    does: 'Your first Listen and your first hint cost no turn, so the phantom does not move.',
  },
  {
    id: 'second-chance',
    relic: 2,
    relicName: 'the Planchette',
    name: 'Second chance',
    does: 'The first time the phantom catches you does not count toward the three.',
  },
];

export const wordsFor = (id: PerkId): PerkWords => PERK_TABLE.find((p) => p.id === id)!;

/** The perks the relics found in a run give, in table order. `foundRelics` are indexes into RELICS. */
export function perksFor(foundRelics: readonly number[]): PerkWords[] {
  return PERK_TABLE.filter((p) => foundRelics.includes(p.relic));
}

/** One option of the scanned choice: said, written and lit. It says what it does before it is chosen. */
export const perkOptionLabel = (perk: PerkWords): string => `${perk.name}, from ${perk.relicName}. ${perk.does}`;

export const NO_PERK_ID = 'no-perk';
export const NO_PERK_LABEL = 'No perk. Start with nothing extra.';

/** Said when the run ends and relics were found: what is coming, so the press that follows is not a surprise. */
export function perkOffer(found: number): string {
  if (found <= 0) return 'You found no relics, so there is no perk for the next house. Perks come from relics.';
  return found === 1
    ? 'You found a relic, so you will choose a perk for the next house first.'
    : `You found ${found} relics, so you will choose a perk for the next house first.`;
}

/** Said when the choice opens. */
export function perkChoiceIntro(count: number): string {
  return `Choose one perk for the next house. There are ${count} and a choice of none. Each is read out, and you can wait as long as you like. Press when you hear the one you want.`;
}

/** Said when a perk is chosen. */
export const perkChosen = (perk: PerkWords | null): string => (perk ? `${perk.name} is chosen. It applies to the next house only.` : 'No perk. On to the next house.');

/** Said at the start of a run that has a perk on. Short, because the run waits for it. */
export const perkStartLine = (id: PerkId): string => ` Perk on: ${wordsFor(id).name}. ${wordsFor(id).does}`;

/** The longest start line, in ms of speech. A house must still fit 5 to 8 minutes with it said (see runs.ts). */
export const PERK_START_MS: number = Math.max(...PERK_IDS.map((id) => lineMs(perkStartLine(id))));

// ---- saved ------------------------------------------------------------------

export const PERK_KEY = 'seance.perk';

/** The perk saved for the next run, or null. A saved value that is not a perk is ignored. */
export function readPerk(read: (key: string) => string | null): PerkId | null {
  const value = read(PERK_KEY);
  return isPerkId(value) ? value : null;
}

/** Said while it is in force, in a line for each thing a perk does in play. */
export const PERK_PLAY = {
  freeListen: 'Your perk paid for that.',
  forgiven: 'That one does not count, dear. Your perk saved you. Up you get.',
};
