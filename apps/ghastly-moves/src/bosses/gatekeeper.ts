import { clamp01, ease, hash, lerp, radial, withAlpha, type Ctx } from '../gfx';
import type { BossPose } from '../boss';
import { bodyPoseFor, groundShadow, heldItem, limb, type BodyPose, type Pt, type PoseSet } from './rig-stages-2-4';

// The Gatekeeper, drawn in code. See "The Gatekeeper (Stage 4 redo)" in .kiro/specs/ghastly-rhythm-v2/design.md.
//
//   Silhouette  wide and square: a gate that walks. A flat-topped great helm on huge square pauldrons with spikes,
//               a chest that is a portcullis, and a tower shield planted at his side. The opposite of the Warden's
//               thin bars and the Witch's lopsided droop.
//   Shape lang. Rectangles and spikes. Rivets, bars, plates. The only curves are the ring of the padlock and the
//               links of the chain across his chest.
//   Palette     near-black iron, a blue-violet steel mid, a pale steel for the lights; the one accent is furnace
//               orange: the cross-shaped slit of his visor and the fire you see through the bars of his chest.
//   Poses       idle, lob wind-up (a spiked mace raised over the helm, the head back), roll wind-up (a deep crouch,
//               an iron ball on a chain swung back along the floor), swoop wind-up (a bolt held high and out),
//               throw, hurt (the plates rattle apart, sparks fly, the visor narrows), laugh (the helm tips back
//               and the chest heaves), defeated (the helm tumbles off, the plates fall in a heap, the fire dies).
//
// Drawn each frame from a few dozen shapes. With reduced motion the poses still change, but nothing rattles,
// heaves or flickers.

const SCALE = 0.72;
const IRON = '#0b0c1a';
const STEEL_D = '#1c1f36';
const STEEL = '#2c3050';
const STEEL_L = '#5d6490';
const RIM = '#9aa0dc';
const FIRE = '#ff8a3d';
const FIRE_HOT = '#ffd9a0';

const IDLE: BodyPose = {
  left: { elbow: [-126, -160], hand: [-128, -106] },
  right: { elbow: [128, -170], hand: [124, -122] },
  crouch: 0,
  tilt: 0,
};
/** A lob: the mace raised over the helm in the front hand, the head back. Matches the rising tell. */
const LOB: BodyPose = {
  left: { elbow: [-118, -288], hand: [-76, -360] },
  right: { elbow: [128, -170], hand: [124, -122] },
  crouch: 0,
  tilt: -0.2,
};
/** A roll: a deep crouch, the ball swung low and back. Matches the rumbling tell. */
const ROLL: BodyPose = {
  left: { elbow: [-132, -112], hand: [-92, -28] },
  right: { elbow: [128, -150], hand: [124, -110] },
  crouch: 40,
  tilt: 0.14,
};
/** A swoop: the arm flung high and out with a bolt in it. */
const SWOOP: BodyPose = {
  left: { elbow: [-140, -262], hand: [-198, -334] },
  right: { elbow: [128, -170], hand: [124, -122] },
  crouch: 8,
  tilt: -0.14,
};
const THROW: BodyPose = {
  left: { elbow: [-152, -214], hand: [-214, -184] },
  right: { elbow: [128, -170], hand: [124, -122] },
  crouch: 12,
  tilt: 0.08,
};
const SET: PoseSet = { idle: IDLE, windup: { lobbed: LOB, rolled: ROLL, swooped: SWOOP }, release: THROW };

const SHOULDER_L: Pt = [-100, -226];
const SHOULDER_R: Pt = [100, -226];

// ---- parts -----------------------------------------------------------------------------------

function rivets(c: Ctx, x: number, y: number, w: number, h: number): void {
  c.fillStyle = STEEL_L;
  for (const [dx, dy] of [[4, 4], [w - 4, 4], [4, h - 4], [w - 4, h - 4]] as const) {
    c.beginPath();
    c.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2);
    c.fill();
  }
}

