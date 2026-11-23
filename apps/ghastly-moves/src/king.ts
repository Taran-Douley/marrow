import { blit, clamp01, ease, hash, lerp, radial, withAlpha, linear, type Ctx } from './gfx';
import type { BossPose } from './boss';

// The Pumpkin King, drawn in code. See "The Pumpkin King" in .kiro/specs/ghastly-rhythm-v2/design.md.
//
//   Silhouette  a tall triangle of cloak, a round glowing head, a sharp crown. About 330 px tall.
//   Palette     near-black cloak, moss and rust mids, ember orange as the only saturated colour,
//               and a thin cool-blue rim light from the moon.
//   Poses       idle, lob wind-up, roll wind-up, throw, hurt, laugh, defeated. The wind-ups are
//               chosen by the kind of throw the song is about to play, so the picture matches the tell.
//
// The cloak and the head shell are painted once and blitted; the arms, the glow, the cracks, the seeds
// and the falling leaves are drawn each frame. With reduced motion the poses still change, but nothing
// sways, bobs, flickers or drifts.

const KING_SCALE = 0.76;
const MOSS = '#34401f';
const MOSS_DARK = '#1d2614';
const RUST = '#5e3217';
const EMBER = '#ff8a1f';
const EMBER_HOT = '#ffd36b';
const RIM = '#7f94d8';

type Pt = readonly [number, number];

interface ArmPose {
  /** Elbow and hand, relative to the feet. */
  elbow: Pt;
  hand: Pt;
}

interface BodyPose {
  left: ArmPose;
  right: ArmPose;
  /** How far the body sinks, in px. */
  crouch: number;
  /** Head tilt in radians: negative looks up. */
  tilt: number;
}

const IDLE: BodyPose = {
  left: { elbow: [-92, -168], hand: [-118, -128] },
  right: { elbow: [74, -150], hand: [84, -92] },
  crouch: 0,
  tilt: 0,
};
/** A lob: both arms up over the head, the head tipped back. Matches the rising tell. */
const LOB: BodyPose = {
  left: { elbow: [-86, -268], hand: [-46, -352] },
  right: { elbow: [86, -268], hand: [50, -352] },
  crouch: 0,
  tilt: -0.28,
};
/** A roll: a crouch, the front arm swept low and back. Matches the rumbling tell. */
const ROLL: BodyPose = {
  left: { elbow: [-104, -96], hand: [-60, -22] },
  right: { elbow: [88, -130], hand: [108, -80] },
  crouch: 30,
  tilt: 0.16,
};
/** A swoop: one arm flung high and out, the other back. */
const SWOOP: BodyPose = {
  left: { elbow: [-120, -230], hand: [-180, -320] },
  right: { elbow: [100, -160], hand: [150, -120] },
  crouch: 6,
  tilt: -0.18,
};
/** The moment of release: the front arm out and forward. */
const THROW: BodyPose = {
  left: { elbow: [-130, -196], hand: [-196, -176] },
  right: { elbow: [70, -170], hand: [64, -120] },
  crouch: 10,
  tilt: 0.1,
};

const mix = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const mixArm = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({ elbow: mix(a.elbow, b.elbow, t), hand: mix(a.hand, b.hand, t) });
const mixBody = (a: BodyPose, b: BodyPose, t: number): BodyPose => ({
  left: mixArm(a.left, b.left, t),
  right: mixArm(a.right, b.right, t),
  crouch: lerp(a.crouch, b.crouch, t),
  tilt: lerp(a.tilt, b.tilt, t),
});

const WINDUP: Record<'lobbed' | 'rolled' | 'swooped', BodyPose> = { lobbed: LOB, rolled: ROLL, swooped: SWOOP };

/** The pose for the moment: a wind-up before the throw, the release, then back to rest. */
export function bodyPose(pose: BossPose): BodyPose {
  const wind = WINDUP[pose.throwMotion ?? pose.windup?.motion ?? 'lobbed'];
  if (pose.throwing > 0) {
    // 0 to 0.35 snaps from the wind-up to the release, then eases home.
    const t = clamp01(pose.throwing);
    return t < 0.35 ? mixBody(wind, THROW, ease(t / 0.35)) : mixBody(THROW, IDLE, ease((t - 0.35) / 0.65));
  }
  if (pose.windup) return mixBody(IDLE, wind, ease(pose.windup.u));
  return IDLE;
}

// ---- the cached shells --------------------------------------------------------------------

const CLOAK_W = 440;
const CLOAK_H = 360;
const CLOAK_OX = 220;
const CLOAK_OY = 350;

