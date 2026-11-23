import { moveAt, pulseAt, sectionAt, sideBefore, themeFor, type Kit, type Level, type Move, type Obstacle, type Profile, type RunSnapshot } from '@marrow/skeleton';
import { drawGhost, drawGround, drawLayers, drawObstacleGlow, drawObstacleHalo, drawPortalGate, drawSky, type ArtState } from './art';
import { drawMound, drawPatchFront, MOUND_HEIGHT } from './patch';
import { throwByName, type BossPattern } from './pattern';
import { drawBoss, drawHealth } from './boss';
import { drawItem } from './map';
import type { BossLook, Scenery } from './stages';

// Everything here is original art drawn with canvas shapes.

export const WIDTH = 960;
export const HEIGHT = 540;
/** Pixels per running second of level time. */
const PX_PER_SEC = 220;
const GHOST_X = 180;
const GROUND_Y = 400;
const JUMP_HEIGHT = 120;
/** Flip mode: the ceiling you run on, upside down. */
const CEIL_Y = 128;
/** Gate mode: the upper lane's floor. */
const UP_Y = GROUND_Y - 150;
const MOVE_WORDS: Record<Move, string> = { jump: 'Jump mode', flip: 'Flip mode', switch: 'Gate mode' };
const FONT = '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';

export interface SceneState {
  snapshot: RunSnapshot | null;
  level: Level | null;
  /** Real clock, ms. */
  nowMs: number;
  falling: boolean;
  /** What the lesson is, for the top of the screen. */
  title: string;
  /** The look of the place. Scenery is still: it never moves or flashes. */
  scenery?: Scenery;
  /** The last judgement, shown as a word above the ghost for a moment. */
  popup?: { text: string; at: number } | null;
  /** A line under the score: the boss fight's count, for example. */
  hud?: string;
  /** Ids of items won, drawn small in the corner. */
  items?: readonly string[];
  /** The boss fight, when there is one. Times are real-clock ms. */
  boss?: BossState | null;
  /** The boss's pattern, to know how each kind of throw moves. */
  pattern?: BossPattern | undefined;
  /** How the run is going, in numbers, so progress is read and not only felt. */
  stats?: { percent: number; attempt: number; best: number } | null;
}

export interface BossState {
  look: BossLook;
  name: string;
  health: number;
  max: number;
  throwAt: number;
  hurtAt: number;
  laughAt: number;
}

/** Where the boss stands, and where a throw leaves the hand: in step with the throw's whoosh. */
const BOSS_X = 700;
const RELEASE_X = 580;
const freshness = (now: number, at: number, ms: number): number => Math.max(0, 1 - (now - at) / ms);

const POPUP_MS = 900;

