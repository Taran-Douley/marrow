import type { Kit } from '@marrow/skeleton';

const FONT = '"Atkinson Hyperlegible", system-ui, sans-serif';

/**
 * A spike crystal, for flip mode: flip to the other side to get past it. It is drawn the same way up
 * on the floor and on the ceiling, and the same whether it is a target or not, so the picture never
 * gives away the answer. Sound, spoken name, caption and vibration come from the kit's defaults.
 */
export function defineSpike(kit: Kit): void {
  kit.defineObstacle('spike', {
    width: [0.12, 0.2],
    caption: 'Spike',
    draw(ctx, box) {
      const g = ctx as CanvasRenderingContext2D;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const r = Math.max(box.width, 30) * 0.75;
      g.fillStyle = '#b9a4ff';
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const len = i % 2 === 0 ? r * 1.25 : r * 0.62;
        const px = cx + Math.cos(a) * len;
        const py = cy + Math.sin(a) * len;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = '#f4efe6';
      g.lineWidth = 2;
      g.stroke();
      if (box.value !== undefined) {
        g.fillStyle = '#14101f';
        g.beginPath();
        g.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
        g.fillStyle = '#f4efe6';
        g.fill();
        g.fillStyle = '#14101f';
        g.font = `bold ${Math.round(r * 0.62)}px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(box.value), cx, cy + 1, r * 1.05);
      }
    },
  });
}

/**
 * A number gate: an arch with a number, one in each lane. Press to switch lanes, to the number that
 * fits the rule; stay if yours already does. Both arches look alike, so only the numbers decide.
 */
export function defineGate(kit: Kit): void {
  kit.defineObstacle('gate', {
    width: [0.12, 0.18],
    caption: 'Gate',
    draw(ctx, box) {
      const g = ctx as CanvasRenderingContext2D;
      const w = Math.max(box.width, 44);
      const x = box.x + box.width / 2 - w / 2;
      g.strokeStyle = '#7ee0c0';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x, box.y + box.height);
      g.lineTo(x, box.y + w / 2);
      g.arc(x + w / 2, box.y + w / 2, w / 2, Math.PI, 0);
      g.lineTo(x + w, box.y + box.height);
      g.stroke();
      if (box.value !== undefined) {
        g.fillStyle = '#f4efe6';
        g.fillRect(x + 6, box.y + box.height * 0.42, w - 12, box.height * 0.4);
        g.fillStyle = '#14101f';
        g.font = `bold ${Math.round(Math.min(28, w * 0.5))}px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(box.value), x + w / 2, box.y + box.height * 0.62, w - 14);
      }
    },
  });
}
