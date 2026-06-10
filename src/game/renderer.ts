import { CANVAS_H, CANVAS_W, GRID_COLS, GRID_ROWS, TILE, type GameMap } from '../data/map';
import { TOWERS } from '../data/towers';
import type { GameEngine } from './Engine';
import type { Enemy } from './Enemy';
import type { Tower } from './Tower';
import { getSprite } from './sprites';

/**
 * Canvas renderer. Pure functions of engine state — no game logic here.
 *
 * Every drawable first checks the sprite registry (see sprites.ts); when no
 * image is registered it falls back to the placeholder vector shapes below,
 * so real art can be swapped in without touching this file's call sites.
 *
 * Animations key off `g.now` (the engine's game clock), so everything
 * freezes naturally while the game is paused.
 */

export interface Particle {
  kind: 'spark' | 'text' | 'ring';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  label?: string;
  radius?: number;
}

// Brand palette (kept in sync with tailwind.config.js).
const C = {
  bgA: '#0a0f24',
  bgB: '#0d1430',
  grid: '#15203f',
  path: '#1d2b55',
  pathEdge: '#2c3f7c',
  vault: '#2563ff',
  white: '#f8fafc',
  danger: '#ef4444',
  hp: '#22c55e',
};

export function render(ctx: CanvasRenderingContext2D, g: GameEngine): void {
  ctx.save();
  // Screen shake: jitter the whole scene while `g.shake` decays.
  if (g.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  drawBoard(ctx, g.map, g.now);
  drawPlacementOverlay(ctx, g);
  drawVault(ctx, g);
  for (const t of g.towers) drawTower(ctx, t, t.id === g.selectedTowerId, g.now);
  for (const e of g.enemies) drawEnemy(ctx, e, g.now);
  for (const p of g.projectiles) {
    // Motion trail from last frame's position, then the projectile head.
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = p.stats.splashRadius ? 4 : 2.5;
    ctx.beginPath();
    ctx.moveTo(p.prevX, p.prevY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.stats.splashRadius ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of g.particles) drawParticle(ctx, pt);
  drawRangePreview(ctx, g);
  ctx.restore();

  if (g.status === 'paused') drawPauseOverlay(ctx);
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

/** Deterministic per-cell pseudo-random in [0, 1) for ambient decorations. */
function cellNoise(c: number, r: number): number {
  const v = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function drawBoard(ctx: CanvasRenderingContext2D, map: GameMap, now: number): void {
  // Subtle vertical gradient backdrop.
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, C.bgA);
  grad.addColorStop(1, C.bgB);
  ctx.fillStyle = grad;
  ctx.fillRect(-20, -20, CANVAS_W + 40, CANVAS_H + 40);

  // Grid lines.
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < GRID_COLS; c++) {
    ctx.moveTo(c * TILE, 0);
    ctx.lineTo(c * TILE, CANVAS_H);
  }
  for (let r = 1; r < GRID_ROWS; r++) {
    ctx.moveTo(0, r * TILE);
    ctx.lineTo(CANVAS_W, r * TILE);
  }
  ctx.stroke();

  // Ambient circuit-board decorations on some open tiles (deterministic, so
  // the board doesn't flicker frame to frame).
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (map.pathCells.has(`${c},${r}`)) continue;
      const n = cellNoise(c, r);
      if (n > 0.85) {
        // Glowing node that breathes slowly.
        const pulse = 0.25 + 0.15 * Math.sin(now * 1.5 + n * 20);
        ctx.fillStyle = `rgba(59, 130, 246, ${pulse})`;
        ctx.beginPath();
        ctx.arc((c + 0.5) * TILE, (r + 0.5) * TILE, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (n > 0.72) {
        // Faint plus-shaped trace.
        const cx = (c + 0.5) * TILE;
        const cy = (r + 0.5) * TILE;
        ctx.strokeStyle = 'rgba(45, 63, 124, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy);
        ctx.lineTo(cx + 5, cy);
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx, cy + 5);
        ctx.stroke();
      }
    }
  }

  // Path tiles.
  for (const key of map.pathCells) {
    const [c, r] = key.split(',').map(Number);
    ctx.fillStyle = C.path;
    ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    ctx.strokeStyle = C.pathEdge;
    ctx.strokeRect(c * TILE + 0.5, r * TILE + 0.5, TILE - 1, TILE - 1);
  }

  // Animated energy flow along the path centerline (dashes drift toward the
  // vault so the threat direction always reads at a glance).
  ctx.save();
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 26]);
  ctx.lineDashOffset = -((now * 55) % 36);
  ctx.beginPath();
  const wp = map.waypointsPx;
  ctx.moveTo(wp[0][0], wp[0][1]);
  for (let i = 1; i < wp.length; i++) ctx.lineTo(wp[i][0], wp[i][1]);
  ctx.stroke();
  ctx.restore();
}