/** A plate: a filled rectangle with a pale top edge and a darker foot, so it has a lit side and a shaded one. */
function plate(c: Ctx, x: number, y: number, w: number, h: number, colour = STEEL): void {
  c.fillStyle = colour;
  c.fillRect(x, y, w, h);
  c.fillStyle = withAlpha('#000000', 0.25);
  c.fillRect(x, y + h * 0.72, w, h * 0.28);
  c.fillStyle = withAlpha(RIM, 0.55);
  c.fillRect(x, y, w, 1.8);
  c.fillRect(x + w - 1.8, y, 1.8, h);
  rivets(c, x, y, w, h);
}

function legs(c: Ctx, crouch: number, rattle: number): void {
  for (const side of [-1, 1]) {
    const x = side * 46;
    c.fillStyle = IRON;
    c.fillRect(x - 28, -96 + crouch * 0.4, 56, 96 - crouch * 0.4);
    plate(c, x - 30 + rattle * side, -88 + crouch * 0.4, 60, 36, STEEL_D);
    plate(c, x - 32, -26, 64, 26, STEEL);
    // A knee spike.
    c.fillStyle = STEEL_L;
    c.beginPath();
    c.moveTo(x - 8, -88 + crouch * 0.4);
    c.lineTo(x, -112 + crouch * 0.4);
    c.lineTo(x + 8, -88 + crouch * 0.4);
    c.closePath();
    c.fill();
  }
}

