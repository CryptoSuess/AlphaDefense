import { useEffect, useState } from 'react';
import { ACHIEVEMENTS } from '../data/achievements';
import { COPY } from '../data/copy';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty';
import { FEATURES } from '../data/features';
import { GRID_COLS, GRID_ROWS, MAPS, MAP_ORDER } from '../data/map';
import { getWeeklyChallenge } from '../data/weekly';
import type { DifficultyId, MapId } from '../types';
import {
  loadUnlockedAchievements,
  scoreKey,
  weeklyScoreKey,
  type HighScores,
} from '../utils/storage';
import { globalLeaderboardEnabled, leaderboard } from '../utils/integrations';
import { shortAddress } from '../utils/wallet';
import { useWallet } from '../hooks/useWallet';
import { NikoLogo } from './NikoLogo';

interface Props {
  highScores: HighScores;
  onStart: (difficulty: DifficultyId, map: MapId) => void;
  onStartWeekly: () => void;
}

/** Title screen: logo, map + difficulty selection, weekly trench, records. */
export function StartScreen({ highScores, onStart, onStartWeekly }: Props) {
  const [difficulty, setDifficulty] = useState<DifficultyId>('guardian');
  const [mapId, setMapId] = useState<MapId>('vaultRun');
  const weekly = getWeeklyChallenge();
  const weeklyBest = highScores[weeklyScoreKey(weekly.weekKey)];

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-niko-deep p-4 text-white">
      {/* Ambient aurora blobs */}
      <div
        aria-hidden
        className="animate-aurora pointer-events-none absolute left-1/4 top-1/4 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-niko-blue/10 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-aurora pointer-events-none absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-niko-flame/8 blur-3xl"
        style={{ animationDelay: '4s' }}
      />

      <div className="animate-fade-up relative flex flex-col items-center gap-2 text-center">
        <NikoLogo size={96} />
        <h1 className="bg-gradient-to-r from-niko-glow to-white bg-clip-text font-display text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          {COPY.title}
        </h1>
        <p className="text-sm text-niko-ice sm:text-base">{COPY.subtitle}</p>
        {FEATURES.wallet && <WalletButton />}
      </div>

      {/* Map selection */}
      <div className="animate-fade-up relative w-full max-w-xl" style={{ animationDelay: '0.1s' }}>
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
      <div className="animate-fade-up relative w-full max-w-xl" style={{ animationDelay: '0.2s' }}>
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
        className="animate-fade-up relative rounded-xl bg-niko-blue px-10 py-4 text-lg font-extrabold uppercase tracking-wide shadow-glow transition hover:bg-niko-electric active:scale-95"
        style={{ animationDelay: '0.3s' }}
      >
        {COPY.startButton}
      </button>

      {/* Weekly Trench: identical seeded waves for every player this week. */}
      <div className="animate-fade-up relative w-full max-w-xl rounded-xl border border-niko-blue/50 bg-niko-panel/80 p-4" style={{ animationDelay: '0.4s' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-niko-glow">
              ⚔ Weekly Trench — {weekly.weekKey}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {MAPS[weekly.mapId].def.name} ·{' '}
              {weekly.modifiers.map((m) => m.label).join(' · ')}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Same seeded waves for every player this week.
              {weeklyBest !== undefined && (
                <span className="ml-1 text-yellow-300">Your best: ★ {weeklyBest}</span>
              )}
            </p>
          </div>
          <button
            onClick={onStartWeekly}
            className="rounded-xl bg-gradient-to-r from-niko-blue to-niko-flame px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide hover:brightness-110 active:scale-95"
          >
            Enter
          </button>
        </div>
      </div>

      {globalLeaderboardEnabled && <GlobalTopPanel boardKey={weeklyScoreKey(weekly.weekKey)} />}

      <AchievementsPanel />

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

      {FEATURES.leaderboard && <PackRecords highScores={highScores} />}

      <p className="text-center text-xs text-slate-500">
        Global leaderboards, NFT skins &amp; weekly tournaments — coming soon.
      </p>
    </div>
  );
}

/** Global top-10 for a board (only rendered when the API is configured). */
function GlobalTopPanel({ boardKey }: { boardKey: string }) {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof leaderboard.top>> | null>(null);

  useEffect(() => {
    let alive = true;
    leaderboard.top(boardKey, 10).then((e) => {
      if (alive) setEntries(e);
    });
    return () => {
      alive = false;
    };
  }, [boardKey]);

  return (
    <div className="w-full max-w-xl rounded-xl border border-niko-line bg-niko-navy/60 p-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-niko-glow">
        🌍 Global Weekly Top 10
      </h2>
      {entries === null ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-slate-500">No scores yet this week — be the first Wolf in.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {entries.map((e, i) => (
              <tr key={`${e.player}-${i}`} className="border-t border-niko-line/50 first:border-t-0">
                <td className="py-1 pr-2 text-slate-500">{i + 1}.</td>
                <td className="py-1">{e.player}</td>
                <td className="py-1 text-slate-400">w{e.wave}</td>
                <td className="py-1 text-right font-bold tabular-nums text-yellow-300">{e.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Grid of all achievements; locked ones render dimmed. */
function AchievementsPanel() {
  const unlocked = loadUnlockedAchievements();
  return (
    <div className="w-full max-w-xl rounded-xl border border-niko-line bg-niko-navy/60 p-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-niko-glow">
        Achievements ({unlocked.size}/{ACHIEVEMENTS.length})
      </h2>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.has(a.id);
          return (
            <div
              key={a.id}
              title={a.description}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                got ? 'bg-niko-panel text-niko-ice' : 'bg-niko-navy/60 text-slate-600'
              }`}
            >
              <span className={got ? '' : 'grayscale opacity-50'} aria-hidden>
                {a.icon}
              </span>
              <span className="font-bold">{a.name}</span>
              <span className="ml-auto hidden truncate text-[10px] text-slate-500 sm:inline">
                {a.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Connect/disconnect button for an injected wallet (Base chain). */
function WalletButton() {
  const { address, connecting, available, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        onClick={() => disconnect()}
        title="Disconnect"
        className="mt-1 flex items-center gap-2 rounded-full border border-niko-blue bg-niko-panel px-4 py-1.5 text-xs font-bold text-niko-ice hover:border-red-400"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-green-400" aria-hidden />
        {shortAddress(address)} · Base
      </button>
    );
  }
  return (
    <button
      onClick={connect}
      disabled={connecting || !available}
      title={available ? 'Connect an injected wallet (Base)' : 'No wallet extension detected'}
      className={`mt-1 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
        available
          ? 'border-niko-line bg-niko-navy text-niko-ice hover:border-niko-electric'
          : 'cursor-not-allowed border-niko-line bg-niko-navy text-slate-500'
      }`}
    >
      {connecting ? 'Connecting…' : available ? '🔗 Connect Wallet' : 'No Wallet Detected'}
    </button>
  );
}

/**
 * Local best-score table ("Pack Records"). Reads the same data the future
 * global leaderboard will serve — swapping in the API is a data-source change.
 */
function PackRecords({ highScores }: { highScores: HighScores }) {
  const rows = Object.entries(highScores)
    .flatMap(([key, score]) => {
      if (score === undefined) return [];
      const [map, diff] = key.split(':') as [MapId, DifficultyId];
      if (!MAPS[map] || !DIFFICULTIES[diff]) return [];
      return [{ map, diff, score }];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (rows.length === 0) return null;
  return (
    <div className="w-full max-w-xl rounded-xl border border-niko-line bg-niko-navy/60 p-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-niko-glow">
        Pack Records
      </h2>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.map}:${r.diff}`} className="border-t border-niko-line/50 first:border-t-0">
              <td className="py-1 pr-2 text-slate-500">{i + 1}.</td>
              <td className="py-1">{MAPS[r.map].def.name}</td>
              <td className="py-1 text-slate-400">{DIFFICULTIES[r.diff].name}</td>
              <td className="py-1 text-right font-bold tabular-nums text-yellow-300">{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-500">
        Saved on this device. Global leaderboard coming soon.
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
