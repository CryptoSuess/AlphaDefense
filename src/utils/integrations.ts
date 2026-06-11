/**
 * Future-ready integration stubs.
 *
 * Nothing here is wired up yet — these interfaces define the seams where
 * web3 / social features will plug in without touching gameplay code:
 *
 *  - Wallet connect: gate NFT skins + tournament entry behind `WalletProvider`.
 *  - Leaderboard: swap `LocalLeaderboard` for an API-backed implementation.
 *  - NFT skins: `SkinProvider.getUnlockedSkins()` feeds the sprite registry
 *    (see src/game/sprites.ts) so unlocked art replaces placeholder shapes.
 *  - Weekly tournament: `TournamentProvider` supplies a seeded wave schedule
 *    so every player faces identical waves for the week.
 */
import type { DifficultyId, MapId } from '../types';
import { loadHighScores, scoreKey, submitHighScore } from './storage';
import { connectWallet, disconnectWallet, getAddress as getWalletAddress } from './wallet';

// ---------------------------------------------------------------------------
// Wallet (future)
// ---------------------------------------------------------------------------
export interface WalletProvider {
  connect(): Promise<{ address: string } | null>;
  disconnect(): Promise<void>;
  getAddress(): string | null;
}

/**
 * Backed by the dependency-free injected-wallet implementation in wallet.ts
 * (EIP-1193, switches to Base). Swap for wagmi/viem when richer on-chain
 * features are needed — this interface stays put.
 */
export const wallet: WalletProvider = {
  async connect() {
    const address = await connectWallet();
    return address ? { address } : null;
  },
  disconnect: disconnectWallet,
  getAddress: getWalletAddress,
};

// ---------------------------------------------------------------------------
// Leaderboard (future) — local-only implementation for now
// ---------------------------------------------------------------------------
export interface LeaderboardEntry {
  player: string;
  score: number;
  map: MapId;
  difficulty: DifficultyId;
}

export interface LeaderboardProvider {
  submit(entry: LeaderboardEntry): Promise<void>;
  top(limit: number): Promise<LeaderboardEntry[]>;
}

/** Local stand-in until a backend exists. */
export const leaderboard: LeaderboardProvider = {
  async submit(entry) {
    submitHighScore(scoreKey(entry.map, entry.difficulty), entry.score);
  },
  async top() {
    const scores = loadHighScores();
    return Object.entries(scores).flatMap(([key, score]) => {
      const [map, difficulty] = key.split(':') as [MapId, DifficultyId];
      return score !== undefined ? [{ player: 'You', score, map, difficulty }] : [];
    });
  },
};

// ---------------------------------------------------------------------------
// NFT skins (future)
// ---------------------------------------------------------------------------
export interface SkinProvider {
  /** Returns sprite-key -> image-url overrides for skins the player owns. */
  getUnlockedSkins(): Promise<Record<string, string>>;
}

export const skins: SkinProvider = {
  async getUnlockedSkins() {
    return {};
  },
};

// ---------------------------------------------------------------------------
// Weekly tournament (future)
// ---------------------------------------------------------------------------
export interface TournamentProvider {
  /** Deterministic seed shared by all players for the current week. */
  getWeeklySeed(): Promise<number | null>;
}

export const tournament: TournamentProvider = {
  async getWeeklySeed() {
    return null;
  },
};

// ---------------------------------------------------------------------------
// Telegram sharing
// ---------------------------------------------------------------------------
/** Builds a t.me share link for a finished run. */
export function telegramShareUrl(score: number, wave: number): string {
  const text = `I scored ${score} defending the Base Vault through wave ${wave} in NIKO: Guardian of Base! 🐺🐾 Protect the Pack.`;
  const url = typeof window !== 'undefined' ? window.location.href : '';
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
