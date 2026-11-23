import { blit, hash, linear, radial, tile, withAlpha, type Ctx } from '../gfx';
import type { ArtState } from '../art';
import { arch, BASE, fog, glow, H, lamp, moon, ridge, ridgePath, ridgeRim, rimmed, shafts, specks, stars, W, wob } from './common-stages-5-7';

// Stage 7, Midnight Manor, drawn in code. One cold hue (deep violet night), one warm accent (crimson-rose window
// light and candle gold), a pale rose-lilac rim light. Layers, far to near:
//
//   sky + a huge pale moon + a far flock of bats + cloud streaks + moon shafts
//   far     hill with the manor (three towers, gables, many small lit windows) and gnarled trees
//   fog
//   hills   terraced garden: hedges, statues on plinths, a far balustrade, lantern posts
//   fog
//   mid     the gates and a long balustrade with urns and tall arched crimson windows (in the boss arena: the
//           ballroom, tall moonlit windows, drapes, a staircase and a chandelier)
//   fog
//   near    dead rose bushes, urns, candelabra with candles, a bench
//   (obstacles, ghost)
//   front   a velvet drape at the left edge and a chandelier chain top right, then a vignette
//
// Static layers are painted once to offscreen canvases. Everything stands still with reduced motion. The only slow
// change is falling rose petals, and a candle halo that breathes at under a fifth of a hertz. Nothing flashes.

const COLD = {
  skyTop: '#05020e',
  skyMid: '#12082c',
  skyHorizon: '#3d1a58',
  far: '#2c1650',
  farLow: '#1f0f3a',
  hills: '#1c0e36',
  mid: '#12072a',
  near: '#0a0419',
  front: '#030109',
  rim: '#cbb0ff',
  fog: '#b79ae6',
  crimson: '#ff4d6d',
  candle: '#ffcf8a',
  wine: '#3a0f26',
};

// ---- the sky -----------------------------------------------------------------------------

function bat(g: Ctx, x: number, y: number, s: number, flap: number): void {
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x - 5 * s, y - 6 * s * flap, x - 12 * s, y - 2 * s);
  g.quadraticCurveTo(x - 8 * s, y + 1 * s, x - 6 * s, y + 3 * s);
  g.quadraticCurveTo(x - 3 * s, y, x, y + 3 * s);
  g.quadraticCurveTo(x + 3 * s, y, x + 6 * s, y + 3 * s);
  g.quadraticCurveTo(x + 8 * s, y + 1 * s, x + 12 * s, y - 2 * s);
  g.quadraticCurveTo(x + 5 * s, y - 6 * s * flap, x, y);
  g.fill();
}

