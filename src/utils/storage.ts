import type { DifficultyId } from '../types';

/**
 * LocalStorage wrapper for persisted data (high scores, sound preference).
 * All access goes through here so a backend can replace it later.
 */
const SCORES_KEY = 'niko-td:high-scores';
const SOUND_KEY = 'niko-td:sound';

export type HighScores = Partial<Record<DifficultyId, number>>;

export function loadHighScores(): HighScores {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    return raw ? (JSON.parse(raw) as HighScores) : {};
  } catch {
    return {};
  }
}

/** Saves a score if it beats the stored one. Returns true on a new record. */
export function submitHighScore(difficulty: DifficultyId, score: number): boolean {
  const scores = loadHighScores();
  if ((scores[difficulty] ?? 0) >= score) return false;
  scores[difficulty] = score;
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
