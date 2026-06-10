import type { TowerDef, TowerTypeId } from '../types';

/**
 * Tower balance tables.
 * Each tower has 3 levels; levels[0].cost is the build cost.
 * Ranges are in canvas pixels (one tile = 60px).
 */
export const TOWERS: Record<TowerTypeId, TowerDef> = {
  diamondPaw: {
    id: 'diamondPaw',
    name: 'Diamond Paw',
    tagline: 'Balanced single-target damage. Never sells.',
    color: '#60a5fa',
    spriteKey: 'tower.diamondPaw',
    levels: [
      { damage: 16, range: 130, fireRate: 1.6, projectileSpeed: 460, cost: 50 },
      { damage: 27, range: 142, fireRate: 1.9, projectileSpeed: 480, cost: 45 },
      { damage: 44, range: 158, fireRate: 2.3, projectileSpeed: 500, cost: 80 },
    ],
  },
  howlCannon: {
    id: 'howlCannon',
    name: 'Howl Cannon',
    tagline: 'Splash damage. One howl, many bags shaken.',
    color: '#93c5fd',
    spriteKey: 'tower.howlCannon',
    levels: [
      { damage: 26, range: 120, fireRate: 0.7, projectileSpeed: 320, splashRadius: 55, cost: 90 },
      { damage: 42, range: 130, fireRate: 0.8, projectileSpeed: 330, splashRadius: 66, cost: 75 },
      { damage: 66, range: 142, fireRate: 0.95, projectileSpeed: 340, splashRadius: 80, cost: 130 },
    ],
  },
  blueFlame: {
    id: 'blueFlame',
    name: 'Blue Flame',
    tagline: 'Ignites enemies with NIKO’s tail flame. Damage over time.',
    color: '#38bdf8',
    spriteKey: 'tower.blueFlame',
    levels: [
      { damage: 6, range: 115, fireRate: 0.9, projectileSpeed: 420, burnDps: 14, burnDuration: 3, cost: 80 },
      { damage: 10, range: 125, fireRate: 1.0, projectileSpeed: 430, burnDps: 24, burnDuration: 3.5, cost: 65 },
      { damage: 16, range: 138, fireRate: 1.15, projectileSpeed: 440, burnDps: 40, burnDuration: 4, cost: 110 },
    ],
  },
  packScout: {
    id: 'packScout',
    name: 'Pack Scout',
    tagline: 'Marks targets and slows the herd for the Pack.',
    color: '#bfdbfe',
    spriteKey: 'tower.packScout',
    levels: [
      { damage: 5, range: 140, fireRate: 0.8, projectileSpeed: 480, slowFactor: 0.6, slowDuration: 2, cost: 60 },
      { damage: 8, range: 152, fireRate: 0.9, projectileSpeed: 490, slowFactor: 0.5, slowDuration: 2.4, cost: 50 },
      { damage: 12, range: 165, fireRate: 1.0, projectileSpeed: 500, slowFactor: 0.4, slowDuration: 2.8, cost: 90 },
    ],
  },
  guardianNiko: {
    id: 'guardianNiko',
    name: 'Guardian NIKO',
    tagline: 'The Alpha himself. Devastating single-target bite.',
    color: '#2563ff',
    spriteKey: 'tower.guardianNiko',
    levels: [
      { damage: 90, range: 170, fireRate: 0.8, projectileSpeed: 560, cost: 250 },
      { damage: 150, range: 185, fireRate: 0.9, projectileSpeed: 580, cost: 210 },
      { damage: 245, range: 200, fireRate: 1.0, projectileSpeed: 600, cost: 360 },
    ],
  },
};

/** Display order in the build bar. */
export const TOWER_ORDER: TowerTypeId[] = [
  'diamondPaw',
  'packScout',
  'blueFlame',
  'howlCannon',
  'guardianNiko',
];

/** Fraction of total invested Paws refunded when a tower is sold. */
export const SELL_REFUND = 0.7;

/** Total paws invested into a tower at a given level (build + upgrades). */
export function investedCost(type: TowerTypeId, level: number): number {
  return TOWERS[type].levels
    .slice(0, level + 1)
    .reduce((sum, l) => sum + l.cost, 0);
}
