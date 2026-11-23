import { clamp01, ease, hash, lerp, radial, withAlpha, type Ctx } from '../gfx';
import type { BossPose } from '../boss';
import { bodyPoseFor, groundShadow, heldItem, limb, limbRim, mix, type BodyPose, type Pt, type PoseSet } from './rig-stages-5-7';

// The Spider Miller, drawn in code. See "Stage 5: Haunted Mill and the Spider Miller" in
// .kiro/specs/ghastly-rhythm-v2/design.md.
//
//   Silhouette  wide and low: a fan of eight long jointed legs, a big round abdomen behind with a flour sack tied
//               on top, a small head under a floppy miller's cap. A spiky wide star with a round weight on its back.
//   Shape lang. Long thin diagonals and zigzag joints (legs, silk); round only for the abdomen, the sack and the
//               cluster of eyes, so the six gold eyes are where the eye goes.
//   Palette     shadow violet-black, dusty plum mid, flour cream for the lights; the one accent is lamp gold in the
//               six eyes and the cap's buckle. A silver-lilac rim on the right of every shape.
//   Poses       idle, lob wind-up (both front legs up over the head cradling a web ball), roll wind-up (a crouch,
//               one front leg swept low and back with a little mill wheel), swoop wind-up (rears, one leg flung
//               high, a spiderling dangling on a thread), throw, hurt (recoil, eyes squeeze, a puff of flour),
//               laugh (the abdomen shakes, the fangs chatter), defeated (the legs curl in, the sack bursts, a heap
//               of flour is left under the folded legs).
//
// Everything is drawn each frame from a few dozen shapes. With reduced motion the poses still change, but nothing
// sways, shakes or puffs.

const SCALE = 0.76;
const SHADOW = '#0f0a1a';
const MID = '#3a2a52';
const MID_LIGHT = '#5a4580';
const CREAM = '#e4dcc8';
const CREAM_DARK = '#a79f90';
const GOLD = '#ffcf6b';
const RIM = '#b9b0f0';
const SILK = '#e9e2ff';

const SHOULDER_L: Pt = [-40, -150];
const SHOULDER_R: Pt = [-26, -158];

const IDLE: BodyPose = {
  left: { elbow: [-104, -232], hand: [-152, -152] },
  right: { elbow: [-52, -262], hand: [-98, -184] },
  crouch: 0,
  tilt: 0,
};
/** A lob: both front legs straight up over the head, cradling a web ball between the feet. Matches the rising tell. */
const LOB: BodyPose = {
  left: { elbow: [-100, -300], hand: [-72, -392] },
  right: { elbow: [-34, -316], hand: [-44, -396] },
  crouch: 0,
  tilt: -0.3,
};
/** A roll: a deep crouch, one front leg swept far back and low with a little mill wheel. Matches the rumbling tell. */
const ROLL: BodyPose = {
  left: { elbow: [-132, -116], hand: [-102, -26] },
  right: { elbow: [-70, -170], hand: [-132, -104] },
  crouch: 40,
  tilt: 0.2,
};
/** A swoop: rears up, one leg flung high and out, the spiderling hanging from it on a thread. Matches the falling whistle. */
const SWOOP: BodyPose = {
  left: { elbow: [-132, -300], hand: [-200, -378] },
  right: { elbow: [-60, -252], hand: [-80, -196] },
  crouch: 4,
  tilt: -0.2,
};
const THROW: BodyPose = {
  left: { elbow: [-146, -204], hand: [-216, -170] },
  right: { elbow: [-92, -190], hand: [-138, -150] },
  crouch: 10,
  tilt: 0.12,
};
const SET: PoseSet = { idle: IDLE, windup: { lobbed: LOB, rolled: ROLL, swooped: SWOOP }, release: THROW };

/** The six legs that stay on the ground: where each leaves the body, the knee, and the foot. */
const LEGS: readonly { from: Pt; knee: Pt; foot: Pt }[] = [
  { from: [10, -146], knee: [62, -272], foot: [112, 0] },
  { from: [20, -140], knee: [114, -264], foot: [178, 0] },
  { from: [30, -134], knee: [162, -228], foot: [236, 0] },
  { from: [36, -128], knee: [192, -172], foot: [268, 0] },
  { from: [-30, -140], knee: [-122, -204], foot: [-170, 0] },
  { from: [-20, -132], knee: [-86, -150], foot: [-108, 0] },
];

