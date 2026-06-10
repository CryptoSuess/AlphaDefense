import type { DifficultyId, MapId } from '../types';

/**
 * LocalStorage wrapper for persisted data (high scores, sound preference).
 * All access goes through here so a backend can replace it later.
 */
const SCORES_KEY = 'niko-td:high-scores:v2';
const LEGACY_SCORES_KEY = 'niko-td:high-scores';
const SOUND_KEY = 'niko-td:sound';

/** Scores keyed by "mapId:difficulty". */
export type HighScores = Partial<Record<string, number>>;

export function scoreKey(map: MapId, difficulty: DifficultyId): string {
  return `${map}:${difficulty}`;
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
export function submitHighScore(
  map: MapId,
  difficulty: DifficultyId,
  score: number,
): boolean {
  const scores = loadHighScores();
  const key = scoreKey(map, difficulty);
  if ((scores[key] ?? 0) >= score) return false;
  scores[key] = score;
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
  return true;
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
