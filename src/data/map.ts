import type { MapId } from '../types';

/**
 * Battlefield maps.
 *
 * The grid/canvas size is shared by every map; each map supplies its own
 * waypoint polyline (the enemy path) and vault cell. Logical canvas size is
 * GRID_COLS * TILE x GRID_ROWS * TILE (960x540), scaled with CSS — mobile
 * friendly without per-device math.
 */
export const TILE = 60;
export const GRID_COLS = 16;
export const GRID_ROWS = 9;
export const CANVAS_W = GRID_COLS * TILE; // 960
export const CANVAS_H = GRID_ROWS * TILE; // 540

export interface MapDef {
  id: MapId;
  name: string;
  description: string;
  /**
   * Path waypoints in grid coordinates [col, row]. May start/end off-screen;
   * enemies leak when they reach the final waypoint.
   */
  waypoints: Array<[number, number]>;
  /** Grid cell the Base Vault occupies (drawn specially, not buildable). */
  vaultCell: [number, number];
}

/** A map with all derived geometry precomputed. */
export class GameMap {
  readonly waypointsPx: Array<[number, number]>;
  readonly pathCells: Set<string>;
  readonly pathLength: number;

  constructor(readonly def: MapDef) {
    this.waypointsPx = def.waypoints.map(([c, r]) => [(c + 0.5) * TILE, (r + 0.5) * TILE]);

    this.pathLength = this.waypointsPx.reduce((len, p, i) => {
      if (i === 0) return 0;
      const [px, py] = this.waypointsPx[i - 1];
      return len + Math.hypot(p[0] - px, p[1] - py);
    }, 0);

    // Walk each axis-aligned segment cell by cell to mark path tiles.
    const cells = new Set<string>();
    for (let i = 1; i < def.waypoints.length; i++) {
      let [c0, r0] = def.waypoints[i - 1];
      const [c1, r1] = def.waypoints[i];
      const dc = Math.sign(c1 - c0);
      const dr = Math.sign(r1 - r0);
      while (c0 !== c1 || r0 !== r1) {
        if (c0 >= 0 && c0 < GRID_COLS && r0 >= 0 && r0 < GRID_ROWS) cells.add(`${c0},${r0}`);
        c0 += dc;
        r0 += dr;
      }
      if (c1 >= 0 && c1 < GRID_COLS && r1 >= 0 && r1 < GRID_ROWS) cells.add(`${c1},${r1}`);
    }
    this.pathCells = cells;
  }

  /** True if a tower can be built on this cell (in bounds, off path, not vault). */
  isBuildable(col: number, row: number): boolean {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (this.pathCells.has(`${col},${row}`)) return false;
    const [vc, vr] = this.def.vaultCell;
    if (col === vc && row === vr) return false;
    return true;
  }
}

export const MAPS: Record<MapId, GameMap> = {
  vaultRun: new GameMap({
    id: 'vaultRun',
    name: 'Vault Run',
    description: 'The classic S-route to the Base Vault. Balanced corners.',
    waypoints: [
      [-1, 4],
      [3, 4],
      [3, 1],
      [7, 1],
      [7, 7],
      [11, 7],
      [11, 3],
      [16, 3],
    ],
    vaultCell: [15, 3],
  }),
  gauntlet: new GameMap({
    id: 'gauntlet',
    name: 'The Gauntlet',
    description: 'A long serpentine trench. Towers get many passes — so does the FUD.',
    waypoints: [
      [-1, 1],
      [14, 1],
      [14, 3],
      [1, 3],
      [1, 5],
      [14, 5],
      [14, 7],
      [16, 7],
    ],
    vaultCell: [15, 7],
  }),
  fudSpiral: new GameMap({
    id: 'fudSpiral',
    name: 'FUD Spiral',
    description: 'Enemies coil inward toward the Vault at the core. Hold the center.',
    waypoints: [
      [-1, 1],
      [13, 1],
      [13, 7],
      [2, 7],
      [2, 3],
      [10, 3],
      [10, 5],
      [5, 5],
    ],
    vaultCell: [5, 5],
  }),
};

export const MAP_ORDER: MapId[] = ['vaultRun', 'gauntlet', 'fudSpiral'];
