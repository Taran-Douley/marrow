import type { Kit } from '@marrow/skeleton';
import type { ThrowKind, ThrowShape } from '../pattern';
import type { Projectile } from '../stages';

/**
 * What a boss throws. Like a gravestone it carries a number, and every throw looks and sounds the
 * same, whether it should be jumped or let through: the picture must never give away the answer.
 *
 * It has its own sound, a buzz, so a player hears at once that this is the boss fight.
 */
/**
 * One kind of throw in a boss's pattern. It has its own beep (pitch and timbre) so the kind is heard
 * before it is seen. A lobbed bomb is round with a lit fuse; a rolled bomb is squat, with dust behind it.
 */
export function defineThrow(kit: Kit, t: ThrowKind): void {
  kit.defineObstacle(t.name, {
    width: [0.16, 0.3],
    say: t.label,
    caption: t.label,
    sound: { hz: t.beep.hz, wave: t.beep.wave },
    draw(ctx, box) {
      const g = ctx as CanvasRenderingContext2D;
      const r = Math.max(22, Math.min(34, box.height * 0.42));
      const cx = box.x + box.width / 2;
      const rolled = t.motion === 'rolled';
      const cy = box.y + box.height - r;
      g.save();
      g.strokeStyle = '#14101f';
      g.lineWidth = 3;
      if (t.shape !== 'bomb') {
        drawThrow(g, t, cx, cy, r, box.value);
        g.restore();
        return;
      }
      if (rolled) {
        // Dust behind a rolling bomb: three short lines, always still.
        g.strokeStyle = '#d8d4e4';
        g.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(cx + r * 1.15, cy + r * (0.5 - i * 0.45));
          g.lineTo(cx + r * 1.9, cy + r * (0.5 - i * 0.45));
          g.stroke();
        }
        g.strokeStyle = '#14101f';
      }
      g.fillStyle = t.colour;
      g.beginPath();
      if (rolled) g.ellipse(cx, cy + r * 0.12, r * 1.08, r * 0.88, 0, 0, Math.PI * 2);
      else g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      // The fuse: up on a lobbed bomb, a stub on a rolled one.
      g.strokeStyle = '#14101f';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx, cy - r * (rolled ? 0.75 : 0.95));
      g.lineTo(cx + r * 0.3, cy - r * (rolled ? 1.0 : 1.5));
      g.stroke();
      g.fillStyle = '#ffe066';
      g.beginPath();
      g.arc(cx + r * 0.3, cy - r * (rolled ? 1.0 : 1.5), 5, 0, Math.PI * 2);
      g.fill();
      if (box.value !== undefined) {
        g.fillStyle = '#f4efe6';
        g.beginPath();
        g.arc(cx, cy + (rolled ? r * 0.1 : 0), r * 0.62, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#14101f';
        g.font = `bold ${Math.round(r * 0.8)}px "Atkinson Hyperlegible", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(box.value), cx, cy + (rolled ? r * 0.1 : 0) + 1, r * 1.2);
      }
      g.restore();
    },
  });
}

export function defineProjectile(kit: Kit, p: Projectile): void {
  kit.defineObstacle(p.name, {
    width: [0.16, 0.3],
    say: p.label,
    caption: p.label,
    sound: { hz: 440, wave: 'square' },
    draw(ctx, box) {
      const g = ctx as CanvasRenderingContext2D;
      const r = Math.max(22, Math.min(34, box.height * 0.42));
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height - r;
      g.save();
      g.fillStyle = p.colour;
      g.strokeStyle = '#14101f';
      g.lineWidth = 3;
      g.beginPath();
      if (p.shape === 'star') {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const rr = i % 2 === 0 ? r * 1.15 : r * 0.75;
          g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.closePath();
      } else if (p.shape === 'bone') {
        g.ellipse(cx, cy, r * 1.2, r * 0.7, 0, 0, Math.PI * 2);
        g.moveTo(cx - r * 1.1, cy - r * 0.6);
        g.arc(cx - r * 1.2, cy - r * 0.5, r * 0.4, 0, Math.PI * 2);
        g.moveTo(cx + r * 1.5, cy - r * 0.5);
        g.arc(cx + r * 1.2, cy - r * 0.5, r * 0.4, 0, Math.PI * 2);
      } else if (p.shape === 'bat') {
        g.moveTo(cx - r * 1.5, cy - r * 0.3);
        g.quadraticCurveTo(cx - r * 0.8, cy - r * 1.1, cx - r * 0.3, cy - r * 0.2);
        g.lineTo(cx, cy - r * 0.9);
        g.lineTo(cx + r * 0.3, cy - r * 0.2);
        g.quadraticCurveTo(cx + r * 0.8, cy - r * 1.1, cx + r * 1.5, cy - r * 0.3);
        g.quadraticCurveTo(cx + r * 0.6, cy + r * 0.2, cx, cy + r * 0.9);
        g.quadraticCurveTo(cx - r * 0.6, cy + r * 0.2, cx - r * 1.5, cy - r * 0.3);
        g.closePath();
      } else {
        g.arc(cx, cy, r, 0, Math.PI * 2);
      }
      g.fill();
      g.stroke();
      if (box.value !== undefined) {
        // A light disc behind the number, so it reads on every colour.
        g.fillStyle = '#f4efe6';
        g.beginPath();
        g.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#14101f';
        g.font = `bold ${Math.round(r * 0.8)}px "Atkinson Hyperlegible", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(box.value), cx, cy + 1, r * 1.2);
      }
      g.restore();
    },
  });
}

