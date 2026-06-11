import { useCallback, useEffect, useRef, useState } from 'react';
import { CANVAS_H, CANVAS_W } from '../data/map';
import type { DifficultyId, GameEvent, MapId } from '../types';
import { useGameEngine } from '../hooks/useGameEngine';
import { EndScreen } from './EndScreen';
import { Hud } from './Hud';
import { TowerBar } from './TowerBar';
import { TowerPanel } from './TowerPanel';
import { Toasts, type ToastItem } from './Toasts';

interface Props {
  difficulty: DifficultyId;
  mapId: MapId;
  onQuit: () => void;
  onRetry: () => void;
  /** Returns true if this run set a new personal best. */
  submitScore: (map: MapId, difficulty: DifficultyId, score: number) => boolean;
}

let toastId = 0;

/**
 * The in-game screen: canvas battlefield plus HUD, build bar and overlays.
 * Pointer events are translated from CSS pixels to logical canvas
 * coordinates so the same code path serves mouse and touch.
 */
export function GameScreen({ difficulty, mapId, onQuit, onRetry, submitScore }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [ended, setEnded] = useState<{
    status: 'gameover' | 'victory';
    score: number;
    wave: number;
    isRecord: boolean;
  } | null>(null);

  const handleEvent = useCallback(
    (e: GameEvent) => {
      if (e.kind === 'toast') {
        const item: ToastItem = { id: ++toastId, text: e.text, tone: e.tone };
        setToasts((ts) => [...ts.slice(-2), item]);
        setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== item.id)), 2600);
      } else if (e.kind === 'ended') {
        const isRecord = submitScore(mapId, difficulty, e.score);
        setEnded({ status: e.status, score: e.score, wave: e.wave, isRecord });
      }
    },
    [difficulty, mapId, submitScore],
  );

  const { engine, ui } = useGameEngine(difficulty, mapId, canvasRef, handleEvent);

  /** Converts a pointer event into logical canvas coordinates. */
  const toLogical = (ev: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = ev.currentTarget.getBoundingClientRect();
    return [
      ((ev.clientX - rect.left) / rect.width) * CANVAS_W,
      ((ev.clientY - rect.top) / rect.height) * CANVAS_H,
    ];
  };

  // Keyboard shortcuts (desktop nicety): space = pause, enter = next wave.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') {
        ev.preventDefault();
        engine.togglePause();
      } else if (ev.code === 'Enter') {
        engine.startNextWave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  return (
    <div className="flex min-h-dvh flex-col items-center gap-2 bg-niko-deep p-2 text-white sm:p-4">
      <div className="w-full max-w-5xl">
        <Hud
          ui={ui}
          onPause={() => engine.togglePause()}
          onSpeed={() => engine.toggleSpeed()}
          onSound={() => engine.toggleSound()}
          onStartWave={() => engine.startNextWave()}
          onQuit={onQuit}
        />
      </div>

      <div className="relative w-full max-w-5xl">
        <Toasts toasts={toasts} />
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full touch-none select-none rounded-xl border border-niko-line"
          onPointerDown={(ev) => {
            const [x, y] = toLogical(ev);
            // Track the cell on touch too so the placement preview is visible.
            engine.pointerMove(x, y);
            engine.pointerDown(x, y);
          }}
          onPointerMove={(ev) => {
            const [x, y] = toLogical(ev);
            engine.pointerMove(x, y);
          }}
          onPointerLeave={() => engine.pointerLeave()}
        />
        {ended && (
          <EndScreen
            status={ended.status}
            score={ended.score}
            wave={ended.wave}
            difficulty={difficulty}
            isRecord={ended.isRecord}
            onRetry={onRetry}
            onMenu={onQuit}
            onContinueEndless={
              ended.status === 'victory'
                ? () => {
                    engine.continueEndless();
                    setEnded(null);
                  }
                : undefined
            }
          />
        )}
      </div>

      <div className="w-full max-w-5xl">
        {ui.selectedTower ? (
          <TowerPanel
            tower={ui.selectedTower}
            paws={ui.paws}
            onUpgrade={(id) => engine.upgradeTower(id)}
            onBranch={(id, index) => engine.chooseBranch(id, index)}
            onCycleTargeting={(id) => engine.cycleTargeting(id)}
            onSell={(id) => engine.sellTower(id)}
            onClose={() => engine.clearSelection()}
          />
        ) : (
          <TowerBar ui={ui} onSelect={(t) => engine.selectTowerType(t)} />
        )}
      </div>
    </div>
  );
}
