/**
 * NIKO mascot mark as inline SVG, styled after the official token art:
 * smirking black wolf with white muzzle, blue inner ears, three blue
 * forehead streaks, blue nose, and a blue hoodie with a white ring emblem.
 * (The hoodie ring is a plain circle — deliberately not the notched
 * exchange logo.) Swap for the official asset file when ready.
 */
export function NikoLogo({ size = 64 }: { size?: number }) {
  const FUR = '#0b0e1a';
  const BLUE = '#0052ff';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="NIKO the wolf">
      {/* Hoodie */}
      <path d="M14,98 Q16,74 34,67 L66,67 Q84,74 86,98 Z" fill="#1452d8" stroke={FUR} strokeWidth="3" />
      <path d="M30,70 Q50,80 70,70 L66,67 L34,67 Z" fill="#0d3fb0" />
      {/* White ring emblem */}
      <circle cx="50" cy="86" r="7" fill="none" stroke="#f8fafc" strokeWidth="4.5" />

      {/* Ears with blue inner */}
      <path d="M22,36 L29,7 L47,24 Z" fill={FUR} />
      <path d="M78,36 L71,7 L53,24 Z" fill={FUR} />
      <path d="M27,28 L30,14 L39,23 Z" fill={BLUE} />
      <path d="M73,28 L70,14 L61,23 Z" fill={BLUE} />

      {/* Head with flared cheeks */}
      <path
        d="M50,12 Q30,14 23,32 Q14,44 27,54 Q35,65 50,66 Q65,65 73,54 Q86,44 77,32 Q70,14 50,12 Z"
        fill={FUR}
      />

      {/* White muzzle */}
      <path d="M28,47 Q38,41 50,43 Q62,41 72,47 Q70,62 50,66 Q30,62 28,47 Z" fill="#f8fafc" />
      {/* Smirk */}
      <path d="M36,55 Q49,61 64,52" fill="none" stroke={FUR} strokeWidth="2.6" strokeLinecap="round" />

      {/* Smug eyes: white almonds, heavy upper lids, pupils */}
      <ellipse cx="38" cy="37" rx="7.5" ry="5.5" fill="#f8fafc" />
      <ellipse cx="62" cy="37" rx="7.5" ry="5.5" fill="#f8fafc" />
      <ellipse cx="38" cy="33.5" rx="8" ry="4.5" fill={FUR} />
      <ellipse cx="62" cy="33.5" rx="8" ry="4.5" fill={FUR} />
      <circle cx="39.5" cy="38.5" r="2.6" fill={FUR} />
      <circle cx="60.5" cy="38.5" r="2.6" fill={FUR} />

      {/* Blue nose */}
      <ellipse cx="50" cy="46.5" rx="4.6" ry="3" fill={BLUE} />

      {/* Three blue forehead streaks */}
      <path d="M44,17 Q42,24 43.5,29" fill="none" stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M50,15 Q49,23 50,30" fill="none" stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M56,17 Q58,24 56.5,29" fill="none" stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
