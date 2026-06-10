import { TOWERS } from '../data/towers';
import type { TowerSnapshot } from '../types';

interface Props {
  tower: TowerSnapshot;
  paws: number;
  onUpgrade: (id: number) => void;
  onSell: (id: number) => void;
  onClose: () => void;
}

/** Floating panel for a selected tower: stats, upgrade and sell actions. */
export function TowerPanel({ tower, paws, onUpgrade, onSell, onClose }: Props) {
  const def = TOWERS[tower.type];
  const stats = def.levels[tower.level];
  const next = tower.level < tower.maxLevel ? def.levels[tower.level + 1] : null;
  const canAfford = tower.upgradeCost !== null && paws >= tower.upgradeCost;

  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-niko-line bg-niko-panel/95 px-3 py-2 text-sm">
      <div>
        <div className="font-bold" style={{ color: def.color }}>
          {def.name}{' '}
          <span className="text-xs text-slate-400">
            Lv {tower.level + 1}/{tower.maxLevel + 1}
          </span>
        </div>
        <div className="text-xs text-slate-400">{def.tagline}</div>
      </div>

      <div className="flex gap-3 text-xs text-niko-ice">
        <StatDelta label="DMG" cur={stats.damage} next={next?.damage} />
        <StatDelta label="RNG" cur={stats.range} next={next?.range} />
        <StatDelta label="RATE" cur={stats.fireRate} next={next?.fireRate} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {tower.upgradeCost !== null ? (
          <button
            onClick={() => onUpgrade(tower.id)}
            disabled={!canAfford}
            className={`rounded-lg px-3 py-1.5 font-bold ${
              canAfford
                ? 'bg-niko-blue hover:bg-niko-electric'
                : 'cursor-not-allowed bg-niko-navy text-slate-500'
            }`}
          >
            Upgrade ({tower.upgradeCost} 🐾)
          </button>
        ) : (
          <span className="rounded-lg bg-niko-navy px-3 py-1.5 text-xs font-bold text-yellow-300">
            MAX LEVEL
          </span>
        )}
        <button
          onClick={() => onSell(tower.id)}
          className="rounded-lg border border-niko-line px-3 py-1.5 font-bold text-red-300 hover:border-red-400"
        >
          Sell (+{tower.sellValue} 🐾)
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-niko-line px-2 py-1.5 hover:border-niko-electric"
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function StatDelta({ label, cur, next }: { label: string; cur: number; next?: number }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-bold tabular-nums">
        {cur}
        {next !== undefined && <span className="text-green-400"> →{next}</span>}
      </div>
    </div>
  );
}