export function drawManorSky(ctx: Ctx, s: ArtState): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, BASE, [
    { at: 0, colour: COLD.skyTop },
    { at: 0.55, colour: COLD.skyMid },
    { at: 1, colour: COLD.skyHorizon },
  ]);
  ctx.fillRect(0, 0, W, H);
  stars(ctx, 50, BASE - 190, '#f1dcff', 60);
  const mx = s.arena ? 430 : 700;
  const my = s.arena ? 170 : 124;
  const r = s.arena ? 74 : 54;
  moon(ctx, mx, my, r, s.pulse, '#e3c2ff', '#f6e8f0', '#dbc8da');
  // Streaks of cloud, and a loose flock of bats across the moon.
  ctx.save();
  for (const [dy, len, a] of [[0.5, 2.2, 0.22], [-0.3, 1.8, 0.14]] as const) {
    ctx.save();
    ctx.translate(mx - r * 0.3, my + r * dy);
    ctx.rotate(-0.05);
    ctx.scale(1, 0.09);
    ctx.fillStyle = radial(ctx, 0, 0, 0, r * len, [
      { at: 0, colour: withAlpha('#d6bcff', a) },
      { at: 0.6, colour: withAlpha('#d6bcff', a * 0.4) },
      { at: 1, colour: withAlpha('#d6bcff', 0) },
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, r * len, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = withAlpha('#06020f', 0.85);
  for (let i = 0; i < 9; i++) bat(ctx, mx - 130 + hash(i, 80) * 200, my - 60 + hash(i, 81) * 100 + i * 4, 1 + hash(i, 82) * 0.8, 0.6 + hash(i, 83) * 0.7);
  ctx.restore();
  shafts(ctx, mx, my + r * 0.5, '#cdb0ff', [[mx - 200, 80], [mx - 380, 100], [mx + 30, 60]], 0.07);
}

// ---- far layer: the manor on its hill -------------------------------------------------------------

const FAR = { a: [24, 10, 5], k: [2, 4, 9], p: [4.2, 1.0, 2.2] };
const farY = (x: number): number => ridge(x, BASE - 130, FAR.a, FAR.k, FAR.p);

function litWindow(c: Ctx, x: number, y: number, w: number, h: number, colour: string, a: number): void {
  c.fillStyle = withAlpha(colour, a);
  c.beginPath();
  c.moveTo(x - w / 2, y + h);
  c.lineTo(x - w / 2, y);
  c.quadraticCurveTo(x, y - h * 0.5, x + w / 2, y);
  c.lineTo(x + w / 2, y + h);
  c.closePath();
  c.fill();
}

function tower(g: Ctx, x: number, base: number, w: number, h: number, roof: number): void {
  g.fillRect(x - w / 2, base - h, w, h);
  g.beginPath();
  g.moveTo(x - w / 2 - 5, base - h);
  g.lineTo(x, base - h - roof);
  g.lineTo(x + w / 2 + 5, base - h);
  g.closePath();
  g.fill();
  g.fillRect(x - 1, base - h - roof - 16, 2, 18);
}

function paintFar(c: Ctx): void {
  c.fillStyle = linear(c, 0, BASE - 200, 0, BASE, [
    { at: 0, colour: COLD.far },
    { at: 1, colour: COLD.farLow },
  ]);
  ridgePath(c, farY, BASE);
  c.fill();
  ridgeRim(c, farY, withAlpha(COLD.rim, 0.4), 1.5);
  const mx = 330;
  const by = farY(mx) + 8;
  rimmed(c, COLD.far, withAlpha(COLD.rim, 0.5), (g) => {
    // The manor: a long main block with steep gables, three towers of different heights, a porch.
    g.fillRect(mx - 120, by - 70, 240, 70);
    for (const gx of [-80, 0, 80]) {
      g.beginPath();
      g.moveTo(mx + gx - 32, by - 70);
      g.lineTo(mx + gx, by - 112);
      g.lineTo(mx + gx + 32, by - 70);
      g.closePath();
      g.fill();
    }
    tower(g, mx - 140, by, 34, 130, 50);
    tower(g, mx + 142, by, 30, 112, 44);
    tower(g, mx, by - 70, 36, 84, 64);
    g.fillRect(mx - 24, by - 26, 48, 26);
    // Chimneys.
    g.fillRect(mx - 100, by - 118, 8, 24);
    g.fillRect(mx + 60, by - 124, 8, 28);
    // Gnarled bare trees on the ridge.
    for (const [x, h] of [[60, 110], [140, 86], [560, 120], [640, 96], [860, 130]] as const) {
      const ty = farY(x) + 8;
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, ty);
      g.quadraticCurveTo(x + wob(x, 1, 20), ty - h * 0.5, x + wob(x, 2, 14), ty - h);
      g.stroke();
      g.lineWidth = 2.4;
      for (let k = 0; k < 4; k++) {
        const by2 = ty - h * (0.4 + k * 0.15);
        g.beginPath();
        g.moveTo(x + wob(x, 1, 8), by2);
        g.lineTo(x + (k % 2 ? 1 : -1) * (24 + hash(x + k, 3) * 18), by2 - 22 - hash(x + k, 4) * 14);
        g.stroke();
      }
    }
  });
  // Lit windows: crimson and gold, tiny, with a soft halo each.
  const wins: [number, number, string][] = [];
  for (let i = 0; i < 12; i++) wins.push([mx - 108 + i * 19.6, by - 52 + (i % 2) * 18, hash(i, 90) > 0.5 ? COLD.crimson : COLD.candle]);
  wins.push([mx - 140, by - 100, COLD.crimson], [mx + 142, by - 84, COLD.crimson], [mx, by - 120, COLD.candle], [mx, by - 12, COLD.candle]);
  for (const [x, y, colour] of wins) {
    if (hash(x, 91) > 0.82) continue;
    glow(c, x, y + 4, 11, colour, 0.34);
    litWindow(c, x, y, 5, 9, colour, 0.9);
  }
}

// ---- second ridge: the terraced garden --------------------------------------------------------------

const HILLS = { a: [16, 8, 4], k: [3, 7, 12], p: [0.3, 2.4, 1.1] };
const hillY = (x: number): number => ridge(x, BASE - 70, HILLS.a, HILLS.k, HILLS.p);

function statue(g: Ctx, x: number, base: number, h: number): void {
  // A plinth, a robed figure with raised arm, a small round head.
  g.fillRect(x - 12, base - h * 0.22, 24, h * 0.22);
  g.fillRect(x - 15, base - h * 0.24, 30, 5);
  g.beginPath();
  g.moveTo(x - 9, base - h * 0.24);
  g.lineTo(x - 5, base - h * 0.74);
  g.lineTo(x + 5, base - h * 0.74);
  g.lineTo(x + 11, base - h * 0.24);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(x, base - h * 0.82, h * 0.07, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 3.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x + 4, base - h * 0.7);
  g.lineTo(x + 16, base - h * 0.96);
  g.stroke();
}

function paintHills(c: Ctx): void {
  c.fillStyle = COLD.hills;
  ridgePath(c, hillY, BASE);
  c.fill();
  ridgeRim(c, hillY, withAlpha(COLD.rim, 0.3), 1.4);
  rimmed(c, COLD.hills, withAlpha(COLD.rim, 0.5), (g) => {
    // Clipped hedges in rounded blocks, with a gap for a path between the middle two.
    for (const [x, w, h] of [[60, 80, 42], [150, 60, 36], [440, 90, 44], [540, 70, 38], [790, 100, 46], [900, 70, 36]] as const) {
      const y = hillY(x) + 8;
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.lineTo(x - w / 2, y - h + 8);
      g.quadraticCurveTo(x - w / 2, y - h, x - w / 2 + 8, y - h);
      g.lineTo(x + w / 2 - 8, y - h);
      g.quadraticCurveTo(x + w / 2, y - h, x + w / 2, y - h + 8);
      g.lineTo(x + w / 2, y);
      g.closePath();
      g.fill();
    }
    // A far balustrade with posts and a rail, and statues.
    const by = hillY(300) + 8;
    g.fillRect(230, by - 22, 190, 4);
    for (let x = 232; x < 420; x += 12) g.fillRect(x, by - 18, 4, 18);
    g.fillRect(226, by - 30, 8, 30);
    g.fillRect(416, by - 30, 8, 30);
    statue(g, 660, hillY(660) + 8, 92);
    statue(g, 200, hillY(200) + 8, 80);
    // Cypress.
    for (const x of [30, 360, 740]) {
      const y = hillY(x) + 8;
      g.beginPath();
      g.moveTo(x - 9, y);
      g.bezierCurveTo(x - 16, y - 50, x - 6, y - 100, x, y - 130);
      g.bezierCurveTo(x + 6, y - 100, x + 16, y - 50, x + 9, y);
      g.fill();
    }
  });
  // Lantern posts with a candle light.
  for (const x of [320, 600, 840]) {
    const y = hillY(x) + 8;
    glow(c, x, y - 52, 20, COLD.candle, 0.36);
    c.fillStyle = '#0b0420';
    c.fillRect(x - 1.5, y - 50, 3, 52);
    c.fillStyle = withAlpha('#ffe6b4', 0.9);
    c.fillRect(x - 2.5, y - 58, 5, 8);
  }
}

// ---- mid layer: the gates and balustrade -------------------------------------------------------------

function urn(g: Ctx, x: number, base: number, h: number): void {
  g.beginPath();
  g.moveTo(x - h * 0.2, base);
  g.lineTo(x - h * 0.14, base - h * 0.2);
  g.quadraticCurveTo(x - h * 0.36, base - h * 0.5, x - h * 0.16, base - h * 0.72);
  g.lineTo(x - h * 0.22, base - h * 0.8);
  g.lineTo(x + h * 0.22, base - h * 0.8);
  g.lineTo(x + h * 0.16, base - h * 0.72);
  g.quadraticCurveTo(x + h * 0.36, base - h * 0.5, x + h * 0.14, base - h * 0.2);
  g.lineTo(x + h * 0.2, base);
  g.closePath();
  g.fill();
}

function paintMid(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.5);
  rimmed(c, COLD.mid, lit, (g) => {
    g.fillRect(0, BASE - 18, W, 18);
    // The long balustrade: a rail, a base and fat balusters, with pillars every 160 px topped by urns.
    g.fillRect(0, BASE - 82, W, 10);
    g.fillRect(0, BASE - 22, W, 6);
    for (let x = 8; x < W; x += 20) {
      g.beginPath();
      g.moveTo(x, BASE - 72);
      g.quadraticCurveTo(x + 8, BASE - 56, x, BASE - 22);
      g.quadraticCurveTo(x - 8, BASE - 56, x, BASE - 72);
      g.fill();
    }
    for (let x = 0; x <= W; x += 160) {
      g.fillRect(x - 14, BASE - 108, 28, 90);
      g.fillRect(x - 18, BASE - 114, 36, 8);
      urn(g, x, BASE - 114, 52);
    }
    // The manor gates, behind: two tall pillars, an iron arch of thin bars, spiked.
    g.fillRect(500 - 20, BASE - 270, 40, 252);
    g.fillRect(740 - 20, BASE - 270, 40, 252);
    g.fillRect(500 - 26, BASE - 278, 52, 10);
    g.fillRect(740 - 26, BASE - 278, 52, 10);
    urn(g, 500, BASE - 278, 44);
    urn(g, 740, BASE - 278, 44);
    g.lineWidth = 4;
    g.beginPath();
    arch(g, 520, 720, BASE - 150, BASE - 240);
    g.stroke();
    g.lineWidth = 3;
    for (let x = 530; x < 720; x += 14) {
      g.beginPath();
      g.moveTo(x, BASE - 20);
      g.lineTo(x, BASE - 170 - (1 - Math.abs((x - 620) / 100)) * 30);
      g.stroke();
      g.beginPath();
      g.moveTo(x - 3, BASE - 170 - (1 - Math.abs((x - 620) / 100)) * 30);
      g.lineTo(x, BASE - 184 - (1 - Math.abs((x - 620) / 100)) * 30);
      g.lineTo(x + 3, BASE - 170 - (1 - Math.abs((x - 620) / 100)) * 30);
      g.fill();
    }
    // A wall of the house at the left, with tall arched windows cut in it.
    g.fillRect(0, BASE - 300, 330, 282);
    g.fillRect(-4, BASE - 308, 340, 10);
  });
  // The tall arched windows in the house wall: crimson light with a lead cross, and a halo.
  for (const wx of [60, 150, 240]) {
    glow(c, wx, BASE - 180, 52, COLD.crimson, 0.26);
    c.fillStyle = linear(c, 0, BASE - 250, 0, BASE - 110, [
      { at: 0, colour: withAlpha('#ff6a86', 0.9) },
      { at: 1, colour: withAlpha('#c92b52', 0.9) },
    ]);
    c.beginPath();
    arch(c, wx - 22, wx + 22, BASE - 120, BASE - 250);
    c.lineTo(wx + 22, BASE - 110);
    c.lineTo(wx - 22, BASE - 110);
    c.closePath();
    c.fill();
    c.fillStyle = '#12072a';
    c.fillRect(wx - 1.5, BASE - 250, 3, 140);
    c.fillRect(wx - 22, BASE - 196, 44, 3);
  }
  // Candle sconces on the gate pillars.
  for (const x of [520, 720]) {
    glow(c, x, BASE - 190, 24, COLD.candle, 0.4);
    c.fillStyle = withAlpha('#fff0cc', 0.95);
    c.beginPath();
    c.ellipse(x, BASE - 190, 2.4, 5, 0, 0, Math.PI * 2);
    c.fill();
  }
}

