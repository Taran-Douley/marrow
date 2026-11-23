import { clamp01, ease, hash, lerp, radial, withAlpha, type Ctx } from '../gfx';
import type { BossPose } from '../boss';
import { bodyPoseFor, groundShadow, heldItem, limb, type BodyPose, type Pt, type PoseSet } from './rig-stages-2-4';

// The Bone Warden, drawn in code. See "The Bone Warden (Stage 2 redo)" in .kiro/specs/ghastly-rhythm-v2/design.md.
//
//   Silhouette  tall, narrow and stooped: a peaked hood over a long skull, a cage of ribs, a shroud to the floor.
//               The read at a glance is "thin vertical bars", the opposite of the Pumpkin King's wide cloak.
//   Shape lang. Straight lines and long rectangles (ribs, fingers, the keys on his belt). Round only for the
//               skull, so the face and the lantern in his chest are where the eye goes.
//   Palette     near-black shroud, bone-grey mid, pale bone for the lights; the one accent is the amber of a
//               lantern burning inside his rib cage (and a pinprick in each eye). The moon's cool rim on the right.
//   Poses       idle, lob wind-up (both arms up, a bone raised, head back), roll wind-up (a crouch, a skull
//               held low and swung back), throw, hurt (the ribs jolt apart, a bone falls, the eyes close),
//               laugh (the jaw clatters), defeated (the shroud sinks, the skull rolls off, the lantern dies).
//
// All of it is drawn each frame from a few dozen shapes. With reduced motion the poses still change, but
// nothing sways, flickers or clatters.

const SCALE = 0.76;
const SHROUD = '#0a141c';
const SHROUD_LIGHT = '#16242e';
const BONE = '#cdc7b3';
const BONE_MID = '#7d8793';
const BONE_DARK = '#2a323c';
const AMBER = '#ff9a4d';
const AMBER_HOT = '#ffe0ae';
const RIM = '#7fb4cc';

const SHOULDER_L: Pt = [-66, -236];
const SHOULDER_R: Pt = [66, -236];

const IDLE: BodyPose = {
  left: { elbow: [-96, -178], hand: [-106, -128] },
  right: { elbow: [88, -178], hand: [86, -122] },
  crouch: 0,
  tilt: 0,
};
/** A lob: both arms up over the head, a bone in the raised hand, the head tipped back. Matches the rising tell. */
const LOB: BodyPose = {
  left: { elbow: [-96, -300], hand: [-58, -376] },
  right: { elbow: [98, -296], hand: [60, -366] },
  crouch: 0,
  tilt: -0.26,
};
/** A roll: a deep crouch, the front arm swept low and far back with a skull in it. Matches the rumbling tell. */
const ROLL: BodyPose = {
  left: { elbow: [-112, -122], hand: [-70, -30] },
  right: { elbow: [100, -176], hand: [122, -112] },
  crouch: 36,
  tilt: 0.18,
};
const SWOOP: BodyPose = {
  left: { elbow: [-122, -262], hand: [-182, -340] },
  right: { elbow: [96, -170], hand: [138, -124] },
  crouch: 6,
  tilt: -0.16,
};
const THROW: BodyPose = {
  left: { elbow: [-132, -208], hand: [-200, -176] },
  right: { elbow: [78, -184], hand: [70, -128] },
  crouch: 10,
  tilt: 0.1,
};
const SET: PoseSet = { idle: IDLE, windup: { lobbed: LOB, rolled: ROLL, swooped: SWOOP }, release: THROW };

// ---- parts -----------------------------------------------------------------------------------

