import { COPY } from '../data/copy';
import { DIFFICULTIES } from '../data/difficulty';
import { MAPS, TILE, type GameMap } from '../data/map';
import { TOWERS } from '../data/towers';
import {
  TOTAL_WAVES,
  buildWave,
  isBossWave,
  waveClearBonus,
  waveClearScore,
  waveHpMult,
} from '../data/waves';
import type {
  DifficultyId,
  GameEvent,
  GameStatus,
  MapId,
  SpawnEntry,
  TowerTypeId,
  UiState,
} from '../types';
import { dist } from '../utils/math';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { Tower } from './Tower';
import { SoundManager } from './sound';
import { render, type Particle } from './renderer';

/**
 * The game engine. Owns all simulation state and the requestAnimationFrame
 * loop; renders straight to a canvas and publishes lightweight snapshots to
 * React on a short interval (so the DOM UI never re-renders 60x/s).
 */
export class GameEngine {
  // --- simulation state -----------------------------------------------------
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  paws: number;
  lives: number;
  readonly maxLives: number;
  score = 0;
  wave = 0;
  waveInProgress = false;
  status: GameStatus = 'playing';
  /** Game-time clock in seconds (pauses with the game). */
  now = 0;
  timeScale = 1;
  /** True after the player chose to keep playing past the wave-25 victory. */
  endless = false;
  /** Screen-shake intensity in px, decays each frame. */
  shake = 0;
  /** Game time of the last Vault hit (renderer flashes the vault briefly). */
  lastVaultHit = -10;
  readonly map: GameMap;

  // --- interaction state ----------------------------------------------------
  selectedTowerType: TowerTypeId | null = null;
  selectedTowerId: number | null = null;
  hoverCell: [number, number] | null = null;

  readonly sound = new SoundManager();

  private spawnQueue: SpawnEntry[] = [];
  private waveClock = 0;
  private readonly hpMultBase: number;
  private readonly rewardMult: number;

  private ctx: CanvasRenderingContext2D | null = null;
  private rafId = 0;
  private lastTs = 0;
  private uiTimer = 0;
  private onUiState: (s: UiState) => void = () => {};
  private onEvent: (e: GameEvent) => void = () => {};

  constructor(
    readonly difficulty: DifficultyId,
    mapId: MapId = 'vaultRun',
  ) {
    this.map = MAPS[mapId];
    const diff = DIFFICULTIES[difficulty];
    this.paws = diff.startingPaws;
    this.lives = diff.startingLives;
    this.maxLives = diff.startingLives;
    this.hpMultBase = diff.hpMult;
    this.rewardMult = diff.rewardMult;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  attach(
    canvas: HTMLCanvasElement,
    onUiState: (s: UiState) => void,
    onEvent: (e: GameEvent) => void,
  ): void {
    this.ctx = canvas.getContext('2d');
    this.onUiState = onUiState;
    this.onEvent = onEvent;
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
    this.sound.startMusic();
    this.publishUi();
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.sound.dispose();
    this.ctx = null;
  }

  private loop = (ts: number): void => {
    this.rafId = requestAnimationFrame(this.loop);
    // Clamp dt so a backgrounded tab doesn't fast-forward the simulation.
    const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
    this.lastTs = ts;

    if (this.status === 'playing') {
      this.update(dt * this.timeScale);
    }
    if (this.ctx) render(this.ctx, this);

    // Publish UI snapshots ~8x per second.
    this.uiTimer += dt;
    if (this.uiTimer >= 0.12) {
      this.uiTimer = 0;
      this.publishUi();
    }
  };

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  private update(dt: number): void {
    this.now += dt;

    // Spawn scheduled enemies.
    if (this.waveInProgress) {
      this.waveClock += dt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].time <= this.waveClock) {
        const entry = this.spawnQueue.shift()!;
        this.enemies.push(
          new Enemy(entry.type, this.hpMultBase * waveHpMult(this.wave), this.map),
        );
      }
    }

    // Screen shake decays quickly.
    this.shake = Math.max(0, this.shake - this.shake * 7 * dt - 2 * dt);

