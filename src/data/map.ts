/**
 * The battlefield grid and the path enemies follow.
 *
 * Logical canvas size is GRID_COLS * TILE x GRID_ROWS * TILE (960x540) and is
 * scaled to fit the screen with CSS, which keeps the game mobile friendly.
 */
export const TILE = 60;
export const GRID_COLS = 16;
export const GRID_ROWS = 9;
export const CANVAS_W = GRID_COLS * TILE; // 960
export const CANVAS_H = GRID_ROWS * TILE; // 540

/**
 * Path waypoints in grid coordinates [col, row].
 * Starts off-screen left and ends off-screen right; the Base Vault sits on
 * the last on-screen tile (15, 3).
 */
export const WAYPOINTS: Array<[number, number]> = [
  [-1, 4],
  [3, 4],
  [3, 1],
  [7, 1],
  [7, 7],
  [11, 7],
  [11, 3],
  [16, 3],
];

/** Grid cell occupied by the Base Vault (drawn specially, not buildable). */
export const VAULT_CELL: [number, number] = [15, 3];

/** Waypoint centers in pixel coordinates. */
export const WAYPOINTS_PX: Array<[number, number]> = WAYPOINTS.map(([c, r]) => [
  (c + 0.5) * TILE,
  (r + 0.5) * TILE,
]);

/** Total path length in pixels (used for progress-based targeting). */
export const PATH_LENGTH = WAYPOINTS_PX.reduce((len, p, i) => {
  if (i === 0) return 0;
  const [px, py] = WAYPOINTS_PX[i - 1];
  return len + Math.hypot(p[0] - px, p[1] - py);
}, 0);

/** Set of "c,r" keys for every on-screen cell the path crosses. */
export const PATH_CELLS: Set<string> = (() => {
  const cells = new Set<string>();
  for (let i = 1; i < WAYPOINTS.length; i++) {
    let [c0, r0] = WAYPOINTS[i - 1];
    const [c1, r1] = WAYPOINTS[i];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    // Walk the segment one cell at a time (segments are axis-aligned).
    while (c0 !== c1 || r0 !== r1) {
      if (c0 >= 0 && c0 < GRID_COLS && r0 >= 0 && r0 < GRID_ROWS) {
        cells.add(`${c0},${r0}`);
      }
      c0 += dc;
      r0 += dr;
    }
    if (c1 >= 0 && c1 < GRID_COLS && r1 >= 0 && r1 < GRID_ROWS) {
      cells.add(`${c1},${r1}`);
    }
  }
  return cells;
})();

/** True if a tower can be built on this cell (in bounds, off path, not vault). */
export function isBuildableCell(col: number, row: number): boolean {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
  if (PATH_CELLS.has(`${col},${row}`)) return false;
  if (col === VAULT_CELL[0] && row === VAULT_CELL[1]) return false;
  return true;
}
