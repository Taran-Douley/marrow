import type { ArtState } from '../art';
import { withAlpha, type Ctx } from '../gfx';
import { PULSE_MAX_ALPHA } from '@marrow/skeleton';
import { drawCryptGround, drawCryptFront, drawCryptLayers, drawCryptSky } from './crypt';
import { drawWoodsGround, drawWoodsFront, drawWoodsLayers, drawWoodsSky } from './woods';
import { drawGateGround, drawGateFront, drawGateLayers, drawGateSky } from './gate';

// One place to dispatch the art of stages 2, 3 and 4 by scenery ('moon' is Crypt Steps, 'woods' is Whispering
// Woods, 'gate' is The Old Gate). Each function says whether it drew, so the old art stays the fallback.

interface Place {
  sky: (ctx: Ctx, s: ArtState) => void;
  layers: (ctx: Ctx, s: ArtState) => void;
  front: (ctx: Ctx, s: ArtState) => void;
  ground: (ctx: Ctx, s: ArtState) => void;
  /** The colour of the beat's swell on the ground. */
  pulse: string;
}

const PLACES: Partial<Record<ArtState['scenery'], Place>> = {
  moon: { sky: drawCryptSky, layers: drawCryptLayers, front: drawCryptFront, ground: drawCryptGround, pulse: '#9fd0e6' },
  woods: { sky: drawWoodsSky, layers: drawWoodsLayers, front: drawWoodsFront, ground: drawWoodsGround, pulse: '#7ee081' },
  gate: { sky: drawGateSky, layers: drawGateLayers, front: drawGateFront, ground: drawGateGround, pulse: '#c9b3ff' },
};

export const drawStages24Sky = (ctx: Ctx, s: ArtState): boolean => {
  const p = PLACES[s.scenery];
  if (!p || s.flat) return false;
  p.sky(ctx, s);
  return true;
};

export const drawStages24Layers = (ctx: Ctx, s: ArtState): boolean => {
  const p = PLACES[s.scenery];
  if (!p || s.flat) return false;
  p.layers(ctx, s);
  return true;
};

export const drawStages24Front = (ctx: Ctx, s: ArtState): void => {
  const p = PLACES[s.scenery];
  if (p && !s.flat) p.front(ctx, s);
};

/** The ground, the beat's swell on it and the line you run on. Returns false when the old ground should draw. */
export const drawStages24Ground = (ctx: Ctx, s: ArtState, colours: { panel: string; line: string }): boolean => {
  const p = PLACES[s.scenery];
  if (!p || s.flat) return false;
  p.ground(ctx, s);
  if (s.pulse > 0) {
    ctx.fillStyle = withAlpha(p.pulse, s.pulse * PULSE_MAX_ALPHA);
    ctx.fillRect(0, s.groundY, 960, 40);
  }
  // The line you run on is an essential graphic: the theme's line colour, solid, 3px.
  ctx.strokeStyle = colours.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, s.groundY);
  ctx.lineTo(960, s.groundY);
  ctx.stroke();
  return true;
};
