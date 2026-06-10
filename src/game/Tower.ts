import { SELL_REFUND, TOWERS, investedCost } from '../data/towers';
import { TILE } from '../data/map';
import type { TowerDef, TowerLevelStats, TowerTypeId, TowerSnapshot } from '../types';
import type { Enemy } from './Enemy';
import { dist } from '../utils/math';

let nextId = 1;

/**
 * A placed tower. Owns its cooldown and target acquisition; the engine asks
 * it each frame whether it wants to fire.
 */
export class Tower {
  readonly id = nextId++;
  readonly def: TowerDef;
  level = 0;
  /** Seconds until the next shot is allowed. */
  cooldown = 0;
  /** Facing angle, for rendering. */
  angle = 0;
  readonly x: number;
  readonly y: number;

  constructor(
    readonly type: TowerTypeId,
    readonly col: number,
    readonly row: number,
  ) {
    this.def = TOWERS[type];
    this.x = (col + 0.5) * TILE;
    this.y = (row + 0.5) * TILE;
  }

  get stats(): TowerLevelStats {
    return this.def.levels[this.level];
  }

  get maxLevel(): number {
    return this.def.levels.length - 1;
  }

  get upgradeCost(): number | null {
    return this.level < this.maxLevel ? this.def.levels[this.level + 1].cost : null;
  }

  get sellValue(): number {
    return Math.floor(investedCost(this.type, this.level) * SELL_REFUND);
  }

  /** Current target, kept between shots so damage isn't spread thin. */
  private target: Enemy | null = null;

  /**
   * Sticky targeting: keep shooting the current target while it is alive and
   * in range; otherwise lock onto the in-range enemy closest to the Vault.
   */
  findTarget(enemies: Enemy[]): Enemy | null {
    const t = this.target;
    if (t && !t.dead && dist(this.x, this.y, t.x, t.y) <= this.stats.range) {
      return t;
    }
    let best: Enemy | null = null;
    for (const e of enemies) {
      if (e.dead) continue;
      if (dist(this.x, this.y, e.x, e.y) > this.stats.range) continue;
      if (!best || e.progress > best.progress) best = e;
    }
    this.target = best;
    return best;
  }

  snapshot(): TowerSnapshot {
    return {
      id: this.id,
      type: this.type,
      level: this.level,
      maxLevel: this.maxLevel,
      upgradeCost: this.upgradeCost,
      sellValue: this.sellValue,
      col: this.col,
      row: this.row,
    };
  }
}
