import { clamp01, ease, hash, lerp, linear, radial, withAlpha, type Ctx } from '../gfx';
import type { BossPose } from '../boss';
import { bodyPoseFor, groundShadow, heldItem, limb, limbRim, type BodyPose, type Pt, type PoseSet } from './rig-stages-5-7';

// The Hollow Wraith, drawn in code. See "Stage 6: The Hollow and the Hollow Wraith" in
// .kiro/specs/ghastly-rhythm-v2/design.md.
//
//   Silhouette  a tall teardrop that narrows downward to a tail of smoke, with no feet (it floats), a crown of bare
//               branches like antlers, and long sleeves that hang past the knees. A tall S-curve.
//   Shape lang. Long curves, ribbons and teardrops; the only hard lines are the antler branches.
//   Palette     shadow midnight blue, slate blue mid, pale ice for the mask and the lit edges; the one accent is the
//               cold cyan of the two eye slits and the light it holds. Pale cyan rim on the right.
//   Poses       idle (floats, ribbons stream), lob wind-up (both arms up, an orb of cold light over the throwing
//               hand), roll wind-up (sinks low, one arm sweeps low behind, a rotten knot in the hand), swoop wind-up
//               (leans back, one arm high, an icicle forms in the hand), throw, hurt (the body ripples, a shifted
//               copy trails it, the eyes close, wisps fly off), laugh (a long thin smile, the shoulders shake),
//               defeated (unravels upward into ribbons and wisps, the crown drops and the mask fades).
//
// Drawn each frame from a few dozen curves. With reduced motion the poses still change, but nothing floats,
// streams, shakes or ripples.

const SCALE = 0.72;
const SHADOW = '#060d18';
const MID = '#17304a';
const MID_LIGHT = '#2a5276';
const ICE = '#b8d8ea';
const ICE_DARK = '#6f93aa';
const CYAN = '#8ff3ff';
const RIM = '#a6dff2';

const SHOULDER_L: Pt = [-38, -246];
const SHOULDER_R: Pt = [38, -246];

const IDLE: BodyPose = {
  left: { elbow: [-84, -192], hand: [-96, -132] },
  right: { elbow: [82, -192], hand: [80, -134] },
  crouch: 0,
  tilt: 0,
};
/** A lob: both arms up beside the head, an orb of cold light over the throwing hand. Matches the rising tell. */
const LOB: BodyPose = {
  left: { elbow: [-102, -292], hand: [-86, -374] },
  right: { elbow: [94, -290], hand: [84, -370] },
  crouch: 0,
  tilt: -0.24,
};
/** A roll: it sinks low and sweeps one long arm low behind it, a knot in the hand. Matches the rumbling tell. */
const ROLL: BodyPose = {
  left: { elbow: [-112, -122], hand: [-126, -44] },
  right: { elbow: [86, -150], hand: [66, -108] },
  crouch: 56,
  tilt: 0.2,
};
/** A swoop: it leans back, one arm flung high and out, an icicle growing in the hand. Matches the falling whistle. */
const SWOOP: BodyPose = {
  left: { elbow: [-118, -290], hand: [-178, -372] },
  right: { elbow: [84, -182], hand: [90, -124] },
  crouch: 0,
  tilt: -0.26,
};
const THROW: BodyPose = {
  left: { elbow: [-134, -212], hand: [-212, -188] },
  right: { elbow: [72, -202], hand: [66, -150] },
  crouch: 14,
  tilt: 0.1,
};
const SET: PoseSet = { idle: IDLE, windup: { lobbed: LOB, rolled: ROLL, swooped: SWOOP }, release: THROW };

// ---- parts -----------------------------------------------------------------------------------

