import { themeFor, type ThemeTokens } from '../../theme';
import type { Profile } from '../../types';

// What the player sees from the kit: a caption box with four countdown pips
// and a marker that lights with every sound (Requirements 3a.6, 5).
// Nothing is conveyed by colour alone: pip 4 is a diamond, not a circle, every
// pip has a label, and the sound marker has a word beside it.

export interface VisualState {
  caption: string;
  /** How many pips are lit: 0 to 4. */
  pip: number;
  /** The sound marker is lit until this time on the adapter's clock (ms). */
  indicatorUntil: number;
  /** True: a quick flash. False: a steady marker, for reduced motion. */
  indicatorFlash: boolean;
}

export interface Visual {
  readonly state: VisualState;
  /** A caption. With a pip number it lights that pip; without one it starts afresh. */
  caption(text: string, pip?: 1 | 2 | 3 | 4): void;
  indicator(flash: boolean, nowMs: number, holdMs?: number): void;
  reset(): void;
}

export function createVisual(): Visual {
  const state: VisualState = { caption: '', pip: 0, indicatorUntil: 0, indicatorFlash: true };
  return {
    state,
    caption(text, pip) {
      state.caption = text;
      state.pip = pip ?? 0;
    },
    indicator(flash, nowMs, holdMs = 220) {
      state.indicatorFlash = flash;
      state.indicatorUntil = nowMs + holdMs;
    },
    reset() {
      state.caption = '';
      state.pip = 0;
      state.indicatorUntil = 0;
    },
  };
}

export interface WebStyle {
  /** Font stack. Atkinson Hyperlegible first, with real fallbacks. */
  fontFamily: string;
  /** Override any colour token. The contrast check judges the result. */
  tokens?: Partial<ThemeTokens>;
}

export const DEFAULT_FONT =
  '"Atkinson Hyperlegible", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PIP_LABELS = ['1', '2', '3', 'NOW'] as const;

/** Draw the caption box, the four pips and the sound marker. */
export function drawCaptionBox(
  ctx: CanvasRenderingContext2D,
  state: VisualState,
  profile: Profile,
  rect: Rect,
  nowMs: number,
  style: Partial<WebStyle> = {},
): void {
  const t: ThemeTokens = { ...themeFor(profile.theme, profile.palette), ...style.tokens };
  const font = style.fontFamily ?? DEFAULT_FONT;
  const scale = Math.max(1, Math.min(3, profile.textScale));

  ctx.save();
  ctx.fillStyle = t.panel;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);

  // The sound marker, on the left, with a word so it is not only a colour.
  const lit = nowMs < state.indicatorUntil;
  const cx = rect.x + 28;
  const cy = rect.y + rect.height / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  if (lit && state.indicatorFlash) {
    ctx.fillStyle = t.amber;
    ctx.fill();
  } else if (lit) {
    ctx.lineWidth = 6; // steady ring, no flashing, when motion is reduced
    ctx.strokeStyle = t.amber;
    ctx.stroke();
  } else {
    ctx.lineWidth = 2;
    ctx.strokeStyle = t.line;
    ctx.stroke();
  }
  ctx.fillStyle = t.mutedText;
  ctx.font = `${Math.round(12 * scale)}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('sound', cx, cy + 16);

  // The four pips on the right: three circles, then a diamond for the press.
  const slot = Math.min(72 * Math.min(scale, 1.5), rect.width / 7);
  const pipsLeft = rect.x + rect.width - slot * 4 - 12;
  for (let i = 0; i < 4; i++) {
    const px = pipsLeft + slot * i + slot / 2;
    const py = cy - 6;
    const on = state.pip >= i + 1;
    ctx.beginPath();
    if (i < 3) {
      ctx.arc(px, py, 13, 0, Math.PI * 2);
    } else {
      ctx.moveTo(px, py - 17);
      ctx.lineTo(px + 17, py);
      ctx.lineTo(px, py + 17);
      ctx.lineTo(px - 17, py);
      ctx.closePath();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = on ? (i < 3 ? t.amber : t.green) : t.line;
    ctx.fillStyle = on ? (i < 3 ? t.amber : t.green) : t.panel;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = t.text;
    ctx.font = `bold ${Math.round(14 * Math.min(scale, 1.5))}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(PIP_LABELS[i]!, px, py + 20);
  }

  // The caption text, shrunk to fit between the marker and the pips.
  const left = rect.x + 64;
  const room = pipsLeft - left - 8;
  let size = Math.round(30 * scale);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = t.text;
  // A long caption wraps onto more lines before it shrinks, so story lines stay readable.
  let lines: string[] = [state.caption];
  for (; size > 12; size -= 2) {
    ctx.font = `${size}px ${font}`;
    const lineH = size * 1.2;
    const most = Math.max(1, Math.floor((rect.height - 12) / lineH));
    lines = wrapWords(state.caption, (s) => ctx.measureText(s).width, room);
    if (lines.length <= most && lines.every((l) => ctx.measureText(l).width <= room)) break;
  }
  const lineH = size * 1.2;
  const most = Math.max(1, Math.floor((rect.height - 12) / lineH));
  if (lines.length > most) lines = [...lines.slice(0, most - 1), lines.slice(most - 1).join(' ')];
  const top = cy - 4 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => ctx.fillText(line, left, top + i * lineH, room));
  ctx.restore();
}

