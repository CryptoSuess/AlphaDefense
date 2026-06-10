import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/Engine';
import type { DifficultyId, GameEvent, UiState } from '../types';
import { DIFFICULTIES } from '../data/difficulty';
import { TOTAL_WAVES } from '../data/waves';

/**
 * Bridges the imperative GameEngine to React.
 * Creates one engine per mount (remount with a new key to restart) and
 * exposes the latest UI snapshot plus the engine instance for commands.
 */
export function useGameEngine(
  difficulty: DifficultyId,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onEvent: (e: GameEvent) => void,
) {
  const engineRef = useRef<GameEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new GameEngine(difficulty);
  }
  const engine = engineRef.current;

  const diff = DIFFICULTIES[difficulty];
  const [ui, setUi] = useState<UiState>({
    status: 'playing',
    paws: diff.startingPaws,
    lives: diff.startingLives,
    maxLives: diff.startingLives,
    score: 0,
    wave: 0,
    totalWaves: TOTAL_WAVES,
    waveInProgress: false,
    nextWaveIsBoss: false,
    selectedTowerType: null,
    selectedTower: null,
    timeScale: 1,
    soundOn: engine.sound.on,
  });

  // Keep the latest onEvent without re-attaching the engine.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engine.attach(canvas, setUi, (e) => onEventRef.current(e));
    return () => engine.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { engine, ui };
}
