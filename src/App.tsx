import { useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { StartScreen } from './components/StartScreen';
import { useHighScores } from './hooks/useHighScores';
import { getWeeklyChallenge } from './data/weekly';
import type { DifficultyId, MapId, WeeklyChallenge } from './types';
import { scoreKey, weeklyScoreKey } from './utils/storage';

/** A configured run: classic campaign or the seeded Weekly Trench. */
type RunConfig =
  | { kind: 'campaign'; difficulty: DifficultyId; map: MapId }
  | { kind: 'weekly'; challenge: WeeklyChallenge };

/**
 * App shell: routes between the start screen and the game screen.
 * `runId` is used as a React key so "Defend Again" remounts a fresh engine.
 */
export default function App() {
  const [run, setRun] = useState<RunConfig | null>(null);
  const [runId, setRunId] = useState(0);
  const { scores, submit } = useHighScores();

  if (run === null) {
    return (
      <StartScreen
        highScores={scores}
        onStart={(difficulty, map) => {
          setRun({ kind: 'campaign', difficulty, map });
          setRunId((id) => id + 1);
        }}
        onStartWeekly={() => {
          setRun({ kind: 'weekly', challenge: getWeeklyChallenge() });
          setRunId((id) => id + 1);
        }}
      />
    );
  }

  const isWeekly = run.kind === 'weekly';
  return (
    <GameScreen
      key={runId}
      // Weekly Trench locks the map to the seed and plays on Guardian.
      difficulty={isWeekly ? 'guardian' : run.difficulty}
      mapId={isWeekly ? run.challenge.mapId : run.map}
      challenge={isWeekly ? run.challenge : undefined}
      scoreStorageKey={
        isWeekly
          ? weeklyScoreKey(run.challenge.weekKey)
          : scoreKey(run.map, run.difficulty)
      }
      onQuit={() => setRun(null)}
      onRetry={() => setRunId((id) => id + 1)}
      submitScore={submit}
    />
  );
}
