import { useCallback, useState } from 'react';
import { loadHighScores, submitHighScore, type HighScores } from '../utils/storage';

/**
 * Read + submit local high scores. Keys are "mapId:difficulty" for campaign
 * runs and "weekly:<weekKey>" for Weekly Trench runs (see utils/storage.ts).
 */
export function useHighScores() {
  const [scores, setScores] = useState<HighScores>(() => loadHighScores());

  const submit = useCallback((key: string, score: number): boolean => {
    const isRecord = submitHighScore(key, score);
    setScores(loadHighScores());
    return isRecord;
  }, []);

  return { scores, submit };
}
