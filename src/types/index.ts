/**
 * Shared type definitions for NIKO: Guardian of Base.
 * Everything the game engine, data tables and UI components agree on lives here.
 */

/** Identifier for each placeable tower type. */
export type TowerTypeId =
  | 'diamondPaw'
  | 'howlCannon'
  | 'blueFlame'
  | 'packScout'
  | 'guardianNiko';

/** Identifier for each enemy type. */
export type EnemyTypeId = 'jeet' | 'rugger' | 'bot' | 'sniper' | 'shiller' | 'fudBeast';

/** Difficulty presets selectable on the start screen. */
export type DifficultyId = 'pup' | 'guardian' | 'alpha';

/** Battlefield maps selectable on the start screen. */
export type MapId = 'vaultRun' | 'gauntlet' | 'fudSpiral';

/** High level game status driven by the engine. */
export type GameStatus = 'playing' | 'paused' | 'gameover' | 'victory';

/** How a tower picks its target among enemies in range. */
export type TargetingMode = 'first' | 'strong' | 'close';

/** Stats for a single tower level. Optional fields only apply to some towers. */
export interface TowerLevelStats {
  /** Damage per projectile hit. */
  damage: number;
  /** Attack radius in canvas pixels. */
  range: number;
  /** Shots per second. */
  fireRate: number;
  /** Projectile travel speed (px/s). */
  projectileSpeed: number;
  /** Splash radius (Howl Cannon). 0 = single target. */
  splashRadius?: number;
  /** Burn damage per second applied on hit (Blue Flame). */
  burnDps?: number;
  /** Burn duration in seconds (Blue Flame). */
  burnDuration?: number;
  /** Fraction of speed an enemy keeps while slowed (Pack Scout). 0.5 = half speed. */
  slowFactor?: number;
  /** Slow duration in seconds (Pack Scout). */
  slowDuration?: number;
  /** Cost to reach this level (level 0 = build cost). */
  cost: number;
}

/** A final-tier specialization a tower can upgrade into (pick one of two). */
export interface TowerBranch {
  id: string;
  name: string;
  tagline: string;
  /** Stats while specialized; `cost` is the price of choosing this branch. */
  stats: TowerLevelStats;
}

/** Static definition of a tower type. */
export interface TowerDef {
  id: TowerTypeId;
  name: string;
  tagline: string;
  /** Brand accent color used by the placeholder renderer. */
  color: string;
  /** Per-level stats; index 0 is the freshly built tower. */
  levels: TowerLevelStats[];
  /** Optional pair of mutually exclusive final upgrades after the last level. */
  branches?: [TowerBranch, TowerBranch];
  /** Sprite registry key, so real art can be swapped in later. */
  spriteKey: string;
}

/** Static definition of an enemy type. */
export interface EnemyDef {
  id: EnemyTypeId;
  name: string;
  /** Base HP before wave/difficulty scaling. */
  hp: number;
  /** Movement speed in px/s. */
  speed: number;
  /** Paws awarded on kill. */
  reward: number;
  /** Score awarded on kill. */
  score: number;
  /** Player lives lost if it reaches the Base Vault. */
  livesCost: number;
  /** Body radius in px (collision + drawing). */
  radius: number;
  /** Chance (0..1) to dodge a direct projectile hit. */
  evasion: number;
  /** Whether this enemy is a boss (FUD Beast). */
  boss: boolean;
  /** Heals nearby allies for this many HP/s (Shiller). Scales with wave. */
  healDps?: number;
  /** Heal aura radius in px (Shiller). */
  healRadius?: number;
  /** Enemies spawned at this unit's position when it dies (FUD Beast). */
  deathSpawn?: { type: EnemyTypeId; count: number };
  color: string;
  spriteKey: string;
}

/** One scheduled enemy spawn within a wave. */
export interface SpawnEntry {
  type: EnemyTypeId;
  /** Seconds after wave start at which this enemy spawns. */
  time: number;
}

/** Difficulty preset values. */
export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  description: string;
  /** Multiplier applied to enemy HP. */
  hpMult: number;
  /** Multiplier applied to paw rewards. */
  rewardMult: number;
  startingPaws: number;
  startingLives: number;
}

/** Snapshot of a placed tower, exposed to the React UI. */
export interface TowerSnapshot {
  id: number;
  type: TowerTypeId;
  level: number;
  maxLevel: number;
  /** Cost of next upgrade, or null if maxed or awaiting a branch choice. */
  upgradeCost: number | null;
  /** Final-tier branch options, present once the last level is reached. */
  branchOptions: Array<{ index: 0 | 1; name: string; tagline: string; cost: number }> | null;
  /** Name of the chosen branch, if specialized. */
  branchName: string | null;
  targeting: TargetingMode;
  /** Paws refunded when sold. */
  sellValue: number;
  col: number;
  row: number;
}

/** Engine -> UI state snapshot, published on a short interval. */
export interface UiState {
  status: GameStatus;
  paws: number;
  lives: number;
  maxLives: number;
  score: number;
  /** Last wave that was started (0 = none yet). */
  wave: number;
  totalWaves: number;
  waveInProgress: boolean;
  /** Whether the upcoming wave is a FUD Beast boss wave. */
  nextWaveIsBoss: boolean;
  /** True once the player chose to keep going after the wave-25 victory. */
  endless: boolean;
  selectedTowerType: TowerTypeId | null;
  selectedTower: TowerSnapshot | null;
  timeScale: number;
  soundOn: boolean;
}

/** Events the engine pushes to the UI (toasts, sounds, end states). */
export type GameEvent =
  | { kind: 'toast'; text: string; tone: 'info' | 'danger' | 'success' }
  | {
      kind: 'ended';
      status: 'gameover' | 'victory';
      score: number;
      wave: number;
      stats: RunStats;
    };

/** Counters accumulated over a single run, shown on the end screen. */
export interface RunStats {
  kills: Partial<Record<EnemyTypeId, number>>;
  totalKills: number;
  bossesSlain: number;
  damageByTower: Partial<Record<TowerTypeId, number>>;
  towersBuilt: number;
  upgradesBought: number;
  branchesBought: number;
  pawsEarned: number;
  leaks: number;
  /** Run length in game-time seconds. */
  duration: number;
}

/** An unlockable achievement (definitions in src/data/achievements.ts). */
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** A wave-composition modifier applied by the weekly challenge. */
export interface WeeklyModifier {
  id: string;
  label: string;
  hpMult?: number;
  speedMult?: number;
  countMult?: number;
  rewardMult?: number;
}

/**
 * The seeded weekly tournament. Derived deterministically from the ISO week,
 * so every player worldwide faces identical waves — no backend required.
 */
export interface WeeklyChallenge {
  /** e.g. "2026-W24" */
  weekKey: string;
  seed: number;
  mapId: MapId;
  modifiers: WeeklyModifier[];
}
