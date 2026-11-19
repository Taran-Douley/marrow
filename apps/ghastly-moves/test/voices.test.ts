import { charactersTooAlike, signatureLeadMs, type OutputCommand } from '@marrow/skeleton';
import { describe, expect, it } from 'vitest';
import { createGhastlyKit } from '../src/kit';
import { STAGES } from '../src/stages';
import { GHASTLY_CHARACTERS } from '../src/voices';

describe('Ghastly Moves characters', () => {
  it('every pair differs in at least two of pitch, rate, position and signature', () => {
    expect(charactersTooAlike(GHASTLY_CHARACTERS, 'Ghastly Moves')).toEqual([]);
  });

  it('every boss in the story has a voice, and a signature under 300 ms', () => {
    for (const s of STAGES) {
      const c = GHASTLY_CHARACTERS[s.boss.name];
      expect(c, s.boss.name).toBeDefined();
      expect(c!.name).toBe(s.boss.name);
      expect(c!.signature!.ms).toBeLessThan(300);
    }
  });

  it('the narrator has no signature, so nothing sounds before the numbers, tells and coach lines near a countdown', () => {
    expect(GHASTLY_CHARACTERS.narrator!.signature).toBeUndefined();
    const kit = createGhastlyKit(STAGES[0]!);
    const level = kit.generate(1);
    const lines = kit.renderLevel(level).filter((c): c is Extract<OutputCommand, { channel: 'speech' }> => c.channel === 'speech');
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(signatureLeadMs(l.speaker)).toBe(0);
  });

  it('the boss taunts under its own name, with its signature, and the narrator says the rest', () => {
    const stage = STAGES[0]!;
    const kit = createGhastlyKit(stage, { boss: true });
    const out = kit.render({ type: 'stage-clear', at: 0, data: { place: stage.name, right: 3, total: 3, rank: 'S', taunt: stage.boss.taunt, boss: stage.boss.name } });
    const speech = out.filter((c): c is Extract<OutputCommand, { channel: 'speech' }> => c.channel === 'speech');
    expect(speech.map((c) => c.speaker?.id)).toEqual(['narrator', stage.boss.name, 'narrator']);
    expect(speech[1]!.speaker!.signature).toBeDefined();
    expect(out.filter((c) => c.channel === 'captions').map((c) => (c as { text: string }).text)).toContain(`${stage.boss.name}: ${stage.boss.taunt}`);
  });
});
