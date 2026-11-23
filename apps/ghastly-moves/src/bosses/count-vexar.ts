import { clamp01, ease, hash, lerp, radial, withAlpha, type Ctx } from '../gfx';
import type { BossPose } from '../boss';
import { bodyPoseFor, groundShadow, heldItem, limb, limbRim, type BodyPose, type Pt, type PoseSet } from './rig-stages-5-7';

// Count Vexar, drawn in code. See "Stage 7: Midnight Manor and Count Vexar" in .kiro/specs/ghastly-rhythm-v2/design.md.
//
//   Silhouette  an inverted triangle: a high-collared cape and a broad mantle over narrow legs and a long cane,
//               slicked hair with a widow's peak. A V where the Pumpkin King is an A.
//   Shape lang. Sharp angles and diagonals (the collar points, the scalloped cape, the cane); round only for the
//               brooch and the eyes, so the red at his throat and the red in his eyes are where the eye goes.
//   Palette     black coat and cape, wine lining, ivory face and gloves; the one accent is crimson (eyes, brooch,
//               the edge of the lining). A pale lilac rim on the right of every shape.
//   Poses       idle (the cape breathes), lob wind-up (one hand raised, a blood orb over the palm), roll wind-up
//               (a crouch, the cane planted, an arm sweeping low), swoop wind-up (both arms out, the cape unfurled
//               into wings, a bat forming), throw, hurt (the head snaps back, the cape flares), laugh (head back,
//               fangs, the cape shakes), defeated (he comes apart into bats that fly up, and the empty cape and
//               cane fall to the floor).
//
// Drawn each frame from a few dozen shapes. With reduced motion the poses still change, but nothing breathes,
// shakes or flutters.

const SCALE = 0.76;
const SHADOW = '#0b0510';
const COAT = '#1a0c24';
const WINE = '#3a0f26';
const WINE_LIGHT = '#5e1a3c';
const IVORY = '#e9e1ea';
const IVORY_DARK = '#a99fb0';
const CRIMSON = '#e02848';
const CRIMSON_GLOW = '#ff4d6d';
const RIM = '#cbb0ff';

const SHOULDER_L: Pt = [-46, -244];
const SHOULDER_R: Pt = [46, -244];

const IDLE: BodyPose = {
  left: { elbow: [-78, -198], hand: [-66, -146] },
  right: { elbow: [82, -198], hand: [90, -150] },
  crouch: 0,
  tilt: 0,
};
/** A lob: the left hand raised, palm up, a blood orb over it. Matches the rising tell. */
const LOB: BodyPose = {
  left: { elbow: [-96, -290], hand: [-84, -352] },
  right: { elbow: [84, -206], hand: [92, -156] },
  crouch: 0,
  tilt: -0.24,
};
/** A roll: a crouch, the cane planted, the left arm sweeping low. Matches the rumbling tell. */
const ROLL: BodyPose = {
  left: { elbow: [-104, -118], hand: [-116, -34] },
  right: { elbow: [72, -148], hand: [82, -96] },
  crouch: 40,
  tilt: 0.2,
};
/** A swoop: both arms out and up, the cape spread into wings. Matches the falling whistle. */
const SWOOP: BodyPose = {
  left: { elbow: [-122, -288], hand: [-188, -362] },
  right: { elbow: [112, -288], hand: [160, -344] },
  crouch: 0,
  tilt: -0.2,
};
const THROW: BodyPose = {
  left: { elbow: [-134, -214], hand: [-212, -190] },
  right: { elbow: [82, -200], hand: [90, -152] },
  crouch: 10,
  tilt: 0.1,
};
const SET: PoseSet = { idle: IDLE, windup: { lobbed: LOB, rolled: ROLL, swooped: SWOOP }, release: THROW };

// ---- parts -----------------------------------------------------------------------------------

function bat(c: Ctx, x: number, y: number, s: number, flap: number, colour: string): void {
  c.fillStyle = colour;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x - 5 * s, y - 7 * s * flap, x - 13 * s, y - 2 * s);
  c.quadraticCurveTo(x - 9 * s, y + 1 * s, x - 6 * s, y + 4 * s);
  c.quadraticCurveTo(x - 3 * s, y, x, y + 4 * s);
  c.quadraticCurveTo(x + 3 * s, y, x + 6 * s, y + 4 * s);
  c.quadraticCurveTo(x + 9 * s, y + 1 * s, x + 13 * s, y - 2 * s);
  c.quadraticCurveTo(x + 5 * s, y - 7 * s * flap, x, y);
  c.fill();
}

