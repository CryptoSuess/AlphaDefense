import { COPY } from '../data/copy';
import { DIFFICULTIES } from '../data/difficulty';
import type { DifficultyId, RunStats } from '../types';
import { telegramShareUrl } from '../utils/integrations';
import { NikoLogo } from './NikoLogo';

interface Props {
  status: 'gameover' | 'victory';
  score: number;
  wave: number;
  difficulty: DifficultyId;
  isRecord: boolean;
  stats: RunStats;
  /** Week key when this was a Weekly Trench run. */
  weekly?: string;
  onRetry: () => void;
  onMenu: () => void;
  /** Present only on the campaign victory screen: continue into endless mode. */
  onContinueEndless?: () => void;
}

/** Game over / victory overlay with score, share button and replay actions. */
export function EndScreen({
  status,
  score,
  wave,
  difficulty,
  isRecord,
  stats,
  weekly,
  onRetry,
  onMenu,
  onContinueEndless,
}: Props) {
  const victory = status === 'victory';
  const minutes = Math.floor(stats.duration / 60);
  const seconds = Math.floor(stats.duration % 60);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-niko-deep/90 p-4">
      <div
        className={`flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border bg-niko-panel p-6 text-center ${
          victory ? 'border-niko-blue shadow-glow' : 'border-red-900'
        }`}
      >
        <NikoLogo size={72} />
        <h2 className={`text-3xl font-extrabold ${victory ? 'text-niko-glow' : 'text-red-400'}`}>
          {victory ? COPY.victoryTitle : COPY.gameOverTitle}
        </h2>
        <p className="text-sm text-slate-300">{victory ? COPY.victoryBody : COPY.gameOverBody}</p>

        <div className="grid w-full grid-cols-3 gap-2 text-sm">
          <Cell label="Score" value={String(score)} />
          <Cell label="Wave" value={String(wave)} />
          <Cell label="Trench" value={weekly ? `Weekly ${weekly}` : DIFFICULTIES[difficulty].name} />
        </div>

        {/* Run stats */}
        <div className="grid w-full grid-cols-3 gap-2 text-sm sm:grid-cols-6">
          <Cell label="Kills" value={String(stats.totalKills)} />
          <Cell label="Bosses" value={String(stats.bossesSlain)} />
          <Cell label="Towers" value={String(stats.towersBuilt)} />
          <Cell label="Upgrades" value={String(stats.upgradesBought + stats.branchesBought)} />
          <Cell label="Paws Earned" value={String(stats.pawsEarned)} />
          <Cell label="Time" value={`${minutes}:${String(seconds).padStart(2, '0')}`} />
        </div>

        {isRecord && (
          <div className="rounded-full bg-yellow-500/20 px-4 py-1 text-sm font-bold text-yellow-300">
            ★ New personal best — Diamond Paws Activated!
          </div>
        )}

        {victory && onContinueEndless && (
          <button
            onClick={onContinueEndless}
            className="w-full rounded-xl bg-gradient-to-r from-niko-blue to-niko-flame px-4 py-3 font-bold shadow-glow transition hover:brightness-110"
          >
            {COPY.endlessButton}
          </button>
        )}

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            onClick={onRetry}
            className="flex-1 rounded-xl bg-niko-blue px-4 py-3 font-bold hover:bg-niko-electric"
          >
            Defend Again
          </button>
          <button
            onClick={onMenu}
            className="flex-1 rounded-xl border border-niko-line px-4 py-3 font-bold hover:border-niko-electric"
          >
            Main Menu
          </button>
        </div>

        <a
          href={telegramShareUrl(score, wave)}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-bold text-niko-glow underline-offset-4 hover:underline"
        >
          📣 Share on Telegram
        </a>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-niko-navy p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-bold text-niko-ice">{value}</div>
    </div>
  );
}
