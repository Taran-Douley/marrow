import type { Kit } from '@marrow/skeleton';
import type { ThrowKind } from '../pattern';
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
