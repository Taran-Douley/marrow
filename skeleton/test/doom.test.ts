import { describe, expect, it } from 'vitest';
import { cuesAudible, createKit, trackClearOfCues, validateTrack, type DoomSpec, type TrackSpec } from '../src';
import { TRACK_LEVELS, trackNotes, type TrackWindow } from '../src/channels/track';
import type { OutputCommand } from '../src/types';

const doom: DoomSpec = {
  droneHz: 45,
  swellBars: 8,
  pad: { voice: 'brass', hz: 55, notes: [0, 7] },
  drum: { voice: 'timpani', hz: 80, bars: ['X.......', '........'], phase2: ['X...x...', 'X.....x.'] },
  cluster: { hz: 100, notes: [0, 1], open: [7] },
  bell: { voice: 'bell', hz: 90, every: 4, slot: 4 },
};

const base: TrackSpec = {
  name: 'Doomed',
  rootHz: 110,
  scale: [0, 3, 5, 7, 8, 10, 12],
  bass: ['0---3-0-'],
  melody: ['3---5-3-'],
  kick: ['X...x...'],
  doom,
};

type Sound = Extract<OutputCommand, { channel: 'sound' }>;
const sounds = (c: OutputCommand[]): Sound[] => c.filter((x): x is Sound => x.channel === 'sound');
const window = (extra: Partial<TrackWindow> = {}, spec: TrackSpec = base) =>
  sounds(trackNotes(spec, { from: 0, to: 40 * 0.2 * 1, tension: 0.1, level: 1, mono: false, slot: 0.2, quiet: [], ...extra }));
const of = (list: Sound[], voice: string) => list.filter((n) => n.shape?.voice === voice);

describe('the doom layer of a boss track', () => {
  it('has a swelling sub drone, a closing low pad, drums on the downbeats, a cluster and a toll', () => {
    const list = window({ to: 8 * 0.2 * 16 });
    const drone = of(list, 'sub').filter((n) => n.hz === 45);
    expect(drone.length).toBeGreaterThan(8);
    expect(Math.max(...drone.map((n) => n.gain))).toBeGreaterThan(Math.min(...drone.map((n) => n.gain)) * 1.5); // it swells
    const pad = of(list, 'brass');
    expect(pad.length).toBeGreaterThan(0);
    expect(pad.every((n) => (n.shape?.filterTo ?? 1e9) < (n.shape?.filterHz ?? 0))).toBe(true); // the low-pass closes
    expect(of(list, 'timpani').length).toBeGreaterThan(0);
    const cluster = of(list, 'choir').filter((n) => n.hz >= 99 && n.hz < 110);
    expect(cluster.length).toBeGreaterThan(0);
    expect(of(list, 'bell').length).toBeGreaterThan(0);
  });

  it('is absent from a track without it, and keeps every note under the beeps', () => {
    const { doom: _d, ...plain } = base;
    void _d;
    expect(of(window({}, plain), 'timpani')).toHaveLength(0);
    for (const phase of [0, 1]) {
      const top = Math.max(...window({ phase, phaseBar: 0, to: 8 * 0.2 * 4 }).map((n) => Math.max(n.hz, n.shape?.hzTo ?? 0)));
      expect(top).toBeLessThanOrEqual(294 * 0.9);
    }
  });

  it('phase 2 adds drums, opens the cluster, tolls more often and risers in on its first bar', () => {
    const one = window({ phase: 0, to: 8 * 0.2 * 16 });
    const two = window({ phase: 1, phaseBar: 5, to: 8 * 0.2 * 16 });
    expect(of(two, 'timpani').length).toBeGreaterThan(of(one, 'timpani').length);
    expect(of(two, 'bell').length).toBeGreaterThan(of(one, 'bell').length);
    expect(of(two, 'choir').length).toBeGreaterThan(of(one, 'choir').length);
    const droneGain = (l: Sound[]) => Math.max(...of(l, 'sub').filter((n) => n.hz === 45).map((n) => n.gain));
    expect(droneGain(two)).toBeGreaterThan(droneGain(one));
    expect(of(one, 'riser')).toHaveLength(0);
    const first = window({ phase: 1, phaseBar: 0, to: 8 * 0.2 });
    expect(of(first, 'riser').length).toBe(4);
    const gains = of(first, 'riser').map((n) => n.gain);
    expect(gains).toEqual([...gains].sort((a, b) => a - b)); // it climbs
  });

  it('never sounds under a cue: every part of it is silent where a cue can sound', () => {
    const list = window({ quiet: [[0, 40 * 0.2]], phase: 1, phaseBar: 0 });
    for (const voice of ['brass', 'timpani', 'bell', 'riser']) expect(of(list, voice)).toHaveLength(0);
    expect(of(list, 'choir').filter((n) => n.hz >= 99 && n.hz < 130)).toHaveLength(0);
    const d = TRACK_LEVELS.ducked;
    expect(d.doomPad + d.doomDrum + d.doomCluster + d.doomBell + d.doomRiser).toBe(0);
  });

  it('is checked in plain words', () => {
    expect(() => validateTrack(base)).not.toThrow();
    expect(() => validateTrack({ ...base, doom: { ...doom, droneHz: 80 } })).toThrow(/35 to 55/);
    expect(() => validateTrack({ ...base, doom: { ...doom, drum: { ...doom.drum, bars: ['X.'] } } })).toThrow(/x, X and dots/);
    expect(() => validateTrack({ ...base, doom: { ...doom, cluster: { ...doom.cluster, hz: 200 } } })).toThrow(/264/);
  });

  it('keeps the beeps 6 dB over everything and above every note, in both phases', () => {
    const kit = createKit({ audio: { track: base } });
    kit.defineObstacle('grave', { width: [0.16, 0.3] });
    for (let seed = 1; seed <= 20; seed++) {
      const commands = kit.renderLevel(kit.generate(seed));
      expect(cuesAudible(commands).counterexamples ?? [], `seed ${seed}`).toEqual([]);
      expect(trackClearOfCues(commands).counterexamples ?? [], `seed ${seed}`).toEqual([]);
    }
  });
});
