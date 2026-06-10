import {
  CANVAS_H,
  CANVAS_W,
  GRID_COLS,
  GRID_ROWS,
  PATH_CELLS,
  TILE,
  VAULT_CELL,
  WAYPOINTS_PX,
  isBuildableCell,
} from '../data/map';
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
  drawBoard(ctx);
  drawPlacementOverlay(ctx, g);
  drawVault(ctx);
  for (const t of g.towers) drawTower(ctx, t, t.id === g.selectedTowerId);
  for (const e of g.enemies) drawEnemy(ctx, e);
  for (const p of g.projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.stats.splashRadius ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of g.particles) drawParticle(ctx, pt);
  drawRangePreview(ctx, g);
  if (g.status === 'paused') drawPauseOverlay(ctx);
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

function drawBoard(ctx: CanvasRenderingContext2D): void {
  // Subtle vertical gradient backdrop.
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, C.bgA);
  grad.addColorStop(1, C.bgB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

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

  // Path tiles.
  for (const key of PATH_CELLS) {
    const [c, r] = key.split(',').map(Number);
    ctx.fillStyle = C.path;
    ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    ctx.strokeStyle = C.pathEdge;
    ctx.strokeRect(c * TILE + 0.5, r * TILE + 0.5, TILE - 1, TILE - 1);
  }

  // Direction chevrons along the path centerline.
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i < WAYPOINTS_PX.length; i++) {
    const [x0, y0] = WAYPOINTS_PX[i - 1];
    const [x1, y1] = WAYPOINTS_PX[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    for (let d = TILE; d < len; d += TILE) {
      const x = x0 + ux * d;
      const y = y0 + uy * d;
      ctx.beginPath();
      ctx.moveTo(x - ux * 8 - uy * 6, y - uy * 8 + ux * 6);
      ctx.lineTo(x, y);
      ctx.lineTo(x - ux * 8 + uy * 6, y - uy * 8 - ux * 6);
      ctx.stroke();
    }
  }
}

function drawVault(ctx: CanvasRenderingContext2D): void {
  const sprite = getSprite('map.vault');
  const x = VAULT_CELL[0] * TILE;
  const y = VAULT_CELL[1] * TILE;
  if (sprite) {
    ctx.drawImage(sprite, x, y, TILE, TILE);
    return;
  }
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  // Glow.
  ctx.save();
  ctx.shadowColor = C.vault;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#0f1c4d';
  roundRect(ctx, x + 6, y + 6, TILE - 12, TILE - 12, 10);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.vault;
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
      if (isBuildableCell(c, r) && !g.towers.some((t) => t.col === c && t.row === r)) {
        ctx.fillRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
      }
    }
  }

  // Hover/tap preview with range circle.
  if (!g.hoverCell) return;
  const [c, r] = g.hoverCell;
  const ok =
    isBuildableCell(c, r) && !g.towers.some((t) => t.col === c && t.row === r);
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

function drawTower(ctx: CanvasRenderingContext2D, t: Tower, selected: boolean): void {
  const sprite = getSprite(t.def.spriteKey);
  if (sprite) {
    ctx.drawImage(sprite, t.col * TILE, t.row * TILE, TILE, TILE);
  } else {
    // Base plate.
    ctx.fillStyle = '#101935';
    roundRect(ctx, t.x - 22, t.y - 22, 44, 44, 8);
    ctx.fill();
    ctx.strokeStyle = selected ? C.white : t.def.color;
    ctx.lineWidth = selected ? 3 : 2;
    roundRect(ctx, t.x - 22, t.y - 22, 44, 44, 8);
    ctx.stroke();

    drawTowerIcon(ctx, t);
  }

  // Level pips under the tower.
  for (let i = 0; i <= t.level; i++) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(t.x - 8 + i * 8, t.y + 26, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTowerIcon(ctx: CanvasRenderingContext2D, t: Tower): void {
  const { x, y } = t;
  ctx.save();
  switch (t.type) {
    case 'diamondPaw': {
      // Diamond with a paw dot.
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x + 12, y);
      ctx.lineTo(x, y + 14);
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
      // Rotating barrel.
      ctx.translate(x, y);
      ctx.rotate(t.angle);
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(0, -5, 20, 10);
      break;
    }
    case 'blueFlame': {
      // Flame teardrop.
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.moveTo(x, y - 15);
      ctx.quadraticCurveTo(x + 13, y + 2, x, y + 13);
      ctx.quadraticCurveTo(x - 13, y + 2, x, y - 15);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(x, y + 4, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'packScout': {
      // Radar arcs.
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 2.5;
      for (let r = 5; r <= 13; r += 4) {
        ctx.beginPath();
        ctx.arc(x, y + 6, r, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
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
      // Three blue forehead marks.
      ctx.fillStyle = '#3b82f6';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(x + i * 5, y - 4, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // Blue flame tail tip.
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(x + 14, y + 12);
      ctx.quadraticCurveTo(x + 22, y + 2, x + 16, y - 4);
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

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const sprite = getSprite(e.def.spriteKey);
  const r = e.def.radius;
  if (sprite) {
    ctx.drawImage(sprite, e.x - r, e.y - r, r * 2, r * 2);
  } else {
    ctx.save();
    ctx.fillStyle = e.def.color;
    switch (e.def.id) {
      case 'jeet': // fast runner: forward-pointing triangle
        ctx.beginPath();
        ctx.moveTo(e.x + r, e.y);
        ctx.lineTo(e.x - r * 0.8, e.y - r * 0.8);
        ctx.lineTo(e.x - r * 0.8, e.y + r * 0.8);
        ctx.closePath();
        ctx.fill();
        break;
      case 'rugger': // tank: heavy square
        ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 3;
        ctx.strokeRect(e.x - r + 2, e.y - r + 2, r * 2 - 4, r * 2 - 4);
        break;
      case 'bot': // swarm: small hexagon
        polygon(ctx, e.x, e.y, r, 6);
        ctx.fill();
        break;
      case 'sniper': // evasive: thin diamond
        ctx.beginPath();
        ctx.moveTo(e.x, e.y - r * 1.2);
        ctx.lineTo(e.x + r * 0.7, e.y);
        ctx.lineTo(e.x, e.y + r * 1.2);
        ctx.lineTo(e.x - r * 0.7, e.y);
        ctx.closePath();
        ctx.fill();
        break;
      case 'fudBeast': // boss: spiky blob with eyes
        polygon(ctx, e.x, e.y, r, 9);
        ctx.fill();
        ctx.fillStyle = '#052e16';
        polygon(ctx, e.x, e.y, r * 0.6, 9);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(e.x - 7, e.y - 4, 3.5, 0, Math.PI * 2);
        ctx.arc(e.x + 7, e.y - 4, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  // Status tints.
  if (e.slowFactor < 1) {
    ctx.strokeStyle = 'rgba(191, 219, 254, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (e.burnDps > 0) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.beginPath();
    ctx.arc(e.x + r * 0.6, e.y - r, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Health bar.
  const w = Math.max(r * 2, 22);
  const frac = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(e.x - w / 2, e.y - r - 10, w, 4);
  ctx.fillStyle = frac > 0.4 ? C.hp : C.danger;
  ctx.fillRect(e.x - w / 2, e.y - r - 10, w * frac, 4);
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
