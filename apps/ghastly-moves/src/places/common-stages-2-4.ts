import { hash, linear, radial, withAlpha, type Ctx } from '../gfx';

// Helpers the art of stages 2, 3 and 4 share (Crypt Steps, Whispering Woods, The Old Gate). Same grammar as
// patch.ts: one cold hue per place, a small warm accent, rim light on every silhouette, fog between layers.

export const W = 960;
export const H = 540;
export const BASE = 400;

/** Draw a shape twice: first shifted up and right in the moon's rim colour, then in its own colour on top. */
export function rimmed(c: Ctx, body: string, rim: string, draw: (c: Ctx) => void): void {
  c.save();
  c.translate(1.6, -1.6);
  c.fillStyle = rim;
  c.strokeStyle = rim;
  draw(c);
  c.restore();
  c.fillStyle = body;
  c.strokeStyle = body;
  draw(c);
}

/** A ridge height at x that repeats exactly every W px (whole numbers of cycles), so a layer tiles without a seam. */
export function ridge(x: number, base: number, a: number[], k: number[], p: number[]): number {
  let y = base;
  for (let i = 0; i < a.length; i++) y -= a[i]! * Math.sin((2 * Math.PI * k[i]! * x) / W + p[i]!);
  return y;
}

export function ridgePath(c: Ctx, top: (x: number) => number, bottom: number): void {
  c.beginPath();
  c.moveTo(0, bottom);
  for (let x = 0; x <= W; x += 12) c.lineTo(x, top(x));
  c.lineTo(W, bottom);
  c.closePath();
}

/** The pale line along the lit edge of a ridge. */
export function ridgeRim(c: Ctx, top: (x: number) => number, colour: string, width = 1.5): void {
  c.strokeStyle = colour;
  c.lineWidth = width;
  c.beginPath();
  for (let x = 0; x <= W; x += 12) (x === 0 ? c.moveTo(x, top(x) - 0.5) : c.lineTo(x, top(x) - 0.5));
  c.stroke();
}

/** A band of fog: clear at the top, thickest low down. */
export function fog(ctx: Ctx, colour: string, top: number, bottom: number, alpha: number): void {
  ctx.fillStyle = linear(ctx, 0, top, 0, bottom, [
    { at: 0, colour: withAlpha(colour, 0) },
    { at: 0.7, colour: withAlpha(colour, alpha) },
    { at: 1, colour: withAlpha(colour, alpha * 0.6) },
  ]);
  ctx.fillRect(0, top, W, bottom - top);
}

/** A soft round glow: a warm light on a dark scene. */
export function glow(c: Ctx, x: number, y: number, r: number, colour: string, alpha: number): void {
  c.fillStyle = radial(c, x, y, 1, r, [
    { at: 0, colour: withAlpha(colour, alpha) },
    { at: 1, colour: withAlpha(colour, 0) },
  ]);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

/** Still stars over the top of the sky. */
export function stars(ctx: Ctx, count: number, below: number, colour = '#dfe8ff'): void {
  ctx.save();
  ctx.fillStyle = colour;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.18 + hash(i, 3) * 0.4;
    const r = hash(i, 4) > 0.88 ? 1.7 : 1;
    ctx.fillRect(hash(i, 1) * W, hash(i, 2) * below, r, r);
  }
  ctx.restore();
}

/** The moon with its halo, which swells a little on the beat (never more than the pulse allows, none with reduced motion). */
export function moon(ctx: Ctx, mx: number, my: number, r: number, pulse: number, tint: string): void {
  ctx.save();
  ctx.fillStyle = radial(ctx, mx, my, r * 0.7, r * 3.6, [
    { at: 0, colour: withAlpha(tint, 0.3 + pulse * 0.1) },
    { at: 1, colour: withAlpha(tint, 0) },
  ]);
  ctx.beginPath();
  ctx.arc(mx, my, r * 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = radial(ctx, mx - r * 0.3, my - r * 0.3, 2, r * 1.2, [
    { at: 0, colour: '#f1f2ea' },
    { at: 1, colour: '#cdd6e0' },
  ]);
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.fill();
  for (const [cx, cy, cr] of [[-0.32, -0.2, 0.18], [0.3, 0.3, 0.12], [0.1, -0.44, 0.08], [-0.12, 0.42, 0.09]] as const) {
    ctx.fillStyle = withAlpha('#8f9bb4', 0.26);
    ctx.beginPath();
    ctx.arc(mx + r * cx, my + r * cy, r * cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha('#ffffff', 0.18);
    ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath();
    ctx.arc(mx + r * cx, my + r * cy, r * cr, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/** Long soft slants of light from (x, y) down to the ground. */
export function shafts(ctx: Ctx, x: number, y: number, tint: string, spreads: readonly (readonly [number, number])[], alpha: number): void {
  ctx.save();
  for (const [bx, spread] of spreads) {
    ctx.fillStyle = linear(ctx, x, y, bx, BASE, [
      { at: 0, colour: withAlpha(tint, alpha) },
      { at: 1, colour: withAlpha(tint, 0) },
    ]);
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 14, y);
    ctx.lineTo(bx + spread, BASE);
    ctx.lineTo(bx - spread * 0.4, BASE);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Slow drifting specks (dust, pollen, ash). Still with reduced motion. */
export function specks(ctx: Ctx, s: { reducedMotion: boolean; nowMs: number }, count: number, colour: string, alpha: number, rise: number): void {
  ctx.save();
  ctx.fillStyle = withAlpha(colour, alpha);
  for (let i = 0; i < count; i++) {
    const t = s.reducedMotion ? 0 : s.nowMs / 1000;
    const x = (((hash(i, 70) * W + t * (5 + hash(i, 71) * 6)) % W) + W) % W;
    const span = BASE - 60;
    const y = (((hash(i, 72) * span + rise * t * (3 + hash(i, 73) * 5)) % span) + span) % span;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();
}

/** A small flame light: a halo that breathes under 0.2 Hz (never a flicker), and a hot core. Still with reduced motion. */
export function flame(ctx: Ctx, s: { reducedMotion: boolean; nowMs: number }, x: number, y: number, size: number, colour: string, seed: number): void {
  const t = s.reducedMotion ? 0 : s.nowMs;
  const a = s.reducedMotion ? 0.4 : 0.42 + 0.1 * Math.sin(t / 1500 + seed * 2.3);
  glow(ctx, x, y, size * 4, colour, a);
  ctx.fillStyle = withAlpha('#fff1c4', 0.9);
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.32, size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The sorts of lean and wobble a hand-drawn thing has. */
export const wob = (i: number, salt: number, amount: number): number => (hash(i, salt) - 0.5) * amount;
