import { hash, linear, radial, withAlpha, type Ctx } from '../gfx';

// Helpers the art of stages 5 to 7 share (Haunted Mill, The Hollow, Midnight Manor). The same grammar as patch.ts
// and the places of stages 2 to 4: one cold hue per place, a small warm accent, rim light on every silhouette, fog
// between layers. Kept apart from the other places' helpers so neither set depends on the other.

export const W = 960;
export const H = 540;
export const BASE = 400;

/** Draw a shape twice: first shifted up and right in the rim colour, then in its own colour on top. */
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

/** A ridge height at x that repeats exactly every W px, so a layer tiles without a seam. */
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

export function stars(ctx: Ctx, count: number, below: number, colour = '#dfe8ff', salt = 0): void {
  ctx.save();
  ctx.fillStyle = colour;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.18 + hash(i, 3 + salt) * 0.4;
    const r = hash(i, 4 + salt) > 0.88 ? 1.7 : 1;
    ctx.fillRect(hash(i, 1 + salt) * W, hash(i, 2 + salt) * below, r, r);
  }
  ctx.restore();
}

/** The moon with its halo, which swells a little on the beat (never more than the pulse allows, none with reduced motion). */
export function moon(ctx: Ctx, mx: number, my: number, r: number, pulse: number, tint: string, face = '#f1f2ea', edge = '#cdd6e0'): void {
  ctx.save();
  ctx.fillStyle = radial(ctx, mx, my, r * 0.7, r * 3.6, [
    { at: 0, colour: withAlpha(tint, 0.3 + pulse * 0.1) },
    { at: 1, colour: withAlpha(tint, 0) },
  ]);
  ctx.beginPath();
  ctx.arc(mx, my, r * 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = radial(ctx, mx - r * 0.3, my - r * 0.3, 2, r * 1.2, [
    { at: 0, colour: face },
    { at: 1, colour: edge },
  ]);
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.fill();
  for (const [cx, cy, cr] of [[-0.32, -0.2, 0.18], [0.3, 0.3, 0.12], [0.1, -0.44, 0.08], [-0.12, 0.42, 0.09]] as const) {
    ctx.fillStyle = withAlpha('#8f9bb4', 0.26);
    ctx.beginPath();
    ctx.arc(mx + r * cx, my + r * cy, r * cr, 0, Math.PI * 2);
    ctx.fill();
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

/** Slow drifting specks (flour, spores, petals). `rise` is the vertical drift: negative falls. Still with reduced motion. */
export function specks(ctx: Ctx, s: { reducedMotion: boolean; nowMs: number }, count: number, colour: string, alpha: number, rise: number, size = 1.6): void {
  ctx.save();
  ctx.fillStyle = withAlpha(colour, alpha);
  for (let i = 0; i < count; i++) {
    const t = s.reducedMotion ? 0 : s.nowMs / 1000;
    const x = (((hash(i, 70) * W + t * (5 + hash(i, 71) * 6)) % W) + W) % W;
    const span = BASE - 60;
    const y = (((hash(i, 72) * span + rise * t * (3 + hash(i, 73) * 5)) % span) + span) % span;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

/** A light that breathes under 0.2 Hz (never a flicker). Still with reduced motion. */
export function lamp(ctx: Ctx, s: { reducedMotion: boolean; nowMs: number }, x: number, y: number, size: number, colour: string, seed: number): void {
  const a = s.reducedMotion ? 0.4 : 0.42 + 0.1 * Math.sin(s.nowMs / 1500 + seed * 2.3);
  glow(ctx, x, y, size * 4, colour, a);
  ctx.fillStyle = withAlpha('#fff1c4', 0.9);
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.32, size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A fixed lean or wobble, so hand-made things are never quite straight. */
export const wob = (i: number, salt: number, amount: number): number => (hash(i, salt) - 0.5) * amount;

/** A pointed (gothic) arch between x0 and x1, springing at `spring` and peaking at `apex`. Only a path: fill or stroke it. */
export function arch(g: Ctx, x0: number, x1: number, spring: number, apex: number): void {
  const mid = (x0 + x1) / 2;
  g.moveTo(x0, spring);
  g.quadraticCurveTo(x0 + (mid - x0) * 0.1, apex + (spring - apex) * 0.45, mid, apex);
  g.quadraticCurveTo(x1 - (x1 - mid) * 0.1, apex + (spring - apex) * 0.45, x1, spring);
}

/** An orb web centred on (cx, cy): radial threads, and rings that sag between them. Thin pale lines. */
export function orbWeb(g: Ctx, cx: number, cy: number, r: number, spokes: number, rings: number, colour: string, seed = 0): void {
  g.save();
  g.strokeStyle = colour;
  g.lineWidth = 1;
  g.lineCap = 'round';
  const ang = (i: number): number => (i / spokes) * Math.PI * 2 + wob(i, seed + 5, 0.1);
  for (let i = 0; i < spokes; i++) {
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r);
    g.stroke();
  }
  for (let k = 1; k <= rings; k++) {
    const rr = (r * k) / rings;
    g.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const a = ang(i % spokes) + (i === spokes ? Math.PI * 2 : 0);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py);
      else {
        const am = (ang((i - 1) % spokes) + a) / 2;
        const sag = rr * 0.9;
        g.quadraticCurveTo(cx + Math.cos(am) * sag, cy + Math.sin(am) * sag, px, py);
      }
    }
    g.stroke();
  }
  g.restore();
}

/** Tiny dew beads on a set of points. */
export function beads(g: Ctx, points: readonly (readonly [number, number])[], colour: string): void {
  g.fillStyle = colour;
  for (const [x, y] of points) {
    g.beginPath();
    g.arc(x, y, 1.4, 0, Math.PI * 2);
    g.fill();
  }
}
