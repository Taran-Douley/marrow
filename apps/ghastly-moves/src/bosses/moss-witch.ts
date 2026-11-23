import { clamp01, ease, hash, lerp, radial, withAlpha, type Ctx } from '../gfx';
import type { BossPose } from '../boss';
import { bodyPoseFor, groundShadow, heldItem, limb, type BodyPose, type Pt, type PoseSet } from './rig-stages-2-4';

// The Moss Witch, drawn in code. See "The Moss Witch (Stage 3 redo)" in .kiro/specs/ghastly-rhythm-v2/design.md.
//
//   Silhouette  low and wide at the foot, a hunched hump of moss, and a huge hat bent over to one side, its tip
//               drooping. Lopsided on purpose: the opposite of the Bone Warden's upright bars. A tall crooked staff
//               with a green orb stands beside her.
//   Shape lang. Curves, scallops, droops and spirals: moss clumps, hanging ropes of hair, a hooked nose, a bent hat.
//               Nothing is straight except the staff.
//   Palette     near-black green for the body, two mossy mids, a pale lichen for the lights; the one accent is
//               acid green, the glow of her eyes, her staff's orb and the hex that gathers in her hand.
//   Poses       idle, lob wind-up (the front hand raised, a hex of green sparks gathering, the hat tipped back),
//               roll wind-up (a crouch, a ball of moss scooped low and swung back), throw, hurt (the hat is knocked
//               askew, the eyes shut, clumps of moss fly off), laugh (a wide cackle, shoulders and hat shaking),
//               defeated (she sinks into a mound of moss, the hat tumbles off, the glow dies, toadstools sprout).
//
// Drawn each frame from a few dozen shapes. With reduced motion the poses still change, but nothing sways,
// bobs or flickers.

const SCALE = 0.76;
const NIGHT = '#06100a';
const MOSS_D = '#142a18';
const MOSS_M = '#27472a';
const LICHEN = '#6f9a58';
const ACID = '#a6ff5e';
const ACID_HOT = '#eaffc4';
const RIM = '#8fd6b4';
const STAFF_X = 114;

const IDLE: BodyPose = {
  left: { elbow: [-100, -150], hand: [-114, -102] },
  right: { elbow: [96, -172], hand: [STAFF_X, -134] },
  crouch: 0,
  tilt: 0,
};
/** A lob: the front hand raised high with its palm up, the head tipped back. Matches the rising tell. */
const LOB: BodyPose = {
  left: { elbow: [-92, -280], hand: [-52, -352] },
  right: { elbow: [98, -206], hand: [STAFF_X, -168] },
  crouch: 0,
  tilt: -0.24,
};
/** A roll: a crouch, the front hand scooping low and back. Matches the rumbling tell. */
const ROLL: BodyPose = {
  left: { elbow: [-114, -98], hand: [-78, -26] },
  right: { elbow: [100, -150], hand: [STAFF_X, -112] },
  crouch: 32,
  tilt: 0.16,
};
const SWOOP: BodyPose = {
  left: { elbow: [-118, -248], hand: [-176, -318] },
  right: { elbow: [98, -176], hand: [STAFF_X, -138] },
  crouch: 6,
  tilt: -0.14,
};
const THROW: BodyPose = {
  left: { elbow: [-130, -192], hand: [-198, -170] },
  right: { elbow: [96, -172], hand: [STAFF_X, -134] },
  crouch: 10,
  tilt: 0.1,
};
const SET: PoseSet = { idle: IDLE, windup: { lobbed: LOB, rolled: ROLL, swooped: SWOOP }, release: THROW };

// ---- the body: a hump of moss --------------------------------------------------------------

const TOP = -196;
/** Half-width of the moss mound at height y, left and right (the hump on the back makes the right side fuller). */
const widthAt = (y: number, side: -1 | 1): number => {
  const u = clamp01((y - TOP) / -TOP);
  const base = 66 + 86 * u ** 1.15;
  return side === 1 ? base + 30 * Math.sin(Math.PI * Math.min(1, u * 1.25)) : base;
};