function drawVault(ctx: CanvasRenderingContext2D, g: GameEngine): void {
  const [vc, vr] = g.map.def.vaultCell;
  const x = vc * TILE;
  const y = vr * TILE;
  const sprite = getSprite('map.vault');
  const livesFrac = g.maxLives > 0 ? g.lives / g.maxLives : 0;
  const sinceHit = g.now - g.lastVaultHit;

  if (sprite) {
    ctx.drawImage(sprite, x, y, TILE, TILE);
  } else {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    // Glow breathes; turns red and flickers when the vault is in danger.
    const danger = livesFrac < 0.3;
    const breathe = 14 + 5 * Math.sin(g.now * 2.2);
    ctx.save();
    ctx.shadowColor = danger ? C.danger : C.vault;
    ctx.shadowBlur = danger ? breathe + 6 * Math.sin(g.now * 14) : breathe;
    ctx.fillStyle = '#0f1c4d';
    roundRect(ctx, x + 6, y + 6, TILE - 12, TILE - 12, 10);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = danger ? C.danger : C.vault;
    ctx.lineWidth = 3;
    roundRect(ctx, x + 6, y + 6, TILE - 12, TILE - 12, 10);
    ctx.stroke();
    // Stylized vault dial (circle + keyhole) — placeholder, no copyrighted logos.
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx, cy + 6);
    ctx.stroke();
    // Damage cracks appear as lives drop.
    if (livesFrac < 0.65) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 10);
      ctx.lineTo(x + 20, y + 22);
      ctx.lineTo(x + 16, y + 30);
      ctx.stroke();
    }
    if (livesFrac < 0.35) {
      ctx.beginPath();
      ctx.moveTo(x + TILE - 12, y + TILE - 10);
      ctx.lineTo(x + TILE - 22, y + TILE - 24);
      ctx.lineTo(x + TILE - 16, y + TILE - 34);
      ctx.stroke();
    }
  }

  // Expanding red ring right after a leak.
  if (sinceHit < 0.5) {
    const t = sinceHit / 0.5;
    ctx.strokeStyle = `rgba(239, 68, 68, ${1 - t})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, 16 + t * 34, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Placement helpers
// ---------------------------------------------------------------------------

function drawPlacementOverlay(ctx: CanvasRenderingContext2D, g: GameEngine): void {
  if (!g.selectedTowerType) return;

  // Tint buildable tiles while in build mode.
  ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (g.map.isBuildable(c, r) && !g.towers.some((t) => t.col === c && t.row === r)) {
        ctx.fillRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
      }
    }
  }

  // Hover/tap preview with range circle.
  if (!g.hoverCell) return;
  const [c, r] = g.hoverCell;
  const ok = g.map.isBuildable(c, r) && !g.towers.some((t) => t.col === c && t.row === r);
  const cx = (c + 0.5) * TILE;
  const cy = (r + 0.5) * TILE;
  const def = TOWERS[g.selectedTowerType];
  ctx.fillStyle = ok ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';
  ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
  if (ok) {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, def.levels[0].range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawRangePreview(ctx: CanvasRenderingContext2D, g: GameEngine): void {
  const t = g.towers.find((tw) => tw.id === g.selectedTowerId);
  if (!t) return;
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
  ctx.fillStyle = 'rgba(96, 165, 250, 0.08)';
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.stats.range, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Towers (placeholder shapes per type, color-coded; level shown as pips)
// ---------------------------------------------------------------------------

function drawTower(
  ctx: CanvasRenderingContext2D,
  t: Tower,
  selected: boolean,
  now: number,
): void {
  const sprite = getSprite(t.def.spriteKey);
  // Recoil: 1 right after a shot, easing back to 0 over ~0.15s.
  const recoil = Math.max(0, 1 - (now - t.lastShot) / 0.15);

  if (sprite) {
    ctx.drawImage(sprite, t.col * TILE, t.row * TILE, TILE, TILE);
  } else {
    // Base plate with a soft idle glow that breathes per-tower.
    const glow = 0.5 + 0.5 * Math.sin(now * 2 + t.id * 1.7);
    ctx.save();
    ctx.shadowColor = t.def.color;
    ctx.shadowBlur = selected ? 14 : 4 + glow * 5;
    ctx.fillStyle = '#101935';
    roundRect(ctx, t.x - 22, t.y - 22, 44, 44, 8);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = selected ? C.white : t.def.color;
    ctx.lineWidth = selected ? 3 : 2;
    roundRect(ctx, t.x - 22, t.y - 22, 44, 44, 8);
    ctx.stroke();

    drawTowerIcon(ctx, t, now, recoil);
  }

  // Muzzle flash at the facing edge right after firing.
  if (recoil > 0.55) {
    const fx = t.x + Math.cos(t.angle) * 22;
    const fy = t.y + Math.sin(t.angle) * 22;
    ctx.fillStyle = `rgba(248, 250, 252, ${(recoil - 0.55) * 2})`;
    ctx.beginPath();
    ctx.arc(fx, fy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Level pips under the tower.
  for (let i = 0; i <= t.level; i++) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(t.x - 8 + i * 8, t.y + 26, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTowerIcon(
  ctx: CanvasRenderingContext2D,
  t: Tower,
  now: number,
  recoil: number,
): void {
  const { x, y } = t;
  ctx.save();
  switch (t.type) {
    case 'diamondPaw': {
      // Diamond with a paw dot; squashes slightly on fire.
      const squash = 1 - recoil * 0.15;
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.moveTo(x, y - 14 * squash);
      ctx.lineTo(x + 12, y);
      ctx.lineTo(x, y + 14 * squash);
      ctx.lineTo(x - 12, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.bgA;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'howlCannon': {
      // Rotating barrel with recoil kickback.
      ctx.translate(x, y);
      ctx.rotate(t.angle);
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(-recoil * 5, -5, 20, 10);
      break;
    }
    case 'blueFlame': {
      // Flame teardrop that flickers.
      const flicker = 1 + 0.08 * Math.sin(now * 9 + t.id);
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.moveTo(x, y - 15 * flicker);
      ctx.quadraticCurveTo(x + 13, y + 2, x, y + 13);
      ctx.quadraticCurveTo(x - 13, y + 2, x, y - 15 * flicker);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(x, y + 4, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'packScout': {
      // Radar arcs that sweep.
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 2.5;
      const sweep = (now * 1.2 + t.id) % 1;
      for (let i = 0; i < 3; i++) {
        const r = 5 + i * 4;
        const alpha = i / 3 <= sweep ? 0.95 : 0.35;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y + 6, r, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.arc(x, y + 8, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'guardianNiko': {
      // Stylized NIKO wolf head: black fur, ears, blue forehead marks,
      // white muzzle and a blue flame tail tip curling beside the head.
      ctx.fillStyle = '#0b0e1a';
      ctx.beginPath();
      ctx.arc(x, y + 2, 13, 0, Math.PI * 2);
      ctx.fill();
      // Ears.
      ctx.beginPath();
      ctx.moveTo(x - 11, y - 6);
      ctx.lineTo(x - 6, y - 18);
      ctx.lineTo(x - 1, y - 8);
      ctx.moveTo(x + 11, y - 6);
      ctx.lineTo(x + 6, y - 18);
      ctx.lineTo(x + 1, y - 8);
      ctx.fill();
      // White muzzle/chest patch.
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(x, y + 8, 6, 0, Math.PI * 2);
      ctx.fill();
      // Three blue forehead marks that glow brighter as NIKO fires.
      ctx.fillStyle = recoil > 0 ? '#93c5fd' : '#3b82f6';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(x + i * 5, y - 4, 1.8 + recoil, 0, Math.PI * 2);
        ctx.fill();
      }
      // Blue flame tail tip, flickering.
      const f = 1 + 0.15 * Math.sin(now * 8 + t.id);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(x + 14, y + 12);
      ctx.quadraticCurveTo(x + 22, y + 2 - 4 * (f - 1) * 10, x + 16, y - 4 * f);
      ctx.quadraticCurveTo(x + 18, y + 6, x + 12, y + 8);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Enemies (placeholder shapes per type + health bars + status tints)
// ---------------------------------------------------------------------------

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, now: number): void {
  const sprite = getSprite(e.def.spriteKey);
  const r = e.def.radius;
  // Walk-cycle bob, slower when slowed.
  const bob = Math.sin(now * 9 * e.slowFactor + e.id * 2.1) * 1.8;
  const ey = e.y + (e.def.boss ? 0 : bob);

  if (sprite) {
    ctx.drawImage(sprite, e.x - r, ey - r, r * 2, r * 2);
  } else {
    ctx.save();
    ctx.fillStyle = e.def.color;
    switch (e.def.id) {
      case 'jeet': // fast runner: triangle facing its heading
        ctx.translate(e.x, ey);
        ctx.rotate(e.angle);
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.8, -r * 0.8);
        ctx.lineTo(-r * 0.8, r * 0.8);
        ctx.closePath();
        ctx.fill();
        break;
      case 'rugger': { // tank: heavy square with grinding treads
        ctx.translate(e.x, ey);
        ctx.rotate(e.angle);
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 3;
        ctx.strokeRect(-r + 2, -r + 2, r * 2 - 4, r * 2 - 4);
        // Tread marks scroll backwards as it rolls.
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 2;
        const tread = (now * e.def.speed * e.slowFactor) % 8;
        for (let i = -r + tread; i < r; i += 8) {
          ctx.beginPath();
          ctx.moveTo(i, -r + 2);
          ctx.lineTo(i, -r + 7);
          ctx.moveTo(i, r - 2);
          ctx.lineTo(i, r - 7);
          ctx.stroke();
        }
        break;
      }
      case 'bot': // swarm: small spinning hexagon
        ctx.translate(e.x, ey);
        ctx.rotate(now * 4 + e.id);
        polygon(ctx, 0, 0, r, 6);
        ctx.fill();
        break;
      case 'sniper': { // evasive: thin diamond that shimmers/strafes
        const strafe = Math.sin(now * 13 + e.id * 3) * 3;
        ctx.translate(e.x + Math.cos(e.angle + Math.PI / 2) * strafe, ey);
        ctx.rotate(e.angle);
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now * 10 + e.id);
        ctx.beginPath();
        ctx.moveTo(r * 1.2, 0);
        ctx.lineTo(0, r * 0.7);
        ctx.lineTo(-r * 1.2, 0);
        ctx.lineTo(0, -r * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'fudBeast': { // boss: pulsing spiky blob with glaring eyes
        const pulse = 1 + 0.07 * Math.sin(now * 3 + e.id);
        ctx.translate(e.x, ey);
        ctx.rotate(Math.sin(now * 1.4) * 0.12);
        polygon(ctx, 0, 0, r * pulse, 9);
        ctx.fill();
        ctx.fillStyle = '#052e16';
        polygon(ctx, 0, 0, r * 0.6 * pulse, 9);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        const glare = 3.5 + Math.sin(now * 5) * 0.8;
        ctx.beginPath();
        ctx.arc(-7, -4, glare, 0, Math.PI * 2);
        ctx.arc(7, -4, glare, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  // Status tints.
  if (e.slowFactor < 1) {
    ctx.strokeStyle = 'rgba(191, 219, 254, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, ey, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (e.burnDps > 0) {
    // Flickering blue embers above a burning enemy.
    for (let i = 0; i < 2; i++) {
      const fx = e.x + Math.sin(now * 11 + e.id + i * 3) * r * 0.5;
      const fy = ey - r - 2 - ((now * 26 + i * 9) % 9);
      ctx.fillStyle = `rgba(56, 189, 248, ${0.8 - ((now * 3 + i) % 1) * 0.5})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Health bar.
  const w = Math.max(r * 2, 22);
  const frac = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(e.x - w / 2, ey - r - 10, w, 4);
  ctx.fillStyle = frac > 0.4 ? C.hp : C.danger;
  ctx.fillRect(e.x - w / 2, ey - r - 10, w * frac, 4);
}

// ---------------------------------------------------------------------------
// Particles & overlays
// ---------------------------------------------------------------------------

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const alpha = Math.max(0, p.life / p.maxLife);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (p.kind === 'text' && p.label) {
    ctx.fillStyle = p.color;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.label, p.x, p.y);
  } else if (p.kind === 'ring' && p.radius) {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (1 - alpha * 0.5), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPauseOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(6, 10, 24, 0.7)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = C.white;
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 8);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('The Pack rests. Tap Resume to keep defending.', CANVAS_W / 2, CANVAS_H / 2 + 22);
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function polygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  sides: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