// ---- parts -----------------------------------------------------------------------------------

function drawLeg(c: Ctx, from: Pt, knee: Pt, foot: Pt, curl: number, sway: number): void {
  // Curling in as he falls: the knee and the foot draw back toward the body and up.
  const k: Pt = mix([knee[0] + sway, knee[1]], [from[0] * 0.6 + 8, -128], curl * 0.9);
  const f: Pt = mix(foot, [from[0] * 0.5 + (foot[0] > 0 ? 28 : -28), -60 + hash(foot[0], 3) * 20], curl);
  limb(c, from, k, f, [9, 6, 2.4], SHADOW);
  limb(c, from, k, f, [4.6, 3.2, 1.2], MID);
  limbRim(c, from, k, f, RIM, 0.55, 1.2);
  // A pale band at the knee, like flour on a joint.
  c.fillStyle = withAlpha(CREAM, 0.8);
  c.beginPath();
  c.arc(k[0], k[1], 4.4, 0, Math.PI * 2);
  c.fill();
}

/** The front legs, which throw. Longer and stronger than the others, with a hooked tip. */
function drawForeleg(c: Ctx, shoulder: Pt, elbow: Pt, hand: Pt, alpha: number): void {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  limb(c, shoulder, elbow, hand, [11, 7.5, 3], SHADOW);
  limb(c, shoulder, elbow, hand, [5.6, 3.8, 1.4], MID);
  limbRim(c, shoulder, elbow, hand, RIM, 0.6, 1.3);
  c.fillStyle = withAlpha(CREAM, 0.85);
  c.beginPath();
  c.arc(elbow[0], elbow[1], 5.2, 0, Math.PI * 2);
  c.fill();
  // The tip: two small hooked claws.
  const ang = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  c.strokeStyle = SHADOW;
  c.lineWidth = 2.4;
  c.lineCap = 'round';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(hand[0], hand[1]);
    c.quadraticCurveTo(hand[0] + Math.cos(ang + s * 0.7) * 10, hand[1] + Math.sin(ang + s * 0.7) * 10, hand[0] + Math.cos(ang + s * 0.3) * 18, hand[1] + Math.sin(ang + s * 0.3) * 18);
    c.stroke();
  }
  c.restore();
}

function drawAbdomen(c: Ctx, shake: number, down: number): void {
  c.save();
  c.translate(80, -150 + shake);
  c.scale(1, 1 - down * 0.25);
  // The bulb: shadow at the rim, plum in the middle, a softer light on the upper left.
  c.fillStyle = radial(c, -14, -16, 4, 76, [
    { at: 0, colour: MID_LIGHT },
    { at: 0.6, colour: MID },
    { at: 1, colour: SHADOW },
  ]);
  c.beginPath();
  c.ellipse(0, 0, 66, 60, 0, 0, Math.PI * 2);
  c.fill();
  // Three cream chevrons down the back, like flour dusted in a pattern.
  c.strokeStyle = withAlpha(CREAM, 0.7);
  c.lineWidth = 4;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(-22 + i * 14, -28 + i * 20);
    c.lineTo(-4 + i * 14, -8 + i * 22);
    c.lineTo(-22 + i * 14, 8 + i * 22 + (i === 2 ? -2 : 0));
    c.stroke();
  }
  c.strokeStyle = withAlpha(RIM, 0.65);
  c.lineWidth = 1.8;
  c.beginPath();
  c.ellipse(0, 0, 66, 60, 0, -1.25, 0.35);
  c.stroke();
  c.restore();
}