function drawBody(c: Ctx, shake: number, sinkY: number): void {
  c.save();
  c.translate(shake, 0);
  // The dark mass.
  c.fillStyle = NIGHT;
  c.beginPath();
  c.moveTo(-widthAt(-2, -1), 2);
  for (let y = -2; y >= TOP; y -= 10) c.lineTo(-widthAt(y, -1), y);
  c.quadraticCurveTo(0, TOP - 26, widthAt(TOP, 1), TOP);
  for (let y = TOP; y <= -2; y += 10) c.lineTo(widthAt(y, 1), y);
  c.lineTo(widthAt(-2, 1), 2);
  c.closePath();
  c.fill();
  // Moss clumps over it, back to front, the pale ones on the lit (right) side: scalloped edges, never a smooth cone.
  const clumps: { x: number; y: number; r: number; k: number }[] = [];
  for (let i = 0; i < 74; i++) {
    const y = -6 - hash(i, 211) * 192;
    const edge = hash(i, 212) < 0.62;
    const side: -1 | 1 = hash(i, 213) < 0.5 ? -1 : 1;
    const r = 11 + hash(i, 214) * 12;
    const x = edge ? side * (widthAt(y, side) - r * 0.45) : (hash(i, 215) - 0.5) * 2 * (widthAt(y, 1) - r);
    clumps.push({ x, y, r, k: hash(i, 216) });
  }
  clumps.sort((a, b) => a.y - b.y);
  for (const k of clumps) {
    const lit = k.x > 10;
    c.fillStyle = k.k < 0.34 ? MOSS_D : k.k < 0.76 ? MOSS_M : lit ? LICHEN : MOSS_M;
    c.beginPath();
    c.ellipse(k.x, k.y, k.r, k.r * 0.72, hash(k.y, 217) - 0.5, 0, Math.PI * 2);
    c.fill();
    if (lit && k.k > 0.3) {
      c.strokeStyle = withAlpha(RIM, 0.5);
      c.lineWidth = 1.4;
      c.beginPath();
      c.ellipse(k.x, k.y, k.r, k.r * 0.72, hash(k.y, 217) - 0.5, -1.5, -0.2);
      c.stroke();
    }
  }
  // A few lit spores in the moss: the accent, small.
  for (let i = 0; i < 9; i++) {
    const y = -20 - hash(i, 218) * 150;
    const x = (hash(i, 219) - 0.5) * 2 * (widthAt(y, 1) - 24);
    c.fillStyle = withAlpha(ACID, 0.55);
    c.beginPath();
    c.arc(x, y, 1.9, 0, Math.PI * 2);
    c.fill();
  }
  // Ropes of moss hanging off the hem.
  c.strokeStyle = MOSS_D;
  c.lineWidth = 3;
  c.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const x = -140 + i * 25 + hash(i, 220) * 10;
    c.beginPath();
    c.moveTo(x, -18);
    c.quadraticCurveTo(x + 4, -4, x - 2 + hash(i, 221) * 8, 6 + hash(i, 222) * 4);
    c.stroke();
  }
  c.restore();
  void sinkY;
}

// ---- the staff -------------------------------------------------------------------------------

