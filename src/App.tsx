import { useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { StartScreen } from './components/StartScreen';
import { useHighScores } from './hooks/useHighScores';
import type { DifficultyId } from './types';

/**
 * App shell: routes between the start screen and the game screen.
 * `runId` is used as a React key so "Defend Again" remounts a fresh engine.
 */
export default function App() {
  const [difficulty, setDifficulty] = useState<DifficultyId | null>(null);
  const [runId, setRunId] = useState(0);
  const { scores, submit } = useHighScores();

  if (difficulty === null) {
    return (
      <StartScreen
        highScores={scores}
        onStart={(d) => {
          setDifficulty(d);
          setRunId((id) => id + 1);
        }}
      />
    );
  }

  return (
    <GameScreen
      key={runId}
      difficulty={difficulty}
      onQuit={() => setDifficulty(null)}
      onRetry={() => setRunId((id) => id + 1)}
      submitScore={submit}
    />
  );
}