/** The number, on a light disc so it reads on every colour. Every throw carries one: the picture never gives the answer away. */
function numberDisc(g: CanvasRenderingContext2D, value: number | undefined, cx: number, cy: number, r: number): void {
  if (value === undefined) return;
  g.fillStyle = '#f4efe6';
  g.beginPath();
  g.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#14101f';
  g.font = `bold ${Math.round(r * 0.8)}px "Atkinson Hyperlegible", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(value), cx, cy + 1, r * 1.2);
}

/** What a throw leaves behind it, still and never flashing: dust on the ground, or a slanted streak in the air. */
function trail(g: CanvasRenderingContext2D, motion: ThrowKind['motion'], cx: number, cy: number, r: number): void {
  if (motion === 'lobbed') return;
  g.save();
  g.strokeStyle = '#d8d4e4';
  g.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    if (motion === 'rolled') {
      g.moveTo(cx + r * 1.15, cy + r * (0.5 - i * 0.45));
      g.lineTo(cx + r * 1.9, cy + r * (0.5 - i * 0.45));
    } else {
      g.moveTo(cx + r * 1.3, cy - r * (0.5 - i * 0.5));
      g.lineTo(cx + r * 2.1, cy - r * (0.9 - i * 0.5));
    }
    g.stroke();
  }
  g.restore();
}

/** The outline of each shape, as a path. The caller fills and outlines it. */
function shapePath(g: CanvasRenderingContext2D, shape: ThrowShape, cx: number, cy: number, r: number): void {
  const poly = (points: readonly (readonly [number, number])[]): void => {
    points.forEach(([x, y], i) => (i === 0 ? g.moveTo(cx + x * r, cy + y * r) : g.lineTo(cx + x * r, cy + y * r)));
    g.closePath();
  };
  g.beginPath();
  switch (shape) {
    case 'bone':
      g.ellipse(cx, cy, r * 1.15, r * 0.55, 0, 0, Math.PI * 2);
      for (const [x, y] of [[-1.2, -0.5], [-1.2, 0.5], [1.2, -0.5], [1.2, 0.5]] as const) {
        g.moveTo(cx + x * r + r * 0.38, cy + y * r);
        g.arc(cx + x * r, cy + y * r, r * 0.38, 0, Math.PI * 2);
      }
      break;
    case 'skull':
      g.arc(cx, cy - r * 0.1, r, 0, Math.PI * 2);
      poly([[-0.55, 0.7], [0.55, 0.7], [0.5, 1.1], [-0.5, 1.1]]);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.15 : r * 0.75;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      break;
    case 'bolt':
      poly([[-1.6, 0], [-0.5, -0.55], [1.4, -0.4], [1.4, 0.4], [-0.5, 0.55]]);
      break;
    case 'bat':
      g.moveTo(cx - r * 1.5, cy - r * 0.3);
      g.quadraticCurveTo(cx - r * 0.8, cy - r * 1.1, cx - r * 0.3, cy - r * 0.2);
      g.lineTo(cx, cy - r * 0.9);
      g.lineTo(cx + r * 0.3, cy - r * 0.2);
      g.quadraticCurveTo(cx + r * 0.8, cy - r * 1.1, cx + r * 1.5, cy - r * 0.3);
      g.quadraticCurveTo(cx + r * 0.6, cy + r * 0.2, cx, cy + r * 0.9);
      g.quadraticCurveTo(cx - r * 0.6, cy + r * 0.2, cx - r * 1.5, cy - r * 0.3);
      g.closePath();
      break;
    case 'wisp':
      g.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
      g.moveTo(cx + r * 0.6, cy - r * 0.6);
      g.quadraticCurveTo(cx + r * 1.4, cy - r * 0.9, cx + r * 2.0, cy - r * 0.4);
      g.quadraticCurveTo(cx + r * 1.4, cy - r * 0.1, cx + r * 0.8, cy + r * 0.5);
      break;
    case 'coffin':
      poly([[-0.55, -1.0], [0.55, -1.0], [0.95, -0.2], [0.55, 1.0], [-0.55, 1.0], [-0.95, -0.2]]);
      break;
    case 'spider':
      g.ellipse(cx, cy, r * 0.8, r * 0.7, 0, 0, Math.PI * 2);
      break;
    default:
      g.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

/** Details over the shape, outside the number's disc: spokes, legs, rivets, teeth. All still. */
function shapeDetails(g: CanvasRenderingContext2D, shape: ThrowShape, cx: number, cy: number, r: number): void {
  g.save();
  g.strokeStyle = '#14101f';
  g.lineWidth = 2.5;
  g.beginPath();
  if (shape === 'web' || shape === 'wheel') {
    const spokes = shape === 'web' ? 6 : 8;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.moveTo(cx + r * 0.8, cy);
    g.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  } else if (shape === 'ball') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.moveTo(cx + Math.cos(a) * r * 0.86 + 3, cy + Math.sin(a) * r * 0.86);
      g.arc(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, 3, 0, Math.PI * 2);
    }
  } else if (shape === 'spider') {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const y = cy - r * 0.5 + i * r * 0.35;
        g.moveTo(cx + side * r * 0.6, y);
        g.lineTo(cx + side * r * 1.2, y - r * 0.5);
        g.lineTo(cx + side * r * 1.6, y + r * 0.45);
      }
    }
  } else if (shape === 'skull') {
    g.moveTo(cx - r * 0.2, cy + r * 0.7);
    g.lineTo(cx - r * 0.2, cy + r * 1.1);
    g.moveTo(cx + r * 0.2, cy + r * 0.7);
    g.lineTo(cx + r * 0.2, cy + r * 1.1);
  }
  g.stroke();
  g.restore();
}

/** A throw that is not a bomb: its shape, details, trail and the number on it. */
function drawThrow(g: CanvasRenderingContext2D, t: ThrowKind, cx: number, cy: number, r: number, value: number | undefined): void {
  trail(g, t.motion, cx, cy, r);
  g.fillStyle = t.colour;
  g.strokeStyle = '#14101f';
  g.lineWidth = 3;
  shapePath(g, t.shape, cx, cy, r);
  g.fill();
  g.stroke();
  shapeDetails(g, t.shape, cx, cy, r);
  numberDisc(g, value, cx, cy, r);
}
