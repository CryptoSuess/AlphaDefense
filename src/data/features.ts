/**
 * Feature flags for staged rollout of web3/social features.
 *
 * Flip a flag to false to ship a build without that surface — no other code
 * changes needed. When a real backend/config service exists these can move
 * to environment variables (import.meta.env) or remote config.
 */
export const FEATURES = {
  /** "Connect Wallet" on the start screen (injected EIP-1193, Base chain). */
  wallet: true,
  /** Local "Pack Records" panel; swaps to a global API leaderboard later. */
  leaderboard: true,
  /**
   * Global leaderboard API base URL (the deployed server/ Worker, e.g.
   * "https://niko-leaderboard.<account>.workers.dev"). Empty string = the
   * global leaderboard is off and the game is fully local, as before.
   */
  leaderboardApiUrl: '',
  /** NFT skin loading via SkinProvider (no skins exist yet). */
  nftSkins: false,
  /** Weekly tournament seed (needs backend). */
  tournament: false,
} as const;
