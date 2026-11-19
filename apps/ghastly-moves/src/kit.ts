import { createKit, type Kit, type Lesson } from '@marrow/skeleton';
import { timesTable } from './lessons';
import { GHASTLY_CHARACTERS } from './voices';
import { useObject } from '@marrow/skeleton/catalogue';
import { OBJECTS } from './objects/index.generated';
import { defineGate, defineSpike } from './objects/moves';
import { defineProjectile, defineThrow } from './objects/projectile';
import { patternByEar, patternEvents, patternSong, tellsClearOfCountdowns } from './pattern';
import { defineStone } from './objects/stone';
import { bossLesson, bossTrackOf, type Stage } from './stages';

export interface GhastlyKitOptions {
  /** Build the boss fight of a stage: the boss throws, harder numbers, the boss's own track. */
  boss?: boolean;
}

/**
 * Everything this game chooses, in one place. Anything left out uses the kit's
 * defaults (timing, wording, sounds, scoring, starting settings).
 *
 * Give it a table number for free practice, or a stage for the story (with `boss: true`
 * for the fight at the end of it).
 */
export function createGhastlyKit(what: number | Stage | Lesson, options: GhastlyKitOptions = {}): Kit {
  const stage = typeof what === 'object' && 'boss' in what ? what : undefined;
  const boss = stage && options.boss ? stage.boss : undefined;
  const lesson: Lesson =
    typeof what === 'number' ? timesTable(what) : stage ? (boss ? bossLesson(stage) : stage.lesson) : (what as Lesson);
  const track = stage ? (boss ? bossTrackOf(stage) : stage.track) : null;
  // A stage is a song: the level follows its parts, its portals and its tempo. A boss fight is jumps only.
  // A boss with a pattern is a song too: tells and volleys in a fixed order, every press on the beat.
  const pattern = boss?.pattern;
  const song = stage && !boss ? stage.song : pattern && stage ? patternSong(pattern, stage.song.beat, stage.boss.name) : undefined;
  const kit = createKit({
    lesson,
    // The coach says what is coming before each countdown, for players who want more warning. Off until the player picks a lead.
    coach: true,
    // Instant retry: back in play within a second of a fall. The sum behind a mistake is told the first
    // time at each obstacle; later falls there say the short reason and the attempt.
    run: { fallPause: 0.4, restartLead: 0.8, explainOnce: true },
    strings: { fallEarly: 'Early.', fallLate: 'Late.', fallNone: 'Missed.', fallWrong: 'Wrong number.' },
    characters: GHASTLY_CHARACTERS,
    ...(song ? { song: song.song, timing: { beat: song.beat } } : {}),
    ...(pattern ? { properties: [patternByEar(pattern), tellsClearOfCountdowns(pattern)] } : {}),
    ...(track ? { audio: { keyHz: track.rootHz, track } } : {}),
    events: {
      ...(pattern ? patternEvents(pattern) : {}),
      // Beating your best: a rising chime, a caption and two words. It plays once an attempt.
      'new-best': {
        say: 'New best.',
        caption: 'New best: {percent}%',
        sound: { hz: 784, wave: 'sine', gain: 0.7, role: 'reward', shape: { hzTo: 1175, seconds: 0.45 } },
        haptic: [40, 40, 80],
      },
      // The numbers at a fall, for the live region and the caption. Not spoken: the reason is.
      'run-stats': {
        say: 'Attempt {attempt}. {percent} percent. Best {best} percent.',
        caption: 'Attempt {attempt}: {percent}%. Best {best}%',
        priority: 'information',
      },
      intro: {
        say: 'Ghastly Moves. {prompt}',
        caption: '{prompt}',
      },
      summary: {
        say: 'Rank {rank}. {score} points. {right} of {total} right. Press any key to play again.',
        caption: 'Rank {rank}: {score} points',
      },
      menu: {
        say: 'Ghastly Moves. Press any key to start. Escape comes back here.',
        caption: 'Press any key to start',
      },
      'story-menu': {
        say: 'Ghastly Moves. {where} Press any key to go. Escape comes back here.',
        caption: '{where} Press any key to go.',
      },
      'story-card': {
        say: '{story} Today: {rule}. Press any key to begin.',
        caption: '{rule}. Press any key to begin.',
      },
      'stage-clear': {
        say: '{place} done. {right} of {total} right. Rank {rank}.',
        // The boss taunts in its own voice, then the narrator says what to do. No countdown is running.
        also: [
          { say: '{taunt}', speaker: '{boss}', caption: '{taunt}' },
          { say: 'Press any key to fight {boss}.' },
        ],
        caption: '{place} done: rank {rank}. Next: {boss}',
        sound: { hz: 659, wave: 'sine', gain: 0.6, role: 'reward', shape: { hzTo: 880, seconds: 0.6 } },
        haptic: [60, 50, 60],
      },
      'boss-intro': {
        say: '{boss}! {prompt} Hit {need} times to win.',
        caption: '{boss}: hit {need} times',
        sound: { hz: 110, wave: 'square', gain: 0.7, role: 'effect', shape: { hzTo: 65, filterHz: 600, seconds: 0.9 } },
        haptic: [200, 80, 200],
      },
      // The boss winds up and throws, a moment before the countdown, so the whoosh never sits on a beep.
      'boss-throw': {
        sound: { hz: 0, wave: 'sine', gain: 0.45, role: 'effect', shape: { noise: true, filterHz: 400, filterTo: 2600, seconds: 0.26 } },
        haptic: [25],
      },
      // A right move hurts the boss: a short, low groan that drops further as the boss weakens.
      'boss-hurt': {
        caption: '{boss} hit! {left} to go',
        sound: { hz: 120, wave: 'square', gain: 0.5, role: 'effect', shape: { hzTo: 70, filterHz: 900, seconds: 0.2 } },
        haptic: [50, 30, 50],
      },
      // A mistake: the boss laughs. The reason and the lesson still come in words.
      'boss-laugh': {
        sound: { hz: 196, wave: 'triangle', gain: 0.5, role: 'effect', shape: { hzTo: 330, filterHz: 1600, seconds: 0.6 } },
        haptic: [80, 40, 80, 40, 80],
      },
      'boss-won': {
        say: 'You beat {boss}! You win the {item}. {blurb} Press any key to go on.',
        caption: 'You beat {boss}! You won the {item}',
        sound: { hz: 523, wave: 'sine', gain: 0.8, role: 'reward', shape: { hzTo: 1047, seconds: 1.2 } },
        haptic: [60, 60, 60, 60, 240],
      },
      'boss-lost': {
        say: '{boss} laughs. You hit {hits} times. You need {need}. You can do it. Press any key to try again.',
        caption: '{hits} hits. Need {need}. Try again',
        sound: { hz: 150, wave: 'triangle', gain: 0.5, role: 'effect', shape: { hzTo: 80, seconds: 0.5 } },
        haptic: [120],
      },
    },
  });
  if (pattern) for (const t of pattern.throws) defineThrow(kit, t);
  else if (boss) defineProjectile(kit, boss.projectile);
  else defineStone(kit);
  // Spikes and gates only where the song has flips and gates, so they never turn up in a jump part.
  const kinds = new Set(song?.song.sections.flatMap((s) => s.kinds ?? []) ?? []);
  if (kinds.has('spike')) defineSpike(kit);
  if (kinds.has('gate')) defineGate(kit);
  // Objects added as files in src/objects/ are wired in by the Kiro hook. They join the jump parts.
  // Defined last, so the built-in objects keep their own sounds.
  if (!boss) for (const o of OBJECTS) useObject(kit, o);
  return kit;
}
