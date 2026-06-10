/**
 * Placeholder NIKO mascot mark rendered as inline SVG:
 * black wolf head, white chest/muzzle, three blue forehead marks and a blue
 * flame tail tip. Swap for the official asset when art is ready.
 */
export function NikoLogo({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="NIKO the wolf"
    >
      {/* Flame tail tip behind the head */}
      <path
        d="M78 70 Q92 52 80 38 Q84 56 70 62 Z"
        fill="#38bdf8"
        opacity="0.9"
      />
      {/* Ears */}
      <path d="M28 38 L34 10 L48 30 Z" fill="#0b0e1a" />
      <path d="M72 38 L66 10 L52 30 Z" fill="#0b0e1a" />
      {/* Head */}
      <circle cx="50" cy="52" r="30" fill="#0b0e1a" />
      {/* White muzzle / chest */}
      <ellipse cx="50" cy="66" rx="14" ry="12" fill="#f8fafc" />
      {/* Eyes */}
      <circle cx="40" cy="48" r="3.5" fill="#60a5fa" />
      <circle cx="60" cy="48" r="3.5" fill="#60a5fa" />
      {/* Nose */}
      <circle cx="50" cy="62" r="3" fill="#0b0e1a" />
      {/* Three blue forehead marks */}
      <circle cx="42" cy="34" r="2.5" fill="#2563ff" />
      <circle cx="50" cy="31" r="2.5" fill="#2563ff" />
      <circle cx="58" cy="34" r="2.5" fill="#2563ff" />
    </svg>
  );
}