/** A flour sack tied on his back: lumpy, with a rope round its neck, and a little flour dusting off it. */
function drawSack(c: Ctx, burst: number, puff: number): void {
  if (burst >= 1) return;
  c.save();
  c.translate(84, -204);
  c.scale(1 - burst * 0.4, 1 - burst * 0.6);
  c.fillStyle = radial(c, -8, -4, 3, 40, [
    { at: 0, colour: '#cbc3b2' },
    { at: 1, colour: CREAM_DARK },
  ]);
  c.beginPath();
  c.moveTo(-30, 10);
  c.quadraticCurveTo(-40, -16, -18, -30);
  c.lineTo(-10, -42);
  c.lineTo(8, -40);
  c.lineTo(14, -30);
  c.quadraticCurveTo(40, -16, 32, 10);
  c.quadraticCurveTo(0, 20, -30, 10);
  c.closePath();
  c.fill();
  c.strokeStyle = '#4b3a2a';
  c.lineWidth = 3.2;
  c.beginPath();
  c.moveTo(-14, -28);
  c.lineTo(12, -28);
  c.stroke();
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-8, -14);
  c.quadraticCurveTo(0, -8, 10, -14);
  c.stroke();
  c.strokeStyle = withAlpha(RIM, 0.6);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(14, -30);
  c.quadraticCurveTo(40, -16, 32, 6);
  c.stroke();
  c.restore();
  // A puff of flour when he is hit: pale clouds that spread up and out.
  if (puff > 0.02) {
    c.save();
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.4;
      const d = (1 - puff) * 70 + 8;
      c.fillStyle = withAlpha(CREAM, puff * 0.5);
      c.beginPath();
      c.arc(84 + Math.cos(a) * d * (0.6 + hash(i, 9) * 0.6), -204 + Math.sin(a) * d - 8, 8 + hash(i, 10) * 10 * (1 - puff + 0.4), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
}

function drawThorax(c: Ctx): void {
  c.fillStyle = radial(c, -22, -158, 3, 50, [
    { at: 0, colour: MID_LIGHT },
    { at: 0.65, colour: MID },
    { at: 1, colour: SHADOW },
  ]);
  c.beginPath();
  c.ellipse(-12, -146, 42, 34, -0.1, 0, Math.PI * 2);
  c.fill();
  // Bristles along the top.
  c.fillStyle = MID;
  for (let i = 0; i < 7; i++) {
    const x = -38 + i * 10;
    const y = -176 + Math.abs(i - 3) * 3.4;
    c.beginPath();
    c.moveTo(x - 3, y + 4);
    c.lineTo(x + (i % 2 ? 2 : -1), y - 8 - hash(i, 11) * 5);
    c.lineTo(x + 4, y + 4);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = withAlpha(RIM, 0.6);
  c.lineWidth = 1.6;
  c.beginPath();
  c.ellipse(-12, -146, 42, 34, -0.1, -1.2, 0.3);
  c.stroke();
}

/** The cap: a flat floppy miller's cap with a drooping side, a band and a gold buckle. */
function drawCap(c: Ctx): void {
  c.save();
  c.translate(2, -20);
  c.rotate(-0.12);
  c.fillStyle = CREAM_DARK;
  c.beginPath();
  c.moveTo(-26, 0);
  c.quadraticCurveTo(-26, -20, -4, -24);
  c.quadraticCurveTo(24, -28, 34, -8);
  c.quadraticCurveTo(40, 4, 30, 8);
  c.lineTo(-26, 4);
  c.closePath();
  c.fill();
  c.fillStyle = CREAM;
  c.beginPath();
  c.moveTo(-26, -2);
  c.quadraticCurveTo(-24, -18, -2, -22);
  c.quadraticCurveTo(20, -24, 30, -12);
  c.quadraticCurveTo(10, -14, -26, -2);
  c.closePath();
  c.fill();
  c.fillStyle = '#4b3a2a';
  c.fillRect(-26, 0, 56, 6);
  c.fillStyle = GOLD;
  c.fillRect(-5, 0, 8, 6);
  c.fillStyle = '#4b3a2a';
  c.fillRect(-3, 2, 4, 2);
  c.strokeStyle = withAlpha(RIM, 0.65);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-4, -24);
  c.quadraticCurveTo(24, -28, 34, -8);
  c.stroke();
  c.restore();
}

function drawHead(c: Ctx, hx: number, hy: number, tilt: number, pose: BossPose, fangs: number, glowing: number): void {
  c.save();
  c.translate(hx, hy);
  c.rotate(tilt);
  c.fillStyle = radial(c, -6, -8, 2, 32, [
    { at: 0, colour: MID_LIGHT },
    { at: 1, colour: SHADOW },
  ]);
  c.beginPath();
  c.ellipse(0, 0, 28, 25, 0, 0, Math.PI * 2);
  c.fill();
  // Fangs: two hooked curves under the front of the face, opening when he laughs or is hit.
  c.strokeStyle = CREAM;
  c.lineWidth = 4.4;
  c.lineCap = 'round';
  for (const s of [0, 1]) {
    c.beginPath();
    c.moveTo(-22 + s * 9, 14);
    c.quadraticCurveTo(-26 + s * 9 - fangs * 6, 26 + fangs * 4, -20 + s * 9 - fangs * 3, 34 + fangs * 6);
    c.stroke();
  }
  // The eyes: six, a big pair and four small, in lamp gold. They squeeze shut to slits when he is hit.
  const squeeze = pose.hurt > 0.2;
  const eyes: [number, number, number][] = [[-14, -4, 4.4], [-4, -10, 3.4], [-18, 6, 3], [-7, 3, 2.6], [4, -3, 2.2], [-1, -16, 2]];
  for (const [ex, ey, er] of eyes) {
    if (squeeze) {
      c.strokeStyle = withAlpha(GOLD, 0.9);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(ex - er, ey);
      c.lineTo(ex + er, ey);
      c.stroke();
      continue;
    }
    c.fillStyle = radial(c, ex, ey, 0.5, er * 3, [
      { at: 0, colour: withAlpha(GOLD, 0.55 * glowing) },
      { at: 1, colour: withAlpha(GOLD, 0) },
    ]);
    c.beginPath();
    c.arc(ex, ey, er * 3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = withAlpha(GOLD, 0.45 + 0.55 * glowing);
    c.beginPath();
    c.arc(ex, ey, er, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a1020';
    c.beginPath();
    c.arc(ex - 0.6, ey, er * 0.4, 0, Math.PI * 2);
    c.fill();
  }
  drawCap(c);
  c.strokeStyle = withAlpha(RIM, 0.6);
  c.lineWidth = 1.5;
  c.beginPath();
  c.ellipse(0, 0, 28, 25, 0, -1.3, 0.2);
  c.stroke();
  c.restore();
}

function drawSpiderling(c: Ctx, x: number, y: number, s: number): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = '#b49cff';
  c.beginPath();
  c.arc(0, 0, 6, 0, Math.PI * 2);
  c.arc(-7, -2, 4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#b49cff';
  c.lineWidth = 1.5;
  c.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(side * (8 + i * 2), -4 + i * 4);
      c.lineTo(side * (12 + i * 3), 3 + i * 4);
      c.stroke();
    }
  }
  c.restore();
}

/** What he holds before the release: a web ball in the lob, a mill wheel in the roll, a spiderling on a thread in the swoop. */
function drawHeld(c: Ctx, held: { motion: string; u: number }, left: Pt, right: Pt): void {
  c.save();
  c.globalAlpha = clamp01((held.u - 0.2) * 3);
  if (held.motion === 'lobbed') {
    const x = (left[0] + right[0]) / 2 - 4;
    const y = (left[1] + right[1]) / 2 - 18;
    c.fillStyle = withAlpha(SILK, 0.18);
    c.beginPath();
    c.arc(x, y, 24, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = withAlpha(SILK, 0.95);
    c.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(i * 1.05) * 20, y + Math.sin(i * 1.05) * 20);
      c.stroke();
    }
    for (const r of [8, 15]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
    }
  } else if (held.motion === 'rolled') {
    const x = left[0] - 4;
    const y = left[1] - 14;
    c.strokeStyle = '#c9a96a';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(x, y, 15, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(i * 1.05) * 15, y + Math.sin(i * 1.05) * 15);
      c.stroke();
    }
  } else {
    c.strokeStyle = withAlpha(SILK, 0.9);
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(left[0], left[1]);
    c.lineTo(left[0] - 2, left[1] + 70);
    c.stroke();
    drawSpiderling(c, left[0] - 2, left[1] + 76, 1);
  }
  c.restore();
}

