/**
 * Headless balance simulation for the content-expansion PR.
 *
 * Bundles the engine with esbuild and drives scripted runs in Node (no
 * canvas/audio — `attach()` is never called). Verifies:
 *   1. Campaign is clearable on all 4 maps (guardian) with a competent build.
 *   2. Whale armor punishes no-burn builds vs burn builds (waves 10+).
 *   3. Yield Dens net positive paws over a campaign.
 *   4. Rug Lord waves (10/20) are clearable with slows in the mix.
 *
 * Usage: node scripts/balance-sim.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'niko-sim-'));

const entry = join(tmp, 'entry.ts');
writeFileSync(
  entry,
  `export { GameEngine } from '${join(root, 'src/game/Engine.ts').replace(/\\/g, '/')}';
export { MAPS, MAP_ORDER, TILE, GRID_COLS, GRID_ROWS } from '${join(root, 'src/data/map.ts').replace(/\\/g, '/')}';
export { TOWERS } from '${join(root, 'src/data/towers.ts').replace(/\\/g, '/')}';
`,
);

const out = join(tmp, 'bundle.mjs');
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: out, platform: 'node' });

// Engine reads localStorage via storage.ts; keep sound off and stats empty.
globalThis.localStorage = {
  getItem: (k) => (k === 'niko-td:sound' ? 'off' : null),
  setItem: () => {},
  removeItem: () => {},
};

const { GameEngine, MAPS, MAP_ORDER, TILE, GRID_COLS, GRID_ROWS } = await import(
  pathToFileURL(out).href
);

const DT = 1 / 30;
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

/** Buildable cells ranked by path coverage within a 130px ring. */
function rankedCells(map) {
  const cells = [];
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (!map.isBuildable(c, r)) continue;
      const cx = (c + 0.5) * TILE;
      const cy = (r + 0.5) * TILE;
      let cover = 0;
      for (const key of map.pathCells) {
        const [pc, pr] = key.split(',').map(Number);
        if (dist(cx, cy, (pc + 0.5) * TILE, (pr + 0.5) * TILE) <= 130) cover++;
      }
      if (cover > 0) cells.push({ c, r, cover });
    }
  }
  return cells.sort((a, b) => b.cover - a.cover);
}

/**
 * Plays a full campaign with a scripted strategy.
 * buildOrder: tower type ids placed (in order) as paws allow; after the
 * order is exhausted, spare paws go to upgrades then more diamondPaws.
 */
function playCampaign(mapId, buildOrder, { dens = 0 } = {}) {
  const eng = new GameEngine('guardian', mapId);
  const map = MAPS[mapId];
  const spots = rankedCells(map);
  let spotIdx = 0;
  let orderIdx = 0;
  let densPlaced = 0;

  const nextSpot = () => {
    while (spotIdx < spots.length) {
      const s = spots[spotIdx];
      if (!eng.towers.some((t) => t.col === s.c && t.row === s.r)) return s;
      spotIdx++;
    }
    return null;
  };

  const spend = () => {
    let acted = true;
    while (acted) {
      acted = false;
      // 1. Follow the build order.
      if (orderIdx < buildOrder.length) {
        const type = buildOrder[orderIdx];
        const cost = eng.towers.length === 0 ? 0 : 0; // cost checked by placeTower
        const s = nextSpot();
        if (s && eng.placeTower(type, s.c, s.r)) {
          orderIdx++;
          acted = true;
          continue;
        }
      }
      // 2. Drop Yield Dens early (low-coverage corner cells are fine).
      if (densPlaced < dens && eng.wave >= 2) {
        const corner = spots[spots.length - 1 - densPlaced];
        if (corner && eng.placeTower('yieldDen', corner.c, corner.r)) {
          densPlaced++;
          acted = true;
          continue;
        }
      }
      // 3. Upgrade the most-invested attacking tower we can afford.
      for (const t of eng.towers) {
        if (t.stats.income !== undefined && t.level >= 2) continue;
        const before = eng.paws;
        eng.upgradeTower(t.id);
        if (eng.paws !== before) {
          acted = true;
          break;
        }
      }
      // 4. Extra diamondPaws with leftover paws.
      if (!acted && eng.paws >= 220) {
        const s = nextSpot();
        if (s && eng.placeTower('diamondPaw', s.c, s.r)) acted = true;
      }
    }
  };

  const leaksByWave = {};
  while (eng.status === 'playing') {
    spend();
    const leaksBefore = eng.stats.leaks;
    eng.startNextWave();
    let guard = 0;
    while (eng.waveInProgress && eng.status === 'playing' && guard++ < 30 * 600) {
      eng.update(DT);
    }
    leaksByWave[eng.wave] = eng.stats.leaks - leaksBefore;
    if (eng.wave >= 25 || guard >= 30 * 600) break;
  }
  return { eng, leaksByWave };
}

console.log('=== 1. Campaign clearable on all maps (guardian, full kit + slows) ===');
const KIT = ['diamondPaw', 'packScout', 'diamondPaw', 'blueFlame', 'howlCannon',
  'packScout', 'blueFlame', 'howlCannon', 'diamondPaw', 'guardianNiko', 'diamondPaw'];
for (const mapId of MAP_ORDER) {
  const { eng } = playCampaign(mapId, KIT);
  console.log(
    `  ${mapId.padEnd(12)} -> ${eng.status.padEnd(8)} wave ${eng.wave}, lives ${eng.lives}/${eng.maxLives}, score ${eng.score}`,
  );
}

console.log('\n=== 2. Whale counterplay: no-burn vs burn build (vaultRun) ===');
const NO_BURN = ['diamondPaw', 'packScout', 'diamondPaw', 'packScout', 'diamondPaw',
  'diamondPaw', 'packScout', 'diamondPaw', 'diamondPaw', 'diamondPaw'];
const WITH_BURN = ['diamondPaw', 'packScout', 'blueFlame', 'blueFlame', 'diamondPaw',
  'blueFlame', 'packScout', 'diamondPaw', 'blueFlame', 'diamondPaw'];
for (const [label, order] of [['no burn ', NO_BURN], ['with burn', WITH_BURN]]) {
  const { eng, leaksByWave } = playCampaign('vaultRun', order);
  const whaleLeaks = Object.entries(leaksByWave)
    .filter(([w]) => Number(w) >= 10)
    .reduce((s, [, n]) => s + n, 0);
  console.log(
    `  ${label} -> ${eng.status.padEnd(8)} wave ${eng.wave}, leaks from wave 10+: ${whaleLeaks}, lives ${eng.lives}`,
  );
}

console.log('\n=== 3. Yield Den ROI (vaultRun, same kit ± 2 dens) ===');
for (const dens of [0, 2]) {
  const { eng } = playCampaign('vaultRun', KIT, { dens });
  console.log(
    `  dens=${dens} -> ${eng.status.padEnd(8)} wave ${eng.wave}, paws earned ${eng.stats.pawsEarned}, final paws ${eng.paws}, lives ${eng.lives}`,
  );
}

console.log('\n=== 4. Rug Lord waves (10/20) leak check from run #1 ===');
const { eng: e4, leaksByWave: l4 } = playCampaign('doubleCross', KIT);
console.log(
  `  doubleCross -> ${e4.status}, wave 10 leaks: ${l4[10] ?? '-'}, wave 20 leaks: ${l4[20] ?? '-'}, bosses slain: ${e4.stats.bossesSlain}`,
);

rmSync(tmp, { recursive: true, force: true });