export function drawScene(ctx: CanvasRenderingContext2D, kit: Kit, profile: Profile, scene: SceneState): void {
  const theme = themeFor(profile.theme, profile.palette);
  const t = scene.snapshot?.t ?? 0;
  // The picture breathes with the song: one soft swell a beat, none when motion is reduced, and none
  // in a level that has no song to keep time with.
  const pulse = scene.level?.sections ? pulseAt(t, kit.timing.beat, profile.reducedMotion) : 0;
  const art: ArtState = {
    scenery: scene.scenery ?? 'moon',
    t,
    pxPerSec: PX_PER_SEC,
    nowMs: scene.nowMs,
    reducedMotion: profile.reducedMotion,
    pulse,
    flat: profile.theme === 'high-contrast',
    background: theme.background,
    groundY: GROUND_Y,
    arena: scene.boss?.look === 'pumpkin',
  };
  // Sky, moon, three layers of scenery, and the ground. All of it is dim behind the obstacles.
  drawSky(ctx, art);
  drawLayers(ctx, art);
  drawGround(ctx, art, { panel: theme.panel, line: theme.line });

  const half = kit.timing.halfWidth * PX_PER_SEC;
  const streak = scene.snapshot?.streak ?? 0;

  const boss = scene.boss;
  if (boss) {
    // The tell and the throw tell the Pumpkin King what to do with his arms: the part of the song says which kind is coming.
    const part = scene.level ? sectionAt(scene.level, t) : undefined;
    const kindOf = (id: string) => scene.pattern?.throws.find((k) => k.id === id)?.motion;
    const tellMotion = part?.name.startsWith('Tell ') ? kindOf(part.name.slice(5)) : undefined;
    const volleyMotion = part?.name.startsWith('Volley ') ? kindOf(part.name.slice(7)) : undefined;
    const raised = boss.look === 'pumpkin';
    if (raised) drawMound(ctx, BOSS_X, GROUND_Y);
    drawBoss(ctx, boss.look, BOSS_X, raised ? GROUND_Y - MOUND_HEIGHT : GROUND_Y, {
      ...(tellMotion && part ? { windup: { motion: tellMotion, u: Math.min(1, Math.max(0, (t - part.from) / Math.max(1e-6, part.to - part.from))) } } : {}),
      ...(volleyMotion ? { throwMotion: volleyMotion } : {}),
      ...(boss.health === 0 ? { down: Math.min(1, Math.max(0, (scene.nowMs - boss.hurtAt - 250) / 2000)) } : {}),
      throwing: scene.nowMs - boss.throwAt < 350 ? (scene.nowMs - boss.throwAt) / 350 : 0,
      hurt: freshness(scene.nowMs, boss.hurtAt, 450),
      laughing: freshness(scene.nowMs, boss.laughAt, 900),
      health: boss.max === 0 ? 0 : boss.health / boss.max,
      reducedMotion: profile.reducedMotion,
      nowMs: scene.nowMs,
    });
    drawHealth(
      ctx,
      `${boss.name}: ${boss.health} ${boss.health === 1 ? 'hit' : 'hits'} to go`,
      boss.max === 0 ? 0 : boss.health / boss.max,
      WIDTH / 2 - 220,
      58,
      440,
      { text: theme.text, panel: theme.panel, line: theme.line, fill: '#7a2b3f' },
      `bold ${Math.round(18 * Math.min(profile.textScale, 1.4))}px ${FONT}`,
    );
  }

  // The move in force: a ceiling to run on in flip mode, a second lane in gate mode.
  const level = scene.level;
  const moveNow: Move = level ? moveAt(level, t) : 'jump';
  if (level && (moveNow === 'flip' || moveNow === 'switch')) {
    if (moveNow === 'flip') {
      ctx.fillStyle = theme.panel;
      ctx.fillRect(0, CEIL_Y - 24, WIDTH, 24);
    }
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const y = moveNow === 'flip' ? CEIL_Y : UP_Y;
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // A portal gate stands on the way where a part of the song changes the move: it arrives with the
  // portal, and names the new mode in words, so the change is seen as well as heard and said.
  for (const p of level?.portals ?? []) {
    const x = GHOST_X + (p.at - t) * PX_PER_SEC;
    if (x > WIDTH + 100 || x < -100) continue;
    drawPortalGate(ctx, { x, groundY: GROUND_Y, move: p.move, label: MOVE_WORDS[p.move], text: theme.text, panel: theme.panel, line: theme.line, accent: theme.amber, font: `bold ${Math.round(18 * Math.min(profile.textScale, 1.4))}px ${FONT}` });
  }

  if (level) {
    for (const o of level.obstacles) {
      const x = GHOST_X + (o.start - t) * PX_PER_SEC;
      const w = o.width * PX_PER_SEC;
      if (x > WIDTH + 20 || x + w < -20) continue;
      // Every obstacle swells softly on the beat, the same for a target and a dud.
      // A soft dark halo, so a stone is the clearest thing on screen however busy the scenery behind it is.
      if (!art.flat) drawObstacleHalo(ctx, x + w / 2, GROUND_Y - 40, w / 2 + 52, 78);
      if (pulse > 0) drawObstacleGlow(ctx, art, x + w / 2, GROUND_Y - 50, 54);
      if ((o.move ?? 'jump') !== 'jump') {
        drawMoveObstacle(ctx, kit, level, o, x, w, GHOST_X - half, theme.line);
        continue;
      }
      // In a boss fight, a throw is in the boss's hand until it is let go, then arcs down to the ground.
      if (boss && x > RELEASE_X) continue;
      const progress = boss ? Math.min(1, Math.max(0, (RELEASE_X - x) / (RELEASE_X - (GHOST_X + 60)))) : 1;
      // A lobbed throw arcs down, a swooped one flies in on a slant, a rolled one stays on the ground.
      const motion = scene.pattern ? throwByName(scene.pattern, o.kind)?.motion : undefined;
      const lift = !boss || motion === 'rolled' ? 0 : motion === 'swooped' ? (1 - progress) * 130 : (1 - progress) ** 2 * 150;
      const height = 74;
      const box = { x, y: GROUND_Y - height - lift, width: w, height, ...(o.value !== undefined ? { value: o.value } : {}) };
      // A stone you were right to let pass fades once you are through it. Never before:
      // the picture must not give away the answer.
      const throughIt = o.solid === false && x + w < GHOST_X - half;
      ctx.globalAlpha = throughIt ? 0.3 : 1;
      const def = kit.registry.get(o.kind);
      if (def?.draw) def.draw(ctx, box);
      else placeholder(ctx, box, o.kind, theme.line);
      ctx.globalAlpha = 1;
    }
  }

  // The ghost, with its lantern. Bobbing is skipped when motion is reduced.
  const pose = ghostPose(kit, level, scene.snapshot, t);
  const lift = pose.hop * JUMP_HEIGHT * (pose.upsideDown ? -1 : 1);
  const bob = profile.reducedMotion || lift !== 0 || pose.moving ? 0 : Math.sin(scene.nowMs / 220) * 3;
  const gy = pose.y - lift + bob;

  ctx.save();
  if (pose.upsideDown) {
    // On the ceiling the ghost hangs upside down: the picture matches the flip you heard.
    ctx.translate(0, gy * 2);
    ctx.scale(1, -1);
  }
  drawGhost(ctx, { x: GHOST_X, y: gy, halfWidth: half, nowMs: scene.nowMs, reducedMotion: profile.reducedMotion, faded: scene.falling, streak, pulse, lantern: theme.amber, line: theme.text, ...(pose.upsideDown ? {} : { groundY: GROUND_Y }) });
  ctx.restore();
  // The foreground silhouettes pass in front, at the edges, and the vignette closes the corners.
  if (art.scenery === 'patch') drawPatchFront(ctx, art);

  // In a song: the move and the part in words, and the beat as four dots, the one now filled. The edge
  // glows on the first beat of each bar (once a bar, never a flicker); with reduced motion only the dots show it.
  if (level?.sections) {
    drawBeat(ctx, t, kit.timing.beat, profile.reducedMotion, theme.line, theme.amber);
    const part = sectionAt(level, t);
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `${Math.round(18 * Math.min(profile.textScale, 1.4))}px ${FONT}`;
    // In a boss fight the health bar sits here, and the part names ("Tell lob") are for the code, not the
    // player: the tell's own caption says what is coming.
    if (!boss) ctx.fillText(`${MOVE_WORDS[moveNow]}${part ? `. ${part.name}` : ''}`, WIDTH / 2, 50);
  }

  // The judgement as a word above the ghost. With reduced motion it stays still, then goes.
  if (scene.popup && scene.nowMs - scene.popup.at < POPUP_MS) {
    const age = (scene.nowMs - scene.popup.at) / POPUP_MS;
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(30 * Math.min(profile.textScale, 1.5))}px ${FONT}`;
    ctx.fillText(scene.popup.text, GHOST_X + 10, gy - 70 - (profile.reducedMotion ? 0 : age * 24));
    ctx.textBaseline = 'top';
  }

  // The score and the lesson, in words, so nothing here is only a picture.
  ctx.fillStyle = theme.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${Math.round(24 * Math.min(profile.textScale, 1.5))}px ${FONT}`;
  ctx.fillText(`Score ${scene.snapshot?.score ?? 0}`, 24, 20);
  ctx.fillStyle = theme.mutedText;
  ctx.font = `${Math.round(20 * Math.min(profile.textScale, 1.5))}px ${FONT}`;
  ctx.fillText(`Streak ${streak}`, 24, 52);
  ctx.textAlign = 'center';
  ctx.fillText(scene.title, WIDTH / 2, 20);
  if (scene.hud) {
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.text;
    ctx.fillText(scene.hud, 24, 80);
  }
  if (scene.stats) {
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.text;
    ctx.font = `bold ${Math.round(20 * Math.min(profile.textScale, 1.5))}px ${FONT}`;
    ctx.fillText(`Progress ${scene.stats.percent}%`, WIDTH - 24, 70);
    ctx.fillStyle = theme.mutedText;
    ctx.fillText(`Attempt ${scene.stats.attempt}   Best ${scene.stats.best}%`, WIDTH - 24, 96);
  }
  (scene.items ?? []).forEach((id, i) => drawItem(ctx, id, WIDTH - 36 - i * 44, 36, 15, '#14101f'));
}

function placeholder(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  label: string,
  colour: string,
): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  ctx.fillStyle = colour;
  ctx.font = '12px sans-serif';
  ctx.fillText(label, box.x, box.y - 4);
}

