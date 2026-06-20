import { ENEMIES } from '../data/enemies';
import type { EnemyTypeId } from '../types';

interface Props {
  preview: Array<{ type: EnemyTypeId; count: number }> | null;
  autoWaveCountdown: number | null;
  waveNumber: number;
}

/**
 * Between-wave intel panel showing the upcoming enemy composition.
 * Visible when nextWavePreview is non-null; disappears when the wave starts.
 */
export function WaveIntel({ preview, autoWaveCountdown, waveNumber }: Props) {
  if (!preview) return null;
  return (
    <div className="mt-1 w-full rounded-xl border border-niko-line bg-niko-panel/80 px-4 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-niko-glow">
          Wave {waveNumber} Intel
        </span>
        {preview.map(({ type, count }) => {
          const def = ENEMIES[type];
          if (!def) return null;
          return (
            <div key={type} className="flex items-center gap-1.5" title={def.name}>
              <span
                className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: def.color }}
              />
              <span className="text-xs text-niko-ice">{def.name}</span>
              <span className="text-xs font-bold tabular-nums text-white">×{count}</span>
            </div>
          );
        })}
        {autoWaveCountdown !== null && (
          <span className="ml-auto text-xs text-slate-400">
            Starting in {autoWaveCountdown}s
          </span>
        )}
      </div>
    </div>
  );
}
