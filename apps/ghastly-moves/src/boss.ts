import type { BossLook } from './stages';
import { drawPumpkinKing } from './king';
import { drawBoneWarden } from './bosses/bone-warden';
import { drawMossWitch } from './bosses/moss-witch';
import { drawGatekeeper } from './bosses/gatekeeper';
import { drawSpiderMiller } from './bosses/spider-miller';
import { drawHollowWraith } from './bosses/hollow-wraith';
import { drawCountVexar } from './bosses/count-vexar';

// The bosses, drawn in code from simple shapes. One body, with a head and costume for each.
// Poses come from the fight: winding up to throw, hurt, laughing. With reduced motion they change
// pose but never shake or bob.

export interface BossPose {
  /** 0 to 1: how far into a throw. 0 is resting. */
  throwing: number;
  /** 0 to 1: how fresh a hit is. */
  hurt: number;
  /** 0 to 1: how fresh a laugh is. */
  laughing: number;
  /** Share of health left, 0 to 1. */
  health: number;
  reducedMotion: boolean;
  nowMs: number;
  /** The tell is playing: which kind of throw is coming and how far into the tell (0 to 1). The Pumpkin King winds up to match. */
  windup?: { motion: 'lobbed' | 'rolled' | 'swooped'; u: number };
  /** The kind of throw being thrown now, so the release matches the wind-up. */
  throwMotion?: 'lobbed' | 'rolled' | 'swooped';
  /** 0 to 1: how far the defeat has gone. The Pumpkin King collapses into a pile of pumpkins and leaves. */
  down?: number;
}

const PALETTE: Record<BossLook, { body: string; trim: string; eye: string }> = {
  pumpkin: { body: '#3b2a4f', trim: '#ff9a2e', eye: '#ffe066' },
  skeleton: { body: '#2b2733', trim: '#efe8d8', eye: '#ff5a5a' },
  witch: { body: '#2c3b2a', trim: '#7ee081', eye: '#f7ff8a' },
  knight: { body: '#3a3d48', trim: '#b9bfd0', eye: '#ff6b3d' },
  spider: { body: '#2a1f33', trim: '#c9b3ff', eye: '#ff3d6e' },
  wraith: { body: '#1e2f45', trim: '#9fd8ff', eye: '#e6f7ff' },
  vampire: { body: '#2a0f16', trim: '#c0392b', eye: '#ffd84d' },
};

const REDRAWN: Partial<Record<BossLook, (ctx: CanvasRenderingContext2D, x: number, groundY: number, pose: BossPose) => void>> = {
  skeleton: drawBoneWarden,
  witch: drawMossWitch,
  knight: drawGatekeeper,
  spider: drawSpiderMiller,
  wraith: drawHollowWraith,
  vampire: drawCountVexar,
};

/** Where the boss's throwing hand is, relative to the boss's feet, so projectiles leave from it. */
export const HAND_OFFSET = { x: -120, y: -150 };

