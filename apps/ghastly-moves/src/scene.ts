import { moveAt, sectionAt, sideBefore, themeFor, type Kit, type Level, type Move, type Obstacle, type Profile, type RunSnapshot } from '@marrow/skeleton';
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

/** Far scenery, drawn faint and still behind everything, so it adds a place without costing contrast. */
function drawScenery(ctx: CanvasRenderingContext2D, kind: Scenery, colour: string, accent: string): void {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 28; i++) ctx.fillRect(((i * 197) % 880) + 40, ((i * 83) % 190) + 70, 2, 2);
  ctx.globalAlpha = 0.18;
  if (kind === 'woods' || kind === 'hollow') {
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 110 + (i % 2) * 20;
      const h = kind === 'hollow' ? 150 : 110 + (i % 3) * 30;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      ctx.lineTo(x + 38, GROUND_Y - h);
      ctx.lineTo(x + 76, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === 'gate') {
    ctx.fillStyle = colour;
    ctx.fillRect(330, GROUND_Y - 190, 26, 190);
    ctx.fillRect(604, GROUND_Y - 190, 26, 190);
    ctx.beginPath();
    ctx.arc(480, GROUND_Y - 190, 150, Math.PI, 0);
    ctx.lineWidth = 14;
    ctx.strokeStyle = colour;
    ctx.stroke();
    for (let x = 366; x < 604; x += 28) ctx.fillRect(x, GROUND_Y - 190, 4, 190);
  } else if (kind === 'patch') {
    ctx.fillStyle = accent;
    for (let i = 0; i < 12; i++) {
      const x = 60 + i * 78 + (i % 3) * 14;
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y - 14 - (i % 2) * 6, 24, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'mill') {
    ctx.fillStyle = colour;
    ctx.fillRect(700, GROUND_Y - 200, 90, 200);
    ctx.beginPath();
    ctx.moveTo(690, GROUND_Y - 200);
    ctx.lineTo(745, GROUND_Y - 260);
    ctx.lineTo(800, GROUND_Y - 200);
    ctx.fill();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(745, GROUND_Y - 150);
    ctx.lineTo(745, GROUND_Y - 280);
    ctx.moveTo(680, GROUND_Y - 215);
    ctx.lineTo(810, GROUND_Y - 215);
    ctx.stroke();
  } else if (kind === 'mist' || kind === 'midnight') {
    ctx.fillStyle = accent;
    for (let i = 0; i < 4; i++) ctx.fillRect(0, GROUND_Y - 30 - i * 34, WIDTH, 16);
  }
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, kit: Kit, profile: Profile, scene: SceneState): void {
  const theme = themeFor(profile.theme, profile.palette);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Moon, scenery and ground.
  drawScenery(ctx, scene.scenery ?? 'moon', theme.mutedText, theme.line);
  ctx.fillStyle = theme.mutedText;
  ctx.beginPath();
  ctx.arc(820, 90, scene.scenery === 'midnight' ? 52 : 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.panel;
  ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(WIDTH, GROUND_Y);
  ctx.stroke();

  const t = scene.snapshot?.t ?? 0;
  const half = kit.timing.halfWidth * PX_PER_SEC;
  const streak = scene.snapshot?.streak ?? 0;

  const boss = scene.boss;
  if (boss) {
    drawBoss(ctx, boss.look, BOSS_X, GROUND_Y, {
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

  if (level) {
    for (const o of level.obstacles) {
      const x = GHOST_X + (o.start - t) * PX_PER_SEC;
      const w = o.width * PX_PER_SEC;
      if (x > WIDTH + 20 || x + w < -20) continue;
      if ((o.move ?? 'jump') !== 'jump') {
        drawMoveObstacle(ctx, kit, level, o, x, w, GHOST_X - half, theme.line);
        continue;
      }
      // In a boss fight, a throw is in the boss's hand until it is let go, then arcs down to the ground.
      if (boss && x > RELEASE_X) continue;
      const progress = boss ? Math.min(1, Math.max(0, (RELEASE_X - x) / (RELEASE_X - (GHOST_X + 60)))) : 1;
      const lift = boss ? (1 - progress) ** 2 * 150 : 0;
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

  // The lantern grows and glows with the streak: a tune you build is a light you build.
  const glow = 9 + Math.min(streak, 10) * 2.2;
  if (streak > 0) {
    ctx.globalAlpha = 0.12 + Math.min(streak, 10) * 0.025;
    ctx.fillStyle = theme.amber;
    ctx.beginPath();
    ctx.arc(GHOST_X + 30, gy + 8, glow * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  if (pose.upsideDown) {
    // On the ceiling the ghost hangs upside down: the picture matches the flip you heard.
    ctx.translate(0, gy * 2);
    ctx.scale(1, -1);
  }
  ctx.globalAlpha = scene.falling ? 0.45 : 1;
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath();
  ctx.ellipse(GHOST_X, gy, Math.max(half, 16), 34, 0, Math.PI, 0);
  ctx.lineTo(GHOST_X + Math.max(half, 16), gy + 28);
  ctx.lineTo(GHOST_X + 8, gy + 20);
  ctx.lineTo(GHOST_X, gy + 28);
  ctx.lineTo(GHOST_X - 8, gy + 20);
  ctx.lineTo(GHOST_X - Math.max(half, 16), gy + 28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#14101f';
  ctx.fillRect(GHOST_X - 8, gy - 12, 5, 8);
  ctx.fillRect(GHOST_X + 4, gy - 12, 5, 8);
  ctx.fillStyle = theme.amber;
  ctx.beginPath();
  ctx.arc(GHOST_X + 30, gy + 8, 9 + Math.min(streak, 10) * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // In a song: the move and the part in words, and the beat as four dots, the one now filled. The edge
  // glows on the first beat of each bar (once a bar, never a flicker); with reduced motion only the dots show it.
  if (level?.sections) {
    drawBeat(ctx, t, kit.timing.beat, profile.reducedMotion, theme.line, theme.amber);
    const part = sectionAt(level, t);
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `${Math.round(18 * Math.min(profile.textScale, 1.4))}px ${FONT}`;
    ctx.fillText(`${MOVE_WORDS[moveNow]}${part ? `. ${part.name}` : ''}`, WIDTH / 2, 50);
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