    // Move enemies; handle leaks.
    for (const e of this.enemies) {
      if (e.dead) continue;
      const leaked = e.update(dt, this.now);
      if (leaked) {
        this.lives -= e.def.livesCost;
        this.lastVaultHit = this.now;
        this.shake = Math.min(this.shake + (e.def.boss ? 14 : 6), 18);
        this.sound.play('leak');
        this.emit({ kind: 'toast', text: COPY.vaultHit, tone: 'danger' });
        if (this.lives <= 0) {
          this.lives = 0;
          this.endGame('gameover');
          return;
        }
      } else if (e.hp <= 0) {
        this.killEnemy(e);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // Shiller heal auras: healers pump nearby allies back up (not themselves,
    // so focus-firing the healer always works).
    for (const healer of this.enemies) {
      if (healer.healDps <= 0 || healer.dead) continue;
      const radius = healer.def.healRadius ?? 0;
      for (const e of this.enemies) {
        if (e === healer || e.dead || e.hp >= e.maxHp) continue;
        if (dist(healer.x, healer.y, e.x, e.y) <= radius) {
          e.hp = Math.min(e.maxHp, e.hp + healer.healDps * dt);
        }
      }
    }

    // Towers acquire targets and fire.
    for (const t of this.towers) {
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const target = t.findTarget(this.enemies);
      if (!target) continue;
      t.angle = Math.atan2(target.y - t.y, target.x - t.x);
      t.cooldown = 1 / t.stats.fireRate;
      t.lastShot = this.now;
      this.projectiles.push(new Projectile(t, target));
      this.sound.play(t.stats.splashRadius ? 'splash' : 'shoot');
    }

    // Projectiles fly and impact.
    for (const p of this.projectiles) {
      if (p.update(dt)) this.impact(p);
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);

    // Particles decay.
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);

    // Wave end check.
    if (this.waveInProgress && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveInProgress = false;
      const bonus = Math.round(waveClearBonus(this.wave) * this.rewardMult);
      this.paws += bonus;
      this.score += waveClearScore(this.wave);
      // Victory fires once, at the end of the campaign; in endless mode the
      // run only ends when the Vault falls.
      if (this.wave >= TOTAL_WAVES && !this.endless) {
        this.endGame('victory');
        return;
      }
      this.emit({ kind: 'toast', text: `${COPY.waveCleared(this.wave)} (+${bonus} 🐾)`, tone: 'success' });
      this.publishUi();
    }
  }

