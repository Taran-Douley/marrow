import { describe, expect, it } from 'vitest';
import { createSpeaker } from '../src/adapters/web';
import { createKit } from '../src/kit';
import { defaultProfile } from '../src/profile';
import {
  SIGNATURE_GAP_MS,
  charactersTooAlike,
  differences,
  signatureLeadMs,
  signaturesOutsideWindows,
  spokenMs,
  totalSpokenMs,
  validateCharacters,
} from '../src/speech';
import { speechMs } from '../src/scanning';
import type { Character, OutputCommand } from '../src/types';

const MABEL: Character = { name: 'Mabel', pitch: 1.3, rate: 1.02, pan: -0.5, signature: { hz: 880, wave: 'sine', ms: 180 } };
const CHARACTERS = { narrator: {}, mabel: MABEL };

function kit() {
  return createKit({
    characters: CHARACTERS,
    events: {
      hello: { say: 'Hello, dear.', caption: 'Hello', speaker: 'mabel' },
      plain: { say: 'A door.', caption: 'A door' },
      pair: { say: 'First.', also: [{ say: '{extra}', speaker: 'mabel', caption: '{extra}' }, { say: 'Last.' }], caption: 'First' },
    },
  });
}

const speech = (cmds: readonly OutputCommand[]) => cmds.filter((c): c is Extract<OutputCommand, { channel: 'speech' }> => c.channel === 'speech');

describe('character profiles', () => {
  it('refuse a signature of 300 ms or more, and a position outside -1 to 1, in words', () => {
    expect(() => validateCharacters({ a: { signature: { hz: 440, wave: 'sine', ms: 300 } } })).toThrow(/under 300 ms/);
    expect(() => validateCharacters({ a: { signature: { hz: 440, wave: 'sine', ms: 299 } } })).not.toThrow();
    expect(() => validateCharacters({ a: { pan: 1.5 } })).toThrow(/position 1.5/);
    expect(() => validateCharacters({ a: { pitch: 3 } })).toThrow(/pitch 3/);
  });

  it('a kit refuses an event whose speaker was never declared', () => {
    expect(() => createKit({ characters: CHARACTERS, events: { x: { say: 'Hi.', speaker: 'nobody' } } })).toThrow(/no character has that id/);
  });

  it('names the speaker in the caption, and carries voice, pitch, rate, position and signature', () => {
    const k = kit();
    const out = k.render({ type: 'hello', at: 0 });
    const line = speech(out)[0]!;
    expect(line.text).toBe('Hello, dear.');
    expect(line.speaker).toMatchObject({ id: 'mabel', name: 'Mabel', pan: -0.5, signature: { ms: 180 } });
    expect(line.tone).toEqual({ pitch: 1.3, rate: 1.02 });
    expect(out.find((c) => c.channel === 'captions')).toMatchObject({ text: 'Mabel: Hello' });
  });

  it('leaves the narrator unnamed: no prefix in captions, no signature', () => {
    const out = kit().render({ type: 'plain', at: 0 });
    expect(speech(out)[0]!.speaker).toMatchObject({ id: 'narrator' });
    expect(speech(out)[0]!.speaker?.signature).toBeUndefined();
    expect(out.find((c) => c.channel === 'captions')).toMatchObject({ text: 'A door' });
  });

  it('says later parts by their own speakers, and leaves out a part whose slot is empty', () => {
    const k = kit();
    const some = speech(k.render({ type: 'pair', at: 0, data: { extra: 'Boo.' } }));
    expect(some.map((c) => [c.text, c.speaker?.id])).toEqual([['First.', 'narrator'], ['Boo.', 'mabel'], ['Last.', 'narrator']]);
    const none = speech(k.render({ type: 'pair', at: 0 }));
    expect(none.map((c) => c.text)).toEqual(['First.', 'Last.']);
  });

  it('counts the signature and its pause in the time a line takes', () => {
    const k = kit();
    const mabel = speech(k.render({ type: 'hello', at: 0 }))[0]!;
    const narrator = speech(k.render({ type: 'plain', at: 0 }))[0]!;
    expect(signatureLeadMs(MABEL)).toBe(180 + SIGNATURE_GAP_MS);
    expect(spokenMs(mabel)).toBe(speechMs('Hello, dear.') + 180 + SIGNATURE_GAP_MS);
    expect(spokenMs(narrator)).toBe(speechMs('A door.'));
    expect(totalSpokenMs([mabel, narrator])).toBe(spokenMs(mabel) + spokenMs(narrator));
    expect(spokenMs({ channel: 'haptics', senses: ['touch'], at: 0, pattern: [1] })).toBe(0);
  });

  it('the signature never sits inside a countdown', () => {
    const mabel = speech(kit().render({ type: 'hello', at: 2 }))[0]!;
    expect(signaturesOutsideWindows([mabel], [{ from: 3, to: 4 }], 1)).toEqual([]);
    expect(signaturesOutsideWindows([mabel], [{ from: 2.1, to: 4 }], 1)[0]).toMatch(/Mabel at 2.00 s sounds inside a countdown/);
  });

  it('two characters must differ in at least two of pitch, rate, position and signature', () => {
    expect(differences(MABEL, {})).toEqual(expect.arrayContaining(['pitch', 'position', 'signature']));
    expect(charactersTooAlike(CHARACTERS)).toEqual([]);
    const twin = { ...MABEL, name: 'Twin', pitch: 1.35 };
    expect(charactersTooAlike({ mabel: MABEL, twin })[0]).toMatch(/Mabel and Twin differ only in nothing/);
  });
});

