import { TOWERS, TOWER_ORDER } from '../data/towers';
import type { TowerTypeId, UiState } from '../types';

interface Props {
  ui: UiState;
  onSelect: (type: TowerTypeId) => void;
}

/**
 * Build bar (bottom of screen). Tap a card to enter build mode, then tap an
 * open tile on the battlefield. Works for both mouse and touch.
 */
export function TowerBar({ ui, onSelect }: Props) {
  return (
    <div className="flex w-full gap-2 overflow-x-auto pb-1">
      {TOWER_ORDER.map((id) => {
        const def = TOWERS[id];
        const cost = def.levels[0].cost;
        const affordable = ui.paws >= cost;
        const active = ui.selectedTowerType === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            disabled={!affordable && !active}
            title={def.tagline}
            className={`flex min-w-[5.5rem] flex-1 flex-col items-center rounded-xl border p-2 transition ${
              active
                ? 'border-niko-glow bg-niko-blue/30 shadow-glow'
                : affordable
                  ? 'border-niko-line bg-niko-panel hover:border-niko-electric'
                  : 'cursor-not-allowed border-niko-line bg-niko-navy opacity-40'
            }`}
          >
            <span
              className="mb-1 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: def.color }}
              aria-hidden
            />
            <span className="text-[11px] font-bold leading-tight sm:text-xs">{def.name}</span>
            <span className="text-[11px] text-yellow-300">{cost} 🐾</span>
          </button>
        );
      })}
    </div>
  );
}
