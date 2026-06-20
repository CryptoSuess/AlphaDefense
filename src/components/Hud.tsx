import { COPY } from '../data/copy';
import type { UiState } from '../types';

interface Props {
  ui: UiState;
  onPause: () => void;
  onSpeed: () => void;
  onSound: () => void;
  onStartWave: () => void;
  onAutoWave: () => void;
  onQuit: () => void;
}

/** Top bar: lives, paws, score, wave counter and game controls. */
export function Hud({ ui, onPause, onSpeed, onSound, onStartWave, onAutoWave, onQuit }: Props) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-niko-line bg-niko-panel/80 px-3 py-2 text-sm">
      <Stat icon="❤️" label="Vault" value={`${ui.lives}/${ui.maxLives}`} warn={ui.lives <= 5} />
      <Stat icon="🐾" label="Paws" value={String(ui.paws)} />
      <Stat icon="⭐" label="Score" value={String(ui.score)} />
      <Stat
        icon="🌊"
        label="Wave"
        value={ui.endless ? `${ui.wave} ∞` : `${ui.wave}/${ui.totalWaves}`}
      />

      <div className="ml-auto flex items-center gap-2">
        {/* Manual start-wave button — hidden while auto-wave is counting down */}
        {!ui.waveInProgress &&
          ui.status === 'playing' &&
          (ui.endless || ui.wave < ui.totalWaves) &&
          ui.autoWaveCountdown === null && (
          <button
            onClick={onStartWave}
            className={`animate-pulse rounded-lg px-3 py-2.5 font-bold sm:py-1.5 ${
              ui.nextWaveIsBoss ? 'bg-red-600 hover:bg-red-500' : 'bg-niko-blue hover:bg-niko-electric'
            }`}
          >
            {ui.nextWaveIsBoss ? '⚠ Boss Wave' : `Start Wave ${ui.wave + 1}`}
          </button>
        )}
        {/* Auto-wave countdown badge */}
        {ui.autoWaveCountdown !== null && (
          <span className="rounded-lg bg-niko-navy px-3 py-1.5 text-xs font-bold tabular-nums text-niko-glow">
            ⏱ {ui.autoWaveCountdown}s
          </span>
        )}
        <IconButton
          onClick={onAutoWave}
          label={ui.autoWave ? '⚡' : '⏩'}
          title={ui.autoWave ? 'Auto-wave ON — click to turn off' : 'Auto-wave OFF — click to turn on'}
          active={ui.autoWave}
        />
        <IconButton onClick={onSpeed} label={`${ui.timeScale}x`} title="Toggle game speed" />
        <IconButton
          onClick={onSound}
          label={ui.soundOn ? '🔊' : '🔇'}
          title="Toggle sound & music"
        />
        <IconButton
          onClick={onPause}
          label={ui.status === 'paused' ? '▶' : '⏸'}
          title={ui.status === 'paused' ? COPY.resume : COPY.pause}
        />
        <IconButton onClick={onQuit} label="✕" title="Quit to menu" />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  warn,
}: {
  icon: string;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${
        warn ? 'bg-red-950 text-red-300' : 'bg-niko-navy text-niko-ice'
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span className="hidden text-xs uppercase tracking-wide text-slate-400 sm:inline">
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function IconButton({
  onClick,
  label,
  title,
  active,
}: {
  onClick: () => void;
  label: string;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`min-h-11 min-w-11 rounded-lg border px-2 py-1.5 font-bold hover:border-niko-electric sm:min-h-0 sm:min-w-9 ${
        active
          ? 'border-niko-electric bg-niko-blue/30 text-niko-glow'
          : 'border-niko-line bg-niko-navy'
      }`}
    >
      {label}
    </button>
  );
}
