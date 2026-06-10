export interface ToastItem {
  id: number;
  text: string;
  tone: 'info' | 'danger' | 'success';
}

/** Transient NIKO-flavored announcements stacked over the battlefield. */
export function Toasts({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-1 px-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-toast-in rounded-full border px-4 py-1.5 text-center text-xs font-bold shadow-lg sm:text-sm ${
            t.tone === 'danger'
              ? 'border-red-500/60 bg-red-950/90 text-red-200'
              : t.tone === 'success'
                ? 'border-green-500/60 bg-green-950/90 text-green-200'
                : 'border-niko-blue/60 bg-niko-panel/90 text-niko-ice'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