/** The cape behind him: a long scalloped sheet from the mantle, wine on the inside edge. `flare` widens the hem. */
function drawCape(c: Ctx, flare: number, shake: number, sag: number): void {
  const hem = -6;
  const w = 74 + flare;
  c.fillStyle = WINE;
  c.beginPath();
  c.moveTo(-86, -236);
  c.lineTo(-w - 14, hem - 30 + sag);
  // The scalloped hem: five points.
  for (let i = 0; i < 5; i++) {
    const x0 = -w - 14 + (i / 5) * (2 * w + 28);
    const x1 = -w - 14 + ((i + 1) / 5) * (2 * w + 28);
    c.quadraticCurveTo((x0 + x1) / 2 + shake * (i % 2 ? 1 : -1), hem - 18 + sag, x1, hem - (i === 4 ? 30 : 0) + sag);
  }
  c.lineTo(86, -236);
  c.closePath();
  c.fill();
  // The black outer cape over it, narrower, so the wine shows as a lining at the edges.
  c.fillStyle = SHADOW;
  c.beginPath();
  c.moveTo(-80, -236);
  c.lineTo(-w + 2, hem - 30 + sag);
  for (let i = 0; i < 5; i++) {
    const x0 = -w + 2 + (i / 5) * (2 * w - 4);
    const x1 = -w + 2 + ((i + 1) / 5) * (2 * w - 4);
    c.quadraticCurveTo((x0 + x1) / 2 + shake * (i % 2 ? 1 : -1), hem - 24 + sag, x1, hem - 6 - (i === 4 ? 24 : 0) + sag);
  }
  c.lineTo(80, -236);
  c.closePath();
  c.fill();
  // Two long folds, and the lilac rim down the right edge, and a crimson thread along the lining's lower edge.
  c.strokeStyle = withAlpha(WINE_LIGHT, 0.55);
  c.lineWidth = 6;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(40, -230);
  c.quadraticCurveTo(52, -120, 46 + flare * 0.3, -24 + sag);
  c.stroke();
  c.strokeStyle = withAlpha(RIM, 0.55);
  c.lineWidth = 1.7;
  c.beginPath();
  c.moveTo(86, -236);
  c.lineTo(w + 14, hem - 30 + sag);
  c.stroke();
  c.strokeStyle = withAlpha(CRIMSON, 0.5);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-w - 14, hem - 30 + sag);
  c.lineTo(-86, -236);
  c.stroke();
}

/** A cape wing spread between a shoulder and a raised hand, with a scalloped lower edge. */
function drawWing(c: Ctx, shoulder: Pt, hand: Pt, hip: Pt, k: number): void {
  if (k <= 0.02) return;
  const tip: Pt = [lerp(shoulder[0], hand[0], k), lerp(shoulder[1], hand[1], k)];
  c.save();
  c.fillStyle = WINE;
  c.beginPath();
  c.moveTo(shoulder[0], shoulder[1]);
  c.lineTo(tip[0], tip[1]);
  for (let i = 1; i <= 3; i++) {
    const a: Pt = [lerp(tip[0], hip[0], (i - 1) / 3), lerp(tip[1], hip[1], (i - 1) / 3)];
    const b: Pt = [lerp(tip[0], hip[0], i / 3), lerp(tip[1], hip[1], i / 3)];
    c.quadraticCurveTo((a[0] + b[0]) / 2 + (shoulder[0] < 0 ? 14 : -14), (a[1] + b[1]) / 2 - 6, b[0], b[1]);
  }
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha(CRIMSON, 0.55);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(shoulder[0], shoulder[1]);
  c.lineTo(tip[0], tip[1]);
  c.stroke();
  c.restore();
}

