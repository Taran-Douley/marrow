import { themeFor, type Profile } from '@marrow/skeleton';
import { drawSky } from './art';
import type { Progress } from './progress';
import { STAGES } from './stages';

// The story map and the item art. All original shapes drawn with canvas paths.
// Each place and item also has its name written beside it, so nothing is colour or picture alone.

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 540;
const FONT = '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';

/** Draw one item, centred at x, y, about `r` across. */
export function drawItem(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, r: number, ink = '#14101f'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.strokeStyle = ink;
  switch (id) {
    case 'pumpkin-lantern': {
      ctx.fillStyle = '#ff9a2e';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.9, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.1);
      ctx.lineTo(-r * 0.15, -r * 0.35);
      ctx.lineTo(-r * 0.05, -r * 0.05);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.4, -r * 0.1);
      ctx.lineTo(r * 0.15, -r * 0.35);
      ctx.lineTo(r * 0.05, -r * 0.05);
      ctx.fill();
      ctx.fillRect(-r * 0.4, r * 0.2, r * 0.8, r * 0.14);
      ctx.fillStyle = '#6aa84f';
      ctx.fillRect(-r * 0.08, -r * 0.95, r * 0.16, r * 0.28);
      break;
    }
    case 'bone-key': {
      ctx.fillStyle = '#efe8d8';
      ctx.beginPath();
      ctx.arc(-r * 0.5, 0, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-r * 0.15, -r * 0.1, r * 1.0, r * 0.2);
      ctx.strokeRect(-r * 0.15, -r * 0.1, r * 1.0, r * 0.2);
      ctx.fillRect(r * 0.5, r * 0.1, r * 0.14, r * 0.3);
      ctx.fillRect(r * 0.72, r * 0.1, r * 0.14, r * 0.22);
      break;
    }
    case 'witch-broom': {
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, r * 0.5);
      ctx.lineTo(r * 0.35, -r * 0.15);
      ctx.stroke();
      ctx.fillStyle = '#d6b25e';
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.45);
      ctx.lineTo(r * 1.0, -r * 0.7);
      ctx.lineTo(r * 1.0, r * 0.35);
      ctx.lineTo(r * 0.3, r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.stroke();
      break;
    }
    case 'silver-bell': {
      ctx.fillStyle = '#d8dce8';
      ctx.beginPath();
      ctx.arc(0, -r * 0.05, r * 0.62, Math.PI, 0);
      ctx.lineTo(r * 0.85, r * 0.55);
      ctx.lineTo(-r * 0.85, r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, r * 0.68, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'spider-cape': {
      ctx.fillStyle = '#7b5ec4';
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.8);
      ctx.lineTo(r * 0.5, -r * 0.8);
      ctx.lineTo(r * 0.95, r * 0.8);
      ctx.quadraticCurveTo(0, r * 0.5, -r * 0.95, r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#e9e2ff';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.lineTo(0, r * 0.55);
      ctx.moveTo(-r * 0.3, -r * 0.1);
      ctx.lineTo(r * 0.3, -r * 0.1);
      ctx.moveTo(-r * 0.5, r * 0.3);
      ctx.lineTo(r * 0.5, r * 0.3);
      ctx.stroke();
      break;
    }
    case 'moon-mirror': {
      ctx.fillStyle = '#bfe3ff';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.1, r * 0.62, r * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(-r * 0.1, r * 0.62, r * 0.2, r * 0.38);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(r * 0.1, -r * 0.2, r * 0.38, -Math.PI / 2, Math.PI / 2, true);
      ctx.fill();
      break;
    }
    default: {
      // The Crown of Midnight, and anything else.
      ctx.fillStyle = '#ffd84d';
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, r * 0.5);
      ctx.lineTo(-r * 0.9, -r * 0.5);
      ctx.lineTo(-r * 0.45, -r * 0.05);
      ctx.lineTo(0, -r * 0.7);
      ctx.lineTo(r * 0.45, -r * 0.05);
      ctx.lineTo(r * 0.9, -r * 0.5);
      ctx.lineTo(r * 0.9, r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export interface MapState {
  progress: Progress;
  /** The stage that will be played when the player presses. 0 for free practice. */
  selected: number;
  nowMs: number;
}

/** The story map: a winding road with a node for each place. The next place is boxed and labelled "next". */
export function drawMap(ctx: CanvasRenderingContext2D, profile: Profile, state: MapState): void {
  const theme = themeFor(profile.theme, profile.palette);
  const scale = Math.min(profile.textScale, 1.4);
  // The same night sky and moon as the levels, standing still, and then the title.
  drawSky(ctx, {
    scenery: 'moon',
    t: 0,
    pxPerSec: 0,
    nowMs: state.nowMs,
    reducedMotion: true,
    pulse: 0,
    flat: profile.theme === 'high-contrast',
    background: theme.background,
    groundY: MAP_HEIGHT,
  });
  ctx.fillStyle = theme.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${Math.round(28 * scale)}px ${FONT}`;
  ctx.fillText('The Road Through Grimsby Hollow', MAP_WIDTH / 2, 16);

  const px = (s: (typeof STAGES)[number]): [number, number] => [40 + s.at.x * (MAP_WIDTH - 80), 80 + s.at.y * 240];

  // The road.
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 6;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  STAGES.forEach((s, i) => {
    const [x, y] = px(s);
    if (i === 0) ctx.moveTo(x, y);
    else {
      const [bx, by] = px(STAGES[i - 1]!);
      ctx.quadraticCurveTo((bx + x) / 2, Math.min(by, y) - 40, x, y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]);

  const nextId = STAGES.find((s) => !state.progress.cleared.includes(s.id))?.id ?? 0;
  for (const s of STAGES) {
    const [x, y] = px(s);
    const done = state.progress.cleared.includes(s.id);
    const isNext = s.id === nextId;
    const isSelected = s.id === state.selected;
    ctx.fillStyle = theme.panel;
    ctx.strokeStyle = isSelected ? theme.amber : theme.line;
    ctx.lineWidth = isSelected ? 6 : 3;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (done) drawItem(ctx, s.boss.item.id, x, y, 20, '#14101f');
    else {
      ctx.fillStyle = theme.text;
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(26 * scale)}px ${FONT}`;
      ctx.fillText(String(s.id), x, y);
    }
    ctx.textBaseline = 'top';
    ctx.fillStyle = theme.text;
    ctx.font = `${Math.round(15 * scale)}px ${FONT}`;
    ctx.fillText(s.name, x, y + 38, 120);
    ctx.fillStyle = theme.mutedText;
    ctx.font = `${Math.round(13 * scale)}px ${FONT}`;
    const tag = done ? 'Boss beaten' : isNext ? 'NEXT' : s.rule;
    ctx.fillText(isSelected && !done && !isNext ? `${tag} (chosen)` : tag, x, y + 58, 130);
  }

  // The items won, in a row, with their names.
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.text;
  ctx.font = `bold ${Math.round(18 * scale)}px ${FONT}`;
  const won = STAGES.filter((s) => state.progress.cleared.includes(s.id));
  ctx.fillText(won.length === 0 ? 'Items: none yet' : `Items: ${won.length} of ${STAGES.length}`, 40, 345);
  won.forEach((s, i) => drawItem(ctx, s.boss.item.id, 60 + i * 56, 392, 20, '#14101f'));
}