/** The teardrop of the body: broad at the shoulders, narrowing to a tail of smoke that drifts with `sw`. */
function bodyPath(c: Ctx, sw: number): void {
  const top = -252;
  c.beginPath();
  c.moveTo(-34, top);
  c.bezierCurveTo(-72, top + 30, -78, -172, -48, -112);
  c.bezierCurveTo(-30, -74, -22 + sw, -46, -4 + sw * 1.6, -10);
  c.bezierCurveTo(6 + sw * 1.3, -40, 28 + sw, -72, 50, -112);
  c.bezierCurveTo(78, -172, 72, top + 30, 34, top);
  c.quadraticCurveTo(0, top - 14, -34, top);
  c.closePath();
}

function drawBody(c: Ctx, sw: number, t: number, calm: boolean, alpha: number, yScale: number): void {
  c.save();
  c.globalAlpha *= alpha;
  c.scale(1, yScale);
  // The body fades into smoke toward the tail.
  c.fillStyle = linear(c, 0, -252, 0, -10, [
    { at: 0, colour: MID },
    { at: 0.55, colour: SHADOW },
    { at: 1, colour: withAlpha(SHADOW, 0.1) },
  ]);
  bodyPath(c, sw);
  c.fill();
  // A slate fold down the middle and one on the left.
  c.strokeStyle = withAlpha(MID_LIGHT, 0.55);
  c.lineWidth = 7;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(14, -238);
  c.bezierCurveTo(30, -180, 26, -120, 6 + sw, -40);
  c.stroke();
  c.strokeStyle = withAlpha('#02060c', 0.7);
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(-20, -236);
  c.bezierCurveTo(-42, -180, -30, -120, -10 + sw, -40);
  c.stroke();
  // Ribbons off the hem, streaming and tapering: the smoke the Wraith is made of.
  c.lineWidth = 6;
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1;
    const y0 = -150 + i * 12;
    const x0 = side * (50 - i * 4);
    const wave = calm ? 0 : Math.sin(t / 700 + i * 1.3) * 7;
    c.strokeStyle = withAlpha(i % 3 === 0 ? MID_LIGHT : MID, 0.75 - i * 0.05);
    c.beginPath();
    c.moveTo(x0, y0);
    c.bezierCurveTo(x0 + side * 22 + wave, y0 + 30, x0 - side * 10 + wave * 1.4, y0 + 60, x0 + side * 14 + sw, y0 + 96 - i * 4);
    c.stroke();
  }
  // The cyan rim on the right edge.
  c.strokeStyle = withAlpha(RIM, 0.6);
  c.lineWidth = 1.7;
  c.beginPath();
  c.moveTo(34, -252);
  c.bezierCurveTo(72, -222, 78, -172, 50, -112);
  c.bezierCurveTo(28, -72, 6 + sw, -40, 6 + sw, -14);
  c.stroke();
  c.restore();
}

/** A bare branch that forks, for the crown. */
function branch(g: Ctx, x: number, y: number, a: number, len: number, w: number, depth: number): void {
  const x1 = x + Math.cos(a) * len;
  const y1 = y + Math.sin(a) * len;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x1, y1);
  g.stroke();
  if (depth > 0) {
    branch(g, x1, y1, a - 0.5, len * 0.72, w * 0.7, depth - 1);
    branch(g, x1, y1, a + 0.42, len * 0.62, w * 0.7, depth - 1);
  }
}

function drawCrown(c: Ctx, drop: number): void {
  c.save();
  c.translate(0, drop);
  c.rotate(drop * 0.003);
  c.lineCap = 'round';
  for (const [rim, col] of [[true, withAlpha(RIM, 0.7)], [false, '#0b1826']] as const) {
    c.save();
    if (rim) c.translate(1.4, -1.4);
    c.strokeStyle = col;
    branch(c, -10, -346, -2.25, 30, 4.4, 2);
    branch(c, 10, -346, -0.9, 30, 4.4, 2);
    branch(c, 0, -352, -1.58, 26, 3.6, 2);
    c.restore();
  }
  c.restore();
}