/** A long bone: a thin rod with a knob at each end. */
function bone(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, colour: string): void {
  c.save();
  c.strokeStyle = colour;
  c.fillStyle = colour;
  c.lineCap = 'round';
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  for (const [x, y] of [[x0, y0], [x1, y1]] as const) {
    c.beginPath();
    c.arc(x - 1.5, y - 1.5, w * 0.7, 0, Math.PI * 2);
    c.arc(x + 1.5, y + 1.5, w * 0.7, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function skull(c: Ctx, x: number, y: number, r: number, angle: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = BONE;
  c.beginPath();
  c.ellipse(0, -r * 0.1, r, r * 0.9, 0, 0, Math.PI * 2);
  c.fill();
  c.fillRect(-r * 0.55, r * 0.55, r * 1.1, r * 0.55);
  c.fillStyle = '#05090e';
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.ellipse(sx * r * 0.38, -r * 0.1, r * 0.24, r * 0.3, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.moveTo(0, r * 0.15);
  c.lineTo(-r * 0.12, r * 0.45);
  c.lineTo(r * 0.12, r * 0.45);
  c.fill();
  c.restore();
}

/** The shroud: a tall tattered cloak that hangs from the shoulders to the floor, with a peaked hood. */
function drawShroud(c: Ctx, sag: number, down: number): void {
  const top = -246;
  c.save();
  c.scale(1 + down * 0.3, lerp(1, 0.16, down));
  // Back panel: dark, widening to a ragged hem.
  c.fillStyle = SHROUD;
  c.beginPath();
  c.moveTo(-72, top);
  c.quadraticCurveTo(-90, -150, -122, -4);
  const teeth = 9;
  for (let i = 0; i <= teeth; i++) {
    const x = -122 + (i / teeth) * 244;
    c.lineTo(x, -4 + (i % 2 ? 0 : -(14 + hash(i, 201) * 18)));
  }
  c.quadraticCurveTo(92, -150, 72, top);
  c.quadraticCurveTo(0, top - 16 + sag, -72, top);
  c.closePath();
  c.fill();
  // Two long folds: a lit one on the right, a dark one down the middle.
  c.strokeStyle = SHROUD_LIGHT;
  c.lineWidth = 9;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(34, top + 20);
  c.quadraticCurveTo(54, -130, 78, -18);
  c.stroke();
  c.strokeStyle = '#04080c';
  c.lineWidth = 12;
  c.beginPath();
  c.moveTo(-30, top + 30);
  c.quadraticCurveTo(-44, -120, -64, -20);
  c.stroke();
  // The moon's rim along the right edge.
  c.strokeStyle = withAlpha(RIM, 0.55);
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(72, top);
  c.quadraticCurveTo(92, -150, 122, -8);
  c.stroke();
  c.restore();
}

function drawRibs(c: Ctx, glow: number, spread: number, calm: boolean): void {
  // The inside of the cage is dark, with the lantern burning in it.
  c.fillStyle = '#04080c';
  c.beginPath();
  c.moveTo(-50, -238);
  c.quadraticCurveTo(-62, -190, -34, -142);
  c.lineTo(34, -142);
  c.quadraticCurveTo(62, -190, 50, -238);
  c.closePath();
  c.fill();
  c.fillStyle = radial(c, 0, -192, 4, 78, [
    { at: 0, colour: withAlpha(AMBER, 0.55 * glow) },
    { at: 1, colour: withAlpha(AMBER, 0) },
  ]);
  c.beginPath();
  c.arc(0, -192, 78, 0, Math.PI * 2);
  c.fill();
  // The flame: a teardrop with a hot core, steady (it breathes under 0.3 Hz in the glow above, never a flicker).
  c.fillStyle = withAlpha(AMBER, 0.55 + 0.45 * glow);
  c.beginPath();
  c.moveTo(0, -222);
  c.quadraticCurveTo(14, -198, 0, -178);
  c.quadraticCurveTo(-14, -198, 0, -222);
  c.fill();
  c.fillStyle = withAlpha(AMBER_HOT, 0.5 + 0.5 * glow);
  c.beginPath();
  c.moveTo(0, -208);
  c.quadraticCurveTo(6, -194, 0, -184);
  c.quadraticCurveTo(-6, -194, 0, -208);
  c.fill();
  // The ribs: seven pairs of long, straight-ish bars that taper in toward the waist.
  c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const y = -234 + i * 14;
    const w = 54 - i * 3 + (spread > 0 ? spread * 7 * (i % 2 ? 1 : 0.6) : 0);
    for (const side of [-1, 1]) {
      c.strokeStyle = BONE_DARK;
      c.lineWidth = 7.5;
      c.beginPath();
      c.moveTo(side * 4, y);
      c.quadraticCurveTo(side * w * 0.9, y - 6, side * w, y + 20);
      c.stroke();
      c.strokeStyle = BONE;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(side * 4, y - 0.6);
      c.quadraticCurveTo(side * w * 0.9, y - 6.6, side * w, y + 19.4);
      c.stroke();
      if (side === 1) {
        c.strokeStyle = withAlpha(RIM, 0.6);
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(4, y - 3);
        c.quadraticCurveTo(w * 0.9, y - 9, w, y + 17);
        c.stroke();
      }
    }
  }
  // The spine, a column of small blocks, and the pelvis.
  for (let i = 0; i < 9; i++) {
    c.fillStyle = i % 2 ? BONE_MID : BONE;
    c.fillRect(-4.5, -240 + i * 11.5, 9, 9);
  }
  c.fillStyle = BONE_MID;
  c.beginPath();
  c.moveTo(-34, -146);
  c.quadraticCurveTo(0, -128, 34, -146);
  c.lineTo(22, -126);
  c.lineTo(-22, -126);
  c.closePath();
  c.fill();
  void calm;
}

/** The ring of keys at his belt: a big iron ring and three long keys, hanging and swaying a little. */
function drawKeys(c: Ctx, swing: number): void {
  c.save();
  c.translate(-40, -128);
  c.rotate(swing);
  c.strokeStyle = BONE_MID;
  c.lineWidth = 3.5;
  c.beginPath();
  c.arc(0, 8, 11, 0, Math.PI * 2);
  c.stroke();
  for (let k = 0; k < 3; k++) {
    c.save();
    c.translate((k - 1) * 8, 16);
    c.rotate((k - 1) * 0.22);
    c.fillStyle = BONE;
    c.fillRect(-2, 0, 4, 34 - k * 4);
    c.beginPath();
    c.arc(0, 38 - k * 4, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#05090e';
    c.beginPath();
    c.arc(0, 38 - k * 4, 2.4, 0, Math.PI * 2);
    c.fill();
    c.fillRect(2, 8, 6, 4);
    c.fillRect(2, 15, 5, 4);
    c.restore();
  }
  c.restore();
}

/** A hand of long finger bones, fanned, each in two parts and a little hooked. */
function drawHand(c: Ctx, hand: Pt, elbow: Pt, curl: number): void {
  const base = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  c.save();
  c.lineCap = 'round';
  for (let f = -2; f <= 1; f++) {
    const ang = base + f * 0.32 + 0.16;
    const L1 = 15;
    const L2 = 13;
    const jx = hand[0] + Math.cos(ang) * L1;
    const jy = hand[1] + Math.sin(ang) * L1;
    const ang2 = ang + curl * 0.6 * (f % 2 ? 1 : 0.7);
    c.strokeStyle = BONE_DARK;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(hand[0], hand[1]);
    c.lineTo(jx, jy);
    c.lineTo(jx + Math.cos(ang2) * L2, jy + Math.sin(ang2) * L2);
    c.stroke();
    c.strokeStyle = BONE;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(hand[0], hand[1]);
    c.lineTo(jx, jy);
    c.lineTo(jx + Math.cos(ang2) * L2, jy + Math.sin(ang2) * L2);
    c.stroke();
  }
  c.restore();
}

function drawArm(c: Ctx, shoulder: Pt, elbow: Pt, hand: Pt, alpha: number, curl: number): void {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  // A ragged sleeve over the upper arm, then bare forearm bones.
  limb(c, shoulder, elbow, hand, [17, 12, 8], BONE_DARK);
  limb(c, shoulder, elbow, hand, [11, 8, 5], BONE);
  // The sleeve: a tattered dark cloth strip on the upper arm.
  c.strokeStyle = SHROUD;
  c.lineWidth = 19;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(shoulder[0], shoulder[1]);
  c.lineTo(lerp(shoulder[0], elbow[0], 0.62), lerp(shoulder[1], elbow[1], 0.62));
  c.stroke();
  c.strokeStyle = withAlpha(RIM, 0.45);
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(shoulder[0] + 7, shoulder[1] - 8);
  c.lineTo(lerp(shoulder[0], elbow[0], 0.62) + 7, lerp(shoulder[1], elbow[1], 0.62) - 8);
  c.stroke();
  // Joints.
  c.fillStyle = BONE;
  c.beginPath();
  c.arc(elbow[0], elbow[1], 7.5, 0, Math.PI * 2);
  c.arc(hand[0], hand[1], 5.5, 0, Math.PI * 2);
  c.fill();
  drawHand(c, hand, elbow, curl);
  c.restore();
}

function drawHead(c: Ctx, hx: number, hy: number, tilt: number, pose: BossPose, glow: number, jaw: number): void {
  c.save();
  c.translate(hx, hy);
  c.rotate(tilt);
  // The hood: a tall peak behind the skull.
  c.fillStyle = SHROUD;
  c.beginPath();
  c.moveTo(-44, 22);
  c.quadraticCurveTo(-48, -34, -10, -78);
  c.quadraticCurveTo(0, -92, 14, -74);
  c.quadraticCurveTo(46, -34, 44, 22);
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha(RIM, 0.55);
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(14, -74);
  c.quadraticCurveTo(46, -34, 44, 22);
  c.stroke();
  // The skull: a long cranium, brow, cheek and a hinged jaw.
  c.fillStyle = BONE;
  c.beginPath();
  c.ellipse(0, -14, 29, 35, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = withAlpha('#000000', 0.18);
  c.beginPath();
  c.ellipse(-9, -6, 17, 28, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = BONE;
  c.fillRect(-17, 12, 34, 14);
  // Cracks that grow as he is hurt: the fewer hits left, the more.
  const cracks = clamp01(1 - pose.health + pose.hurt * 0.5);
  if (cracks > 0.02) {
    c.strokeStyle = withAlpha('#05090e', 0.55 + cracks * 0.4);
    c.lineWidth = 1.8;
    const lines: Pt[][] = [
      [[6, -48], [10, -34], [4, -26]],
      [[-18, -36], [-12, -24], [-18, -14]],
      [[18, -20], [12, -8], [18, 2]],
    ];
    for (const line of lines.slice(0, Math.max(1, Math.ceil(cracks * lines.length)))) {
      c.beginPath();
      line.forEach((p, i) => (i === 0 ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1])));
      c.stroke();
    }
  }
  // Eye sockets: deep, angled, with a pinprick of amber. Shut to a slit when he is hit.
  const open = pose.hurt > 0.2 ? 0.12 : 1;
  for (const sx of [-1, 1]) {
    c.fillStyle = '#04070b';
    c.beginPath();
    c.ellipse(sx * 11.5, -14, 8.5, 12 * open + 1.4, sx * 0.16, 0, Math.PI * 2);
    c.fill();
    if (open > 0.5) {
      c.fillStyle = withAlpha(AMBER, 0.55 + 0.45 * glow);
      c.beginPath();
      c.arc(sx * 11.5, -12, 2.6, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.fillStyle = '#04070b';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(-4.5, 10);
  c.lineTo(4.5, 10);
  c.closePath();
  c.fill();
  // The upper teeth, and the jaw, which hangs open by `jaw` (0 shut, 1 wide).
  c.fillStyle = BONE;
  for (let i = 0; i < 6; i++) c.fillRect(-14 + i * 5.6, 22, 4, 6);
  c.save();
  c.translate(0, 26 + jaw * 3);
  c.rotate(jaw * 0.14);
  c.fillStyle = BONE_MID;
  c.fillRect(-16, 2 + jaw * 6, 32, 11);
  c.fillStyle = BONE;
  for (let i = 0; i < 6; i++) c.fillRect(-14 + i * 5.6, jaw * 6 - 4, 4, 6);
  c.restore();
  // The rim on the right of the cranium.
  c.strokeStyle = withAlpha(RIM, 0.7);
  c.lineWidth = 1.8;
  c.beginPath();
  c.ellipse(0, -14, 29, 35, 0, -1.15, 0.5);
  c.stroke();
  c.restore();
}

/** What is left when he falls: a heap of long bones, ribs and a toppled ring of keys. */
function drawPile(c: Ctx, grow: number): void {
  if (grow <= 0) return;
  c.save();
  c.globalAlpha = clamp01(grow * 1.5);
  const bones: [number, number, number, number][] = [
    [-96, -10, -30, -22],
    [-60, -14, 20, -26],
    [-10, -12, 66, -20],
    [30, -8, 100, -16],
    [-70, -26, -10, -12],
    [-26, -28, 44, -10],
  ];
  for (const [x0, y0, x1, y1] of bones) bone(c, x0, y0, x1, y1, 6, BONE);
  c.strokeStyle = BONE;
  c.lineWidth = 4;
  c.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.arc(-56 + i * 22, -10, 14, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
  }
  c.strokeStyle = withAlpha(RIM, 0.5);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-96, -14);
  c.lineTo(100, -20);
  c.stroke();
  c.restore();
}

/** What he holds before the release: a bone raised in the lob, a skull held low in the roll. */
function drawHeld(c: Ctx, held: { motion: string; u: number }, hand: Pt): void {
  c.save();
  c.globalAlpha = clamp01((held.u - 0.2) * 3);
  if (held.motion === 'rolled') skull(c, hand[0] - 6, hand[1] - 10, 15, -0.3);
  else bone(c, hand[0] - 12, hand[1] - 12, hand[0] + 12, hand[1] - 34, 5, BONE);
  c.restore();
}

/** Draw the Bone Warden standing at (x, groundY). */
export function drawBoneWarden(ctx: Ctx, x: number, groundY: number, pose: BossPose): void {
  const calm = pose.reducedMotion;
  const down = ease(pose.down ?? 0);
  const t = pose.nowMs;
  const body = bodyPoseFor(pose, SET);
  const sway = calm ? 0 : Math.sin(t / 1500) * 0.006;
  const breathe = calm ? 0 : Math.sin(t / 1200) * 2.5;
  const recoil = calm ? 0 : pose.hurt * 16;
  // The lantern in his chest breathes (about 0.15 Hz), burns brighter when he is hurt, and dies as he falls.
  const glow = clamp01((calm ? 0.8 : 0.72 + 0.1 * Math.sin(t / 1100)) + pose.hurt * 0.3) * (1 - down) ** 1.5;
  // The jaw clatters when he laughs (about 2 Hz) and drops open when he is hit.
  const jaw = down > 0.2 ? 0.8 : pose.hurt > 0.2 ? 1 : pose.laughing > 0.1 ? (calm ? 0.8 : 0.5 + 0.5 * Math.sin(t / 75)) : 0;
  const crouch = body.crouch * (1 - down);

  ctx.save();
  ctx.translate(x + recoil, groundY);
  ctx.scale(SCALE, SCALE);
  groundShadow(ctx, 130 + down * 30);

  // Two bone feet peek out under the hem.
  ctx.fillStyle = BONE_MID;
  for (const fx of [-34, 28]) {
    ctx.beginPath();
    ctx.moveTo(fx - 18, 2);
    ctx.lineTo(fx - 6, -10);
    ctx.lineTo(fx + 14, -8);
    ctx.lineTo(fx + 20, 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.transform(1, 0, sway * 2, 1, 0, 0);
  drawShroud(ctx, 0, down);
  ctx.restore();

  // Everything above the hem sinks as he crouches and as he falls.
  const sink = crouch * 0.9 + down * 120;
  ctx.save();
  ctx.translate(0, sink + breathe);
  ctx.scale(1, lerp(1, 0.4, down));
  ctx.globalAlpha = 1 - down * 0.5;
  drawRibs(ctx, glow, pose.hurt, calm);
  if (down < 0.6) drawKeys(ctx, calm ? 0 : Math.sin(t / 900) * 0.08 + pose.hurt * 0.3);
  ctx.restore();

  const droop = down * 90;
  const shoulderL: Pt = [SHOULDER_L[0], SHOULDER_L[1] + sink];
  const shoulderR: Pt = [SHOULDER_R[0], SHOULDER_R[1] + sink];
  const lift = (p: Pt): Pt => [p[0], p[1] + crouch * 0.5 + droop];
  const head = {
    x: lerp(-sway * 262, -84, down * down),
    y: lerp(-282 + crouch + breathe, -30, down * down),
    tilt: lerp(body.tilt + (pose.hurt > 0.1 ? 0.2 * pose.hurt : 0), -1.3, down),
  };

  drawArm(ctx, shoulderR, lift(body.right.elbow), lift(body.right.hand), 1 - down, 0.5);
  drawHead(ctx, head.x, head.y, head.tilt, pose, glow, jaw);
  const lh = lift(body.left.hand);
  drawArm(ctx, shoulderL, lift(body.left.elbow), lh, 1 - down, 0.9);
  const held = heldItem(pose);
  if (held && down === 0) drawHeld(ctx, held, lh);

  drawPile(ctx, down);

  // A rib shaken loose when he is hit: it falls away.
  if (pose.hurt > 0.02) {
    const fall = 1 - pose.hurt;
    ctx.globalAlpha = clamp01(pose.hurt * 1.6);
    bone(ctx, 40 + fall * 20, -196 + (calm ? 20 : fall * 120), 66 + fall * 20, -176 + (calm ? 20 : fall * 120), 5, BONE);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
