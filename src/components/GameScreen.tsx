import { useCallback, useEffect, useRef, useState } from 'react';
import { CANVAS_H, CANVAS_W, TILE } from '../data/map';
import type { DifficultyId, GameEvent, MapId, RunStats, TowerTypeId, WeeklyChallenge } from '../types';
import { globalLeaderboardEnabled, leaderboard } from '../utils/integrations';
import { getPlayerName, loadTutorialSeen, markTutorialSeen } from '../utils/storage';
import { getAddress, shortAddress } from '../utils/wallet';
import { useGameEngine } from '../hooks/useGameEngine';
import { EndScreen } from './EndScreen';
import { Hud } from './Hud';
import { Settings } from './Settings';
import { TowerBar } from './TowerBar';
import { TowerPanel } from './TowerPanel';
import { Toasts, type ToastItem } from './Toasts';
import { Tutorial } from './Tutorial';
import { WaveIntel } from './WaveIntel';

interface Props {
  difficulty: DifficultyId;
  mapId: MapId;
  /** Present when playing the Weekly Trench. */
  challenge?: WeeklyChallenge;
  /** Storage key the final score is recorded under. */
  scoreStorageKey: string;
  onQuit: () => void;
  onRetry: () => void;
  /** Returns true if this run set a new personal best. */
  submitScore: (key: string, score: number) => boolean;
}

let toastId = 0;

/**
 * The in-game screen: canvas battlefield plus HUD, build bar and overlays.
 * Pointer events are translated from CSS pixels to logical canvas
 * coordinates so the same code path serves mouse and touch.
 */
export function GameScreen({
  difficulty,
  mapId,
  challenge,
  scoreStorageKey,
  onQuit,
  onRetry,
  submitScore,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => !loadTutorialSeen());
  const [ended, setEnded] = useState<{
    status: 'gameover' | 'victory';
    score: number;
    wave: number;
    isRecord: boolean;
    stats: RunStats;
  } | null>(null);

  const handleEvent = useCallback(
    (e: GameEvent) => {
      if (e.kind === 'toast') {
        const item: ToastItem = { id: ++toastId, text: e.text, tone: e.tone };
        setToasts((ts) => [...ts.slice(-2), item]);
        setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== item.id)), 2600);
      } else if (e.kind === 'ended') {
        const isRecord = submitScore(scoreStorageKey, e.score);
        // Fire-and-forget global submission when the API is configured.
        if (globalLeaderboardEnabled) {
          const address = getAddress() ?? undefined;
          void leaderboard.submit({
            key: scoreStorageKey,
            player: address ? shortAddress(address) : getPlayerName(),
            score: e.score,
            wave: e.wave,
            address,
          });
        }
        setEnded({ status: e.status, score: e.score, wave: e.wave, isRecord, stats: e.stats });
      }
    },
    [scoreStorageKey, submitScore],
  );

  const { engine, ui } = useGameEngine(difficulty, mapId, canvasRef, handleEvent, challenge);

  /** Converts a pointer event into logical canvas coordinates. */
  const toLogical = (ev: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = ev.currentTarget.getBoundingClientRect();
    return [
      ((ev.clientX - rect.left) / rect.width) * CANVAS_W,
      ((ev.clientY - rect.top) / rect.height) * CANVAS_H,
    ];
  };

  /** Logical canvas coords from client coords, or null when off-canvas. */
  const clientToLogical = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }
    return [
      ((clientX - rect.left) / rect.width) * CANVAS_W,
      ((clientY - rect.top) / rect.height) * CANVAS_H,
    ];
  }, []);

  /**
   * Drag-to-place: press a build-bar card and drag onto the battlefield.
   * A press-and-release on the card itself (no real movement) falls back to
   * the classic tap-to-select toggle.
   */
  const handleCardDragStart = useCallback(
    (type: TowerTypeId, ev: React.PointerEvent) => {
      const startX = ev.clientX;
      const startY = ev.clientY;
      const wasSelected = engine.selectedTowerType === type;
      let moved = false;
      engine.beginPlacement(type);

      const onMove = (me: PointerEvent) => {
        if (Math.hypot(me.clientX - startX, me.clientY - startY) > 8) moved = true;
        const pos = clientToLogical(me.clientX, me.clientY);
        if (pos) engine.pointerMove(pos[0], pos[1]);
        else engine.pointerLeave();
      };
      const onUp = (ue: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        const pos = clientToLogical(ue.clientX, ue.clientY);
        if (moved && pos) {
          // Dropped on the battlefield: place and exit build mode.
          engine.pointerMove(pos[0], pos[1]);
          engine.placeTower(type, Math.floor(pos[0] / TILE), Math.floor(pos[1] / TILE));
          engine.clearSelection();
          engine.pointerLeave();
        } else if (!moved && wasSelected) {
          // Tap on an already-selected card: toggle off.
          engine.clearSelection();
        }
        // Otherwise: plain tap selected the card; tap a tile next (or drag again).
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    },
    [engine, clientToLogical],
  );

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
          onAutoWave={() => engine.toggleAutoWave()}
          onSettings={() => setShowSettings(true)}
          onHelp={() => setShowTutorial(true)}
          onQuit={onQuit}
        />
      </div>

      {challenge && (
        <div className="w-full max-w-5xl rounded-lg border border-niko-blue/40 bg-niko-panel/60 px-3 py-1 text-center text-xs text-niko-ice">
          ⚔ Weekly Trench {challenge.weekKey} —{' '}
          {challenge.modifiers.map((m) => m.label).join(' · ')}
        </div>
      )}

      <div className="relative w-full max-w-5xl">
        <Toasts toasts={toasts} />
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full touch-none select-none rounded-xl border border-niko-line shadow-[0_0_40px_rgba(37,99,235,0.25)]"
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
            stats={ended.stats}
            weekly={challenge?.weekKey}
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
        {showTutorial && (
          <Tutorial
            onClose={() => {
              markTutorialSeen();
              setShowTutorial(false);
            }}
          />
        )}
        {showSettings && (
          <Settings
            onMasterVolume={(v) => engine.sound.setMasterVolume(v)}
            onMusicVolume={(v) => engine.sound.setMusicVolume(v)}
            onScreenShake={(on) => engine.setScreenShake(on)}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>

      <WaveIntel
        preview={ui.nextWavePreview}
        autoWaveCountdown={ui.autoWaveCountdown}
        waveNumber={ui.wave + 1}
      />

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
          <TowerBar
            ui={ui}
            onSelect={(t) => engine.selectTowerType(t)}
            onDragStart={handleCardDragStart}
          />
        )}
      </div>
    </div>
  );
}
