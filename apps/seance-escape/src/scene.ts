import { indexOf, openings, themeFor, type Maze, type Profile, type WalkSnapshot } from '@marrow/skeleton';

// Everything here is original art drawn with canvas shapes. The picture shows what the
// sound already says: nothing is shown here that is not also spoken and written.

export const WIDTH = 960;
export const HEIGHT = 540;
const FONT = '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';
const DIR_STEP = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

export interface SceneState {
  maze: Maze | null;
  snapshot: WalkSnapshot | null;
  nowMs: number;
  /** How far, in rooms, you can see by lantern light. */
  sight: number;
  title: string;
  /** The heartbeat in words, shown under the steps, so it is never sound alone. */
  heart?: string;
  /** The room you are in, by name. */
  room?: string;
}

/**
 * Draw the flat view. With `overlay` it sits on top of the 3D view: transparent, with a small
 * map in the corner, a dark edge, and the options in a box. Without it, it is the whole picture.
 */
export function drawScene(ctx: CanvasRenderingContext2D, profile: Profile, scene: SceneState, overlay = false): void {
  const theme = themeFor(profile.theme, profile.palette);
  const { maze, snapshot: s } = scene;
  if (overlay) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // A dark edge, so the lantern is the light. It is still: it never pulses.
    const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.35, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.6, 'rgba(10,4,2,0.22)');
    vignette.addColorStop(1, 'rgba(6,2,3,0.66)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (s?.phase === 'caught') {
      ctx.fillStyle = 'rgba(120,10,20,0.35)'; // a steady red wash, never a flash
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  } else {
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  const scale = Math.min(profile.textScale, 1.5);
  const panels: PanelStyle = { panel: theme.panel, line: theme.line, text: theme.text, lit: theme.amber, see: overlay ? 0.82 : 1 };
  if (!maze || !s) {
    if (!overlay) drawPanel(ctx, [{ text: scene.title, bold: true }], { x: MARGIN, y: MARGIN, width: COLUMN, maxHeight: TEXT_BOTTOM - MARGIN }, 22 * scale, panels);
    return;
  }

  // The map is a square in the top-right corner, clear of every text panel.
  const area = overlay ? 150 : 300;
  const cell = Math.floor(area / Math.max(maze.width, maze.height));
  const ox = WIDTH - cell * maze.width - MARGIN;
  const oy = MARGIN;
  if (overlay) {
    ctx.fillStyle = 'rgba(10,6,18,0.7)';
    ctx.fillRect(ox - 6, oy - 6, cell * maze.width + 12, cell * maze.height + 12);
  }
  const centre = (c: { x: number; y: number }): [number, number] => [ox + c.x * cell + cell / 2, oy + c.y * cell + cell / 2];
  const near = (c: { x: number; y: number }): boolean => Math.hypot(c.x - s.cell.x, c.y - s.cell.y) <= scene.sight;

  // Rooms you have been in, and rooms in lantern light. Everything else is fog.
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const here = { x, y };
      const seen = s.visited[indexOf(maze, here)] === true;
      if (!seen && !near(here)) continue;
      ctx.globalAlpha = seen ? 1 : 0.5;
      ctx.fillStyle = theme.panel;
      ctx.fillRect(ox + x * cell + 3, oy + y * cell + 3, cell - 6, cell - 6);
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 2;
      for (const d of openings(maze, here)) {
        const [dx, dy] = DIR_STEP[d]!;
        const [cx, cy] = centre(here);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (dx * cell) / 2, cy + (dy * cell) / 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // The bell, when it is close enough to see. It has a bell shape and the word, not only a colour.
  if (near(maze.exit) || s.visited[indexOf(maze, maze.exit)]) {
    const [bx, by] = centre(maze.exit);
    ctx.fillStyle = theme.amber;
    ctx.beginPath();
    ctx.arc(bx, by - 2, cell * 0.22, Math.PI, 0);
    ctx.lineTo(bx + cell * 0.28, by + cell * 0.18);
    ctx.lineTo(bx - cell * 0.28, by + cell * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${Math.max(12, Math.round(cell * 0.24))}px ${FONT}`;
    ctx.fillText('EXIT', bx, by + cell * 0.2);
  }

  // The phantom, drawn only when it is close, as a ragged shape with the word beside it.
  const [gx, gy] = centre(s.ghost);
  if (near(s.ghost)) {
    ctx.fillStyle = '#d9c9ff';
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx - cell * 0.22, gy + cell * 0.24);
    ctx.lineTo(gx - cell * 0.22, gy - cell * 0.05);
    ctx.arc(gx, gy - cell * 0.05, cell * 0.22, Math.PI, 0);
    ctx.lineTo(gx + cell * 0.22, gy + cell * 0.24);
    ctx.lineTo(gx + cell * 0.1, gy + cell * 0.14);
    ctx.lineTo(gx, gy + cell * 0.24);
    ctx.lineTo(gx - cell * 0.1, gy + cell * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#14101f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${Math.max(11, Math.round(cell * 0.2))}px ${FONT}`;
    ctx.fillText('P', gx, gy - cell * 0.12);
  }

  // You, with a lantern. The arrow shows which way you face.
  const [px, py] = centre(s.cell);
  const [fx, fy] = DIR_STEP[s.facing]!;
  ctx.fillStyle = theme.amber;
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + fx * cell * 0.38, py + fy * cell * 0.38);
  ctx.stroke();

  // Where you are and how the ritual stands, in words, so nothing is the picture alone. One panel, top left.
  const total = maze.relics.length;
  const status: PanelLine[] = [
    ...(overlay ? [] : [{ text: scene.title, bold: true }]),
    ...(scene.room ? [{ text: scene.room, bold: true }] : []),
    ...(total > 0 ? [{ text: s.chasing ? 'All relics found. Run to the bell!' : `Relics ${s.relicsFound} of ${total}` }] : []),
    ...(s.phase === 'hidden' ? [{ text: 'Hiding' }] : []),
    ...(s.chasing ? [{ text: 'It knows where you are' }] : s.ghostMode === 'hunt' ? [{ text: 'It is hunting you' }] : []),
    ...(scene.heart ? [{ text: scene.heart }] : []),
    { text: `Steps ${s.steps}. Caught ${s.catches}.` },
  ];
  drawPanel(ctx, status, { x: MARGIN, y: MARGIN, width: COLUMN, maxHeight: TEXT_BOTTOM - MARGIN }, 20 * scale, panels);

  // The options: a label for each, the lit one marked with an arrow and a box, so it is not colour alone.
  // Over the 3D view they sit under the map; on the flat map, in the middle column.
  if (s.phase === 'choosing' || s.phase === 'hidden') {
    const lines = s.options.map((o): PanelLine => ({ text: o.label, bold: true, lit: o.id === s.lit }));
    const box = overlay
      ? { x: WIDTH - MARGIN - COLUMN, y: oy + cell * maze.height + 18, width: COLUMN }
      : { x: MARGIN * 2 + COLUMN, y: MARGIN, width: WIDTH - cell * maze.width - COLUMN - MARGIN * 4 };
    drawPanel(ctx, lines, { ...box, maxHeight: TEXT_BOTTOM - box.y }, 22 * scale, panels);
  }
}

// ---- text panels ---------------------------------------------------------------

const MARGIN = 16;
/** Width of a text column. */
const COLUMN = 300;
/** Text stays above the caption box, which the game draws from HEIGHT - 110. */
const TEXT_BOTTOM = HEIGHT - 122;
const MIN_FONT = 13;

interface PanelLine {
  text: string;
  bold?: boolean;
  /** The lit scanning option: drawn with an arrow, a box and the highlight colour. */
  lit?: boolean;
}
interface PanelStyle {
  panel: string;
  line: string;
  text: string;
  lit: string;
  /** How solid the panel is: a little see-through over the 3D view. */
  see: number;
}

/**
 * Draw lines of text in a panel that never spills out of its box: if the lines would not fit, the font
 * shrinks until they do. Returns the panel's height.
 */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  lines: readonly PanelLine[],
  box: { x: number; y: number; width: number; maxHeight: number },
  size: number,
  style: PanelStyle,
): number {
  if (lines.length === 0 || box.width <= 40 || box.maxHeight <= 20) return 0;
  const pad = 10;
  const arrow = '▶ ';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const fontOf = (px: number, bold?: boolean): string => `${bold ? 'bold ' : ''}${Math.round(px)}px ${FONT}`;
  const widest = (px: number): number =>
    Math.max(
      ...lines.map((l) => {
        ctx.font = fontOf(px, l.bold);
        return ctx.measureText(arrow + l.text).width;
      }),
    );
  let px = size;
  while (px > MIN_FONT && (lines.length * px * 1.45 + pad * 2 > box.maxHeight || widest(px) + pad * 2 > box.width)) px -= 1;
  const lineH = Math.round(px * 1.45);
  const height = lines.length * lineH + pad * 2;
  const width = Math.min(box.width, Math.ceil(widest(px)) + pad * 2);

  ctx.globalAlpha = style.see;
  ctx.fillStyle = style.panel;
  ctx.fillRect(box.x, box.y, width, height);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = style.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x, box.y, width, height);

  lines.forEach((l, i) => {
    const y = box.y + pad + i * lineH;
    if (l.lit) {
      ctx.strokeStyle = style.lit;
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x + 4, y - 3, width - 8, lineH);
    }
    ctx.font = fontOf(px, l.bold);
    ctx.fillStyle = l.lit ? style.lit : style.text;
    const text = l.lit ? arrow + l.text : l.text;
    // A line that is still too wide at the smallest size is cut with an ellipsis, never drawn over its neighbour.
    ctx.fillText(fit(ctx, text, width - pad * 2), box.x + pad + (l.lit ? 0 : ctx.measureText(arrow).width), y);
  });
  return height;
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}
