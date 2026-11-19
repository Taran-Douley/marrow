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
      g.fillStyle = '#8b8799';
      g.beginPath();
      g.moveTo(box.x, box.y + box.height);
      g.lineTo(box.x, box.y + box.height * 0.3);
      g.quadraticCurveTo(box.x + box.width / 2, box.y - box.height * 0.12, box.x + box.width, box.y + box.height * 0.3);
      g.lineTo(box.x + box.width, box.y + box.height);
      g.closePath();
      g.fill();
      g.strokeStyle = '#d8d4e4';
      g.lineWidth = 2;
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
