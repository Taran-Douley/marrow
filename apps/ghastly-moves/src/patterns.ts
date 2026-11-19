import type { BossPattern, ThrowKind, ThrowShape } from './pattern';

// The attack patterns of the six bosses after the Pumpkin King (his is in pattern.ts). Each boss has
// its own throws, its own words and its own volleys. Timing is the same for all of them: the same
// busy parts, the same take-off window and countdown, every press on the beat. Speed is the only
// timing dial, so the later fights are longer or busier to listen to, never tighter to play.
//
// One grammar runs through every fight, so a player learns it once:
//  - a LOBBED throw arcs in from above. Its tell is a rising sine tone ("A rising sound"), its throw
//    sound is a burst of airy noise, and its countdown beeps are a smooth tone (sine or triangle);
//  - a ROLLED throw runs along the ground. Its tell is a low, falling, buzzy rumble (a square wave),
//    its throw sound a low buzz, and its countdown beeps are hollow (a square wave);
//  - a SWOOPED throw flies in on a slant. Its tell is a falling whistle (a triangle wave), its throw
//    sound a falling sine, and its countdown beeps the highest in the fight.
// Within one fight every pair of kinds differs in timbre and in pitch (a major third or more), for
// the beeps, the throw sounds and the tells (property 22). The numbers below were chosen without
// ears. Tune them by playing.

interface Voice {
  hz: number;
  hzTo: number;
}

/** What differs between the kinds of one boss. The sounds follow from how the throw moves. */
interface KindSpec {
  id: string;
  name: string;
  label: string;
  plural: string;
  colour: string;
  motion: ThrowKind['motion'];
  shape: ThrowShape;
  beep: ThrowKind['beep'];
  /** Throw sound. Lobbed: the filter sweeps from `hz` to `hzTo`. Rolled and swooped: the pitch glides from `hz` to `hzTo`. */
  whoosh: Voice;
  /** The tell's pitch glide. Lobbed rises, rolled and swooped fall. */
  tell: Voice;
  say: string;
  caption: string;
  haptic: number[];
}

function kind(s: KindSpec): ThrowKind {
  const common = { id: s.id, name: s.name, label: s.label, plural: s.plural, colour: s.colour, motion: s.motion, shape: s.shape, beep: s.beep };
  const words = { say: s.say, caption: s.caption, haptic: s.haptic };
  if (s.motion === 'lobbed') {
    return {
      ...common,
      heard: 'A rising sound',
      whoosh: { hz: 0, wave: 'sine', gain: 0.45, shape: { noise: true, filterHz: s.whoosh.hz, filterTo: s.whoosh.hzTo, seconds: 0.26 } },
      tell: { ...words, hz: s.tell.hz, wave: 'sine', gain: 0.7, shape: { hzTo: s.tell.hzTo, seconds: 0.7 } },
    };
  }
  if (s.motion === 'rolled') {
    return {
      ...common,
      heard: 'A low rumble',
      whoosh: { hz: s.whoosh.hz, wave: 'square', gain: 0.5, shape: { filterHz: 320, filterTo: 160, hzTo: s.whoosh.hzTo, seconds: 0.45 } },
      tell: { ...words, hz: s.tell.hz, wave: 'square', gain: 0.7, shape: { hzTo: s.tell.hzTo, filterHz: 500, filterTo: 250, seconds: 0.7 } },
    };
  }
  return {
    ...common,
    heard: 'A falling whistle',
    whoosh: { hz: s.whoosh.hz, wave: 'sine', gain: 0.4, shape: { hzTo: s.whoosh.hzTo, seconds: 0.3 } },
    tell: { ...words, hz: s.tell.hz, wave: 'triangle', gain: 0.7, shape: { hzTo: s.tell.hzTo, seconds: 0.6 } },
  };
}

const HAPTIC: Record<ThrowKind['motion'], number[]> = {
  lobbed: [40, 60, 40, 60, 40],
  rolled: [260, 70, 260],
  swooped: [15, 25, 15, 25, 15, 25, 150],
};