function leaf(c: Ctx, x: number, y: number, length: number, angle: number, colour: string, rim: boolean): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = colour;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(10, length * 0.45, 1, length);
  c.quadraticCurveTo(-10, length * 0.45, 0, 0);
  c.fill();
  c.strokeStyle = 'rgba(8, 7, 14, 0.5)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, 2);
  c.lineTo(0.5, length * 0.9);
  c.stroke();
  if (rim) {
    c.strokeStyle = withAlpha(RIM, 0.65);
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(1, 1);
    c.quadraticCurveTo(10.5, length * 0.45, 1.5, length - 1);
    c.stroke();
  }
  c.restore();
}

function paintCloak(c: Ctx): void {
  c.save();
  c.translate(CLOAK_OX, CLOAK_OY);
  // The base: a tall triangle with a hem that sweeps the ground, longer on the left.
  const path = (): void => {
    c.beginPath();
    c.moveTo(-40, -214);
    c.bezierCurveTo(-60, -150, -112, -76, -196, -2);
    c.lineTo(-120, 8);
    c.lineTo(-20, 4);
    c.lineTo(70, 8);
    c.lineTo(156, 0);
    c.bezierCurveTo(112, -76, 62, -150, 40, -214);
    c.closePath();
  };
  c.fillStyle = linear(c, 0, -214, 0, 0, [
    { at: 0, colour: '#07060d' },
    { at: 1, colour: '#15101e' },
  ]);
  path();
  c.fill();
  // Layers of dead leaves, row by row from the shoulders to the hem: moss, rust and shadow.
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const y = -196 + r * 34;
    const half = lerp(44, 150, (y + 214) / 214) + (r === rows - 1 ? 30 : 0);
    const n = Math.round((half * 2) / 19);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = -half * 1.05 + u * half * 2.0 - (r === rows - 1 ? 30 : 0);
      const pick = hash(r * 31 + i, 80);
      const colour = pick < 0.34 ? MOSS : pick < 0.62 ? RUST : pick < 0.82 ? MOSS_DARK : '#120f1b';
      const length = 36 + hash(r * 17 + i, 81) * 18 + (r === rows - 1 ? 14 : 0);
      leaf(c, x, y, length, (u - 0.5) * 0.6 + (hash(i, 82 + r) - 0.5) * 0.25, colour, u > 0.62 && pick < 0.82);
    }
  }
  // The right edge of the cloak catches the moon.
  c.strokeStyle = withAlpha(RIM, 0.5);
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(41, -214);
  c.bezierCurveTo(63, -150, 113, -76, 157, -1);
  c.stroke();
  c.restore();
}

const HEAD_W = 320;
const HEAD_H = 300;
const HEAD_OX = 160;
const HEAD_OY = 200;