function drawStaff(c: Ctx, handY: number, glow: number, alpha: number): void {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = '#0c0f09';
  c.lineWidth = 8;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(STAFF_X - 4, 0);
  c.bezierCurveTo(STAFF_X + 8, -90, STAFF_X - 8, -200, STAFF_X + 2, -300);
  c.stroke();
  c.strokeStyle = withAlpha(RIM, 0.5);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(STAFF_X, 0);
  c.bezierCurveTo(STAFF_X + 12, -90, STAFF_X - 4, -200, STAFF_X + 6, -300);
  c.stroke();
  // The crook at the top: three curled twigs that hold the orb.
  c.strokeStyle = '#0c0f09';
  c.lineWidth = 5;
  for (const dx of [-1, 0, 1]) {
    c.beginPath();
    c.moveTo(STAFF_X + 2, -296);
    c.bezierCurveTo(STAFF_X + dx * 22, -312, STAFF_X + dx * 20, -340, STAFF_X + dx * 8, -342);
    c.stroke();
  }
  // The orb: acid green, a halo and a hot core. It breathes at about 0.15 Hz and never flickers.
  c.fillStyle = radial(c, STAFF_X + 2, -322, 2, 62, [
    { at: 0, colour: withAlpha(ACID, 0.5 * glow) },
    { at: 1, colour: withAlpha(ACID, 0) },
  ]);
  c.beginPath();
  c.arc(STAFF_X + 2, -322, 62, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = withAlpha(ACID, 0.5 + 0.5 * glow);
  c.beginPath();
  c.arc(STAFF_X + 2, -322, 11, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = withAlpha(ACID_HOT, 0.5 + 0.5 * glow);
  c.beginPath();
  c.arc(STAFF_X, -324, 5, 0, Math.PI * 2);
  c.fill();
  c.restore();
  void handY;
}

// ---- arms ---------------------------------------------------------------------------------------

/** A long, thin, twiggy hand: four fingers that fan and hook, with knuckle knots. */
function drawHand(c: Ctx, hand: Pt, elbow: Pt, open: number): void {
  const base = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = '#0b130a';
  for (let f = -2; f <= 1; f++) {
    const ang = base + (f + 0.5) * 0.3 * (0.5 + open);
    const L = 22 + (f === -1 || f === 0 ? 5 : 0);
    const mx = hand[0] + Math.cos(ang) * L * 0.55;
    const my = hand[1] + Math.sin(ang) * L * 0.55;
    c.lineWidth = 3.4;
    c.beginPath();
    c.moveTo(hand[0], hand[1]);
    c.lineTo(mx, my);
    c.lineTo(mx + Math.cos(ang + 0.7) * L * 0.5, my + Math.sin(ang + 0.7) * L * 0.5);
    c.stroke();
  }
  c.restore();
}

function drawArm(c: Ctx, shoulder: Pt, elbow: Pt, hand: Pt, alpha: number, open: number): void {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  limb(c, shoulder, elbow, hand, [17, 11, 7], '#0b130a');
  limb(c, shoulder, elbow, hand, [8, 5, 3], MOSS_M);
  // A rim along the lit side and a knot at the elbow.
  c.strokeStyle = withAlpha(RIM, 0.5);
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(shoulder[0] + 4, shoulder[1] - 6);
  c.lineTo(elbow[0] + 4, elbow[1] - 6);
  c.lineTo(hand[0] + 3, hand[1] - 4);
  c.stroke();
  c.fillStyle = '#0b130a';
  c.beginPath();
  c.arc(elbow[0], elbow[1], 7, 0, Math.PI * 2);
  c.fill();
  // A fringe of moss at the shoulder.
  c.fillStyle = MOSS_M;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.ellipse(shoulder[0] + (i - 1.5) * 7, shoulder[1] + 4 + (i % 2) * 5, 9, 6.5, 0, 0, Math.PI * 2);
    c.fill();
  }
  drawHand(c, hand, elbow, open);
  c.restore();
}

// ---- head and hat -------------------------------------------------------------------------------

function drawHat(c: Ctx): void {
  // The cone: broad at the brim, bending over and drooping at the tip.
  c.fillStyle = '#080f0a';
  c.beginPath();
  c.moveTo(-48, -22);
  c.bezierCurveTo(-40, -70, -10, -112, 30, -126);
  c.bezierCurveTo(60, -134, 88, -122, 104, -92);
  c.bezierCurveTo(110, -80, 118, -66, 112, -52);
  c.bezierCurveTo(104, -66, 92, -78, 76, -80);
  c.bezierCurveTo(60, -50, 40, -34, 46, -20);
  c.closePath();
  c.fill();
  // The brim: a wide ellipse, tilted, with a ragged edge.
  c.beginPath();
  c.ellipse(0, -20, 86, 15, -0.08, 0, Math.PI * 2);
  c.fill();
  // The band, with a small toadstool as a buckle.
  c.fillStyle = '#1a1030';
  c.beginPath();
  c.moveTo(-46, -30);
  c.quadraticCurveTo(0, -20, 44, -30);
  c.lineTo(42, -42);
  c.quadraticCurveTo(0, -32, -44, -42);
  c.closePath();
  c.fill();
  c.fillStyle = LICHEN;
  c.beginPath();
  c.ellipse(-6, -38, 9, 6, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = '#c8d8b0';
  c.fillRect(-8, -38, 4, 7);
  // A moss patch on the cone, and the moon's rim on its upper edge.
  c.fillStyle = withAlpha(MOSS_M, 0.7);
  c.beginPath();
  c.ellipse(-20, -66, 11, 7, 0.7, 0, Math.PI * 2);
  c.ellipse(40, -100, 9, 6, 0.2, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = withAlpha(RIM, 0.7);
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(-34, -64);
  c.bezierCurveTo(-18, -100, 8, -118, 30, -126);
  c.bezierCurveTo(60, -134, 88, -122, 104, -92);
  c.stroke();
  c.beginPath();
  c.ellipse(0, -20, 86, 15, -0.08, 3.5, 5.6);
  c.stroke();
}

function drawFace(c: Ctx, pose: BossPose, glow: number, cackle: number): void {
  // The face under the brim: a long dark oval with a hooked nose and chin. Only the eyes light it.
  c.fillStyle = '#0a140c';
  c.beginPath();
  c.moveTo(-28, -14);
  c.quadraticCurveTo(-34, 24, -8, 40);
  c.quadraticCurveTo(0, 46, 12, 36);
  c.quadraticCurveTo(30, 20, 28, -14);
  c.closePath();
  c.fill();
  // The hooked nose: a dark triangle bending down over the mouth.
  c.fillStyle = '#0d1a0f';
  c.beginPath();
  c.moveTo(-4, 0);
  c.quadraticCurveTo(-14, 14, -16, 30);
  c.quadraticCurveTo(-6, 26, 3, 14);
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha(RIM, 0.5);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-3, 1);
  c.quadraticCurveTo(-12, 14, -14, 28);
  c.stroke();
  // Eyes: slanted slits of acid green with a halo, shut to a line when she is hit.
  const open = pose.hurt > 0.2 ? 0.1 : 1;
  for (const sx of [-1, 1]) {
    c.fillStyle = radial(c, sx * 13, 0, 1, 20, [
      { at: 0, colour: withAlpha(ACID, 0.5 * glow) },
      { at: 1, colour: withAlpha(ACID, 0) },
    ]);
    c.beginPath();
    c.arc(sx * 13, 0, 20, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = withAlpha(ACID, 0.6 + 0.4 * glow);
    c.beginPath();
    c.moveTo(sx * 5, 3);
    c.lineTo(sx * 23, -3 * open - 1);
    c.lineTo(sx * 20, 3 + 5 * open);
    c.closePath();
    c.fill();
  }
  // The mouth: a thin crooked line; in a cackle, wide open with a few crooked teeth.
  if (cackle > 0.05) {
    c.fillStyle = '#04080a';
    c.beginPath();
    c.moveTo(-17, 24);
    c.quadraticCurveTo(0, 24 + 18 * cackle, 17, 22);
    c.quadraticCurveTo(0, 28, -17, 24);
    c.closePath();
    c.fill();
    c.fillStyle = '#c8d8b0';
    for (const [tx, ty] of [[-10, 26], [-2, 29], [7, 28], [13, 25]] as const) {
      c.beginPath();
      c.moveTo(tx - 2, ty);
      c.lineTo(tx, ty + 6 * cackle);
      c.lineTo(tx + 2, ty);
      c.fill();
    }
  } else {
    c.strokeStyle = '#04080a';
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-14, 26);
    c.quadraticCurveTo(-2, 30, 3, 25);
    c.quadraticCurveTo(10, 22, 15, 26);
    c.stroke();
  }
}

function drawHair(c: Ctx, sway: number): void {
  // Ropes of moss hair, long and uneven, hanging from under the brim.
  c.strokeStyle = MOSS_D;
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const side = i < 5 ? -1 : 1;
    const x = side * (24 + (i % 5) * 7);
    c.lineWidth = 6 - (i % 3);
    c.beginPath();
    c.moveTo(x, -8);
    c.bezierCurveTo(x + side * 8 + sway, 14, x + side * 14 - sway, 44, x + side * (10 + hash(i, 230) * 16) + sway * 1.4, 70 + hash(i, 231) * 30);
    c.stroke();
  }
  c.strokeStyle = withAlpha(LICHEN, 0.4);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(34, -6);
  c.bezierCurveTo(44 + sway, 14, 52 - sway, 44, 46 + sway, 76);
  c.stroke();
}

function drawHead(c: Ctx, hx: number, hy: number, tilt: number, hatKnock: number, pose: BossPose, glow: number, cackle: number, sway: number): void {
  c.save();
  c.translate(hx, hy);
  c.rotate(tilt);
  drawHair(c, sway);
  drawFace(c, pose, glow, cackle);
  // The hat sits on the head, and is knocked askew when she is hit.
  c.save();
  c.translate(hatKnock * 22, -hatKnock * 8);
  c.rotate(hatKnock * 0.28);
  drawHat(c);
  c.restore();
  c.restore();
}

/** What is left: a low mound of moss, a toppled hat, toadstools. `grow` is 0 to 1. */
function drawMound(c: Ctx, grow: number): void {
  if (grow <= 0) return;
  c.save();
  c.globalAlpha = clamp01(grow * 1.5);
  for (let i = 0; i < 16; i++) {
    c.fillStyle = hash(i, 240) < 0.5 ? MOSS_M : MOSS_D;
    c.beginPath();
    c.ellipse(-100 + i * 14 + hash(i, 241) * 8, -10 - hash(i, 242) * 18, 16 + hash(i, 243) * 8, 10, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.save();
  c.translate(-92, -22);
  c.rotate(-1.15);
  c.scale(0.55, 0.55);
  drawHat(c);
  c.restore();
  for (const [x, r] of [[40, 9], [66, 12], [88, 8]] as const) {
    c.fillStyle = '#c8d8b0';
    c.fillRect(x - 2, -24, 4, 16);
    c.fillStyle = LICHEN;
    c.beginPath();
    c.ellipse(x, -24, r, r * 0.6, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = withAlpha(ACID, 0.6 * (1 - grow * 0.5));
    c.beginPath();
    c.arc(x, -25, 1.8, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** What she holds before the release: a hex of green sparks in the lob, a ball of moss in the roll. */
function drawHeld(c: Ctx, held: { motion: string; u: number }, hand: Pt, glow: number): void {
  const a = clamp01((held.u - 0.2) * 3);
  c.save();
  c.globalAlpha = a;
  if (held.motion === 'rolled') {
    c.fillStyle = MOSS_M;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.ellipse(hand[0] - 6 + Math.cos(i * 1.1) * 8, hand[1] - 14 + Math.sin(i * 1.1) * 8, 9, 7, i, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    c.fillStyle = radial(c, hand[0], hand[1] - 18, 2, 44, [
      { at: 0, colour: withAlpha(ACID, 0.5 * glow) },
      { at: 1, colour: withAlpha(ACID, 0) },
    ]);
    c.beginPath();
    c.arc(hand[0], hand[1] - 18, 44, 0, Math.PI * 2);
    c.fill();
    // A six-pointed star of two triangles.
    c.fillStyle = withAlpha(ACID, 0.9);
    for (const flip of [0, Math.PI]) {
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const ang = flip + -Math.PI / 2 + (k * 2 * Math.PI) / 3;
        const px = hand[0] + Math.cos(ang) * 14;
        const py = hand[1] - 18 + Math.sin(ang) * 14;
        if (k === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}

/** Draw the Moss Witch standing at (x, groundY). */
export function drawMossWitch(ctx: Ctx, x: number, groundY: number, pose: BossPose): void {
  const calm = pose.reducedMotion;
  const down = ease(pose.down ?? 0);
  const t = pose.nowMs;
  const body = bodyPoseFor(pose, SET);
  const breathe = calm ? 0 : Math.sin(t / 1300) * 2.5;
  const recoil = calm ? 0 : pose.hurt * 16;
  const cackle = pose.laughing > 0.1 ? 1 : 0;
  // She shakes with laughter at about 2 Hz, a few pixels; none with reduced motion.
  const shake = calm ? 0 : cackle ? Math.sin(t / 80) * 3 : 0;
  const hairSway = calm ? 0 : Math.sin(t / 1100) * 5;
  const glow = clamp01((calm ? 0.8 : 0.72 + 0.1 * Math.sin(t / 1000)) + pose.hurt * 0.2) * (1 - down) ** 1.5;
  const crouch = body.crouch * (1 - down);

  ctx.save();
  ctx.translate(x + recoil, groundY);
  ctx.scale(SCALE, SCALE);
  groundShadow(ctx, 160 + down * 20);

  drawStaff(ctx, body.right.hand[1], glow, 1 - down);

  ctx.save();
  ctx.translate(0, crouch * 0.4 + down * 130);
  ctx.scale(1 + down * 0.3, lerp(1 - crouch / 330, 0.28, down));
  drawBody(ctx, shake, 0);
  ctx.restore();

  const droop = down * 90;
  const lift = (p: Pt): Pt => [p[0] + shake, p[1] + crouch * 0.5 + droop];
  const sh = (p: Pt): Pt => [p[0] + shake, p[1] + crouch * 0.8 + down * 150];
  drawArm(ctx, sh([66, -190]), lift(body.right.elbow), lift(body.right.hand), 1 - down, 0.2);
  const head = {
    x: lerp(-4 + shake, -30, down * down),
    y: lerp(-228 + crouch + breathe, -34, down * down),
    tilt: lerp(body.tilt, -0.5, down),
  };
  const hatKnock = down > 0 ? 0 : clamp01(pose.hurt * 1.2);
  if (down < 0.7) drawHead(ctx, head.x, head.y, head.tilt, hatKnock, pose, glow, cackle, hairSway);
  const lh = lift(body.left.hand);
  drawArm(ctx, sh([-66, -190]), lift(body.left.elbow), lh, 1 - down, pose.throwing > 0 ? 1.4 : 0.5);
  const held = heldItem(pose);
  if (held && down === 0) drawHeld(ctx, held, lh, glow);

  drawMound(ctx, down);

  // When hit, clumps of moss are shaken loose and fall.
  if (pose.hurt > 0.02) {
    const fall = 1 - pose.hurt;
    ctx.globalAlpha = clamp01(pose.hurt * 1.6);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? MOSS_M : LICHEN;
      ctx.beginPath();
      ctx.ellipse(-70 + i * 26, -150 + (calm ? 20 : fall * (80 + hash(i, 250) * 60)), 9, 6, i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