/** The boss's arena: the ballroom. Tall moonlit windows, drapes, a staircase up behind the Count, a chandelier. */
function paintArena(c: Ctx): void {
  c.fillStyle = withAlpha('#07030f', 0.92);
  c.fillRect(0, 0, W, BASE);
  // Tall windows with moonlight pouring in.
  for (const wx of [250, 480, 920]) {
    c.fillStyle = linear(c, 0, 20, 0, BASE - 40, [
      { at: 0, colour: withAlpha('#7a4fb5', 0.7) },
      { at: 1, colour: withAlpha('#3a2070', 0.5) },
    ]);
    c.beginPath();
    arch(c, wx - 48, wx + 48, BASE - 40, 40);
    c.lineTo(wx + 48, BASE - 40);
    c.lineTo(wx - 48, BASE - 40);
    c.closePath();
    c.fill();
    c.fillStyle = '#12072a';
    c.fillRect(wx - 2, 40, 4, BASE - 80);
    c.fillRect(wx - 48, 150, 96, 4);
    c.fillRect(wx - 48, 250, 96, 4);
    shafts(c, wx, 110, '#d3b8ff', [[wx - 120, 60]], 0.06);
  }
  glow(c, 700, BASE - 150, 220, COLD.crimson, 0.14);
  rimmed(c, COLD.mid, withAlpha(COLD.rim, 0.5), (g) => {
    // Pillars, and a staircase that climbs to a landing behind the Count.
    for (const x of [30, 360, 580]) {
      g.fillRect(x - 22, 0, 44, BASE);
      g.fillRect(x - 30, BASE - 30, 60, 30);
      g.fillRect(x - 28, 0, 56, 20);
    }
    for (let i = 0; i < 7; i++) g.fillRect(620 + i * 40, BASE - 20 - i * 26, 340 - i * 40, 26);
    g.fillRect(620, BASE - 20 - 7 * 26 - 4, 340, 8);
    for (let x = 640; x < 960; x += 24) g.fillRect(x, BASE - 20 - 7 * 26 - 46, 4, 44);
    // The chandelier: a ring with arms, hung from a chain.
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(420, -4);
    g.lineTo(420, 74);
    g.stroke();
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(420, 88, 70, 14, 0, 0, Math.PI * 2);
    g.stroke();
    for (let i = -3; i <= 3; i++) g.fillRect(420 + i * 22 - 1.5, 66 + Math.abs(i) * 2, 3, 20);
  });
  for (let i = -3; i <= 3; i++) {
    glow(c, 420 + i * 22, 62 + Math.abs(i) * 2, 16, COLD.candle, 0.4);
    c.fillStyle = withAlpha('#fff0cc', 0.95);
    c.beginPath();
    c.ellipse(420 + i * 22, 62 + Math.abs(i) * 2, 2, 4.5, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Velvet drapes on the pillars: wine red, in vertical folds, tied back.
  for (const x of [30, 580]) {
    c.fillStyle = withAlpha(COLD.wine, 0.95);
    c.beginPath();
    c.moveTo(x + 18, 0);
    c.quadraticCurveTo(x + 70, 120, x + 40, 190);
    c.quadraticCurveTo(x + 66, 240, x + 40, BASE - 12);
    c.lineTo(x + 18, BASE - 12);
    c.closePath();
    c.fill();
    c.strokeStyle = withAlpha('#7a2048', 0.7);
    c.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.moveTo(x + 24 + k * 8, 6);
      c.quadraticCurveTo(x + 52 + k * 6, 160, x + 38 + k * 2, BASE - 20);
      c.stroke();
    }
  }
}

// ---- near layer ------------------------------------------------------------------------------

function rosebush(g: Ctx, x: number, base: number, h: number, seed: number): void {
  g.lineWidth = 2.6;
  g.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.42 + wob(seed + k, 50, 0.2);
    const len = h * (0.7 + hash(seed + k, 51) * 0.5);
    g.beginPath();
    g.moveTo(x, base);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + wob(k, 52, 10), base + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, base + Math.sin(a) * len);
    g.stroke();
    // A thorn or two along it, and a dead bloom at the tip.
    g.beginPath();
    g.arc(x + Math.cos(a) * len, base + Math.sin(a) * len, 3.2, 0, Math.PI * 2);
    g.fill();
    for (const f of [0.4, 0.7]) {
      g.beginPath();
      g.moveTo(x + Math.cos(a) * len * f, base + Math.sin(a) * len * f);
      g.lineTo(x + Math.cos(a) * len * f + 5, base + Math.sin(a) * len * f - 4);
      g.stroke();
    }
  }
}

