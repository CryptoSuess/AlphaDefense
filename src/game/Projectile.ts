import type { TowerLevelStats, TowerTypeId } from '../types';
import type { Enemy } from './Enemy';
import type { Tower } from './Tower';

/**
 * A homing projectile fired by a tower. If its target dies mid-flight it
 * flies to the target's last known position and detonates there (relevant
 * for splash shots).
 */
export class Projectile {
  x: number;
  y: number;
  /** Position one frame ago, used by the renderer to draw a motion trail. */
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
  done = false;
  readonly stats: TowerLevelStats;
  readonly color: string;
  /** Firing tower's type, for damage attribution in run stats. */
  readonly towerType: TowerTypeId;

  constructor(
    tower: Tower,
    public target: Enemy | null,
  ) {
    this.x = tower.x;
    this.y = tower.y;
    this.prevX = tower.x;
    this.prevY = tower.y;
    this.stats = tower.stats;
    this.color = tower.def.color;
    this.towerType = tower.type;
    this.targetX = target?.x ?? tower.x;
    this.targetY = target?.y ?? tower.y;
  }

  /** Moves toward the target. Returns true when it arrives (impact). */
  update(dt: number): boolean {
    this.prevX = this.x;
    this.prevY = this.y;
    if (this.target && !this.target.dead) {
      this.targetX = this.target.x;
      this.targetY = this.target.y;
    } else {
      this.target = null;
    }
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.stats.projectileSpeed * dt;
    if (d <= step || d < 1) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.done = true;
      return true;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    return false;
  }
}