/** What is left when he falls: a heap of flour under the folded legs. */
function drawFlourHeap(c: Ctx, grow: number): void {
  if (grow <= 0) return;
  c.save();
  c.globalAlpha = clamp01(grow * 1.4);
  c.fillStyle = radial(c, 60, -30, 6, 150, [
    { at: 0, colour: '#f1ead8' },
    { at: 1, colour: withAlpha(CREAM_DARK, 0.9) },
  ]);
  c.beginPath();
  c.moveTo(-60, 2);
  c.quadraticCurveTo(-20, -50 * grow - 10, 70, -64 * grow - 6);
  c.quadraticCurveTo(150, -40 * grow, 190, 2);
  c.closePath();
  c.fill();
  c.restore();
}

/** Draw the Spider Miller standing at (x, groundY). */
export function drawSpiderMiller(ctx: Ctx, x: number, groundY: number, pose: BossPose): void {
  const calm = pose.reducedMotion;
  const down = ease(pose.down ?? 0);
  const t = pose.nowMs;
  const body = bodyPoseFor(pose, SET);
  const breathe = calm ? 0 : Math.sin(t / 1300) * 2.5;
  const sway = calm ? 0 : Math.sin(t / 1700) * 3;
  const recoil = calm ? 0 : pose.hurt * 16;
  // The eyes glow steadily (a slow breath under 0.2 Hz), brighter when he is hit, and go out as he falls.
  const glowing = clamp01((calm ? 0.8 : 0.72 + 0.12 * Math.sin(t / 1400)) + pose.hurt * 0.2) * (1 - down) ** 1.5;
  // The abdomen shakes when he laughs (about 5 Hz, small) and the fangs chatter.
  const laugh = pose.laughing > 0.1 ? 1 : 0;
  const shake = calm ? 0 : laugh * Math.sin(t / 32) * 2.6;
  const fangs = down > 0.2 ? 0 : pose.hurt > 0.2 ? 1 : laugh ? (calm ? 0.8 : 0.5 + 0.5 * Math.sin(t / 70)) : 0;
  const sink = body.crouch * 0.9 + down * 96;

  ctx.save();
  ctx.translate(x + recoil, groundY);
  ctx.scale(SCALE, SCALE);
  groundShadow(ctx, 170 + down * 30);

  // The thread from his spinneret, hanging to the ground, pale and thin.
  ctx.strokeStyle = withAlpha(SILK, 0.45 * (1 - down));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(140, -130 + sink);
  ctx.quadraticCurveTo(150 + sway, -60, 144, -6);
  ctx.stroke();

  // Back legs first (on the right), then the body, then the legs on the left.
  const legSink = (l: { from: Pt; knee: Pt }): { from: Pt; knee: Pt } => ({ from: [l.from[0], l.from[1] + sink], knee: [l.knee[0], l.knee[1] + sink * 0.7] });
  LEGS.forEach((l, i) => {
    if (l.foot[0] < 0) return;
    const s = legSink(l);
    drawLeg(ctx, s.from, s.knee, l.foot, down, calm ? 0 : Math.sin(t / 900 + i) * 2);
  });

  ctx.save();
  ctx.translate(0, sink + breathe);
  drawAbdomen(ctx, shake, down);
  drawSack(ctx, down, pose.hurt);
  drawThorax(ctx);
  ctx.restore();

  LEGS.forEach((l, i) => {
    if (l.foot[0] >= 0) return;
    const s = legSink(l);
    drawLeg(ctx, s.from, s.knee, l.foot, down, calm ? 0 : Math.sin(t / 900 + i) * 2);
  });

  const head = { x: -66, y: -140 + sink + breathe + down * 14, tilt: body.tilt * 0.6 + (pose.hurt > 0.1 ? -0.18 * pose.hurt : 0) + down * 0.5 };
  drawHead(ctx, head.x, head.y, head.tilt, pose, fangs, glowing);

  // The front legs, which throw: they curl in with the rest as he falls.
  const lift = (p: Pt): Pt => [p[0], p[1] + body.crouch * 0.5 + down * 96];
  const fold = (p: Pt): Pt => mix(p, [-70, -70], down);
  const sL: Pt = [SHOULDER_L[0], SHOULDER_L[1] + sink + breathe];
  const sR: Pt = [SHOULDER_R[0], SHOULDER_R[1] + sink + breathe];
  const le = fold(lift(body.left.elbow));
  const lh = fold(lift(body.left.hand));
  const re = fold(lift(body.right.elbow));
  const rh = fold(lift(body.right.hand));
  drawForeleg(ctx, sR, re, rh, 1);
  drawForeleg(ctx, sL, le, lh, 1);
  const held = heldItem(pose);
  if (held && down === 0) drawHeld(ctx, held, lh, rh);

  drawFlourHeap(ctx, down);
  ctx.restore();
}