function paintNear(c: Ctx): void {
  const lit = withAlpha(COLD.rim, 0.55);
  rimmed(c, COLD.near, lit, (g) => {
    for (const [x, h] of [[40, 56], [250, 50], [470, 60], [700, 52], [900, 58]] as const) rosebush(g, x, BASE + 2, h, x);
    // Stone urns on short plinths with spiky plants.
    for (const x of [140, 600, 820]) {
      g.fillRect(x - 14, BASE - 14, 28, 16);
      urn(g, x, BASE - 14, 52);
      g.lineWidth = 2.4;
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.moveTo(x, BASE - 62);
        g.lineTo(x + k * 7, BASE - 84 - Math.abs(k) * -4);
        g.stroke();
      }
    }
    // A bench: a seat, two curled ends and a back rail.
    g.fillRect(330, BASE - 26, 80, 6);
    g.fillRect(334, BASE - 20, 6, 22);
    g.fillRect(400, BASE - 20, 6, 22);
    g.fillRect(330, BASE - 46, 80, 4);
    g.fillRect(330, BASE - 46, 4, 22);
    g.fillRect(406, BASE - 46, 4, 22);
    // Candelabra: a stem, two arms, three cups.
    for (const x of [760]) {
      g.fillRect(x - 2, BASE - 70, 4, 72);
      g.fillRect(x - 12, BASE + 0, 24, 2);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, BASE - 52);
      g.quadraticCurveTo(x - 18, BASE - 52, x - 18, BASE - 70);
      g.moveTo(x, BASE - 52);
      g.quadraticCurveTo(x + 18, BASE - 52, x + 18, BASE - 70);
      g.stroke();
    }
  });
  // The candles: three small flames with halos.
  for (const [x, y] of [[742, BASE - 74], [760, BASE - 76], [778, BASE - 74]] as const) {
    glow(c, x, y - 4, 22, COLD.candle, 0.4);
    c.fillStyle = '#d8cfe0';
    c.fillRect(x - 2, y, 4, 8);
    c.fillStyle = withAlpha('#fff0cc', 0.95);
    c.beginPath();
    c.ellipse(x, y - 4, 2.2, 4.6, 0, 0, Math.PI * 2);
    c.fill();
  }
}