function paintHead(c: Ctx): void {
  c.save();
  c.translate(HEAD_OX, HEAD_OY);
  // The crown: twisted dry stems and curling tendrils, behind the head.
  const stems: { x: number; h: number; lean: number }[] = [
    { x: -34, h: 62, lean: -0.5 },
    { x: -18, h: 92, lean: -0.22 },
    { x: 0, h: 70, lean: 0.05 },
    { x: 18, h: 100, lean: 0.25 },
    { x: 34, h: 58, lean: 0.55 },
  ];
  for (const s of stems) {
    c.strokeStyle = '#1b2113';
    c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      c.lineWidth = 9 - k * 2.6;
      c.beginPath();
      c.moveTo(s.x, -42);
      c.bezierCurveTo(s.x + s.lean * 20 - 6, -42 - s.h * 0.35, s.x + s.lean * 50 + 7, -42 - s.h * 0.7, s.x + s.lean * 62, -42 - s.h);
      c.stroke();
    }
    // A thorn-sharp tip and a tendril curling off it.
    const tx = s.x + s.lean * 62;
    const ty = -42 - s.h;
    c.fillStyle = '#1b2113';
    c.beginPath();
    c.moveTo(tx - 4, ty + 4);
    c.lineTo(tx + s.lean * 8, ty - 16);
    c.lineTo(tx + 4, ty + 4);
    c.fill();
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(tx, ty + 14);
    c.bezierCurveTo(tx + 22, ty + 8, tx + 24, ty + 34, tx + 8, ty + 32);
    c.bezierCurveTo(tx, ty + 31, tx + 2, ty + 24, tx + 8, ty + 25);
    c.stroke();
    c.strokeStyle = withAlpha(RIM, 0.5);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(s.x + 2, -43);
    c.bezierCurveTo(s.x + s.lean * 20 - 2, -42 - s.h * 0.35, s.x + s.lean * 50 + 10, -42 - s.h * 0.7, tx + 2, ty);
    c.stroke();
  }
  // The gourd: three ribbed lobes, dark rust, lit from inside only through the cuts.
  const lobes = [-24, 24, 0];
  for (const lx of lobes) {
    c.fillStyle = linear(c, lx - 24, -50, lx + 24, 50, [
      { at: 0, colour: '#5a2b12' },
      { at: 1, colour: '#1e0d07' },
    ]);
    c.beginPath();
    c.ellipse(lx, 0, 29, 52, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(8, 4, 3, 0.55)';
    c.lineWidth = 2;
    c.stroke();
  }
  // Moss patches and a rim of moonlight on the right-hand edge.
  c.fillStyle = withAlpha(MOSS, 0.55);
  c.beginPath();
  c.ellipse(-36, -30, 11, 7, -0.5, 0, Math.PI * 2);
  c.ellipse(34, 36, 9, 6, 0.4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = withAlpha(RIM, 0.75);
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(26, -50);
  c.bezierCurveTo(60, -40, 62, 24, 34, 48);
  c.stroke();
  // A stub of stem on top, between the crown's roots.
  c.fillStyle = '#26301a';
  c.fillRect(-5, -60, 10, 14);
  c.restore();
}

// ---- parts drawn each frame ---------------------------------------------------------------

/** A long thin vine arm with thorns and a hooked hand. Tapers from the shoulder. */
function drawArm(ctx: Ctx, shoulder: Pt, elbow: Pt, hand: Pt, alpha: number, side: 1 | -1): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = (): void => {
    ctx.beginPath();
    ctx.moveTo(shoulder[0], shoulder[1]);
    ctx.quadraticCurveTo(elbow[0] - side * 8, elbow[1] + 6, elbow[0], elbow[1]);
    ctx.quadraticCurveTo(elbow[0] + (hand[0] - elbow[0]) * 0.4 + 6, elbow[1] + (hand[1] - elbow[1]) * 0.6, hand[0], hand[1]);
  };
  ctx.strokeStyle = '#14180d';
  ctx.lineWidth = 11;
  trace();
  ctx.stroke();
  ctx.strokeStyle = MOSS_DARK;
  ctx.lineWidth = 6.5;
  trace();
  ctx.stroke();
  // Moon rim on the upper edge.
  ctx.strokeStyle = withAlpha(RIM, 0.55);
  ctx.lineWidth = 1.3;
  ctx.save();
  ctx.translate(1.5, -3);
  trace();
  ctx.stroke();
  ctx.restore();
  // Thorns along the forearm.
  ctx.fillStyle = '#14180d';
  for (let i = 1; i <= 4; i++) {
    const u = i / 5;
    const px = lerp(elbow[0], hand[0], u);
    const py = lerp(elbow[1], hand[1], u);
    ctx.beginPath();
    ctx.moveTo(px - 3, py);
    ctx.lineTo(px + (i % 2 ? 1 : -1) * 9, py - 10);
    ctx.lineTo(px + 3, py + 1);
    ctx.fill();
  }
  // Three hooked fingers.
  ctx.strokeStyle = '#14180d';
  ctx.lineWidth = 3.2;
  const dx = Math.sign(hand[0] - elbow[0]) || -side;
  for (let f = -1; f <= 1; f++) {
    ctx.beginPath();
    ctx.moveTo(hand[0], hand[1]);
    ctx.quadraticCurveTo(hand[0] + dx * 18, hand[1] + f * 10 - 6, hand[0] + dx * 22, hand[1] + f * 13 + 8);
    ctx.quadraticCurveTo(hand[0] + dx * 18, hand[1] + f * 13 + 16, hand[0] + dx * 12, hand[1] + f * 12 + 12);
    ctx.stroke();
  }
  ctx.restore();
}

/** Roots instead of feet, spread along the ground. */
function drawRoots(ctx: Ctx, spread: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#0d0b14';
  for (let i = 0; i < 9; i++) {
    const x0 = -110 + i * 28;
    const dir = x0 < 0 ? -1 : 1;
    ctx.lineWidth = 7 - (i % 3);
    ctx.beginPath();
    ctx.moveTo(x0, -6);
    ctx.bezierCurveTo(x0 + dir * 20 * spread, -2, x0 + dir * 36 * spread, 4 + (i % 2) * 3, x0 + dir * (56 + hash(i, 90) * 40) * spread, 3);
    ctx.stroke();
  }
  ctx.strokeStyle = withAlpha(RIM, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, -8);
  ctx.bezierCurveTo(100, -4, 130, 2, 170 * spread, 2);
  ctx.stroke();
  ctx.restore();
}

