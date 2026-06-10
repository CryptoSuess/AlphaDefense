import { useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { StartScreen } from './components/StartScreen';
import { useHighScores } from './hooks/useHighScores';
import type { DifficultyId, MapId } from './types';

/**
 * App shell: routes between the start screen and the game screen.
 * `runId` is used as a React key so "Defend Again" remounts a fresh engine.
 */
export default function App() {
  const [run, setRun] = useState<{ difficulty: DifficultyId; map: MapId } | null>(null);
  const [runId, setRunId] = useState(0);
  const { scores, submit } = useHighScores();

  if (run === null) {
    return (
      <StartScreen
        highScores={scores}
        onStart={(difficulty, map) => {
          setRun({ difficulty, map });
          setRunId((id) => id + 1);
        }}
      />
    );
  }

  return (
    <GameScreen
      key={runId}
      difficulty={run.difficulty}
      mapId={run.map}
      onQuit={() => setRun(null)}
      onRetry={() => setRunId((id) => id + 1)}
      submitScore={submit}
    />
  );
}