/** Stage 2. Two kinds, bone-dry and clattery: thrown bones from above, skulls rolled along the floor. Long volleys at the end. */
export const BONE_PATTERN: BossPattern = {
  throws: [
    kind({
      id: 'bone', name: 'bone', label: 'thrown bone', plural: 'thrown bones', colour: '#efe8d8', motion: 'lobbed', shape: 'bone',
      beep: { hz: 587, wave: 'triangle' }, whoosh: { hz: 2200, hzTo: 4200 }, tell: { hz: 523, hzTo: 1047 },
      say: 'Bones.', caption: 'Bones next', haptic: [30, 40, 30, 40, 30, 40, 30],
    }),
    kind({
      id: 'skull', name: 'skull', label: 'rolling skull', plural: 'rolling skulls', colour: '#d9cfb0', motion: 'rolled', shape: 'skull',
      beep: { hz: 370, wave: 'square' }, whoosh: { hz: 80, hzTo: 50 }, tell: { hz: 130, hzTo: 87 },
      say: 'Skulls.', caption: 'Skulls next', haptic: HAPTIC.rolled,
    }),
  ],
  volleys: ['bone', 'bone', 'skull', 'bone', 'skull', 'skull'],
  volleyBars: [4, 4, 4, 4, 5, 5],
  bars: 4,
  noun: 'throw',
};

/** Stage 3. Two kinds, with an uneven rhythm: hexes in the air, mossy balls underfoot, and a long run of moss at the end. */
export const MOSS_PATTERN: BossPattern = {
  throws: [
    kind({
      id: 'hex', name: 'hex', label: 'hex', plural: 'hexes', colour: '#7ee081', motion: 'lobbed', shape: 'star',
      beep: { hz: 698, wave: 'sine' }, whoosh: { hz: 600, hzTo: 1800 }, tell: { hz: 466, hzTo: 932 },
      say: 'Hexes.', caption: 'Hexes next', haptic: [50, 50, 50, 50, 50],
    }),
    kind({
      id: 'moss', name: 'moss-ball', label: 'moss ball', plural: 'moss balls', colour: '#5a9a4a', motion: 'rolled', shape: 'ball',
      beep: { hz: 415, wave: 'square' }, whoosh: { hz: 100, hzTo: 65 }, tell: { hz: 156, hzTo: 104 },
      say: 'Moss.', caption: 'Moss balls next', haptic: [200, 100, 200, 100, 200],
    }),
  ],
  volleys: ['hex', 'moss', 'moss', 'hex', 'hex', 'moss', 'hex'],
  volleyBars: [4, 4, 5, 4, 4, 5, 6],
  bars: 4,
  noun: 'throw',
};

/** Stage 4. Three kinds: iron balls on the floor, spiked maces from above, crossbow bolts on a slant. */
export const GATEKEEPER_PATTERN: BossPattern = {
  throws: [
    kind({
      id: 'ball', name: 'iron-ball', label: 'iron ball', plural: 'iron balls', colour: '#b9bfd0', motion: 'rolled', shape: 'ball',
      beep: { hz: 370, wave: 'square' }, whoosh: { hz: 85, hzTo: 55 }, tell: { hz: 139, hzTo: 93 },
      say: 'Iron.', caption: 'Iron balls next', haptic: HAPTIC.rolled,
    }),
    kind({
      id: 'mace', name: 'mace', label: 'spiked mace', plural: 'spiked maces', colour: '#e0b04a', motion: 'lobbed', shape: 'star',
      beep: { hz: 494, wave: 'triangle' }, whoosh: { hz: 1000, hzTo: 3000 }, tell: { hz: 494, hzTo: 988 },
      say: 'Maces.', caption: 'Maces next', haptic: HAPTIC.lobbed,
    }),
    kind({
      id: 'bolt', name: 'crossbow-bolt', label: 'crossbow bolt', plural: 'crossbow bolts', colour: '#e8eef7', motion: 'swooped', shape: 'bolt',
      beep: { hz: 659, wave: 'sine' }, whoosh: { hz: 1000, hzTo: 400 }, tell: { hz: 1175, hzTo: 784 },
      say: 'Bolts.', caption: 'Bolts next', haptic: HAPTIC.swooped,
    }),
  ],
  volleys: ['ball', 'mace', 'bolt', 'mace', 'ball', 'bolt', 'ball'],
  volleyBars: [4, 4, 4, 5, 4, 5, 6],
  bars: 4,
  noun: 'throw',
};