/** A carved eye: an angled triangle. `open` is 0 for a slit and 1 for fully open. */
function eyePath(ctx: Ctx, side: number, open: number, scale: number): void {
  const h = lerp(2, 15, open) * scale;
  ctx.beginPath();
  ctx.moveTo(side * 8, -8);
  ctx.lineTo(side * 31 * scale, -17 * scale);
  ctx.lineTo(side * 27 * scale, -17 * scale + h);
  ctx.closePath();
}

function mouthPath(ctx: Ctx, widen: number): void {
  const w = 24 + widen * 12;
  const drop = 26 + widen * 14;
  ctx.beginPath();
  ctx.moveTo(-w, 15);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-w + (i / 6) * w * 2, 15 + (i % 2 ? 7 : 0));
  ctx.quadraticCurveTo(w * 0.7, drop, 0, drop + 4);
  ctx.quadraticCurveTo(-w * 0.7, drop, -w, 15);
  ctx.closePath();
}

function drawHead(ctx: Ctx, hx: number, hy: number, tilt: number, pose: BossPose, glow: number): void {
  const open = pose.hurt > 0.2 ? 0.1 : 1;
  const widen = pose.laughing > 0.1 ? 1 : 0;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  // The ember light spills out of the cuts: a halo, steady or flickering gently under 3 Hz.
  ctx.fillStyle = radial(ctx, 0, 0, 10, 130, [
    { at: 0, colour: withAlpha(EMBER, 0.42 * glow) },
    { at: 1, colour: withAlpha(EMBER, 0) },
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 130, 0, Math.PI * 2);
  ctx.fill();
  blit(ctx, 'king-head', HEAD_W, HEAD_H, -HEAD_OX, -HEAD_OY, paintHead);
  // The cuts, lit from inside: ember with a hot core.
  for (const [fill, scale] of [[EMBER, 1], [EMBER_HOT, 0.55]] as const) {
    ctx.fillStyle = scale === 1 ? withAlpha(fill, 0.55 + 0.45 * glow) : withAlpha(fill, 0.4 + 0.6 * glow);
    ctx.save();
    if (scale < 1) ctx.scale(scale, scale);
    ctx.translate(0, scale < 1 ? 8 : 0);
    eyePath(ctx, -1, open, 1);
    ctx.fill();
    eyePath(ctx, 1, open, 1);
    ctx.fill();
    mouthPath(ctx, widen);
    ctx.fill();
    ctx.restore();
  }
  // Cracks that brighten as the King is hurt: the fewer hits left, the more of them there are.
  const cracks = clamp01(1 - pose.health + pose.hurt * 0.5);
  if (cracks > 0.02) {
    ctx.strokeStyle = withAlpha(EMBER_HOT, 0.25 + cracks * 0.7);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const lines: Pt[][] = [
      [[-12, -50], [-16, -32], [-8, -22], [-12, -12]],
      [[30, -40], [22, -26], [30, -14]],
      [[-40, 10], [-30, 24], [-36, 38], [-26, 48]],
      [[16, 28], [24, 40], [14, 50]],
    ];
    const count = Math.max(1, Math.ceil(cracks * lines.length));
    for (const line of lines.slice(0, count)) {
      ctx.beginPath();
      line.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A heap of small pumpkins and dead leaves, where the King collapsed. `grow` is 0 to 1. */
function drawPile(ctx: Ctx, grow: number): void {
  if (grow <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp01(grow * 1.5);
  const pumps: [number, number, number][] = [[-70, -14, 22], [-20, -18, 26], [34, -14, 24], [80, -9, 17], [-44, -38, 18], [10, -44, 20], [52, -36, 15]];
  for (const [x, y, r] of pumps) {
    ctx.fillStyle = linear(ctx, x - r, y - r, x + r, y + r, [
      { at: 0, colour: '#5a2b12' },
      { at: 1, colour: '#1e0d07' },
    ]);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(RIM, 0.5);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.95, -1.2, -0.2);
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) leaf(ctx, -110 + i * 17 + hash(i, 95) * 8, -10 - hash(i, 96) * 14, 24 + hash(i, 97) * 12, 1.2 + hash(i, 98) * 1.8, hash(i, 99) < 0.5 ? MOSS : RUST, false);
  // The last warmth: one small ember that fades as the glow dies.
  ctx.restore();
}

/** Draw the Pumpkin King standing at (x, groundY). */
export function drawPumpkinKing(ctx: Ctx, x: number, groundY: number, pose: BossPose): void {
  const calm = pose.reducedMotion;
  const down = ease(pose.down ?? 0);
  const t = pose.nowMs;
  const body = bodyPose(pose);
  const sway = calm ? 0 : Math.sin(t / 1300) * 0.012 + (pose.laughing > 0.1 ? Math.sin(t / 170) * 0.01 : 0);
  const breathe = calm ? 0 : Math.sin(t / 1100) * 3;
  const recoil = calm ? 0 : pose.hurt * 16;
  const flicker = calm ? 1 : 0.86 + 0.09 * Math.sin(t / 190) + 0.05 * Math.sin(t / 310 + 1);
  const glow = clamp01((0.62 + pose.hurt * 0.45 + (1 - pose.health) * 0.12) * flicker) * (1 - down) ** 1.5;
  const bob = !calm && pose.laughing > 0.1 ? Math.sin(t / 150) * 4 : 0;

  ctx.save();
  ctx.translate(x + recoil, groundY);
  // Drawn at 330 px tall in its own units; scaled to fit under the health bar.
  ctx.scale(KING_SCALE, KING_SCALE);

  // A soft shadow on the ground.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(-10, 3, 150 + down * 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  drawRoots(ctx, 1 + down * 0.3);

  const crouch = body.crouch * (1 - down);
  const cloakScaleY = lerp(1 - crouch / 240, 0.2, down);
  const cloakScaleX = 1 + down * 0.28;
  // The cloak: sways from the hem up (the shear grows with height), sinks as the King crouches or falls.
  ctx.save();
  ctx.transform(cloakScaleX, 0, sway * 2, cloakScaleY, 0, 0);
  blit(ctx, 'king-cloak', CLOAK_W, CLOAK_H, -CLOAK_OX, -CLOAK_OY, paintCloak);
  ctx.restore();

  const shoulderY = -206 + crouch * 0.8 + down * 150;
  const armAlpha = 1 - down;
  const droop = down * 90;
  const head = {
    x: lerp(-sway * 2 * 262, -46, down * down),
    y: lerp(-262 + crouch + breathe + bob, -34, down * down),
    tilt: lerp(body.tilt + (pose.hurt > 0.1 ? 0.2 * pose.hurt : 0), -1.0, down),
  };

  // The back arm, then the head, then the front arm.
  drawArm(ctx, [40, shoulderY], [body.right.elbow[0], body.right.elbow[1] + crouch * 0.5 + droop], [body.right.hand[0], body.right.hand[1] + crouch * 0.4 + droop], armAlpha, 1);
  drawHead(ctx, head.x, head.y, head.tilt, pose, glow);
  drawArm(ctx, [-40, shoulderY], [body.left.elbow[0], body.left.elbow[1] + crouch * 0.5 + droop], [body.left.hand[0], body.left.hand[1] + crouch * 0.4 + droop], armAlpha, -1);

  drawPile(ctx, down);

  // Seeds drifting off the cloak: still, and a few, with reduced motion.
  ctx.fillStyle = withAlpha('#d9a34a', 0.7 * (1 - down));
  for (let i = 0; i < 7; i++) {
    const phase = calm ? hash(i, 110) : ((t / (5200 + hash(i, 111) * 2600) + hash(i, 112)) % 1);
    const sx = -90 + hash(i, 113) * 190 + phase * 40;
    const sy = -60 - hash(i, 114) * 120 + phase * 130;
    ctx.globalAlpha = (1 - down) * (calm ? 0.6 : Math.sin(phase * Math.PI));
    ctx.beginPath();
    ctx.ellipse(sx, sy, 2.6, 1.3, phase * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // When hit, a few leaves are shaken loose and fall.
  if (pose.hurt > 0.02) {
    const fall = 1 - pose.hurt;
    ctx.globalAlpha = clamp01(pose.hurt * 1.6);
    for (let i = 0; i < 6; i++) {
      leaf(ctx, -60 + i * 26, -150 + (calm ? 20 : fall * (80 + hash(i, 120) * 60)), 14, 0.5 + hash(i, 121) * 2 + (calm ? 0 : fall * 3), i % 2 ? RUST : MOSS, false);
    }
  }
  ctx.restore();
}