function drawHead(c: Ctx, tilt: number, pose: BossPose, glowing: number, smile: number, fade: number, crown: number): void {
  c.save();
  c.translate(0, -262);
  c.rotate(tilt);
  c.translate(0, 262);
  // The hood: tall, pointed and dark, open at the front.
  c.fillStyle = SHADOW;
  c.beginPath();
  c.moveTo(0, -364);
  c.bezierCurveTo(32, -340, 42, -300, 28, -258);
  c.lineTo(-28, -258);
  c.bezierCurveTo(-42, -300, -32, -340, 0, -364);
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha(RIM, 0.65);
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(0, -364);
  c.bezierCurveTo(32, -340, 42, -300, 28, -258);
  c.stroke();
  if (crown > 0.02) {
    c.save();
    c.globalAlpha *= crown;
    drawCrown(c, 0);
    c.restore();
  }
  c.globalAlpha *= fade;
  // The mask: a long pale oval, shaded on the left, with a thin crack.
  c.fillStyle = linear(c, -18, 0, 18, 0, [
    { at: 0, colour: ICE_DARK },
    { at: 0.5, colour: ICE },
    { at: 1, colour: '#e6f4fb' },
  ]);
  c.beginPath();
  c.ellipse(0, -298, 17, 30, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = withAlpha('#2a4258', 0.6);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(6, -326);
  c.lineTo(3, -314);
  c.lineTo(7, -304);
  c.stroke();
  // The eyes: two tall slits of cold light. They close to a line when it is hit.
  const open = pose.hurt > 0.2 ? 0.08 : 1;
  for (const sx of [-1, 1]) {
    const ex = sx * 7.4;
    if (open > 0.5) {
      c.fillStyle = radial(c, ex, -304, 1, 24, [
        { at: 0, colour: withAlpha(CYAN, 0.5 * glowing) },
        { at: 1, colour: withAlpha(CYAN, 0) },
      ]);
      c.beginPath();
      c.arc(ex, -304, 24, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = withAlpha(CYAN, 0.55 + 0.45 * glowing);
    c.beginPath();
    c.ellipse(ex, -304, 2.3, 9 * open + 0.9, sx * -0.12, 0, Math.PI * 2);
    c.fill();
  }
  // A thin nose and a mouth: a faint line, or a long smile when it laughs.
  c.fillStyle = withAlpha('#2a4258', 0.7);
  c.beginPath();
  c.moveTo(0, -296);
  c.lineTo(-2.6, -284);
  c.lineTo(2.6, -284);
  c.closePath();
  c.fill();
  c.strokeStyle = '#0b1826';
  c.lineWidth = 1.8;
  c.beginPath();
  if (smile > 0.1) {
    c.moveTo(-11, -278);
    c.quadraticCurveTo(0, -278 + 14 * smile, 11, -278);
  } else {
    c.moveTo(-5, -276);
    c.lineTo(5, -276);
  }
  c.stroke();
  c.restore();
}

/** A long sleeve and bony pale fingers. The sleeve hangs from the elbow in a long point, and trails from the hand. */
function drawArm(c: Ctx, shoulder: Pt, elbow: Pt, hand: Pt, t: number, calm: boolean, alpha: number): void {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  limb(c, shoulder, elbow, hand, [20, 15, 6], SHADOW);
  limb(c, shoulder, elbow, hand, [9, 7, 2.6], MID);
  limbRim(c, shoulder, elbow, hand, RIM, 0.6, 1.4);
  // Cloth hanging from the elbow, a long wavy point.
  const wave = calm ? 0 : Math.sin(t / 800 + elbow[0]) * 5;
  c.fillStyle = SHADOW;
  c.beginPath();
  c.moveTo(elbow[0] - 13, elbow[1] - 2);
  c.quadraticCurveTo(elbow[0] - 18 + wave, elbow[1] + 36, elbow[0] - 6 + wave * 1.5, elbow[1] + 76);
  c.quadraticCurveTo(elbow[0] + 6, elbow[1] + 30, elbow[0] + 13, elbow[1] - 2);
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha(RIM, 0.5);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(elbow[0] + 13, elbow[1] - 2);
  c.quadraticCurveTo(elbow[0] + 6, elbow[1] + 30, elbow[0] - 6 + wave * 1.5, elbow[1] + 76);
  c.stroke();
  // Fingers: four long thin pale lines, fanned, each slightly hooked.
  const base = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  c.strokeStyle = ICE;
  c.lineWidth = 2.2;
  c.lineCap = 'round';
  for (let f = -2; f <= 1; f++) {
    const a = base + f * 0.3 + 0.15;
    const j: Pt = [hand[0] + Math.cos(a) * 14, hand[1] + Math.sin(a) * 14];
    c.beginPath();
    c.moveTo(hand[0], hand[1]);
    c.lineTo(j[0], j[1]);
    c.lineTo(j[0] + Math.cos(a + 0.5) * 11, j[1] + Math.sin(a + 0.5) * 11);
    c.stroke();
  }
  c.fillStyle = ICE_DARK;
  c.beginPath();
  c.arc(hand[0], hand[1], 4.4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** What it holds before the release: an orb of cold light, a rotten knot, an icicle growing. */
function drawHeld(c: Ctx, held: { motion: string; u: number }, hand: Pt): void {
  c.save();
  c.globalAlpha = clamp01((held.u - 0.2) * 3);
  if (held.motion === 'lobbed') {
    const x = hand[0] - 6;
    const y = hand[1] - 28;
    c.fillStyle = radial(c, x, y, 2, 34, [
      { at: 0, colour: withAlpha('#e6fbff', 0.95) },
      { at: 0.35, colour: withAlpha(CYAN, 0.6) },
      { at: 1, colour: withAlpha(CYAN, 0) },
    ]);
    c.beginPath();
    c.arc(x, y, 34, 0, Math.PI * 2);
    c.fill();
  } else if (held.motion === 'rolled') {
    c.fillStyle = '#6a4e36';
    c.beginPath();
    c.ellipse(hand[0] - 6, hand[1] - 12, 15, 13, 0.3, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#2a1c12';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(hand[0] - 6, hand[1] - 12, 6, 0, Math.PI * 2);
    c.stroke();
  } else {
    const len = 12 + 38 * held.u;
    c.fillStyle = '#e6f6ff';
    c.beginPath();
    c.moveTo(hand[0] - 5, hand[1] - 4);
    c.lineTo(hand[0] - 4 - len * 0.35, hand[1] - len);
    c.lineTo(hand[0] + 4, hand[1] - 6);
    c.closePath();
    c.fill();
    c.strokeStyle = withAlpha(CYAN, 0.8);
    c.lineWidth = 1.2;
    c.stroke();
  }
  c.restore();
}

/** Wisps: small streaks that fly off when it is hit and rise as it unravels. */
function drawWisps(c: Ctx, n: number, spread: number, rise: number, alpha: number, calm: boolean): void {
  if (alpha <= 0.02) return;
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (hash(i, 61) - 0.5) * 2.2;
    const d = spread * (0.4 + hash(i, 62) * 0.8);
    const x = -30 + hash(i, 63) * 100 + Math.cos(a) * d;
    const y = -170 - hash(i, 64) * 80 + Math.sin(a) * d - rise * (calm ? 0 : 0) - rise * (40 + hash(i, 65) * 120);
    c.strokeStyle = withAlpha(i % 2 ? CYAN : ICE, alpha * (0.5 + hash(i, 66) * 0.4));
    c.lineWidth = 2 + hash(i, 67) * 2.4;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + 8, y - 12, x + 2, y - 24 - hash(i, 68) * 20);
    c.stroke();
  }
  c.restore();
}

/** Draw the Hollow Wraith floating at (x, groundY). */
export function drawHollowWraith(ctx: Ctx, x: number, groundY: number, pose: BossPose): void {
  const calm = pose.reducedMotion;
  const down = ease(pose.down ?? 0);
  const t = pose.nowMs;
  const body = bodyPoseFor(pose, SET);
  const bob = calm ? 0 : Math.sin(t / 1400) * 6;
  const sw = calm ? 0 : Math.sin(t / 1100) * 8;
  const recoil = calm ? 0 : pose.hurt * 14;
  // The light in its eyes holds steady (a slow breath under 0.2 Hz), brightens when it is hit and goes out as it unravels.
  const glowing = clamp01((calm ? 0.8 : 0.74 + 0.12 * Math.sin(t / 1300)) + pose.hurt * 0.2) * (1 - down) ** 1.5;
  const smile = pose.laughing > 0.1 ? 1 : 0;
  const shiver = calm ? 0 : smile * Math.sin(t / 55) * 1.8;
  // It floats a hand's breadth off the ground, and sinks low for the roll.
  const float = 24 - body.crouch * 0.4 + bob;
  const lift = down * 40;

  ctx.save();
  ctx.translate(x + recoil + shiver, groundY);
  ctx.scale(SCALE, SCALE);
  // A faint, wide shadow: a floating thing casts a pale one.
  groundShadow(ctx, 70 + float * 0.6, 0.22 * (1 - down));

  ctx.translate(0, -float - lift);
  const yScale = lerp(1, 0.55, down);
  const alpha = 1 - down;
  // When it is hit the body ripples: a shifted ghost copy trails behind.
  if (pose.hurt > 0.05) {
    ctx.save();
    ctx.translate(18 * pose.hurt, -4 * pose.hurt);
    drawBody(ctx, sw, t, calm, 0.4 * pose.hurt * alpha, yScale);
    ctx.restore();
  }
  drawBody(ctx, sw, t, calm, alpha, yScale);

  const lh = (p: Pt): Pt => [p[0], p[1] + body.crouch * 0.4 - down * 30];
  const sink = body.crouch * 0.4;
  const sL: Pt = [SHOULDER_L[0], SHOULDER_L[1] + sink];
  const sR: Pt = [SHOULDER_R[0], SHOULDER_R[1] + sink];
  const head = { tilt: body.tilt + (pose.hurt > 0.1 ? 0.18 * pose.hurt : 0) + down * 0.4 };
  ctx.save();
  ctx.translate(0, sink - down * 10);
  ctx.globalAlpha = alpha;
  drawArm(ctx, sR, lh(body.right.elbow), lh(body.right.hand), t, calm, alpha);
  ctx.globalAlpha = 1;
  drawHead(ctx, head.tilt, pose, glowing, smile, 1 - down * 0.8, 1 - clamp01(down * 3));
  ctx.restore();
  drawArm(ctx, sL, lh(body.left.elbow), lh(body.left.hand), t, calm, alpha);
  const held = heldItem(pose);
  if (held && down === 0) drawHeld(ctx, held, lh(body.left.hand));

  // Wisps fly off when it is hit, and stream up as it comes apart.
  drawWisps(ctx, 8, (1 - pose.hurt) * 60, 0, pose.hurt * 0.9, calm);
  drawWisps(ctx, 18, 30, down * (calm ? 0.6 : 1), Math.min(1, down * 2) * (1 - down * 0.4), calm);
  ctx.restore();

  // The crown, left behind: it drops to the ground and lies there as the Wraith comes apart.
  if (down > 0.15) {
    const k = clamp01((down - 0.15) / 0.5);
    ctx.save();
    ctx.translate(x + 6, groundY);
    ctx.scale(SCALE, SCALE);
    ctx.globalAlpha = clamp01(k * 1.5);
    ctx.translate(0, -8);
    ctx.scale(1, 0.4);
    ctx.translate(0, 350);
    drawCrown(ctx, 0);
    ctx.restore();
  }
}