/** Break text into lines no wider than `max`, at spaces. A single word wider than `max` keeps its own line. */
export function wrapWords(text: string, width: (s: string) => number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (line && width(tryLine) > max) {
      lines.push(line);
      line = word;
    } else {
      line = tryLine;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/**
 * Draw a scanning menu: a title, then every entry, the lit one marked with an arrow, a thick box and
 * the highlight colour, so it is never colour alone. The text shrinks to fit the box; it never spills.
 */
export function drawMenu(
  ctx: CanvasRenderingContext2D,
  profile: Profile,
  rect: Rect,
  menu: { title: string; labels: readonly string[]; lit: number },
  style: Partial<WebStyle> = {},
): void {
  const t: ThemeTokens = { ...themeFor(profile.theme, profile.palette), ...style.tokens };
  const font = style.fontFamily ?? DEFAULT_FONT;
  const pad = 14;
  const rows = menu.labels.length + 1;
  let size = Math.round(22 * Math.max(1, Math.min(2, profile.textScale)));
  const widest = (px: number): number => {
    ctx.font = `bold ${px}px ${font}`;
    return Math.max(...[menu.title, ...menu.labels.map((l) => `▶ ${l}`)].map((l) => ctx.measureText(l).width));
  };
  while (size > 12 && (rows * size * 1.5 + pad * 2 > rect.height || widest(size) + pad * 2 > rect.width)) size -= 1;
  const lineH = Math.round(size * 1.5);
  const height = Math.min(rect.height, rows * lineH + pad * 2);

  ctx.save();
  ctx.fillStyle = t.panel;
  ctx.fillRect(rect.x, rect.y, rect.width, height);
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, height - 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = t.mutedText;
  ctx.font = `bold ${size}px ${font}`;
  ctx.fillText(menu.title, rect.x + pad, rect.y + pad, rect.width - pad * 2);
  menu.labels.forEach((label, i) => {
    const y = rect.y + pad + (i + 1) * lineH;
    const lit = i === menu.lit;
    if (lit) {
      ctx.strokeStyle = t.amber;
      ctx.lineWidth = 4;
      ctx.strokeRect(rect.x + 6, y - 4, rect.width - 12, lineH);
    }
    ctx.fillStyle = lit ? t.amber : t.text;
    ctx.font = `${lit ? 'bold ' : ''}${size}px ${font}`;
    ctx.fillText(lit ? `▶ ${label}` : `   ${label}`, rect.x + pad, y, rect.width - pad * 2);
  });
  ctx.restore();
}
