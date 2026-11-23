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

const CLOAK_W = 480;
const CLOAK_H = 384;
const CLOAK_OX = 240;
const CLOAK_OY = 350;

function leaf(c: Ctx, x: number, y: number, length: number, angle: number, colour: string, rim: boolean, width = 10): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = colour;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(width, length * 0.45, 1, length);
  c.quadraticCurveTo(-width, length * 0.45, 0, 0);
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
    c.quadraticCurveTo(width + 0.5, length * 0.45, 1.5, length - 1);
    c.stroke();
  }
  c.restore();
}

// The cloak's outline: half-widths from the shoulders to the hem, a little wavy so it hangs and does not stand like a cone.
const TOP_Y = -198;
const HEM_Y = -26;
const hang = (y: number): number => Math.max(0, Math.min(1, (y - TOP_Y) / (HEM_Y - TOP_Y)));
const leftEdge = (y: number): number => -(100 + hang(y) ** 2 * 104 - Math.sin(hang(y) * Math.PI) * 12 + Math.sin(y * 0.06) * 3);
const rightEdge = (y: number): number => 96 + hang(y) ** 2 * 74 - Math.sin(hang(y) * Math.PI) * 12 + Math.sin(y * 0.06 + 1) * 3;

function cloakPath(c: Ctx): void {
  c.beginPath();
  c.moveTo(-34, -226);
  c.quadraticCurveTo(-64, -222, leftEdge(TOP_Y), TOP_Y);
  for (let y = TOP_Y + 14; y <= HEM_Y; y += 14) c.lineTo(leftEdge(y), y);
  c.lineTo(leftEdge(HEM_Y), HEM_Y + 6);
  c.lineTo(rightEdge(HEM_Y), HEM_Y + 6);
  for (let y = HEM_Y; y >= TOP_Y; y -= 14) c.lineTo(rightEdge(y), y);
  c.quadraticCurveTo(64, -222, 34, -226);
  c.closePath();
}