/** The chest: a portcullis, with the furnace burning behind the bars, a chain across and a padlock on it. */
function torso(c: Ctx, glow: number, heave: number, rattle: number): void {
  const top = -240 + heave;
  const bottom = -92;
  // The iron frame, wider at the shoulders.
  c.fillStyle = IRON;
  c.beginPath();
  c.moveTo(-98, top);
  c.lineTo(98, top);
  c.lineTo(78, bottom);
  c.lineTo(-78, bottom);
  c.closePath();
  c.fill();
  // The furnace behind the bars: a glow rising from the belly.
  c.save();
  c.beginPath();
  c.moveTo(-86, top + 12);
  c.lineTo(86, top + 12);
  c.lineTo(68, bottom - 8);
  c.lineTo(-68, bottom - 8);
  c.closePath();
  c.clip();
  c.fillStyle = '#05050f';
  c.fillRect(-100, top, 200, bottom - top);
  c.fillStyle = radial(c, 0, bottom - 40, 4, 120, [
    { at: 0, colour: withAlpha(FIRE_HOT, 0.8 * glow) },
    { at: 0.35, colour: withAlpha(FIRE, 0.7 * glow) },
    { at: 1, colour: withAlpha(FIRE, 0) },
  ]);
  c.fillRect(-100, top, 200, bottom - top);
  c.restore();
  // The bars: vertical, with three crossbands, and spiked feet along the bottom.
  c.fillStyle = STEEL_D;
  for (let x = -76; x <= 76; x += 15) {
    c.fillRect(x - 3, top + 10, 6, bottom - top - 20);
    c.fillStyle = withAlpha(RIM, 0.5);
    c.fillRect(x + 1.2, top + 10, 1.6, bottom - top - 20);
    c.fillStyle = STEEL_D;
  }
  for (const y of [top + 10, top + 54, bottom - 24]) {
    c.fillStyle = STEEL;
    c.fillRect(-90 + (y === top + 10 ? 0 : 6), y, 180 - (y === top + 10 ? 0 : 12), 9);
    c.fillStyle = withAlpha(RIM, 0.5);
    c.fillRect(-90 + (y === top + 10 ? 0 : 6), y, 180 - (y === top + 10 ? 0 : 12), 1.6);
  }
  for (let x = -66; x <= 66; x += 22) {
    c.fillStyle = STEEL_L;
    c.beginPath();
    c.moveTo(x - 5, bottom);
    c.lineTo(x, bottom + 14);
    c.lineTo(x + 5, bottom);
    c.closePath();
    c.fill();
  }
  // A chain across the chest from the left shoulder to the right hip, with a padlock on it.
  c.strokeStyle = STEEL_L;
  c.lineWidth = 3.2;
  const x0 = -90;
  const y0 = top + 20;
  const x1 = 74;
  const y1 = bottom - 12;
  for (let i = 0; i <= 11; i++) {
    const u = i / 11;
    const lx = lerp(x0, x1, u);
    const ly = lerp(y0, y1, u) + Math.sin(u * Math.PI) * 14 + rattle * 0.6;
    c.save();
    c.translate(lx, ly);
    c.rotate(Math.atan2(y1 - y0, x1 - x0) + (i % 2 ? Math.PI / 2 : 0));
    c.beginPath();
    c.ellipse(0, 0, 8, 4.4, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
  const lx = lerp(x0, x1, 0.55);
  const ly = lerp(y0, y1, 0.55) + 12;
  c.strokeStyle = STEEL_L;
  c.lineWidth = 4;
  c.beginPath();
  c.arc(lx, ly - 4, 8, Math.PI, 0);
  c.stroke();
  c.fillStyle = STEEL;
  c.fillRect(lx - 11, ly - 4, 22, 20);
  c.fillStyle = withAlpha(RIM, 0.55);
  c.fillRect(lx - 11, ly - 4, 22, 1.8);
  c.fillStyle = '#05050f';
  c.beginPath();
  c.arc(lx, ly + 4, 2.6, 0, Math.PI * 2);
  c.fill();
  c.fillRect(lx - 1.2, ly + 4, 2.4, 6);
  // The moon's rim down the right edge of the frame.
  c.strokeStyle = withAlpha(RIM, 0.6);
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(98, top);
  c.lineTo(78, bottom);
  c.stroke();
}

function pauldron(c: Ctx, cx: number, y: number, side: number, rattle: number): void {
  const w = 64;
  const h = 40;
  const x = cx - w / 2 + rattle * side;
  plate(c, x, y, w, h, STEEL);
  // A row of upward spikes along the top.
  c.fillStyle = STEEL_L;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(x + 8 + k * 21, y);
    c.lineTo(x + 16 + k * 21, y - 22 - (k === 1 ? 8 : 0));
    c.lineTo(x + 24 + k * 21, y);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = withAlpha(RIM, 0.5);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(x + 16 + 21 * 1, y - 29);
  c.lineTo(x + 24 + 21 * 1, y);
  c.stroke();
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The gorget: a stack of steel collar bands from under the helm out to the shoulders, so the helm never floats. */
function gorget(c: Ctx, top: number, alpha: number): void {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  c.fillStyle = IRON;
  c.beginPath();
  c.moveTo(-40, top - 22);
  c.lineTo(40, top - 22);
  c.lineTo(84, top + 26);
  c.lineTo(-84, top + 26);
  c.closePath();
  c.fill();
  plate(c, -42, top - 18, 84, 14, STEEL_D);
  plate(c, -56, top - 6, 112, 14, STEEL);
  plate(c, -72, top + 6, 144, 16, STEEL_D);
  c.restore();
}

/** The great helm: a flat-topped box with a cross-shaped visor that burns, rivets, and a ring of short spikes. */
function helm(c: Ctx, pose: BossPose, glow: number, open: number): void {
  const w = 58;
  const top = -78;
  const bottom = 14;
  c.fillStyle = IRON;
  c.fillRect(-w / 2 - 4, top - 4, w + 8, bottom - top + 8);
  plate(c, -w / 2, top, w, bottom - top, STEEL);
  // The brow band and the chin plate.
  plate(c, -w / 2 - 4, top + 8, w + 8, 10, STEEL_D);
  plate(c, -w / 2 + 6, bottom - 18, w - 12, 18, STEEL_D);
  // Short spikes on the crown.
  c.fillStyle = STEEL_L;
  for (let k = -2; k <= 2; k++) {
    c.beginPath();
    c.moveTo(k * 11 - 4, top);
    c.lineTo(k * 11, top - 14 - (k === 0 ? 8 : 0));
    c.lineTo(k * 11 + 4, top);
    c.closePath();
    c.fill();
  }
  // The visor, a cross that burns.
  const hot = clamp01(glow);
  const thick = lerp(2.2, 6.4, open);
  c.fillStyle = radial(c, 0, -22, 2, 46, [
    { at: 0, colour: withAlpha(FIRE, 0.5 * hot) },
    { at: 1, colour: withAlpha(FIRE, 0) },
  ]);
  c.beginPath();
  c.arc(0, -22, 46, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#05050f';
  c.fillRect(-w / 2 + 8, -26, w - 16, thick);
  c.fillRect(-thick / 2, -50, thick, 52);
  c.fillStyle = withAlpha(FIRE_HOT, 0.4 + 0.6 * hot);
  c.fillRect(-w / 2 + 10, -26 + thick * 0.2, w - 20, thick * 0.6);
  c.fillRect(-thick * 0.3, -48, thick * 0.6, 48);
  // A dent that grows as he is hurt.
  const dent = clamp01(1 - pose.health + pose.hurt * 0.5);
  if (dent > 0.02) {
    c.strokeStyle = withAlpha('#05050f', 0.4 + dent * 0.5);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(14, top + 4);
    c.lineTo(20, top + 22);
    c.lineTo(15, top + 34);
    c.stroke();
    if (dent > 0.5) {
      c.beginPath();
      c.moveTo(-22, top + 20);
      c.lineTo(-16, top + 36);
      c.stroke();
    }
  }
  c.strokeStyle = withAlpha(RIM, 0.7);
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(w / 2, top);
  c.lineTo(w / 2, bottom);
  c.stroke();
}

function shield(c: Ctx, rattle: number): void {
  // A tower shield planted at his right: a tall plate with a portcullis cut into it, and rivets.
  const x = 112 + rattle;
  const y = -190;
  const w = 62;
  const h = 190;
  c.fillStyle = IRON;
  c.fillRect(x - 4, y - 4, w + 8, h + 4);
  plate(c, x, y, w, h, STEEL_D);
  c.fillStyle = '#05050f';
  for (let k = 0; k < 4; k++) c.fillRect(x + 12 + k * 12, y + 26, 5, 56);
  c.fillRect(x + 8, y + 40, w - 16, 5);
  c.fillRect(x + 8, y + 64, w - 16, 5);
  c.fillStyle = STEEL_L;
  c.beginPath();
  c.moveTo(x + w / 2 - 12, y);
  c.lineTo(x + w / 2, y - 18);
  c.lineTo(x + w / 2 + 12, y);
  c.closePath();
  c.fill();
  c.fillStyle = STEEL;
  c.fillRect(x + 6, y + h - 40, w - 12, 8);
}

function gauntlet(c: Ctx, hand: Pt, elbow: Pt, fist: number): void {
  const ang = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  c.save();
  c.translate(hand[0], hand[1]);
  c.rotate(ang);
  c.fillStyle = IRON;
  c.fillRect(-4, -15, 38, 30);
  c.fillStyle = STEEL;
  c.fillRect(-2, -13, 34, 26);
  c.fillStyle = withAlpha(RIM, 0.5);
  c.fillRect(-2, -13, 34, 1.8);
  // Knuckles: three short blocks, spread more when the hand is open.
  c.fillStyle = STEEL_D;
  for (let k = -1; k <= 1; k++) c.fillRect(24, k * (6 + fist * 2) - 4, 14, 8);
  c.restore();
}

function drawArm(c: Ctx, shoulder: Pt, elbow: Pt, hand: Pt, alpha: number, fist: number): void {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  limb(c, shoulder, elbow, hand, [30, 24, 20], IRON);
  limb(c, shoulder, elbow, hand, [22, 17, 13], STEEL);
  c.strokeStyle = withAlpha(RIM, 0.5);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(shoulder[0] + 8, shoulder[1] - 12);
  c.lineTo(elbow[0] + 8, elbow[1] - 10);
  c.lineTo(hand[0] + 6, hand[1] - 8);
  c.stroke();
  // The elbow: a cop with a spike.
  c.fillStyle = STEEL_D;
  c.beginPath();
  c.arc(elbow[0], elbow[1], 14, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = STEEL_L;
  c.beginPath();
  c.moveTo(elbow[0] - 4, elbow[1] - 12);
  c.lineTo(elbow[0] + 2, elbow[1] - 28);
  c.lineTo(elbow[0] + 8, elbow[1] - 12);
  c.fill();
  gauntlet(c, hand, elbow, fist);
  c.restore();
}

/** What he holds before the release: a mace in the lob, an iron ball on a chain in the roll, a bolt in the swoop. */
function drawHeld(c: Ctx, held: { motion: string; u: number }, hand: Pt): void {
  c.save();
  c.globalAlpha = clamp01((held.u - 0.2) * 3);
  if (held.motion === 'rolled') {
    c.strokeStyle = STEEL_L;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(hand[0] + 4, hand[1]);
    c.lineTo(hand[0] + 34, hand[1] + 6);
    c.stroke();
    c.fillStyle = STEEL_D;
    c.beginPath();
    c.arc(hand[0] + 50, hand[1] + 6, 17, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = withAlpha(RIM, 0.7);
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(hand[0] + 50, hand[1] + 6, 17, 3.6, 5);
    c.stroke();
  } else if (held.motion === 'swooped') {
    c.fillStyle = STEEL_L;
    c.fillRect(hand[0] - 44, hand[1] - 38, 54, 4);
    c.beginPath();
    c.moveTo(hand[0] - 44, hand[1] - 42);
    c.lineTo(hand[0] - 58, hand[1] - 36);
    c.lineTo(hand[0] - 44, hand[1] - 30);
    c.fill();
  } else {
    c.strokeStyle = IRON;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(hand[0] + 10, hand[1] + 10);
    c.lineTo(hand[0] - 6, hand[1] - 46);
    c.stroke();
    c.fillStyle = STEEL_D;
    c.beginPath();
    c.arc(hand[0] - 8, hand[1] - 56, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = STEEL_L;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      c.beginPath();
      c.moveTo(hand[0] - 8 + Math.cos(a - 0.2) * 12, hand[1] - 56 + Math.sin(a - 0.2) * 12);
      c.lineTo(hand[0] - 8 + Math.cos(a) * 24, hand[1] - 56 + Math.sin(a) * 24);
      c.lineTo(hand[0] - 8 + Math.cos(a + 0.2) * 12, hand[1] - 56 + Math.sin(a + 0.2) * 12);
      c.fill();
    }
  }
  c.restore();
}

/** What is left when he falls: a heap of plates, a padlock and a dull ember. `grow` is 0 to 1. */
function drawHeap(c: Ctx, grow: number): void {
  if (grow <= 0) return;
  c.save();
  c.globalAlpha = clamp01(grow * 1.5);
  const parts: [number, number, number, number, number][] = [
    [-120, -24, 70, 24, -0.1],
    [-30, -34, 60, 32, 0.12],
    [50, -22, 74, 22, -0.06],
    [-80, -52, 50, 22, 0.2],
    [20, -56, 56, 22, -0.14],
  ];
  parts.forEach(([x, y, w, h, rot]) => {
    c.save();
    c.translate(x + w / 2, y + h / 2);
    c.rotate(rot);
    plate(c, -w / 2, -h / 2, w, h, STEEL);
    c.restore();
  });
  for (let k = 0; k < 4; k++) {
    c.fillStyle = STEEL_L;
    c.beginPath();
    c.moveTo(-70 + k * 40, -58);
    c.lineTo(-64 + k * 40, -78 - (k % 2) * 8);
    c.lineTo(-56 + k * 40, -58);
    c.fill();
  }
  c.fillStyle = withAlpha(FIRE, 0.4 * (1 - grow * 0.6));
  c.beginPath();
  c.ellipse(-8, -34, 22, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Draw the Gatekeeper standing at (x, groundY). */
export function drawGatekeeper(ctx: Ctx, x: number, groundY: number, pose: BossPose): void {
  const calm = pose.reducedMotion;
  const down = ease(pose.down ?? 0);
  const t = pose.nowMs;
  const body = bodyPoseFor(pose, SET);
  const breathe = calm ? 0 : Math.sin(t / 1300) * 2;
  const recoil = calm ? 0 : pose.hurt * 18;
  // His plates rattle when he is hit (a few pixels, fading out) and his chest heaves when he laughs (about 2 Hz).
  const rattle = calm ? 0 : pose.hurt * Math.sin(t / 40) * 4;
  const heave = calm ? 0 : pose.laughing > 0.1 ? Math.sin(t / 80) * 3 : 0;
  const glow = clamp01((calm ? 0.8 : 0.72 + 0.1 * Math.sin(t / 1100)) + pose.hurt * 0.3 + (1 - pose.health) * 0.1) * (1 - down) ** 1.5;
  const crouch = body.crouch * (1 - down);
  const sink = crouch * 0.9 + down * 110;

  ctx.save();
  ctx.translate(x + recoil, groundY);
  ctx.scale(SCALE, SCALE);
  groundShadow(ctx, 150 + down * 30);

  ctx.save();
  ctx.globalAlpha = 1 - down * 0.4;
  legs(ctx, crouch, rattle);
  shield(ctx, rattle);
  ctx.save();
  ctx.translate(0, sink + breathe);
  ctx.scale(1, lerp(1, 0.4, down));
  ctx.globalAlpha *= clamp01(1 - down * 2.2);
  torso(ctx, glow, heave, rattle);
  gorget(ctx, -240 + heave, 1 - down * 2);
  pauldron(ctx, -104, -246 + heave, -1, rattle);
  pauldron(ctx, 104, -246 + heave, 1, rattle);
  ctx.restore();
  ctx.restore();

  const droop = down * 80;
  const lift = (p: Pt): Pt => [p[0], p[1] + crouch * 0.5 + droop];
  const shoulderL: Pt = [SHOULDER_L[0], SHOULDER_L[1] + sink];
  const shoulderR: Pt = [SHOULDER_R[0], SHOULDER_R[1] + sink];
  drawArm(ctx, shoulderR, lift(body.right.elbow), lift(body.right.hand), 1 - down, 0);
  // The helm sits in the gorget on the shoulders and moves with the body; it tips a little about its base when
  // he laughs or is hit, and falls off to the left when he is beaten.
  const neckY = -240 + heave + sink + breathe + 4;
  const hx = lerp(0, -70, down * down);
  const hy = lerp(neckY, -28, down * down);
  const lean = clamp(body.tilt * 0.3 + (pose.laughing > 0.1 ? -0.07 : 0) + (pose.hurt > 0.1 ? 0.06 * pose.hurt : 0), -0.1, 0.1);
  const tilt = lerp(lean, -1.5, down * down);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  ctx.translate(0, -14);
  helm(ctx, pose, glow, pose.hurt > 0.2 ? 0 : pose.laughing > 0.1 ? 1 : 0.55);
  ctx.restore();
  const lh = lift(body.left.hand);
  drawArm(ctx, shoulderL, lift(body.left.elbow), lh, 1 - down, pose.throwing > 0 ? 1 : 0);
  const held = heldItem(pose);
  if (held && down === 0) drawHeld(ctx, held, lh);

  drawHeap(ctx, down);

  // Sparks when he is hit: a few orange flecks thrown off the plates and falling.
  if (pose.hurt > 0.02) {
    const fall = 1 - pose.hurt;
    ctx.fillStyle = withAlpha(FIRE_HOT, clamp01(pose.hurt * 1.6));
    for (let i = 0; i < 9; i++) {
      const sx = -90 + hash(i, 260) * 190;
      const sy = -220 + hash(i, 261) * 90 + (calm ? 14 : fall * (60 + hash(i, 262) * 80));
      ctx.fillRect(sx, sy, 3, 3);
    }
  }
  ctx.restore();
}
