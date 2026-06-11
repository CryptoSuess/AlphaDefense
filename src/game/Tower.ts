import { SELL_REFUND, TOWERS, investedCost } from '../data/towers';
import { TILE } from '../data/map';
import type {
  TargetingMode,
  TowerDef,
  TowerLevelStats,
  TowerSnapshot,
  TowerTypeId,
} from '../types';
import type { Enemy } from './Enemy';
import { dist } from '../utils/math';

let nextId = 1;

const TARGETING_CYCLE: TargetingMode[] = ['first', 'strong', 'close'];

/**
 * A placed tower. Owns its cooldown and target acquisition; the engine asks
 * it each frame whether it wants to fire.
 */
export class Tower {
  readonly id = nextId++;
  readonly def: TowerDef;
  level = 0;
  /** Chosen final-tier branch, or null while unspecialized. */
  branch: 0 | 1 | null = null;
  /** How this tower picks targets (player-cyclable). */
  targeting: TargetingMode = 'first';
  /** Seconds until the next shot is allowed. */
  cooldown = 0;
  /** Facing angle, for rendering. */
  angle = 0;
  /** Game time of the last shot (renderer uses it for recoil/muzzle flash). */
  lastShot = -10;
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
    if (this.branch !== null && this.def.branches) {
      return this.def.branches[this.branch].stats;
    }
    return this.def.levels[this.level];
  }

  get maxLevel(): number {
    return this.def.levels.length - 1;
  }

  /** Cost of the next linear level, or null if at the top (or specialized). */
  get upgradeCost(): number | null {
    if (this.branch !== null) return null;
    return this.level < this.maxLevel ? this.def.levels[this.level + 1].cost : null;
  }

  /** True when the next upgrade is a branch choice rather than a level. */
  get atBranchPoint(): boolean {
    return (
      this.branch === null && this.level >= this.maxLevel && this.def.branches !== undefined
    );
  }

  chooseBranch(index: 0 | 1): void {
    if (this.atBranchPoint) this.branch = index;
  }

  cycleTargeting(): TargetingMode {
    const next =
      TARGETING_CYCLE[(TARGETING_CYCLE.indexOf(this.targeting) + 1) % TARGETING_CYCLE.length];
    this.targeting = next;
    this.target = null; // re-acquire with the new rule
    return next;
  }

  get sellValue(): number {
    return Math.floor(investedCost(this.type, this.level, this.branch) * SELL_REFUND);
  }

  /** Current target, kept between shots so damage isn't spread thin. */
  private target: Enemy | null = null;

  /**
   * Sticky targeting: keep shooting the current target while it is alive and
   * in range; otherwise re-acquire using the tower's targeting mode:
   *  - first:  enemy furthest along the path (closest to the Vault)
   *  - strong: highest current HP
   *  - close:  nearest to this tower
   */
  findTarget(enemies: Enemy[]): Enemy | null {
    const t = this.target;
    if (t && !t.dead && dist(this.x, this.y, t.x, t.y) <= this.stats.range) {
      return t;
    }
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d > this.stats.range) continue;
      const score =
        this.targeting === 'strong' ? e.hp : this.targeting === 'close' ? -d : e.progress;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    this.target = best;
    return best;
  }

  snapshot(): TowerSnapshot {
    const branches = this.def.branches;
    return {
      id: this.id,
      type: this.type,
      level: this.level,
      maxLevel: this.maxLevel,
      upgradeCost: this.upgradeCost,
      branchOptions:
        this.atBranchPoint && branches
          ? branches.map((b, i) => ({
              index: i as 0 | 1,
              name: b.name,
              tagline: b.tagline,
              cost: b.stats.cost,
            }))
          : null,
      branchName: this.branch !== null && branches ? branches[this.branch].name : null,
      targeting: this.targeting,
      sellValue: this.sellValue,
      col: this.col,
      row: this.row,
    };
  }
}
