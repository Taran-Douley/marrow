import { AdditiveBlending, CanvasTexture, Sprite, SpriteMaterial, type Texture } from 'three';

/** A soft round glow, drawn once on a canvas. Shared by torches, relics and the phantom. */
let glowTexture: Texture | null | undefined;
export function glow(): Texture | null {
  if (glowTexture !== undefined) return glowTexture;
  glowTexture = null;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g || typeof g.createRadialGradient !== 'function') return null;
  try {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTexture = new CanvasTexture(c);
  } catch {
    glowTexture = null;
  }
  return glowTexture;
}

/** A glow that always faces you, unaffected by fog, so a light source reads from across the house. */
export function halo(colour: number, size: number, opacity = 0.8): Sprite {
  const map = glow();
  const sprite = new Sprite(
    new SpriteMaterial({ color: colour, ...(map ? { map } : {}), transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, fog: false }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

