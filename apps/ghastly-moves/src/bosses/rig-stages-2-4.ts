import { clamp01, ease, lerp, withAlpha, type Ctx } from '../gfx';
import type { BossPose } from '../boss';

// The pose maths and limb drawing that the Bone Warden, the Moss Witch and the Gatekeeper share. Each boss
// brings its own body set: the arms and the lean that go with each wind-up, so what is seen is what is heard
// (the scene picks the wind-up from the song's `Tell <id>` part, exactly as it does for the Pumpkin King).

export type Pt = readonly [number, number];

export interface ArmPose {
  /** Elbow and hand, relative to the feet. */
  elbow: Pt;
  hand: Pt;
}

export interface BodyPose {
  left: ArmPose;
  right: ArmPose;
  /** How far the body sinks, in px of the boss's own units. */
  crouch: number;
  /** Head tilt in radians: negative looks up. */
  tilt: number;
}

export type Motion = 'lobbed' | 'rolled' | 'swooped';

export interface PoseSet {
  idle: BodyPose;
  windup: Record<Motion, BodyPose>;
  /** The moment of release. */
  release: BodyPose;
}

const mix = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const mixArm = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({ elbow: mix(a.elbow, b.elbow, t), hand: mix(a.hand, b.hand, t) });
export const mixBody = (a: BodyPose, b: BodyPose, t: number): BodyPose => ({
  left: mixArm(a.left, b.left, t),
  right: mixArm(a.right, b.right, t),
  crouch: lerp(a.crouch, b.crouch, t),
  tilt: lerp(a.tilt, b.tilt, t),
});

/** The pose for the moment: a wind-up before the throw, the release, then back to rest. */
export function bodyPoseFor(pose: BossPose, set: PoseSet): BodyPose {
  const wind = set.windup[pose.throwMotion ?? pose.windup?.motion ?? 'lobbed'];
  if (pose.throwing > 0) {
    const t = clamp01(pose.throwing);
    return t < 0.35 ? mixBody(wind, set.release, ease(t / 0.35)) : mixBody(set.release, set.idle, ease((t - 0.35) / 0.65));
  }
  if (pose.windup) return mixBody(set.idle, wind, ease(pose.windup.u));
  return set.idle;
}

/** What the boss is holding right now, if anything: the motion and how ready it is (0 to 1). It is let go at the release. */
export function heldItem(pose: BossPose): { motion: Motion; u: number } | null {
  if (pose.throwing > 0) return pose.throwing < 0.35 ? { motion: pose.throwMotion ?? 'lobbed', u: 1 } : null;
  if (pose.windup && pose.windup.u > 0.2) return { motion: pose.windup.motion, u: pose.windup.u };
  return null;
}

/** A point on a two-part arm (shoulder to elbow to hand), for t from 0 to 1. */
export function armPoint(shoulder: Pt, elbow: Pt, hand: Pt, t: number): Pt {
  return t < 0.5 ? mix(shoulder, elbow, t * 2) : mix(elbow, hand, (t - 0.5) * 2);
}

/** A limb as two tapering strokes (the upper arm and the forearm), with round joints. */
export function limb(ctx: Ctx, shoulder: Pt, elbow: Pt, hand: Pt, widths: readonly [number, number, number], colour: string, alpha = 1): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const seg = (a: Pt, b: Pt, w0: number, w1: number): void => {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const p0 = mix(a, b, i / steps);
      const p1 = mix(a, b, (i + 1) / steps);
      ctx.lineWidth = lerp(w0, w1, (i + 0.5) / steps);
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
    }
  };
  seg(shoulder, elbow, widths[0], widths[1]);
  seg(elbow, hand, widths[1], widths[2]);
  ctx.restore();
}

/** A soft shadow on the ground under a boss. */
export function groundShadow(ctx: Ctx, rx: number, alpha = 0.4): void {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(-8, 3, rx, 14, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A thin pale line along a path's lit edge: call after the path is built. */
export function rimLine(ctx: Ctx, colour: string, alpha: number, width: number): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}