/** Stage 5. Three kinds: webs from above, mill wheels along the floor, spiderlings dropping in on a slant. */
export const SPIDER_PATTERN: BossPattern = {
  throws: [
    kind({
      id: 'web', name: 'web-ball', label: 'web ball', plural: 'web balls', colour: '#e9e2ff', motion: 'lobbed', shape: 'web',
      beep: { hz: 554, wave: 'sine' }, whoosh: { hz: 1500, hzTo: 4000 }, tell: { hz: 415, hzTo: 831 },
      say: 'Webs.', caption: 'Webs next', haptic: [20, 30, 20, 30, 20, 30, 20, 30],
    }),
    kind({
      id: 'wheel', name: 'mill-wheel', label: 'mill wheel', plural: 'mill wheels', colour: '#c9a96a', motion: 'rolled', shape: 'wheel',
      beep: { hz: 415, wave: 'triangle' }, whoosh: { hz: 70, hzTo: 45 }, tell: { hz: 123, hzTo: 82 },
      say: 'Wheels.', caption: 'Wheels next', haptic: [320, 80, 120, 80, 320],
    }),
    kind({
      id: 'spider', name: 'spiderling', label: 'spiderling', plural: 'spiderlings', colour: '#b49cff', motion: 'swooped', shape: 'spider',
      beep: { hz: 740, wave: 'square' }, whoosh: { hz: 1200, hzTo: 500 }, tell: { hz: 1397, hzTo: 932 },
      say: 'Spiders.', caption: 'Spiders next', haptic: HAPTIC.swooped,
    }),
  ],
  volleys: ['web', 'wheel', 'spider', 'spider', 'web', 'wheel', 'spider', 'web'],
  volleyBars: [4, 4, 4, 5, 4, 4, 5, 6],
  bars: 4,
  noun: 'throw',
};

/** Stage 6. Three kinds, soft and cold: wisps drifting in, rotten knots rolling, icicles on a slant. */
export const WRAITH_PATTERN: BossPattern = {
  throws: [
    kind({
      id: 'wisp', name: 'wisp', label: 'wisp', plural: 'wisps', colour: '#9fd8ff', motion: 'lobbed', shape: 'wisp',
      beep: { hz: 587, wave: 'sine' }, whoosh: { hz: 300, hzTo: 1200 }, tell: { hz: 392, hzTo: 784 },
      say: 'Wisps.', caption: 'Wisps next', haptic: [60, 80, 60, 80, 60],
    }),
    kind({
      id: 'knot', name: 'knot', label: 'rotten knot', plural: 'rotten knots', colour: '#8a6a4a', motion: 'rolled', shape: 'ball',
      beep: { hz: 392, wave: 'square' }, whoosh: { hz: 75, hzTo: 50 }, tell: { hz: 110, hzTo: 73 },
      say: 'Knots.', caption: 'Knots next', haptic: [240, 90, 240],
    }),
    kind({
      id: 'icicle', name: 'icicle', label: 'icicle', plural: 'icicles', colour: '#cfeaff', motion: 'swooped', shape: 'bolt',
      beep: { hz: 784, wave: 'triangle' }, whoosh: { hz: 1400, hzTo: 600 }, tell: { hz: 1319, hzTo: 880 },
      say: 'Icicles.', caption: 'Icicles next', haptic: [10, 20, 10, 20, 10, 20, 10, 20, 120],
    }),
  ],
  volleys: ['wisp', 'knot', 'icicle', 'wisp', 'icicle', 'knot', 'icicle', 'wisp'],
  volleyBars: [4, 4, 4, 5, 5, 4, 5, 6],
  bars: 4,
  noun: 'throw',
};

/** Stage 7, the last. Three kinds and the longest fight: blood orbs from above, rolling coffins, bats on a slant. */
export const VEXAR_PATTERN: BossPattern = {
  throws: [
    kind({
      id: 'orb', name: 'blood-orb', label: 'blood orb', plural: 'blood orbs', colour: '#c0392b', motion: 'lobbed', shape: 'ball',
      beep: { hz: 494, wave: 'sine' }, whoosh: { hz: 700, hzTo: 2200 }, tell: { hz: 466, hzTo: 932 },
      say: 'Orbs.', caption: 'Orbs next', haptic: [70, 50, 70, 50, 70, 50, 70],
    }),
    kind({
      id: 'coffin', name: 'coffin', label: 'rolling coffin', plural: 'rolling coffins', colour: '#6b4a2f', motion: 'rolled', shape: 'coffin',
      beep: { hz: 370, wave: 'square' }, whoosh: { hz: 65, hzTo: 40 }, tell: { hz: 116, hzTo: 77 },
      say: 'Coffins.', caption: 'Coffins next', haptic: [380, 100, 380],
    }),
    kind({
      id: 'bat', name: 'bat', label: 'bat', plural: 'bats', colour: '#d44a3a', motion: 'swooped', shape: 'bat',
      beep: { hz: 659, wave: 'triangle' }, whoosh: { hz: 900, hzTo: 400 }, tell: { hz: 1245, hzTo: 831 },
      say: 'Bats.', caption: 'Bats next', haptic: [12, 18, 12, 18, 12, 18, 12, 18, 12, 18, 160],
    }),
  ],
  volleys: ['orb', 'coffin', 'bat', 'bat', 'coffin', 'orb', 'bat', 'coffin', 'bat'],
  volleyBars: [4, 4, 4, 5, 4, 4, 5, 5, 6],
  bars: 4,
  noun: 'throw',
};