function drawLegs(c: Ctx, crouch: number): void {
  c.fillStyle = SHADOW;
  c.strokeStyle = SHADOW;
  c.lineCap = 'round';
  for (const [hx, fx] of [[-16, -26], [16, 14]] as const) {
    c.lineWidth = 18;
    c.beginPath();
    c.moveTo(hx, -118 + crouch);
    c.lineTo(fx, -10);
    c.stroke();
    // A pointed shoe.
    c.beginPath();
    c.moveTo(fx - 12, 2);
    c.lineTo(fx - 34, 2);
    c.lineTo(fx - 6, -14);
    c.lineTo(fx + 10, -12);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = withAlpha(RIM, 0.55);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(24, -118 + crouch);
  c.lineTo(20, -14);
  c.stroke();
}

/** The coat: narrow, buttoned, with a waist and two short tails. The mantle sits on the shoulders. */
function drawCoat(c: Ctx, breathe: number): void {
  c.fillStyle = COAT;
  c.beginPath();
  c.moveTo(-48, -246);
  c.lineTo(-36, -134);
  c.lineTo(-48, -64);
  c.lineTo(-34, -52);
  c.lineTo(-16, -66);
  c.lineTo(0, -52);
  c.lineTo(16, -66);
  c.lineTo(34, -52);
  c.lineTo(48, -64);
  c.lineTo(36, -134);
  c.lineTo(48, -246);
  c.quadraticCurveTo(0, -256 + breathe, -48, -246);
  c.closePath();
  c.fill();
  // The white shirt front: a narrow V, and a crimson brooch.
  c.fillStyle = IVORY;
  c.beginPath();
  c.moveTo(-14, -250);
  c.lineTo(0, -170);
  c.lineTo(14, -250);
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha(IVORY_DARK, 0.7);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(0, -240);
  c.lineTo(0, -172);
  c.stroke();
  c.fillStyle = '#05020a';
  for (const y of [-150, -126, -102]) {
    c.beginPath();
    c.arc(0, y, 2.2, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = withAlpha(RIM, 0.6);
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(48, -246);
  c.lineTo(36, -134);
  c.lineTo(48, -64);
  c.stroke();
}

/** The mantle and the high collar: broad over the shoulders, two sharp points rising either side of the head. */
function drawMantle(c: Ctx, breathe: number): void {
  c.fillStyle = SHADOW;
  c.beginPath();
  c.moveTo(-96, -226);
  c.lineTo(-60, -258);
  c.lineTo(-30, -266 + breathe);
  c.lineTo(30, -266 + breathe);
  c.lineTo(60, -258);
  c.lineTo(96, -226);
  c.lineTo(66, -206);
  c.lineTo(-66, -206);
  c.closePath();
  c.fill();
  // Collar points, wine inside.
  for (const s of [-1, 1]) {
    c.fillStyle = SHADOW;
    c.beginPath();
    c.moveTo(s * 20, -262);
    c.lineTo(s * 62, -352);
    c.lineTo(s * 46, -248);
    c.closePath();
    c.fill();
    c.fillStyle = WINE;
    c.beginPath();
    c.moveTo(s * 24, -262);
    c.lineTo(s * 54, -334);
    c.lineTo(s * 42, -252);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = withAlpha(RIM, 0.65);
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(62, -352);
  c.lineTo(46, -248);
  c.moveTo(96, -226);
  c.lineTo(66, -206);
  c.stroke();
  c.strokeStyle = withAlpha(CRIMSON, 0.55);
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(-62, -352);
  c.lineTo(-46, -248);
  c.stroke();
  // The brooch at the throat.
  c.fillStyle = radial(c, 0, -246, 1, 20, [
    { at: 0, colour: withAlpha(CRIMSON_GLOW, 0.6) },
    { at: 1, colour: withAlpha(CRIMSON_GLOW, 0) },
  ]);
  c.beginPath();
  c.arc(0, -246, 20, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = CRIMSON;
  c.beginPath();
  c.arc(0, -246, 6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = withAlpha('#ffffff', 0.7);
  c.beginPath();
  c.arc(-2, -248, 1.6, 0, Math.PI * 2);
  c.fill();
}

function drawHead(c: Ctx, tilt: number, pose: BossPose, glowing: number, mouth: number): void {
  c.save();
  c.translate(0, -262);
  c.rotate(tilt);
  c.translate(0, 262);
  // The face: long and pale, a sharp chin, shaded on the left.
  c.fillStyle = IVORY;
  c.beginPath();
  c.moveTo(-20, -306);
  c.quadraticCurveTo(-24, -276, -10, -262);
  c.lineTo(0, -254);
  c.lineTo(10, -262);
  c.quadraticCurveTo(24, -276, 20, -306);
  c.quadraticCurveTo(0, -322, -20, -306);
  c.closePath();
  c.fill();
  c.fillStyle = withAlpha('#2a1a3a', 0.28);
  c.beginPath();
  c.moveTo(-20, -306);
  c.quadraticCurveTo(-24, -276, -10, -262);
  c.lineTo(-2, -258);
  c.quadraticCurveTo(-8, -286, -6, -312);
  c.closePath();
  c.fill();
  // Slicked hair with a widow's peak, and pointed ears.
  c.fillStyle = SHADOW;
  c.beginPath();
  c.moveTo(-22, -300);
  c.quadraticCurveTo(-24, -326, 0, -330);
  c.quadraticCurveTo(24, -326, 22, -300);
  c.lineTo(18, -312);
  c.lineTo(0, -300);
  c.lineTo(-18, -312);
  c.closePath();
  c.fill();
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 20, -296);
    c.lineTo(s * 33, -312);
    c.lineTo(s * 21, -284);
    c.closePath();
    c.fill();
  }
  // Eyes: narrow, angled, crimson. They narrow to a slit when he is hit and widen a little when he laughs.
  const squint = pose.hurt > 0.2 ? 0.2 : pose.laughing > 0.1 ? 0.7 : 1;
  for (const s of [-1, 1]) {
    c.fillStyle = radial(c, s * 9, -292, 1, 18, [
      { at: 0, colour: withAlpha(CRIMSON_GLOW, 0.5 * glowing) },
      { at: 1, colour: withAlpha(CRIMSON_GLOW, 0) },
    ]);
    c.beginPath();
    c.arc(s * 9, -292, 18, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = withAlpha(CRIMSON, 0.55 + 0.45 * glowing);
    c.beginPath();
    c.moveTo(s * 3, -290);
    c.lineTo(s * 16, -296 - 2 * squint);
    c.lineTo(s * 14, -291);
    c.lineTo(s * 4, -288 + 2 * squint);
    c.closePath();
    c.fill();
    // The brow, straight and low.
    c.strokeStyle = SHADOW;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(s * 2, -296);
    c.lineTo(s * 19, -302 + (1 - squint) * 4);
    c.stroke();
  }
  // A long thin nose and the mouth: a line, or open with two fangs.
  c.strokeStyle = withAlpha('#2a1a3a', 0.6);
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(0, -292);
  c.lineTo(-2.6, -276);
  c.lineTo(2, -275);
  c.stroke();
  if (mouth > 0.1) {
    c.fillStyle = '#2a0a14';
    c.beginPath();
    c.moveTo(-9, -268);
    c.quadraticCurveTo(0, -268 + 12 * mouth, 9, -268);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 6, -268);
      c.lineTo(s * 4, -268 + 7 * mouth);
      c.lineTo(s * 2, -268);
      c.closePath();
      c.fill();
    }
  } else {
    c.strokeStyle = '#2a0a14';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-8, -268);
    c.quadraticCurveTo(0, -266, 8, -268);
    c.stroke();
  }
  c.strokeStyle = withAlpha(RIM, 0.65);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(20, -306);
  c.quadraticCurveTo(24, -276, 10, -262);
  c.stroke();
  c.restore();
}

/** An arm in a black sleeve with a white cuff and glove. */
function drawArm(c: Ctx, shoulder: Pt, elbow: Pt, hand: Pt, alpha: number): void {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  limb(c, shoulder, elbow, hand, [20, 15, 9], COAT);
  limbRim(c, shoulder, elbow, hand, RIM, 0.6, 1.4);
  // The cuff, and the glove: a pale palm and long fingers.
  const ang = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  c.save();
  c.translate(hand[0], hand[1]);
  c.rotate(ang);
  c.fillStyle = IVORY;
  c.fillRect(-9, -6.5, 8, 13);
  c.fillStyle = IVORY_DARK;
  c.beginPath();
  c.ellipse(5, 0, 8, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = IVORY;
  c.lineWidth = 2.4;
  c.lineCap = 'round';
  for (let f = -1; f <= 1; f++) {
    c.beginPath();
    c.moveTo(9, f * 3);
    c.lineTo(20, f * 5);
    c.stroke();
  }
  c.restore();
  c.restore();
}

/** The cane: a thin straight shaft from the hand to the ground, with a pale knob and a silver band. */
function drawCane(c: Ctx, hand: Pt, down: number): void {
  const tip: Pt = [hand[0] + 6, -2];
  c.save();
  c.strokeStyle = '#05020a';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(hand[0], hand[1] - 8);
  c.lineTo(tip[0], tip[1]);
  c.stroke();
  c.strokeStyle = withAlpha(RIM, 0.6);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(hand[0] + 2, hand[1] - 8);
  c.lineTo(tip[0] + 2, tip[1]);
  c.stroke();
  c.fillStyle = IVORY;
  c.beginPath();
  c.arc(hand[0], hand[1] - 16, 6.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = withAlpha('#000', 0.25);
  c.beginPath();
  c.arc(hand[0] - 2, hand[1] - 14, 4, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = IVORY_DARK;
  c.fillRect(hand[0] - 3, hand[1] - 8, 6, 3);
  void down;
  c.restore();
}

/** What he holds before the release: a blood orb in the lob, a coffin tipped on its end in the roll, a bat forming in the swoop. */
function drawHeld(c: Ctx, held: { motion: string; u: number }, hand: Pt): void {
  c.save();
  c.globalAlpha = clamp01((held.u - 0.2) * 3);
  if (held.motion === 'lobbed') {
    const x = hand[0] - 4;
    const y = hand[1] - 26;
    c.fillStyle = radial(c, x, y, 2, 34, [
      { at: 0, colour: withAlpha('#ffb0bc', 0.95) },
      { at: 0.35, colour: withAlpha(CRIMSON, 0.7) },
      { at: 1, colour: withAlpha(CRIMSON, 0) },
    ]);
    c.beginPath();
    c.arc(x, y, 34, 0, Math.PI * 2);
    c.fill();
  } else if (held.motion === 'rolled') {
    c.save();
    c.translate(hand[0] - 6, hand[1] - 16);
    c.rotate(-0.3);
    c.fillStyle = '#6b4a2f';
    c.beginPath();
    c.moveTo(-8, -18);
    c.lineTo(8, -18);
    c.lineTo(13, -4);
    c.lineTo(8, 18);
    c.lineTo(-8, 18);
    c.lineTo(-13, -4);
    c.closePath();
    c.fill();
    c.strokeStyle = '#2a1a0e';
    c.lineWidth = 1.6;
    c.stroke();
    c.restore();
  } else {
    bat(c, hand[0] - 4, hand[1] - 22, 0.6 + held.u * 0.9, 1, '#d44a3a');
  }
  c.restore();
}

/** What is left when he falls: the cape in a heap and the cane on the floor. */
function drawPile(c: Ctx, grow: number): void {
  if (grow <= 0) return;
  c.save();
  c.globalAlpha = clamp01(grow * 1.4);
  c.fillStyle = WINE;
  c.beginPath();
  c.moveTo(-100, 2);
  c.quadraticCurveTo(-90, -26 * grow - 6, -30, -28 * grow);
  c.quadraticCurveTo(30, -44 * grow, 80, -22 * grow);
  c.quadraticCurveTo(120, -12 * grow, 130, 2);
  c.closePath();
  c.fill();
  c.fillStyle = SHADOW;
  c.beginPath();
  c.moveTo(-86, 2);
  c.quadraticCurveTo(-60, -18 * grow, 0, -20 * grow);
  c.quadraticCurveTo(70, -16 * grow, 110, 2);
  c.closePath();
  c.fill();
  c.strokeStyle = '#05020a';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-150, -4);
  c.lineTo(-80, -2);
  c.stroke();
  c.fillStyle = IVORY;
  c.beginPath();
  c.arc(-154, -5, 6.5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = withAlpha(RIM, 0.55);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-100, 0);
  c.quadraticCurveTo(-20, -40 * grow, 130, 0);
  c.stroke();
  c.restore();
}

/** A flock of bats that leaves the body: they spread and fly up as he comes apart. */
function drawFlock(c: Ctx, down: number, t: number, calm: boolean): void {
  if (down <= 0.02) return;
  for (let i = 0; i < 16; i++) {
    const fly = clamp01(down * 1.3 - hash(i, 71) * 0.3);
    const x = (hash(i, 72) - 0.5) * 120 + (hash(i, 73) - 0.5) * 360 * fly;
    const y = -200 + (hash(i, 74) - 0.5) * 120 - fly * (80 + hash(i, 75) * 220);
    const flap = calm ? 0.8 : 0.5 + 0.5 * Math.abs(Math.sin(t / 110 + i));
    bat(c, x, y, 0.8 + hash(i, 76) * 0.7, flap, withAlpha('#0b0510', 0.95 * (1 - down * 0.5)));
  }
}

/** Draw Count Vexar standing at (x, groundY). */
export function drawCountVexar(ctx: Ctx, x: number, groundY: number, pose: BossPose): void {
  const calm = pose.reducedMotion;
  const down = ease(pose.down ?? 0);
  const t = pose.nowMs;
  const body = bodyPoseFor(pose, SET);
  const breathe = calm ? 0 : Math.sin(t / 1200) * 2.6;
  const recoil = calm ? 0 : pose.hurt * 16;
  const laugh = pose.laughing > 0.1 ? 1 : 0;
  // The red in his eyes holds steady (a slow breath under 0.2 Hz), burns brighter when he is hit and dies as he falls.
  const glowing = clamp01((calm ? 0.8 : 0.74 + 0.1 * Math.sin(t / 1300)) + pose.hurt * 0.2) * (1 - down) ** 1.5;
  const shake = calm ? 0 : laugh * Math.sin(t / 50) * 4;
  const mouth = down > 0.1 ? 0 : pose.hurt > 0.2 ? 0.9 : laugh ? 0.7 + (calm ? 0.2 : 0.3 * Math.sin(t / 90)) : 0;
  // The cape unfurls into wings for the swoop: while the tell plays and through the throw.
  const spread = pose.windup?.motion === 'swooped' ? ease(pose.windup.u) : pose.throwMotion === 'swooped' && pose.throwing > 0 ? 1 - ease(pose.throwing) : 0;
  const sink = body.crouch * 0.9;
  const alpha = 1 - clamp01(down * 1.7);

  ctx.save();
  ctx.translate(x + recoil, groundY);
  ctx.scale(SCALE, SCALE);
  groundShadow(ctx, 110 + down * 20, 0.4 * alpha);

  ctx.save();
  ctx.globalAlpha = alpha;
  // The wings go behind everything, then the cape, the legs, the coat, the mantle, the head, the arms.
  const hipL: Pt = [-30, -70 + sink];
  const hipR: Pt = [30, -70 + sink];
  const handL: Pt = [body.left.hand[0], body.left.hand[1] + sink * 0.5];
  const handR: Pt = [body.right.hand[0], body.right.hand[1] + sink * 0.5];
  drawWing(ctx, [-70, -232 + sink], handL, hipL, spread);
  drawWing(ctx, [70, -232 + sink], handR, hipR, spread * (pose.windup?.motion === 'swooped' || pose.throwMotion === 'swooped' ? 1 : 0));
  ctx.save();
  ctx.translate(0, sink * 0.5);
  drawCape(ctx, pose.hurt * 16 + spread * 14, shake, sink * 0.3);
  ctx.restore();
  drawLegs(ctx, sink * 0.6);
  ctx.save();
  ctx.translate(0, sink + breathe * 0.5);
  drawCoat(ctx, breathe);
  drawMantle(ctx, breathe);
  ctx.restore();

  const lift = (p: Pt): Pt => [p[0], p[1] + sink * 0.6];
  const sL: Pt = [SHOULDER_L[0], SHOULDER_L[1] + sink + breathe * 0.5];
  const sR: Pt = [SHOULDER_R[0], SHOULDER_R[1] + sink + breathe * 0.5];
  const head = { tilt: body.tilt + (pose.hurt > 0.1 ? -0.26 * pose.hurt : 0) + (laugh ? -0.22 : 0) };
  ctx.save();
  ctx.translate(0, sink + breathe * 0.5);
  drawHead(ctx, head.tilt, pose, glowing, mouth);
  ctx.restore();
  const rh = lift(body.right.hand);
  drawCane(ctx, rh, down);
  drawArm(ctx, sR, lift(body.right.elbow), rh, 1);
  const lh = lift(body.left.hand);
  drawArm(ctx, sL, lift(body.left.elbow), lh, 1);
  const held = heldItem(pose);
  if (held && down === 0) drawHeld(ctx, held, lh);
  ctx.restore();

  drawFlock(ctx, down, t, calm);
  drawPile(ctx, clamp01((down - 0.35) / 0.5));
  ctx.restore();
}