// ---- moves: flips and lanes ----------------------------------------------------

/** Where the ghost's middle sits on a side, for the move in force. */
const sideY = (side: 'up' | 'down', move: Move): number =>
  side === 'down' ? GROUND_Y - 34 : move === 'flip' ? CEIL_Y + 34 : UP_Y - 34;

interface Pose {
  y: number;
  /** 0 to 1: how high a jump has lifted the ghost (away from the floor or ceiling it runs on). */
  hop: number;
  upsideDown: boolean;
  /** Mid-flip or mid-switch. */
  moving: boolean;
}

/**
 * Where the ghost is: on the floor, the ceiling or the upper lane, hopping, or on its way between
 * sides. Worked out from the level and the run alone, so it always matches what was heard.
 */
function ghostPose(kit: Kit, level: Level | null, snap: RunSnapshot | null, t: number): Pose {
  const flat: Pose = { y: GROUND_Y - 34, hop: 0, upsideDown: false, moving: false };
  if (!level || !snap) {
    const at = snap?.lastJumpAt ?? null;
    if (at === null) return flat;
    const u = (t - at) / kit.timing.airtime;
    return { ...flat, hop: u >= 0 && u <= 1 ? 4 * u * (1 - u) : 0 };
  }
  const index = snap.obstacle;
  const jumpedIndex = snap.jumpedAt !== null ? index : index - 1;
  const jumped: Obstacle | undefined = level.obstacles[jumpedIndex];
  const at = snap.lastJumpAt;
  const u = at === null ? -1 : (t - at) / kit.timing.airtime;
  const airborne = u >= 0 && u <= 1;
  const jumpedMove: Move = jumped?.move ?? 'jump';

  if (airborne && jumped && jumpedMove !== 'jump') {
    // On the way to the other side: a smooth glide, turning over halfway through a flip.
    const from = sideBefore(level, jumpedIndex);
    const to = from === 'up' ? 'down' : 'up';
    const e = u * u * (3 - 2 * u);
    const y = sideY(from, jumpedMove) + (sideY(to, jumpedMove) - sideY(from, jumpedMove)) * e;
    return { y, hop: 0, upsideDown: jumpedMove === 'flip' && (to === 'up' ? u > 0.5 : u < 0.5), moving: true };
  }
  const move: Move = level.obstacles[index]?.move ?? moveAt(level, t);
  const side = sideBefore(level, index);
  return {
    y: sideY(side, move),
    hop: airborne && jumpedMove === 'jump' ? 4 * u * (1 - u) : 0,
    upsideDown: move === 'flip' && side === 'up',
    moving: false,
  };
}

