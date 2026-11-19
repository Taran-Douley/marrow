import type { Palette, ThemeId } from '../types';

// Colour tokens for anything the kit draws. A game can restyle by passing its
// own tokens to the adapter; the contrast check (property 9, task 12) will
// judge them against WCAG 2.2 AA. Pure data and maths: no DOM.

export interface ThemeTokens {
  background: string;
  /** Caption box and panels. */
  panel: string;
  text: string;
  mutedText: string;
  /** Countdown pips 1 to 3. */
  amber: string;
  /** Countdown pip 4, the press. */
  green: string;
  /** Borders and outlines of essential graphics. */
  line: string;
  focus: string;
}

export const THEMES: Readonly<Record<ThemeId, ThemeTokens>> = {
  default: {
    background: '#14101f',
    panel: '#241c36',
    text: '#f4efe6',
    mutedText: '#c9c0d8',
    amber: '#f2b134',
    green: '#4cd964',
    line: '#9d94b5',
    focus: '#ffd84d',
  },
  'high-contrast': {
    background: '#000000',
    panel: '#000000',
    text: '#ffffff',
    mutedText: '#ffffff',
    amber: '#ffd000',
    green: '#00ff6a',
    line: '#ffffff',
    focus: '#ffff00',
  },
};

/** Colour-blind-safe pip colours (Okabe-Ito orange and sky blue). Shapes and numbers still carry the meaning. */
const COLOURBLIND_PIPS = { amber: '#e69f00', green: '#56b4e9' } as const;

export function themeFor(theme: ThemeId, palette: Palette): ThemeTokens {
  const base = THEMES[theme];
  return palette === 'colourblind' ? { ...base, ...COLOURBLIND_PIPS } : base;
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a #rrggbb colour (WCAG). */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`'${hex}' is not a #rrggbb colour.`);
  const n = parseInt(match[1]!, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours: 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