/** Draw a boss standing at (x, groundY), about 260 px tall. */
export function drawBoss(ctx: CanvasRenderingContext2D, look: BossLook, x: number, groundY: number, pose: BossPose): void {
  if (look === 'pumpkin') {
    drawPumpkinKing(ctx, x, groundY, pose);
    return;
  }
  // The redrawn bosses (stages 2 to 4): looked up, not compared, so the old body code below still type-checks for the others.
  const redrawn = REDRAWN[look];
  if (redrawn) {
    redrawn(ctx, x, groundY, pose);
    return;
  }
  const c = PALETTE[look];
  const calm = pose.reducedMotion;
  const breathe = calm ? 0 : Math.sin(pose.nowMs / 420) * 4;
  const recoil = calm ? 0 : pose.hurt * 14;
  const bx = x + recoil;
  const top = groundY - 250 + breathe;

  ctx.save();
  // Shadow, so the boss stands on the ground.
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(bx, groundY, 110, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Body: a broad cloak, or legs for the spider.
  ctx.fillStyle = c.body;
  ctx.strokeStyle = c.trim;
  ctx.lineWidth = 4;
  if (look === 'spider') {
    ctx.strokeStyle = c.body;
    ctx.lineWidth = 10;
    for (let i = 0; i < 4; i++) {
      const spread = 40 + i * 28;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, top + 150);
        ctx.quadraticCurveTo(bx + side * spread, top + 70 + i * 12, bx + side * (spread + 30), groundY);
        ctx.stroke();
      }
    }
    ctx.fillStyle = c.body;
    ctx.strokeStyle = c.trim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(bx, top + 150, 80, 64, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(bx - 95, groundY);
    ctx.quadraticCurveTo(bx - 85, top + 110, bx - 45, top + 95);
    ctx.lineTo(bx + 45, top + 95);
    ctx.quadraticCurveTo(bx + 85, top + 110, bx + 95, groundY);
    if (look === 'wraith') {
      // A ragged hem instead of feet.
      for (let i = 0; i <= 6; i++) ctx.lineTo(bx + 95 - i * 32, groundY - (i % 2 === 0 ? 0 : 22));
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // The throwing arm: back when winding up, forward when it lets go.
  const swing = pose.throwing > 0 ? Math.sin(Math.min(1, pose.throwing) * Math.PI) : 0;
  const handX = bx + HAND_OFFSET.x * (0.6 + 0.4 * swing);
  const handY = groundY + HAND_OFFSET.y - swing * 30;
  ctx.strokeStyle = c.body;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx - 40, top + 115);
  ctx.lineTo(handX, handY);
  ctx.stroke();
  ctx.fillStyle = c.trim;
  ctx.beginPath();
  ctx.arc(handX, handY, 14, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  const hx = bx;
  const hy = top + 55;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#14101f';
  ctx.fillStyle = c.trim;
  ctx.beginPath();
  if (look === 'knight') ctx.rect(hx - 48, hy - 52, 96, 100);
  else if (look === 'spider') ctx.ellipse(hx, hy + 40, 46, 38, 0, 0, Math.PI * 2);
  else ctx.ellipse(hx, hy, 48, 56, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Costume.
  ctx.fillStyle = '#14101f';
  if (look === 'witch') {
    ctx.beginPath();
    ctx.moveTo(hx - 75, hy - 40);
    ctx.lineTo(hx + 75, hy - 40);
    ctx.lineTo(hx + 10, hy - 150);
    ctx.closePath();
    ctx.fill();
  } else if (look === 'vampire') {
    ctx.fillStyle = c.trim; // a high collar
    ctx.beginPath();
    ctx.moveTo(hx - 80, hy + 70);
    ctx.lineTo(hx - 60, hy - 20);
    ctx.lineTo(hx - 30, hy + 50);
    ctx.moveTo(hx + 80, hy + 70);
    ctx.lineTo(hx + 60, hy - 20);
    ctx.lineTo(hx + 30, hy + 50);
    ctx.fill();
    ctx.fillStyle = '#14101f';
    ctx.beginPath();
    ctx.moveTo(hx - 48, hy - 20);
    ctx.lineTo(hx, hy - 60);
    ctx.lineTo(hx + 48, hy - 20);
    ctx.lineTo(hx, hy - 36);
    ctx.closePath();
    ctx.fill();
  } else if (look === 'knight') {
    ctx.fillRect(hx - 40, hy - 8, 80, 14); // the visor slit
  }

  // Eyes and mouth: angry, hurt, or laughing.
  const eyeY = look === 'spider' ? hy + 32 : hy - 6;
  ctx.fillStyle = c.eye;
  const eyes = look === 'spider' ? [-24, -8, 8, 24] : [-20, 20];
  for (const ex of eyes) {
    ctx.beginPath();
    if (pose.hurt > 0.2) {
      ctx.moveTo(hx + ex - 8, eyeY - 6); // screwed-up eyes when hit
      ctx.lineTo(hx + ex + 8, eyeY + 6);
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.eye;
      ctx.stroke();
    } else {
      ctx.arc(hx + ex, eyeY, look === 'spider' ? 6 : 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#14101f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  const mouthY = look === 'spider' ? hy + 54 : hy + 24;
  if (pose.laughing > 0.1) ctx.arc(hx, mouthY - 6, 22, 0.1 * Math.PI, 0.9 * Math.PI);
  else if (pose.hurt > 0.2) ctx.arc(hx, mouthY + 14, 16, 1.15 * Math.PI, 1.85 * Math.PI);
  else {
    ctx.moveTo(hx - 24, mouthY);
    for (let i = 1; i <= 4; i++) ctx.lineTo(hx - 24 + i * 12, mouthY + (i % 2 === 0 ? 0 : 7));
  }
  ctx.stroke();
  ctx.restore();
}

/** The boss's health, as a bar with words on it, so it is never colour alone. */
export function drawHealth(ctx: CanvasRenderingContext2D, label: string, share: number, x: number, y: number, width: number, colours: { text: string; panel: string; line: string; fill: string }, font: string): void {
  ctx.save();
  ctx.fillStyle = colours.panel;
  ctx.fillRect(x, y, width, 30);
  ctx.fillStyle = colours.fill;
  ctx.fillRect(x + 3, y + 3, Math.max(0, (width - 6) * share), 24);
  // Notches, so the number of hits left can be counted by eye, not read from colour.
  ctx.strokeStyle = colours.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, 30);
  ctx.fillStyle = colours.text;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, y + 15, width - 10);
  ctx.restore();
}
