import { useCallback, useState } from 'react';
import type { DifficultyId } from '../types';
import { loadHighScores, submitHighScore, type HighScores } from '../utils/storage';

/** Read + submit local high scores (per difficulty). */
export function useHighScores() {
  const [scores, setScores] = useState<HighScores>(() => loadHighScores());

  const submit = useCallback((difficulty: DifficultyId, score: number): boolean => {
    const isRecord = submitHighScore(difficulty, score);
    setScores(loadHighScores());
    return isRecord;
  }, []);

  return { scores, submit };
}
