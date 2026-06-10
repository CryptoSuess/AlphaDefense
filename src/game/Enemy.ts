import { ENEMIES } from '../data/enemies';
import { WAYPOINTS_PX } from '../data/map';
import type { EnemyDef, EnemyTypeId } from '../types';

let nextId = 1;

/**
 * A live enemy walking the path toward the Base Vault.
 * Movement follows the waypoint polyline; status effects (slow/burn) are
 * applied by projectile hits and ticked each frame.
 */
export class Enemy {
  readonly id = nextId++;
  readonly def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Distance travelled along the path; used for "closest to vault" targeting. */
  progress = 0;
  /** Index of the waypoint currently being walked toward. */
  private seg = 1;
  /** True once the enemy reached the vault (leaked) or died. */
  dead = false;
  leaked = false;
  /** Slow effect: speed is multiplied by `factor` until `until` (game time). */
  slowFactor = 1;
  slowUntil = 0;
  /** Burn effect: takes `burnDps` damage/s until `burnUntil`. */
  burnDps = 0;
  burnUntil = 0;

  constructor(type: EnemyTypeId, hpMult: number) {
    this.def = ENEMIES[type];
    this.maxHp = Math.round(this.def.hp * hpMult);
    this.hp = this.maxHp;
    [this.x, this.y] = WAYPOINTS_PX[0];
  }

  /** Advances along the path. Returns true if the enemy leaked this frame. */
  update(dt: number, now: number): boolean {
    // Tick burn damage.
    if (this.burnDps > 0 && now < this.burnUntil) {
      this.hp -= this.burnDps * dt;
    }
    if (now >= this.slowUntil) this.slowFactor = 1;

    let move = this.def.speed * this.slowFactor * dt;
    while (move > 0 && this.seg < WAYPOINTS_PX.length) {
      const [tx, ty] = WAYPOINTS_PX[this.seg];
      const d = Math.hypot(tx - this.x, ty - this.y);
      if (d <= move) {
        this.x = tx;
        this.y = ty;
        this.progress += d;
        move -= d;
        this.seg++;
      } else {
        this.x += ((tx - this.x) / d) * move;
        this.y += ((ty - this.y) / d) * move;
        this.progress += move;
        move = 0;
      }
    }
    if (this.seg >= WAYPOINTS_PX.length) {
      this.leaked = true;
      this.dead = true;
      return true;
    }
    return false;
  }

  applySlow(factor: number, duration: number, now: number): void {
    // Strongest slow wins; duration refreshes.
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowUntil = Math.max(this.slowUntil, now + duration);
  }

  applyBurn(dps: number, duration: number, now: number): void {
    // Strongest burn wins; duration refreshes.
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnUntil = Math.max(this.burnUntil, now + duration);
  }
}