/** The cloak hangs in three big folds: a lit right panel, a dark opening down the middle, and a mossy left panel. */
function paintCloak(c: Ctx): void {
  c.save();
  c.translate(CLOAK_OX, CLOAK_OY);
  // The two fold ridges, as curves from the collar to the hem.
  const ridgeA = (): void => {
    c.moveTo(-34, -206);
    c.bezierCurveTo(-52, -140, -74, -80, -84, -22);
  };
  const ridgeB = (): void => {
    c.moveTo(40, -206);
    c.bezierCurveTo(50, -140, 60, -80, 74, -22);
  };
  c.save();
  cloakPath(c);
  c.clip();
  c.fillStyle = linear(c, 0, TOP_Y, 0, HEM_Y, [
    { at: 0, colour: '#0a0b10' },
    { at: 1, colour: '#171a14' },
  ]);
  c.fillRect(-260, -240, 520, 240);
  // Left panel: mossy, lit a little at its outer edge.
  c.beginPath();
  ridgeA();
  c.lineTo(-260, -22);
  c.lineTo(-260, -240);
  c.lineTo(-34, -240);
  c.closePath();
  c.fillStyle = linear(c, -210, 0, -40, 0, [
    { at: 0, colour: '#2c3b20' },
    { at: 0.6, colour: '#182114' },
    { at: 1, colour: '#0c100b' },
  ]);
  c.fill();
  // The dark opening between the ridges: the inner shadow.
  c.beginPath();
  ridgeA();
  c.lineTo(74, -22);
  c.bezierCurveTo(60, -80, 50, -140, 40, -206);
  c.closePath();
  c.fillStyle = linear(c, 0, -204, 0, -22, [
    { at: 0, colour: '#040409' },
    { at: 1, colour: '#12101a' },
  ]);
  c.fill();
  // Right panel: near-black with the moon's blue along its outer edge.
  c.beginPath();
  ridgeB();
  c.lineTo(260, -22);
  c.lineTo(260, -240);
  c.lineTo(40, -240);
  c.closePath();
  c.fillStyle = linear(c, 50, 0, 170, 0, [
    { at: 0, colour: '#141b12' },
    { at: 0.5, colour: '#1c2a2a' },
    { at: 1, colour: '#4a5da0' },
  ]);
  c.fill();
  // A smaller fold in the left panel, and the folds' edges: a dark crease with a pale lip.
  c.lineCap = 'round';
  // Big soft folds in the outer panels: a wide dark crease with a lit lip beside it.
  const creases: [number, number, number, number, number, number][] = [
    [-70, -200, -96, -120, -142, -30],
    [-100, -190, -146, -110, -196, -34],
    [78, -200, 104, -120, 128, -30],
    [98, -186, 134, -110, 158, -34],
  ];
  for (const [x0, y0, cx, cy, x1, y1] of creases) {
    for (const [off, colour, width] of [[0, withAlpha('#020207', 0.6), 11], [7, withAlpha(x0 > 0 ? RIM : '#6b8a45', x0 > 0 ? 0.5 : 0.4), 2.4]] as const) {
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(x0 + off, y0);
      c.quadraticCurveTo(cx + off, cy, x1 + off, y1);
      c.stroke();
    }
  }
  c.beginPath();
  ridgeA();
  c.strokeStyle = withAlpha('#4d6130', 0.5);
  c.lineWidth = 2.4;
  c.stroke();
  c.beginPath();
  ridgeB();
  c.strokeStyle = withAlpha(RIM, 0.6);
  c.lineWidth = 2;
  c.stroke();
  // The spine: a stem running down the chest, with ribs.
  c.strokeStyle = '#2b361b';
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(-2, -200);
  c.bezierCurveTo(-10, -150, 8, -110, 2, -62);
  c.stroke();
  c.strokeStyle = withAlpha(RIM, 0.45);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(1.5, -200);
  c.bezierCurveTo(-6, -150, 11, -110, 5.5, -62);
  c.stroke();
  c.strokeStyle = '#1e2714';
  c.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const y = -184 + i * 24;
    const x = (i % 2 ? 3 : -4) * 0.5;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + side * 16, y + 4, x + side * (22 - i * 2), y + 20);
      c.stroke();
    }
  }
  c.restore();

  // Hem: two rows of ragged leaves hang below the cloth, the back row darker and longer.
  for (let row = 0; row < 2; row++) {
    const n = row === 0 ? 24 : 21;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = lerp(leftEdge(HEM_Y) - 6, rightEdge(HEM_Y) + 4, u) + (hash(i + row * 40, 83) - 0.5) * 8;
      const pick = hash(i * 3 + row * 11, 84);
      const colour = row === 0 ? (pick < 0.5 ? '#0d110b' : '#15111d') : pick < 0.36 ? MOSS : pick < 0.66 ? RUST : pick < 0.86 ? MOSS_DARK : '#1b1626';
      const length = row === 0 ? 22 + hash(i, 85) * 16 + (hash(i, 93) > 0.78 ? 12 : 0) : 14 + hash(i * 2, 86) * 15 + (hash(i, 94) > 0.82 ? 10 : 0);
      leaf(c, x, row === 0 ? -34 : -26, length, (u - 0.5) * 0.3 + (hash(i, 87 + row) - 0.5) * 0.5, colour, u > 0.55 && pick < 0.86, row === 0 ? 14 : 11);
    }
  }
  // The sides: a ragged fringe of leaves along both edges, flung outward and down.
  for (let y = TOP_Y + 8; y < HEM_Y - 8; y += 15) {
    for (const side of [-1, 1] as const) {
      const pick = hash(y * 0.31 + side, 88);
      const colour = pick < 0.4 ? MOSS : pick < 0.7 ? RUST : MOSS_DARK;
      const edge = side === -1 ? leftEdge(y) : rightEdge(y);
      leaf(c, edge - side * 5, y, 22 + hash(y, 89) * 14, -side * (0.7 + hash(y, 90) * 0.5), colour, side === 1 && pick < 0.7, 11);
    }
  }
  // Collar: a stiff fan of leaves that rises behind the head and flares over the shoulders.
  for (let i = 0; i < 11; i++) {
    const u = i / 10;
    const x = lerp(-56, 56, u);
    const pick = hash(i, 91);
    const colour = pick < 0.45 ? MOSS_DARK : pick < 0.75 ? '#12160d' : RUST;
    leaf(c, x, -192, 34 + hash(i, 92) * 14, Math.PI + (u - 0.5) * 1.5, colour, u > 0.5 && pick < 0.75, 13);
  }
  // Shoulders: three leaves each, laid over like pauldrons.
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 3; k++) {
      leaf(c, side * (64 + k * 14), -204 + k * 7, 30 - k * 3, -side * (0.95 + k * 0.28), k === 1 ? RUST : MOSS_DARK, side === 1, 13);
    }
  }
  // The right edge of the cloak catches the moon.
  c.strokeStyle = withAlpha(RIM, 0.55);
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(rightEdge(TOP_Y) + 1, TOP_Y);
  for (let y = TOP_Y + 14; y <= HEM_Y; y += 14) c.lineTo(rightEdge(y) + 1, y);
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

