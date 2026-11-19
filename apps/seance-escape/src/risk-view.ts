import { EVENT_FLICKER_MAX_HZ, type NoiseBand } from '@marrow/skeleton';
import { NOISE_WORDS } from './content';

// What the picture shows of noise and room events: a noise meter you can read (words and bars, never colour
// alone), and a dimming of the room when the lights gutter. Kept apart from the page so it can be tested.

export interface MeterView {
  /** The words: "Noise: very loud". */
  label: string;
  /** How many of the three bars are filled, 1 to 3. Quiet is one bar, so the meter is never empty. */
  bars: 1 | 2 | 3;
  band: NoiseBand;
}

export function meterView(level: number): MeterView {
  const band: NoiseBand = level >= 3 ? 'very loud' : level >= 2 ? 'loud' : 'quiet';
  return { label: NOISE_WORDS[band].caption, bars: band === 'very loud' ? 3 : band === 'loud' ? 2 : 1, band };
}

/** The flicker of the lights-gutter event: a slow wave, at most this many times a second. */
export const GUTTER_HZ = Math.min(1.5, EVENT_FLICKER_MAX_HZ);
/** How long the lights gutter, in ms. */
export const GUTTER_MS = 2600;

/**
 * How dark the room goes while the lights gutter, 0 to 0.6, `sinceMs` after it began. It sinks, wavers a little and
 * steadies, with at most GUTTER_HZ swings a second. With reduced motion it only dims and recovers: no wavering at all.
 */
export function gutterDark(sinceMs: number, reducedMotion: boolean): number {
  if (sinceMs < 0 || sinceMs >= GUTTER_MS) return 0;
  const t = sinceMs / GUTTER_MS;
  const envelope = Math.sin(Math.PI * t); // sinks and steadies
  const waver = reducedMotion ? 0 : 0.18 * Math.sin(2 * Math.PI * GUTTER_HZ * (sinceMs / 1000));
  return Math.max(0, Math.min(0.6, 0.45 * envelope + waver * envelope));
}

/** Draw the noise meter, top left, under the title: three bars and its words. */
export function drawNoiseMeter(ctx: CanvasRenderingContext2D, level: number, x: number, y: number): void {
  const view = meterView(level);
  const w = 232;
  const h = 34;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 6, 16, 0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f4efe6';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  for (let i = 0; i < 3; i++) {
    const filled = i < view.bars;
    // The bars grow taller, and a filled bar is solid while an empty one is only an outline.
    const bh = 8 + i * 6;
    const bx = x + 10 + i * 16;
    const by = y + h - 8 - bh;
    if (filled) {
      ctx.fillStyle = '#ffd84d';
      ctx.fillRect(bx, by, 11, bh);
    } else {
      ctx.strokeStyle = '#c9c0d8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, 11, bh);
    }
  }
  ctx.fillStyle = '#f4efe6';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(view.label, x + 66, y + h / 2);
  ctx.restore();
}
