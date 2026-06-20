import { COPY } from '../data/copy';
import { NikoLogo } from './NikoLogo';

interface Props {
  onClose: () => void;
}

/**
 * First-run "How to Play" overlay. Shown automatically the first time a
 * battle starts (see GameScreen) and re-openable from the HUD help button.
 */
export function Tutorial({ onClose }: Props) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-niko-deep/90 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-niko-blue bg-niko-panel p-6 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <NikoLogo size={56} />
          <h2 className="text-2xl font-extrabold text-niko-glow">{COPY.howToPlayHeading}</h2>
        </div>

        <ol className="flex flex-col gap-2 text-sm text-slate-200">
          {COPY.howToPlay.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-bold text-niko-electric">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>

        <button
          onClick={onClose}
          className="mt-1 rounded-xl bg-gradient-to-r from-niko-blue to-niko-flame px-4 py-3 font-bold shadow-glow transition hover:brightness-110"
        >
          {COPY.startButton}
        </button>
      </div>
    </div>
  );
}
