import { describe, expect, it } from 'vitest';
import { THEMES, contrastRatio, themeFor } from '../src/theme';
import { PALETTES, THEME_IDS } from '../src/types';

describe('contrast maths', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('does not care which colour is first', () => {
    expect(contrastRatio('#14101f', '#f4efe6')).toBe(contrastRatio('#f4efe6', '#14101f'));
  });

  it('rejects anything that is not #rrggbb', () => {
    expect(() => contrastRatio('red', '#fff')).toThrow(/not a #rrggbb colour/);
  });
});

describe('built-in themes meet WCAG 2.2 AA (4.5:1 text, 3:1 essential graphics)', () => {
  for (const theme of THEME_IDS) {
    for (const palette of PALETTES) {
      it(`${theme} theme, ${palette} palette`, () => {
        const t = themeFor(theme, palette);
        for (const surface of [t.background, t.panel]) {
          expect(contrastRatio(t.text, surface)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(t.mutedText, surface)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(t.amber, surface)).toBeGreaterThanOrEqual(3);
          expect(contrastRatio(t.green, surface)).toBeGreaterThanOrEqual(3);
          expect(contrastRatio(t.line, surface)).toBeGreaterThanOrEqual(3);
          expect(contrastRatio(t.focus, surface)).toBeGreaterThanOrEqual(3);
        }
      });
    }
  }

  it('the colour-blind palette changes only the pip colours', () => {
    const base = THEMES.default;
    const cb = themeFor('default', 'colourblind');
    expect({ ...cb, amber: base.amber, green: base.green }).toEqual(base);
    expect(cb.amber).not.toBe(base.amber);
    expect(cb.green).not.toBe(base.green);
  });
});