// ---- foreground ----------------------------------------------------------------------------

const FRONT_W = 1600;

function paintFront(c: Ctx): void {
  // A velvet drape down the left, gathered at the top, and a chandelier chain with a few crystals at the top right.
  c.fillStyle = '#16050f';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(52, 0);
  c.quadraticCurveTo(70, 160, 34, 300);
  c.quadraticCurveTo(52, 420, 40, H);
  c.lineTo(0, H);
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha('#3a0f26', 0.7);
  c.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(10 + k * 12, 0);
    c.quadraticCurveTo(44 + k * 8, 180, 22 + k * 10, H);
    c.stroke();
  }
  c.strokeStyle = withAlpha(COLD.rim, 0.5);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(52, 0);
  c.quadraticCurveTo(70, 160, 34, 300);
  c.stroke();
  rimmed(c, COLD.front, withAlpha(COLD.rim, 0.5), (g) => {
    g.lineWidth = 3;
    for (const [x, len] of [[1330, 90], [1480, 60]] as const) {
      g.beginPath();
      g.moveTo(x, -4);
      g.lineTo(x, len);
      g.stroke();
      g.beginPath();
      g.moveTo(x - 10, len + 16);
      g.lineTo(x, len);
      g.lineTo(x + 10, len + 16);
      g.lineTo(x, len + 30);
      g.closePath();
      g.fill();
    }
  });
}

