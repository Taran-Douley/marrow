import type { Kit } from '@marrow/skeleton';

/**
 * A gravestone with a number on it. This is the whole declaration: sound, spoken
 * name, caption and vibration come from the kit's defaults, and the number is
 * spoken and shown by the lesson. Only the width and the picture are ours.
 *
 * Every stone looks the same, whether it is a target or not. The picture must
 * never give away the answer.
 */
export function defineStone(kit: Kit): void {
  kit.defineObstacle('stone', {
    width: [0.16, 0.3],
    draw(ctx, box) {
      const g = ctx as CanvasRenderingContext2D;
      const bottom = box.y + box.height;
      // A soft shadow on the ground, so the stone stands on it.
      g.fillStyle = 'rgba(0, 0, 0, 0.4)';
      g.beginPath();
      g.ellipse(box.x + box.width / 2 + 4, bottom + 2, box.width * 0.62, 6, 0, 0, Math.PI * 2);
      g.fill();
      const body = (): void => {
        g.beginPath();
        g.moveTo(box.x - 2, bottom);
        g.lineTo(box.x, box.y + box.height * 0.3);
        g.quadraticCurveTo(box.x + box.width / 2, box.y - box.height * 0.12, box.x + box.width, box.y + box.height * 0.3);
        g.lineTo(box.x + box.width + 2, bottom);
        g.closePath();
      };
      const shade = g.createLinearGradient?.(box.x, box.y, box.x + box.width, bottom);
      if (shade?.addColorStop) {
        shade.addColorStop(0, '#a29fb4');
        shade.addColorStop(1, '#797589');
        g.fillStyle = shade;
      } else g.fillStyle = '#8b8799';
      body();
      g.fill();
      // A pale rim on the side the moon lights (right and top), and a dark edge all round.
      g.strokeStyle = '#e2e6ff';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(box.x + box.width * 0.45, box.y + box.height * 0.02);
      g.quadraticCurveTo(box.x + box.width * 0.85, box.y + box.height * 0.04, box.x + box.width, box.y + box.height * 0.32);
      g.lineTo(box.x + box.width + 2, bottom);
      g.stroke();
      g.strokeStyle = '#14101f';
      g.lineWidth = 2;
      body();
      g.stroke();
      // Moss at the foot, and a crack. The same on every stone: nothing here gives the answer away.
      g.fillStyle = 'rgba(76, 112, 70, 0.55)';
      g.beginPath();
      g.moveTo(box.x - 2, bottom);
      g.quadraticCurveTo(box.x + box.width * 0.25, bottom - 14, box.x + box.width * 0.5, bottom - 5);
      g.quadraticCurveTo(box.x + box.width * 0.75, bottom - 12, box.x + box.width + 2, bottom);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(20, 16, 31, 0.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(box.x + box.width * 0.78, box.y + box.height * 0.2);
      g.lineTo(box.x + box.width * 0.7, box.y + box.height * 0.34);
      g.lineTo(box.x + box.width * 0.78, box.y + box.height * 0.42);
      g.stroke();
      if (box.value !== undefined) {
        // The number is big, dark on light stone, so it is easy to read at a glance.
        g.fillStyle = '#14101f';
        g.font = `bold ${Math.max(18, Math.min(30, box.width * 0.62))}px "Atkinson Hyperlegible", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(box.value), box.x + box.width / 2, box.y + box.height * 0.58, box.width - 6);
      }
    },
  });
}
