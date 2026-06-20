import type { DifficultyId, EnemyTypeId, MapId } from '../types';

/**
 * LocalStorage wrapper for persisted data (high scores, lifetime stats,
 * achievements, sound preference). All access goes through here so a backend
 * can replace it later.
 */
const SCORES_KEY = 'niko-td:high-scores:v2';
const LEGACY_SCORES_KEY = 'niko-td:high-scores';
const SOUND_KEY = 'niko-td:sound';
const LIFETIME_KEY = 'niko-td:lifetime';
const ACHIEVEMENTS_KEY = 'niko-td:achievements';

/** Scores keyed by "mapId:difficulty" or "weekly:<weekKey>". */
export type HighScores = Partial<Record<string, number>>;

export function scoreKey(map: MapId, difficulty: DifficultyId): string {
  return `${map}:${difficulty}`;
}

export function weeklyScoreKey(weekKey: string): string {
  return `weekly:${weekKey}`;
}

export function loadHighScores(): HighScores {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (raw) return JSON.parse(raw) as HighScores;
    // One-time migration: v1 scores were keyed by difficulty only and all
    // belonged to the original Vault Run map.
    const legacy = localStorage.getItem(LEGACY_SCORES_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<Record<DifficultyId, number>>;
      const migrated: HighScores = {};
      for (const [diff, score] of Object.entries(old)) {
        migrated[scoreKey('vaultRun', diff as DifficultyId)] = score;
      }
      localStorage.setItem(SCORES_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return {};
  } catch {
    return {};
  }
}

/** Saves a score if it beats the stored one. Returns true on a new record. */
export function submitHighScore(key: string, score: number): boolean {
  const scores = loadHighScores();
  if ((scores[key] ?? 0) >= score) return false;
  scores[key] = score;
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
  return true;
}

// ---------------------------------------------------------------------------
// Lifetime stats & achievements
// ---------------------------------------------------------------------------

/** Counters that accumulate across every run on this device. */
export interface LifetimeStats {
  kills: Partial<Record<EnemyTypeId, number>>;
  totalKills: number;
  bossesSlain: number;
  victories: Partial<Record<DifficultyId, number>>;
  runs: number;
  bestWave: number;
}

export function loadLifetimeStats(): LifetimeStats {
  try {
    const raw = localStorage.getItem(LIFETIME_KEY);
    if (raw) return JSON.parse(raw) as LifetimeStats;
  } catch {
    /* fall through */
  }
  return { kills: {}, totalKills: 0, bossesSlain: 0, victories: {}, runs: 0, bestWave: 0 };
}

export function saveLifetimeStats(stats: LifetimeStats): void {
  try {
    localStorage.setItem(LIFETIME_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

export function loadUnlockedAchievements(): Set<string> {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveUnlockedAchievements(ids: Set<string>): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

/**
 * Persistent anonymous player name for leaderboard submissions
 * (e.g. "Wolf-4821"); a connected wallet address takes precedence.
 */
const PLAYER_KEY = 'niko-td:player-name';

export function getPlayerName(): string {
  try {
    const existing = localStorage.getItem(PLAYER_KEY);
    if (existing) return existing;
    const name = `Wolf-${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(PLAYER_KEY, name);
    return name;
  } catch {
    return 'Wolf-0000';
  }
}

export function loadSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Gameplay settings (volumes, accessibility)
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'niko-td:settings';
const TUTORIAL_KEY = 'niko-td:tutorial-seen';

/** Player-adjustable settings. Volumes are 0–1 user scale. */
export interface GameSettings {
  /** Overall SFX/master loudness (0 = silent, 1 = full). */
  masterVolume: number;
  /** Ambient music loudness relative to master (0–1). */
  musicVolume: number;
  /** Whether the canvas shakes on heavy hits (off for motion sensitivity). */
  screenShake: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.5,
  musicVolume: 0.5,
  screenShake: true,
};

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return {
        masterVolume: clamp01(parsed.masterVolume ?? DEFAULT_SETTINGS.masterVolume),
        musicVolume: clamp01(parsed.musicVolume ?? DEFAULT_SETTINGS.musicVolume),
        screenShake: parsed.screenShake ?? DEFAULT_SETTINGS.screenShake,
      };
    }
  } catch {
    /* fall through */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/** True once the player has dismissed the first-run tutorial. */
export function loadTutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return true; // storage unavailable — don't nag every load
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    /* ignore */
  }
}