  /** Resolves a projectile reaching its destination. */
  private impact(p: Projectile): void {
    const s = p.stats;
    const splash = s.splashRadius ?? 0;

    if (splash > 0) {
      // Area damage cannot be dodged.
      this.particles.push(ring(p.x, p.y, splash, p.color));
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist(p.x, p.y, e.x, e.y) <= splash + e.def.radius) {
          this.damage(e, s.damage, p);
        }
      }
      return;
    }

    const target = p.target;
    if (!target || target.dead) return;
    // Snipers can dodge direct hits.
    if (target.def.evasion > 0 && Math.random() < target.def.evasion) {
      this.particles.push(text(target.x, target.y, 'MISS', '#a855f7'));
      return;
    }
    this.damage(target, s.damage, p);
  }

  /** Applies damage and on-hit effects (burn/slow) to an enemy. */
  private damage(e: Enemy, amount: number, p: Projectile): void {
    e.hp -= amount;
    const s = p.stats;
    if (s.burnDps && s.burnDuration) e.applyBurn(s.burnDps, s.burnDuration, this.now);
    if (s.slowFactor && s.slowDuration) e.applySlow(s.slowFactor, s.slowDuration, this.now);
    this.particles.push(spark(e.x, e.y, p.color));
    this.sound.play('hit');
    if (e.hp <= 0 && !e.dead) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    const reward = Math.round(e.def.reward * this.rewardMult);
    this.paws += reward;
    this.score += e.def.score;
    this.particles.push(text(e.x, e.y, `+${reward}🐾`, '#facc15'));
    // Death burst: a ring plus sparks in the enemy's color.
    this.particles.push(ring(e.x, e.y, e.def.radius + 10, e.def.color));
    const sparkCount = e.def.boss ? 14 : 6;
    for (let i = 0; i < sparkCount; i++) this.particles.push(spark(e.x, e.y, e.def.color));
    this.sound.play('kill');
    if (e.def.boss) {
      this.shake = Math.min(this.shake + 10, 18);
      this.emit({ kind: 'toast', text: COPY.bossDown, tone: 'success' });
    }
    // Death-split: the FUD Beast bursts into a bot swarm where it fell.
    const spawn = e.def.deathSpawn;
    if (spawn) {
      const hpMult = this.hpMultBase * waveHpMult(this.wave);
      for (let i = 0; i < spawn.count; i++) {
        const child = new Enemy(spawn.type, hpMult, this.map);
        child.placeAt(e, e.def.radius * 1.5);
        this.enemies.push(child);
      }
    }
    if (this.selectedTowerId === null) this.uiTimer = 1; // refresh paws promptly
  }

  private endGame(status: 'gameover' | 'victory'): void {
    this.status = status;
    this.waveInProgress = false;
    this.sound.play(status === 'victory' ? 'victory' : 'gameover');
    this.emit({ kind: 'ended', status, score: this.score, wave: this.wave });
    this.publishUi();
  }

  // ---------------------------------------------------------------------------
  // Player commands (called from React)
  // ---------------------------------------------------------------------------

  startNextWave(): void {
    if (this.status !== 'playing' || this.waveInProgress) return;
    if (this.wave >= TOTAL_WAVES && !this.endless) return;
    this.wave += 1;
    this.spawnQueue = buildWave(this.wave);
    this.waveClock = 0;
    this.waveInProgress = true;
    const boss = isBossWave(this.wave);
    this.sound.play(boss ? 'boss' : 'wave');
    this.emit({
      kind: 'toast',
      text: boss ? COPY.bossWave : COPY.waveStart(this.wave),
      tone: boss ? 'danger' : 'info',
    });
    this.publishUi();
  }

  /** Continues a victorious run into endless mode (waves keep coming). */
  continueEndless(): void {
    if (this.status !== 'victory') return;
    this.endless = true;
    this.status = 'playing';
    this.lastTs = performance.now();
    this.emit({ kind: 'toast', text: COPY.endlessStart, tone: 'info' });
    this.publishUi();
  }

  /** Toggle the build-bar selection. */
  selectTowerType(type: TowerTypeId | null): void {
    this.selectedTowerType = this.selectedTowerType === type ? null : type;
    this.selectedTowerId = null;
    this.publishUi();
  }

  /** Handles a tap/click at logical canvas coordinates. */
  pointerDown(x: number, y: number): void {
    if (this.status !== 'playing' && this.status !== 'paused') return;
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);

    // Tapping an existing tower selects it for upgrade/sell.
    const existing = this.towers.find((t) => t.col === col && t.row === row);
    if (existing) {
      this.selectedTowerId = existing.id === this.selectedTowerId ? null : existing.id;
      this.selectedTowerType = null;
      this.publishUi();
      return;
    }

    // Otherwise try to place the selected tower type.
    if (this.selectedTowerType) {
      this.placeTower(this.selectedTowerType, col, row);
      return;
    }

    this.selectedTowerId = null;
    this.publishUi();
  }

  pointerMove(x: number, y: number): void {
    this.hoverCell = [Math.floor(x / TILE), Math.floor(y / TILE)];
  }

  pointerLeave(): void {
    this.hoverCell = null;
  }

  /** Clears both build-mode and placed-tower selection. */
  clearSelection(): void {
    this.selectedTowerType = null;
    this.selectedTowerId = null;
    this.publishUi();
  }

  placeTower(type: TowerTypeId, col: number, row: number): boolean {
    if (this.status !== 'playing') return false;
    if (!this.map.isBuildable(col, row)) return false;
    if (this.towers.some((t) => t.col === col && t.row === row)) return false;
    const cost = TOWERS[type].levels[0].cost;
    if (this.paws < cost) {
      this.emit({ kind: 'toast', text: COPY.notEnoughPaws, tone: 'danger' });
      return false;
    }
    this.paws -= cost;
    this.towers.push(new Tower(type, col, row));
    this.sound.play('place');
    this.publishUi();
    return true;
  }

  upgradeTower(id: number): void {
    const t = this.towers.find((tw) => tw.id === id);
    if (!t || this.status !== 'playing') return;
    const cost = t.upgradeCost;
    if (cost === null) return;
    if (this.paws < cost) {
      this.emit({ kind: 'toast', text: COPY.notEnoughPaws, tone: 'danger' });
      return;
    }
    this.paws -= cost;
    t.level += 1;
    this.sound.play('upgrade');
    this.publishUi();
  }

  /** Buys a final-tier specialization for a tower at its branch point. */
  chooseBranch(id: number, index: 0 | 1): void {
    const t = this.towers.find((tw) => tw.id === id);
    if (!t || this.status !== 'playing' || !t.atBranchPoint) return;
    const cost = t.def.branches?.[index].stats.cost ?? 0;
    if (this.paws < cost) {
      this.emit({ kind: 'toast', text: COPY.notEnoughPaws, tone: 'danger' });
      return;
    }
    this.paws -= cost;
    t.chooseBranch(index);
    this.sound.play('upgrade');
    this.emit({
      kind: 'toast',
      text: `${t.def.branches![index].name} unlocked — Diamond Paws Activated`,
      tone: 'success',
    });
    this.publishUi();
  }

  /** Cycles a tower's targeting mode (first → strong → close). */
  cycleTargeting(id: number): void {
    const t = this.towers.find((tw) => tw.id === id);
    if (!t) return;
    t.cycleTargeting();
    this.publishUi();
  }

  sellTower(id: number): void {
    const idx = this.towers.findIndex((tw) => tw.id === id);
    if (idx === -1 || this.status !== 'playing') return;
    this.paws += this.towers[idx].sellValue;
    this.towers.splice(idx, 1);
    this.selectedTowerId = null;
    this.sound.play('sell');
    this.publishUi();
  }

  togglePause(): void {
    if (this.status === 'playing') this.status = 'paused';
    else if (this.status === 'paused') {
      this.status = 'playing';
      this.lastTs = performance.now();
    }
    this.publishUi();
  }

  toggleSpeed(): void {
    this.timeScale = this.timeScale === 1 ? 2 : 1;
    this.publishUi();
  }

  toggleSound(): void {
    this.sound.toggle();
    this.publishUi();
  }

  // ---------------------------------------------------------------------------
  // UI plumbing
  // ---------------------------------------------------------------------------

  private emit(e: GameEvent): void {
    this.onEvent(e);
  }

  private publishUi(): void {
    const sel = this.towers.find((t) => t.id === this.selectedTowerId) ?? null;
    this.onUiState({
      status: this.status,
      paws: Math.floor(this.paws),
      lives: this.lives,
      maxLives: this.maxLives,
      score: this.score,
      wave: this.wave,
      totalWaves: TOTAL_WAVES,
      waveInProgress: this.waveInProgress,
      nextWaveIsBoss: isBossWave(this.wave + 1),
      endless: this.endless,
      selectedTowerType: this.selectedTowerType,
      selectedTower: sel ? sel.snapshot() : null,
      timeScale: this.timeScale,
      soundOn: this.sound.on,
    });
  }
}

// ---------------------------------------------------------------------------
// Particle helpers
// ---------------------------------------------------------------------------

function spark(x: number, y: number, color: string): Particle {
  const a = Math.random() * Math.PI * 2;
  return { kind: 'spark', x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.25, maxLife: 0.25, color };
}

function text(x: number, y: number, label: string, color: string): Particle {
  return { kind: 'text', x, y, vx: 0, vy: -40, life: 0.9, maxLife: 0.9, color, label };
}

function ring(x: number, y: number, radius: number, color: string): Particle {
  return { kind: 'ring', x, y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color, radius };
}
