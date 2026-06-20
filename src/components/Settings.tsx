import { useState } from 'react';
import { loadSettings, saveSettings, type GameSettings } from '../utils/storage';

interface Props {
  /** Apply a live master-volume change (0–1). */
  onMasterVolume: (v: number) => void;
  /** Apply a live music-volume change (0–1). */
  onMusicVolume: (v: number) => void;
  /** Apply a live screen-shake toggle. */
  onScreenShake: (on: boolean) => void;
  onClose: () => void;
}

/**
 * In-game settings overlay. Owns its own state seeded from localStorage,
 * persists every change immediately, and pushes the change to the engine so
 * it takes effect live (no restart needed).
 */
export function Settings({ onMasterVolume, onMusicVolume, onScreenShake, onClose }: Props) {
  const [settings, setSettings] = useState<GameSettings>(loadSettings);

  const update = (patch: Partial<GameSettings>): void => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    if (patch.masterVolume !== undefined) onMasterVolume(patch.masterVolume);
    if (patch.musicVolume !== undefined) onMusicVolume(patch.musicVolume);
    if (patch.screenShake !== undefined) onScreenShake(patch.screenShake);
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-niko-deep/90 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-niko-blue bg-niko-panel p-6 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-niko-glow">⚙ Settings</h2>
          <button
            onClick={onClose}
            title="Close"
            className="min-h-9 min-w-9 rounded-lg border border-niko-line px-2 font-bold hover:border-niko-electric"
          >
            ✕
          </button>
        </div>

        <Slider
          label="Master Volume"
          value={settings.masterVolume}
          onChange={(v) => update({ masterVolume: v })}
        />
        <Slider
          label="Music Volume"
          value={settings.musicVolume}
          onChange={(v) => update({ musicVolume: v })}
        />

        <Toggle
          label="Screen Shake"
          hint="Camera jolts on heavy hits"
          on={settings.screenShake}
          onChange={(on) => update({ screenShake: on })}
        />

        <button
          onClick={onClose}
          className="mt-1 rounded-xl bg-niko-blue px-4 py-3 font-bold hover:bg-niko-electric"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-niko-ice">{label}</span>
        <span className="tabular-nums text-slate-400">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-niko-navy accent-niko-electric"
      />
    </label>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-bold text-niko-ice">{label}</div>
        <div className="text-xs text-slate-400">{hint}</div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 rounded-full transition-colors ${
          on ? 'bg-niko-blue' : 'bg-niko-navy'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            on ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}
