import { charactersTooAlike, spokenMs, type OutputCommand } from '@marrow/skeleton';
import { describe, expect, it } from 'vitest';
import { SEANCE_CHARACTERS, createSeanceKit } from '../src/kit';

const speech = (cmds: readonly OutputCommand[]) => cmds.filter((c): c is Extract<OutputCommand, { channel: 'speech' }> => c.channel === 'speech');

describe('Séance Escape characters', () => {
  const kit = createSeanceKit();

  it('every pair differs in at least two of pitch, rate, position and signature', () => {
    expect(charactersTooAlike(SEANCE_CHARACTERS, 'Séance Escape')).toEqual([]);
  });

  it('Mabel speaks her lines under her name, with her signature, in her own voice', () => {
    const out = kit.render({ type: 'walk-hint', at: 0, data: { line: 'The bell is 1 room away.' } });
    const line = speech(out)[0]!;
    expect(line.speaker).toMatchObject({ id: 'mabel', name: 'Mabel' });
    expect(line.tone).toEqual({ pitch: 1.3, rate: 1.02 });
    expect(out.find((c) => c.channel === 'captions')).toMatchObject({ text: 'Mabel: The bell is 1 room away.' });
    expect(spokenMs(line)).toBeGreaterThan(spokenMs({ ...line, speaker: SEANCE_CHARACTERS.narrator as never }));
  });

  it('the narrator is unnamed and has no signature', () => {
    const line = speech(kit.render({ type: 'walk-listen', at: 0, data: { summary: 'Quiet.' } }))[0]!;
    expect(line.speaker?.id).toBe('narrator');
    expect(line.speaker?.signature).toBeUndefined();
  });
});