/**
 * A spike or a gate. A spike is on the side the ghost will be on when it gets there, so a flip clears
 * it. A gate is two arches, one per lane: the number in your lane, and the one a press switches you to.
 * Nothing in the picture says which is right.
 */
function drawMoveObstacle(
  ctx: CanvasRenderingContext2D,
  kit: Kit,
  level: Level,
  o: Obstacle,
  x: number,
  w: number,
  ghostBack: number,
  line: string,
): void {
  const def = kit.registry.get(o.kind);
  const side = sideBefore(level, o.index);
  const throughIt = o.solid === false && x + w < ghostBack;
  ctx.globalAlpha = throughIt ? 0.3 : 1;
  if (o.move === 'flip') {
    const height = 74;
    const y = side === 'down' ? GROUND_Y - height : CEIL_Y;
    const box = { x, y, width: w, height, ...(o.value !== undefined ? { value: o.value } : {}) };
    if (def?.draw) def.draw(ctx, box);
    else placeholder(ctx, box, o.kind, line);
  } else {
    const height = 96;
    const lanes: { floor: number; value: number | undefined }[] = [
      { floor: side === 'down' ? GROUND_Y : UP_Y, value: o.gate?.here },
      { floor: side === 'down' ? UP_Y : GROUND_Y, value: o.value },
    ];
    for (const lane of lanes) {
      const box = { x, y: lane.floor - height, width: w, height, ...(lane.value !== undefined ? { value: lane.value } : {}) };
      if (def?.draw) def.draw(ctx, box);
      else placeholder(ctx, box, o.kind, line);
    }
  }
  ctx.globalAlpha = 1;
}

/** Four beat dots under the title, and a glow round the edge on each bar's first beat. */
function drawBeat(ctx: CanvasRenderingContext2D, t: number, beat: number, reducedMotion: boolean, line: string, lit: string): void {
  const n = Math.floor(t / beat + 1e-6);
  const now = ((n % 4) + 4) % 4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(WIDTH / 2 - 36 + i * 24, 88, i === now ? 8 : 6, 0, Math.PI * 2);
    if (i === now) {
      ctx.fillStyle = lit;
      ctx.fill();
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (reducedMotion || now !== 0) return;
  const into = t / beat - n; // 0 at the beat, 1 at the next
  const glow = Math.max(0, 1 - into * 2.5);
  if (glow <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.5 * glow;
  ctx.strokeStyle = lit;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, WIDTH - 10, HEIGHT - 10);
  ctx.restore();
}
