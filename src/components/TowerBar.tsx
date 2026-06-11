import { TOWERS, TOWER_ORDER } from '../data/towers';
import type { TowerTypeId, UiState } from '../types';

interface Props {
  ui: UiState;
  onSelect: (type: TowerTypeId) => void;
  /** Begins a drag-to-place gesture from a card (pointer is already down). */
  onDragStart: (type: TowerTypeId, ev: React.PointerEvent) => void;
}

/**
 * Build bar (bottom of screen). Two ways to build, both touch-friendly:
 * tap a card then tap a tile, or press a card and drag straight onto the
 * battlefield. Drag handling lives in GameScreen (it owns the canvas).
 */
export function TowerBar({ ui, onSelect, onDragStart }: Props) {
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
            onPointerDown={(ev) => {
              if (!affordable && !active) return;
              onDragStart(id, ev);
            }}
            onClick={() => {
              /* selection is handled in pointer events; keep for keyboards */
            }}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') onSelect(id);
            }}
            disabled={!affordable && !active}
            title={def.tagline}
            className={`min-h-[4.25rem] min-w-[5.5rem] flex-1 touch-none select-none flex-col items-center rounded-xl border p-2 transition flex ${
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
