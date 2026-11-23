import type { ArtState } from '../art';
import { withAlpha, type Ctx } from '../gfx';
import { PULSE_MAX_ALPHA } from '@marrow/skeleton';
import { drawMillFront, drawMillGround, drawMillLayers, drawMillSky } from './mill';
import { drawHollowFront, drawHollowGround, drawHollowLayers, drawHollowSky } from './hollow';
import { drawManorFront, drawManorGround, drawManorLayers, drawManorSky } from './manor';

// One place to dispatch the art of stages 5, 6 and 7 by scenery ('mill' is Haunted Mill, 'hollow' is The Hollow,
// 'midnight' is Midnight Manor). Each function says whether it drew, so the old art stays the fallback.

interface Place {
  sky: (ctx: Ctx, s: ArtState) => void;
  layers: (ctx: Ctx, s: ArtState) => void;
  front: (ctx: Ctx, s: ArtState) => void;
  ground: (ctx: Ctx, s: ArtState) => void;
  /** The colour of the beat's swell on the ground. */
  pulse: string;
}

const PLACES: Partial<Record<ArtState['scenery'], Place>> = {
  mill: { sky: drawMillSky, layers: drawMillLayers, front: drawMillFront, ground: drawMillGround, pulse: '#ffd27a' },
  hollow: { sky: drawHollowSky, layers: drawHollowLayers, front: drawHollowFront, ground: drawHollowGround, pulse: '#a8e8f8' },
  midnight: { sky: drawManorSky, layers: drawManorLayers, front: drawManorFront, ground: drawManorGround, pulse: '#ff6b8a' },
};

export const drawStages57Sky = (ctx: Ctx, s: ArtState): boolean => {
  const p = PLACES[s.scenery];
  if (!p || s.flat) return false;
  p.sky(ctx, s);
  return true;
};

export const drawStages57Layers = (ctx: Ctx, s: ArtState): boolean => {
  const p = PLACES[s.scenery];
  if (!p || s.flat) return false;
  p.layers(ctx, s);
  return true;
};

export const drawStages57Front = (ctx: Ctx, s: ArtState): void => {
  const p = PLACES[s.scenery];
  if (p && !s.flat) p.front(ctx, s);
};

/** The ground, the beat's swell on it and the line you run on. Returns false when the old ground should draw. */
export const drawStages57Ground = (ctx: Ctx, s: ArtState, colours: { panel: string; line: string }): boolean => {
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
