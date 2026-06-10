import { useState } from 'react';
import { COPY } from '../data/copy';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty';
import { GRID_COLS, GRID_ROWS, MAPS, MAP_ORDER } from '../data/map';
import type { DifficultyId, MapId } from '../types';
import { scoreKey, type HighScores } from '../utils/storage';
import { NikoLogo } from './NikoLogo';

interface Props {
  highScores: HighScores;
  onStart: (difficulty: DifficultyId, map: MapId) => void;
}

/** Title screen: logo, map + difficulty selection, how-to-play, high scores. */
export function StartScreen({ highScores, onStart }: Props) {
  const [difficulty, setDifficulty] = useState<DifficultyId>('guardian');
  const [mapId, setMapId] = useState<MapId>('vaultRun');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-niko-deep p-4 text-white">
      <div className="flex flex-col items-center gap-2 text-center">
        <NikoLogo size={96} />
        <h1 className="bg-gradient-to-r from-niko-glow to-white bg-clip-text font-display text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          {COPY.title}
        </h1>
        <p className="text-sm text-niko-ice sm:text-base">{COPY.subtitle}</p>
      </div>

      {/* Map selection */}
      <div className="w-full max-w-xl">
        <h2 className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-niko-glow">
          {COPY.mapHeading}
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MAP_ORDER.map((id) => {
            const m = MAPS[id];
            const active = mapId === id;
            const best = highScores[scoreKey(id, difficulty)];
            return (
              <button
                key={id}
                onClick={() => setMapId(id)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-niko-blue bg-niko-panel shadow-glow'
                    : 'border-niko-line bg-niko-navy hover:border-niko-electric'
                }`}
              >
                <MapPreview mapId={id} active={active} />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold">{m.def.name}</span>
                  {best !== undefined && (
                    <span className="text-xs text-yellow-300">★ {best}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">{m.def.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Difficulty selection */}
      <div className="w-full max-w-xl">
        <h2 className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-niko-glow">
          {COPY.difficultyHeading}
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {DIFFICULTY_ORDER.map((id) => {
            const d = DIFFICULTIES[id];
            const active = difficulty === id;
            return (
              <button
                key={id}
                onClick={() => setDifficulty(id)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-niko-blue bg-niko-panel shadow-glow'
                    : 'border-niko-line bg-niko-navy hover:border-niko-electric'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{d.name}</span>
                  {highScores[scoreKey(mapId, id)] !== undefined && (
                    <span className="text-xs text-yellow-300">
                      ★ {highScores[scoreKey(mapId, id)]}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">{d.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onStart(difficulty, mapId)}
        className="rounded-xl bg-niko-blue px-10 py-4 text-lg font-extrabold uppercase tracking-wide shadow-glow transition hover:bg-niko-electric active:scale-95"
      >
        {COPY.startButton}
      </button>

      {/* How to play */}
      <div className="w-full max-w-xl rounded-xl border border-niko-line bg-niko-navy/60 p-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-niko-glow">
          {COPY.howToPlayHeading}
        </h2>
        <ul className="space-y-1 text-sm text-slate-300">
          {COPY.howToPlay.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-niko-glow">🐾</span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-xs text-slate-500">
        Wallet connect, leaderboards, NFT skins &amp; weekly tournaments — coming soon.
      </p>
    </div>
  );
}

/** Tiny schematic of a map's path, drawn from its waypoints. */
function MapPreview({ mapId, active }: { mapId: MapId; active: boolean }) {
  const m = MAPS[mapId];
  const points = m.def.waypoints
    .map(([c, r]) => `${((c + 0.5) / GRID_COLS) * 96},${((r + 0.5) / GRID_ROWS) * 54}`)
    .join(' ');
  const [vc, vr] = m.def.vaultCell;
  return (
    <svg
      viewBox="0 0 96 54"
      className="h-auto w-full rounded-md"
      style={{ background: '#0a0f24' }}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={active ? '#60a5fa' : '#2c3f7c'}
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <rect
        x={((vc + 0.5) / GRID_COLS) * 96 - 4}
        y={((vr + 0.5) / GRID_ROWS) * 54 - 4}
        width="8"
        height="8"
        rx="2"
        fill="#2563ff"
      />
    </svg>
  );
}