export function drawManorFront(ctx: Ctx, s: ArtState): void {
  if (s.flat) return;
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 40, H);
  ctx.rect(W - 120, 0, 120, 56);
  ctx.clip();
  tile(scroll, FRONT_W, (dx) => blit(ctx, 'manor-front', FRONT_W, H, dx, 0, paintFront));
  ctx.restore();
  ctx.fillStyle = radial(ctx, W / 2, H * 0.45, H * 0.45, W * 0.72, [
    { at: 0, colour: 'rgba(3, 1, 9, 0)' },
    { at: 1, colour: 'rgba(3, 1, 9, 0.52)' },
  ]);
  ctx.fillRect(0, 0, W, H);
}

// ---- the marble terrace --------------------------------------------------------------------------

const PATH_H = 156;
const PATH_TOP = 16;

function paintPath(c: Ctx): void {
  const o = PATH_TOP;
  c.fillStyle = linear(c, 0, o, 0, PATH_H, [
    { at: 0, colour: '#352053' },
    { at: 0.25, colour: '#25153d' },
    { at: 0.6, colour: '#150b27' },
    { at: 1, colour: '#080413' },
  ]);
  c.fillRect(0, o, W, PATH_H - o);
  // Diamond tiles: rows of lozenges, each row deeper and wider than the last.
  let y = o;
  for (let row = 0; row < 5; row++) {
    const hRow = 12 + row * 9;
    const wTile = 60 + row * 22;
    c.strokeStyle = withAlpha('#05020d', 0.55);
    c.lineWidth = 1.4;
    for (let x = -((row * 31) % wTile); x < W + wTile; x += wTile) {
      c.beginPath();
      c.moveTo(x, y + hRow / 2);
      c.lineTo(x + wTile / 2, y);
      c.lineTo(x + wTile, y + hRow / 2);
      c.lineTo(x + wTile / 2, y + hRow);
      c.closePath();
      c.stroke();
      if (((x / wTile + row) | 0) % 2 === 0) {
        c.fillStyle = withAlpha('#d3b8ff', 0.06);
        c.fill();
      }
    }
    c.fillStyle = withAlpha('#d3b8ff', 0.13);
    c.fillRect(0, y + 1, W, 1.3);
    y += hRow;
  }
  c.fillStyle = linear(c, 0, o, 0, o + 8, [
    { at: 0, colour: withAlpha('#d9c2ff', 0.22) },
    { at: 1, colour: withAlpha('#d9c2ff', 0) },
  ]);
  c.fillRect(0, o, W, 8);
  // Cracks, fallen petals and a little ash.
  c.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const x = hash(i, 130) * W;
    const y0 = o + 6 + hash(i, 131) * 80;
    c.strokeStyle = 'rgba(4, 1, 10, 0.5)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y0);
    c.lineTo(x + 10 + hash(i, 132) * 10, y0 + 5);
    c.lineTo(x + 18 + hash(i, 133) * 14, y0 + 1);
    c.stroke();
  }
  for (let i = 0; i < 40; i++) {
    c.save();
    c.translate(hash(i, 140) * W, o + 6 + hash(i, 141) * (PATH_H - o - 16));
    c.rotate(hash(i, 142) * Math.PI);
    c.fillStyle = withAlpha(i % 3 === 0 ? '#c8284a' : '#6a2040', 0.55);
    c.beginPath();
    c.ellipse(0, 0, 3.4, 1.6, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  c.fillStyle = '#05020c';
  for (let i = 0; i < 40; i++) {
    const x = hash(i, 170) * (W - 12);
    const h = 5 + hash(i, 171) * 12;
    c.beginPath();
    c.moveTo(x, PATH_H);
    c.quadraticCurveTo(x + 2 - hash(i, 172) * 8, PATH_H - h * 0.6, x + 4 - hash(i, 173) * 10, PATH_H - h);
    c.quadraticCurveTo(x + 5, PATH_H - h * 0.5, x + 9, PATH_H);
    c.fill();
  }
}

export function drawManorGround(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  tile(scroll, W, (dx) => blit(ctx, 'manor-path', W, PATH_H, dx, s.groundY - PATH_TOP, paintPath));
}

// ---- all the layers ----------------------------------------------------------------------------

export function drawManorLayers(ctx: Ctx, s: ArtState): void {
  const scroll = s.reducedMotion ? 0 : s.t * s.pxPerSec;
  const layer = (key: string, speed: number, paint: (c: Ctx) => void): void => tile(scroll * speed, W, (dx) => blit(ctx, key, W, H, dx, 0, paint));
  layer('manor-far', 0.05, paintFar);
  fog(ctx, COLD.fog, BASE - 190, BASE - 70, 0.16);
  layer('manor-hills', 0.12, paintHills);
  fog(ctx, COLD.fog, BASE - 120, BASE - 20, 0.12);
  layer(s.arena ? 'manor-arena' : 'manor-mid', 0.22, s.arena ? paintArena : paintMid);
  fog(ctx, COLD.fog, BASE - 80, BASE, 0.1);
  layer('manor-near', 0.45, paintNear);
  // Falling petals, slow and sparse.
  specks(ctx, s, 22, '#e0507a', 0.5, -1.4, 2.4);
  tile(scroll * 0.45, W, (dx) => lamp(ctx, s, 760 + dx, BASE - 80, 3.4, COLD.candle, 3));
}

/** The layers, far to near, for the report. */
export const MANOR_LAYERS = ['sky, huge moon, bats, cloud streaks, shafts', 'hill with the manor, three towers, lit windows, gnarled trees', 'terraced garden: hedges, statues, far balustrade, lantern posts', 'gates, balustrade with urns, tall crimson windows (arena: the ballroom, windows, drapes, stairs, chandelier)', 'dead rose bushes, urns, bench, candelabra', 'velvet drape and chandelier chain at the edges'] as const;