/** A point on the arm's two-part curve (shoulder to elbow to hand), for t from 0 to 1. */
function armPoint(shoulder: Pt, elbow: Pt, hand: Pt, side: 1 | -1, t: number): Pt {
  const bend = (a: Pt, ctrl: Pt, b: Pt, u: number): Pt => [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * ctrl[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * ctrl[1] + u * u * b[1]];
  const c1: Pt = [elbow[0] - side * 8, elbow[1] + 6];
  const c2: Pt = [elbow[0] + (hand[0] - elbow[0]) * 0.4 + 6, elbow[1] + (hand[1] - elbow[1]) * 0.6];
  return t < 0.5 ? bend(shoulder, c1, elbow, t * 2) : bend(elbow, c2, hand, (t - 0.5) * 2);
}

/** A twisted vine arm: thick at the shoulder, tapering to the wrist, with a twist of lighter vine, two tendrils, thorns and a hooked hand. */
function drawArm(ctx: Ctx, shoulder: Pt, elbow: Pt, hand: Pt, alpha: number, side: 1 | -1): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const STEPS = 28;
  const pts: Pt[] = [];
  for (let i = 0; i <= STEPS; i++) pts.push(armPoint(shoulder, elbow, hand, side, i / STEPS));
  // The width falls from the shoulder to the wrist.
  const widthAt = (u: number): number => lerp(27, 8, u ** 0.8);
  const run = (colour: string, scale: number, dx: number, dy: number, shrink = 0): void => {
    ctx.strokeStyle = colour;
    for (let i = 0; i < STEPS; i++) {
      const u = i / STEPS;
      ctx.lineWidth = Math.max(1.4, widthAt(u) * scale - shrink);
      ctx.beginPath();
      ctx.moveTo(pts[i]![0] + dx, pts[i]![1] + dy);
      ctx.lineTo(pts[i + 1]![0] + dx, pts[i + 1]![1] + dy);
      ctx.stroke();
    }
  };
  run('#0f130a', 1, 0, 0);
  run('#3a4c22', 0.74, 0, 0);
  // A twist of lighter vine winding round it, so it reads as rope and not a tube.
  ctx.strokeStyle = '#5d7336';
  for (let i = 0; i < STEPS; i++) {
    const u = i / STEPS;
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const o0 = Math.sin(u * Math.PI * 7) * widthAt(u) * 0.28;
    const o1 = Math.sin((u + 1 / STEPS) * Math.PI * 7) * widthAt(u + 1 / STEPS) * 0.28;
    ctx.lineWidth = Math.max(1.2, widthAt(u) * 0.2);
    ctx.beginPath();
    ctx.moveTo(x0 + nx * o0, y0 + ny * o0);
    ctx.lineTo(x1 + nx * o1, y1 + ny * o1);
    ctx.stroke();
  }
  // Moon rim along the upper edge.
  ctx.globalAlpha = alpha * 0.6;
  run(RIM, 0.12, 1.2, -widthAt(0.4) * 0.35);
  ctx.globalAlpha = alpha;
  // The shoulder: a knot of vine where the arm joins the cloak.
  ctx.fillStyle = '#0f130a';
  ctx.beginPath();
  ctx.ellipse(shoulder[0], shoulder[1], 18, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a4c22';
  ctx.beginPath();
  ctx.ellipse(shoulder[0] - 1, shoulder[1] - 1, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Two tendrils curling off the forearm.
  ctx.strokeStyle = '#0f130a';
  ctx.lineWidth = 2.6;
  for (const [at, dir] of [[0.45, -1], [0.72, 1]] as const) {
    const [px, py] = pts[Math.round(at * STEPS)]!;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.bezierCurveTo(px + dir * 6, py - 14, px + dir * 24, py - 16, px + dir * 22, py - 2);
    ctx.bezierCurveTo(px + dir * 21, py + 6, px + dir * 12, py + 4, px + dir * 14, py - 3);
    ctx.stroke();
  }
  // Thorns along the forearm.
  ctx.fillStyle = '#0f130a';
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
  // Three long hooked fingers, fanned, each bending twice and ending in a claw.
  const dx = Math.sign(hand[0] - elbow[0]) || -side;
  ctx.strokeStyle = '#0f130a';
  for (let f = -1; f <= 1; f++) {
    const spread = f * 0.42;
    const ang = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]) + spread;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const hx = hand[0];
    const hy = hand[1];
    const L = 30 - Math.abs(f) * 4;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo(hx + ca * L * 0.6, hy + sa * L * 0.6, hx + ca * L, hy + sa * L);
    ctx.stroke();
    // The hook: the tip turns back toward the palm.
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(hx + ca * L, hy + sa * L);
    ctx.quadraticCurveTo(hx + ca * (L + 8) - sa * dx * 3, hy + sa * (L + 8) + ca * dx * 3 + 4, hx + ca * (L - 2) - sa * dx * 11, hy + sa * (L - 2) + ca * dx * 11 + 5);
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

  const shoulderY = -196 + crouch * 0.8 + down * 150;
  const armAlpha = 1 - down;
  const droop = down * 90;
  const head = {
    x: lerp(-sway * 2 * 262, -46, down * down),
    y: lerp(-262 + crouch + breathe + bob, -34, down * down),
    tilt: lerp(body.tilt + (pose.hurt > 0.1 ? 0.2 * pose.hurt : 0), -1.0, down),
  };

  // The back arm, then the head, then the front arm.
  drawArm(ctx, [86, shoulderY], [body.right.elbow[0], body.right.elbow[1] + crouch * 0.5 + droop], [body.right.hand[0], body.right.hand[1] + crouch * 0.4 + droop], armAlpha, 1);
  drawHead(ctx, head.x, head.y, head.tilt, pose, glow);
  drawArm(ctx, [-86, shoulderY], [body.left.elbow[0], body.left.elbow[1] + crouch * 0.5 + droop], [body.left.hand[0], body.left.hand[1] + crouch * 0.4 + droop], armAlpha, -1);

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
