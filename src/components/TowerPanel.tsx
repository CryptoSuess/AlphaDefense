import { TOWERS } from '../data/towers';
import type { TargetingMode, TowerSnapshot } from '../types';

interface Props {
  tower: TowerSnapshot;
  paws: number;
  onUpgrade: (id: number) => void;
  onBranch: (id: number, index: 0 | 1) => void;
  onCycleTargeting: (id: number) => void;
  onSell: (id: number) => void;
  onClose: () => void;
}

const TARGETING_LABEL: Record<TargetingMode, string> = {
  first: '🎯 First',
  strong: '💪 Strong',
  close: '📍 Close',
};

/**
 * Floating panel for a selected tower: stats, targeting mode, upgrade
 * (including the final-tier branch choice) and sell actions.
 */
export function TowerPanel({
  tower,
  paws,
  onUpgrade,
  onBranch,
  onCycleTargeting,
  onSell,
  onClose,
}: Props) {
  const def = TOWERS[tower.type];
  const stats =
    tower.branchName !== null && def.branches
      ? def.branches.find((b) => b.name === tower.branchName)!.stats
      : def.levels[tower.level];
  const next = tower.upgradeCost !== null ? def.levels[tower.level + 1] : null;
  const canAfford = tower.upgradeCost !== null && paws >= tower.upgradeCost;

  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-niko-line bg-niko-panel/95 px-3 py-2 text-sm">
      <div>
        <div className="font-bold" style={{ color: def.color }}>
          {tower.branchName ?? def.name}{' '}
          <span className="text-xs text-slate-400">
            {tower.branchName
              ? 'MAX'
              : `Lv ${tower.level + 1}/${tower.maxLevel + 1}`}
          </span>
        </div>
        <div className="text-xs text-slate-400">{def.tagline}</div>
      </div>

      <div className="flex gap-3 text-xs text-niko-ice">
        <StatDelta label="DMG" cur={stats.damage} next={next?.damage} />
        <StatDelta label="RNG" cur={stats.range} next={next?.range} />
        <StatDelta label="RATE" cur={stats.fireRate} next={next?.fireRate} />
      </div>

      <button
        onClick={() => onCycleTargeting(tower.id)}
        title="Cycle targeting: First (closest to vault) → Strong (most HP) → Close (nearest)"
        className="rounded-lg border border-niko-line bg-niko-navy px-3 py-1.5 text-xs font-bold hover:border-niko-electric"
      >
        {TARGETING_LABEL[tower.targeting]}
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {tower.upgradeCost !== null ? (
          <button
            onClick={() => onUpgrade(tower.id)}
            disabled={!canAfford}
            className={`rounded-lg px-3 py-2.5 font-bold sm:py-1.5 ${
              canAfford
                ? 'bg-niko-blue hover:bg-niko-electric'
                : 'cursor-not-allowed bg-niko-navy text-slate-500'
            }`}
          >
            Upgrade ({tower.upgradeCost} 🐾)
          </button>
        ) : tower.branchOptions ? (
          tower.branchOptions.map((b) => {
            const affordable = paws >= b.cost;
            return (
              <button
                key={b.index}
                onClick={() => onBranch(tower.id, b.index)}
                disabled={!affordable}
                title={b.tagline}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  affordable
                    ? 'bg-gradient-to-r from-niko-blue to-niko-flame hover:brightness-110'
                    : 'cursor-not-allowed bg-niko-navy text-slate-500'
                }`}
              >
                ⭐ {b.name} ({b.cost} 🐾)
              </button>
            );
          })
        ) : (
          <span className="rounded-lg bg-niko-navy px-3 py-1.5 text-xs font-bold text-yellow-300">
            MAX LEVEL
          </span>
        )}
        <button
          onClick={() => onSell(tower.id)}
          className="rounded-lg border border-niko-line px-3 py-2.5 font-bold text-red-300 hover:border-red-400 sm:py-1.5"
        >
          Sell (+{tower.sellValue} 🐾)
        </button>
        <button
          onClick={onClose}
          className="min-h-11 min-w-11 rounded-lg border border-niko-line px-2 py-1.5 hover:border-niko-electric sm:min-h-0 sm:min-w-0"
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
