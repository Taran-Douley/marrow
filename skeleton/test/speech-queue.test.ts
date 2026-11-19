import { describe, expect, it } from 'vitest';
import { createSpeaker, type SpeakerOptions } from '../src/adapters/web';
import { createKit } from '../src/kit';
import { defaultProfile } from '../src/profile';

/** A fake browser voice: lines are spoken one at a time, and `end()` finishes the current one. */
function fakeVoice() {
  const spoken: string[] = [];
  let cancels = 0;
  let live: { text: string; fire: Map<string, () => void> } | null = null;
  const timers: { fn: () => void; ms: number; on: boolean }[] = [];
  const options: Omit<SpeakerOptions, 'queue'> = {
    region: { append: () => undefined },
    synth: {
      speak(u) {
        live = u as { text: string; fire: Map<string, () => void> };
        spoken.push(live.text);
      },
      cancel() {
        cancels += 1;
        live = null;
      },
    },
    makeUtterance: (text) => {
      const fire = new Map<string, () => void>();
      return { text, fire, addEventListener: (type: string, fn: () => void) => fire.set(type, fn) };
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
  };
  return {
    options,
    spoken,
    cancels: () => cancels,
    end() {
      const u = live;
      live = null;
      u?.fire.get('end')?.();
    },
    /** Fire every guard timer still waiting, as if the voice never reported the end. */
    giveUp() {
      for (const t of timers.splice(0)) if (t.on) t.fn();
    },
  };
}

const how = { aloud: true, volume: 1 };

describe('speech queue', () => {
  it('without a queue the newest line cuts in, as before', () => {
    const v = fakeVoice();
    const speaker = createSpeaker(v.options);
    speaker.say('One', how);
    speaker.say('Two', how);
    expect(v.spoken).toEqual(['One', 'Two']);
    expect(v.cancels()).toBe(2);
  });

  it('with a queue each line finishes before the next begins', () => {
    const v = fakeVoice();
    const speaker = createSpeaker({ ...v.options, queue: true });
    speaker.say('The library.', how);
    speaker.say('Mabel: a relic!', how);
    expect(v.spoken).toEqual(['The library.']);
    expect(speaker.busy()).toBe(true);
    v.end();
    expect(v.spoken).toEqual(['The library.', 'Mabel: a relic!']);
    v.end();
    expect(speaker.busy()).toBe(false);
    expect(v.cancels()).toBe(0);
  });

  it('a cut-in line stops the current one and drops the waiting ones', () => {
    const v = fakeVoice();
    const speaker = createSpeaker({ ...v.options, queue: true });
    speaker.say('A long story line.', how);
    speaker.say('Waiting line.', how);
    speaker.say('Caught!', { ...how, mode: 'cut-in' });
    expect(v.spoken).toEqual(['A long story line.', 'Caught!']);
    v.end();
    expect(v.spoken).toEqual(['A long story line.', 'Caught!']);
    expect(speaker.busy()).toBe(false);
  });

  it('a latest line replaces a waiting line with the same key, so labels keep up with the highlight', () => {
    const v = fakeVoice();
    const speaker = createSpeaker({ ...v.options, queue: true });
    speaker.say('You are in the study.', how);
    speaker.say('Turn left', { ...how, mode: 'latest', key: 'walk-option' });
    speaker.say('Go ahead', { ...how, mode: 'latest', key: 'walk-option' });
    v.end();
    expect(v.spoken).toEqual(['You are in the study.', 'Go ahead']);
  });

  it('a voice that never reports the end is given up on, so the queue never sticks', () => {
    const v = fakeVoice();
    const speaker = createSpeaker({ ...v.options, queue: true });
    speaker.say('One', how);
    speaker.say('Two', how);
    v.giveUp();
    expect(v.spoken).toEqual(['One', 'Two']);
  });

  it('silence stops speech and forgets the waiting lines', () => {
    const v = fakeVoice();
    const speaker = createSpeaker({ ...v.options, queue: true });
    speaker.say('One', how);
    speaker.say('Two', how);
    speaker.silence();
    v.end();
    expect(v.spoken).toEqual(['One']);
    expect(speaker.busy()).toBe(false);
  });

  it('never keeps more than maxWaiting lines waiting', () => {
    const v = fakeVoice();
    const speaker = createSpeaker({ ...v.options, queue: true, maxWaiting: 1 });
    speaker.say('Now', how);
    speaker.say('Old', how);
    speaker.say('New', how);
    v.end();
    v.end();
    expect(v.spoken).toEqual(['Now', 'New']);
  });

  it('events choose their speech mode, and scanning labels are "latest" by default', () => {
    const kit = createKit({ events: { warn: { say: 'Behind you!', speech: 'cut-in' }, story: { say: 'Once upon a time.' } } });
    const profile = defaultProfile();
    const speechOf = (type: string, data?: Record<string, unknown>) =>
      kit.render(data ? { type, at: 0, data } : { type, at: 0 }, profile).find((c) => c.channel === 'speech');
    expect(speechOf('warn')).toMatchObject({ mode: 'cut-in' });
    expect(speechOf('story')).not.toHaveProperty('mode');
    expect(speechOf('menu-option', { label: 'Play' })).toMatchObject({ mode: 'latest', key: 'menu-option' });
  });
});
