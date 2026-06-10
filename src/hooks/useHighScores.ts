import { useCallback, useState } from 'react';
import type { DifficultyId, MapId } from '../types';
import { loadHighScores, submitHighScore, type HighScores } from '../utils/storage';

/** Read + submit local high scores (per map + difficulty). */
export function useHighScores() {
  const [scores, setScores] = useState<HighScores>(() => loadHighScores());

  const submit = useCallback(
    (map: MapId, difficulty: DifficultyId, score: number): boolean => {
      const isRecord = submitHighScore(map, difficulty, score);
      setScores(loadHighScores());
      return isRecord;
    },
    [],
  );

  return { scores, submit };
}
