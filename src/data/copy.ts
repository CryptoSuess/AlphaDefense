/**
 * NIKO-brand copy used across the UI.
 * Keeping all flavor text in one file makes future localization / rebranding easy.
 */
export const COPY = {
  title: 'NIKO: Guardian of Base',
  subtitle: 'Defend the Chain. Protect the Pack.',
  startButton: 'Defend the Chain',
  difficultyHeading: 'Choose Your Trench',
  howToPlayHeading: 'How to Play',
  howToPlay: [
    'Enemies march along the path toward the Base Vault.',
    'Tap a tower card, then tap an open tile to deploy it.',
    'Towers attack automatically. Kills earn Paws 🐾.',
    'Tap a placed tower to upgrade or sell it.',
    'Survive all 25 waves to win. If the Vault falls, it’s over.',
  ],
  waveStart: (n: number) => `Wave ${n} — Diamond Paws Activated`,
  bossWave: 'FUD has entered the trenches…',
  bossDown: 'FUD Beast slain — The Pack Holds!',
  vaultHit: 'Base Vault under attack!',
  waveCleared: (n: number) => `Wave ${n} cleared — The Pack Holds`,
  towerPlaced: 'Diamond Paws Activated',
  notEnoughPaws: 'Not enough Paws 🐾',
  gameOverTitle: 'The Vault Has Fallen',
  gameOverBody: 'FUD overran the trenches. Regroup the Pack and try again.',
  victoryTitle: 'The Pack Holds!',
  victoryBody: 'All 25 waves repelled. NIKO stands guard — Base is safe.',
  pause: 'Pause',
  resume: 'Resume',
} as const;