/** A fake voice that records what was said, and a fake clock. */
function rig(aloud = true) {
  const log: string[] = [];
  const region: string[] = [];
  const timers: { fn: () => void; ms: number; on: boolean }[] = [];
  const styles: unknown[] = [];
  const speaker = createSpeaker({
    region: { append: (t) => region.push(t) },
    synth: { speak: (u) => log.push(`say:${(u as { text: string }).text}`), cancel: () => undefined },
    makeUtterance: (text, _v, tone, voices) => {
      styles.push({ tone, voices });
      return { text };
    },
    timers: {
      set: (fn, ms) => {
        const t = { fn, ms, on: true };
        timers.push(t);
        return t;
      },
      clear: (h) => {
        (h as { on: boolean }).on = false;
      },
    },
  });
  return { speaker, log, region, timers, styles, aloud };
}

describe('speaking in a character voice', () => {
  it('plays the signature first, and the voice starts after it', () => {
    const r = rig();
    r.speaker.say('Hello, dear.', {
      aloud: true,
      volume: 1,
      name: 'Mabel',
      tone: { pitch: 1.3, rate: 1.02 },
      voices: ['Libby'],
      before: () => {
        r.log.push('signature');
        return 260;
      },
    });
    expect(r.log).toEqual(['signature']);
    expect(r.timers[0]!.ms).toBe(260);
    r.timers[0]!.fn();
    expect(r.log).toEqual(['signature', 'say:Hello, dear.']);
    expect(r.styles[0]).toEqual({ tone: { pitch: 1.3, rate: 1.02 }, voices: ['Libby'] });
    expect(r.region).toEqual(['Mabel: Hello, dear.']);
  });

  it('with the built-in voice off, the signature still plays and the live text still names the speaker', () => {
    const r = rig();
    r.speaker.say('Hello, dear.', { aloud: false, volume: 1, name: 'Mabel', before: () => (r.log.push('signature'), 260) });
    expect(r.log).toEqual(['signature']);
    expect(r.region).toEqual(['Mabel: Hello, dear.']);
  });

  it('a signature that cannot play never loses the line', () => {
    const r = rig();
    r.speaker.say('Hello.', {
      aloud: true,
      volume: 1,
      before: () => {
        throw new Error('no audio');
      },
    });
    expect(r.log).toEqual(['say:Hello.']);
  });

  it('a newer line cuts a waiting signature off before its voice starts', () => {
    const r = rig();
    r.speaker.say('One.', { aloud: true, volume: 1, before: () => 200 });
    r.speaker.say('Two.', { aloud: true, volume: 1 });
    r.timers[0]!.fn();
    expect(r.log).toEqual(['say:Two.']);
  });

  it('with a single installed voice the characters still differ by pitch, rate and signature', () => {
    const k = kit();
    const a = speech(k.render({ type: 'hello', at: 0 }))[0]!;
    const b = speech(k.render({ type: 'plain', at: 0 }))[0]!;
    expect(a.tone).not.toEqual(b.tone);
    expect(a.speaker?.signature).toBeDefined();
    expect(b.speaker?.signature).toBeUndefined();
    expect(defaultProfile().voice).toBe(true);
  });
});
