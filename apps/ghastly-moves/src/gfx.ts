// Small drawing helpers shared by the scenery, the boss and the obstacles. All canvas, no assets.

export type Ctx = CanvasRenderingContext2D;

/** A fixed pseudo-random number from 0 to 1, so scenery is the same every play. */
export const hash = (i: number, salt = 0): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export interface Stop {
  at: number;
  colour: string;
}

/** A gradient, or the first colour when the canvas cannot make one (a test double, say). */
export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stop[]): CanvasGradient | string {
  const g = ctx.createLinearGradient?.(x0, y0, x1, y1);
  if (!g?.addColorStop) return stops[0]!.colour;
  for (const s of stops) g.addColorStop(s.at, s.colour);
  return g;
}

export function radial(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: Stop[]): CanvasGradient | string {
  const g = ctx.createRadialGradient?.(x, y, r0, x, y, r1);
  if (!g?.addColorStop) return stops[0]!.colour;
  for (const s of stops) g.addColorStop(s.at, s.colour);
  return g;
}

/** '#rrggbb' with an opacity, as rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Run a draw at `x` and again one tile to the right, so a layer wraps without a seam. */
export function tile(offset: number, period: number, draw: (shift: number) => void): void {
  const shift = -(((offset % period) + period) % period);
  draw(shift);
  draw(shift + period);
}

/**
 * Static layers are painted once into an offscreen canvas and then blitted, so a frame costs a few
 * `drawImage` calls and not hundreds of paths. Where there is no real canvas (a test, a server), the
 * layer is painted straight onto the screen instead, with the same result.
 */
const layers = new Map<string, HTMLCanvasElement | null>();

export function offscreen(key: string, width: number, height: number, paint: (c: Ctx) => void): HTMLCanvasElement | null {
  if (layers.has(key)) return layers.get(key) ?? null;
  let made: HTMLCanvasElement | null = null;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const c = canvas.getContext('2d');
      if (c && typeof c.drawImage === 'function') {
        paint(c);
        made = canvas;
      }
    } catch {
      made = null; // no canvas here: paint onto the screen instead
    }
  }
  layers.set(key, made);
  return made;
}

/** Draw a cached layer with its top-left corner at (x, y). */
export function blit(ctx: Ctx, key: string, width: number, height: number, x: number, y: number, paint: (c: Ctx) => void): void {
  const canvas = offscreen(key, width, height, paint);
  if (canvas) {
    ctx.drawImage(canvas, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  paint(ctx);
  ctx.restore();
}

/** Forget cached layers (tests, and a change of theme). */
export function clearLayers(): void {
  layers.clear();
}

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
/** Smooth start and finish. */
export const ease = (t: number): number => clamp01(t) * clamp01(t) * (3 - 2 * clamp01(t));
