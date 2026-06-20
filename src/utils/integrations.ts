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
import { FEATURES } from '../data/features';
import { getPlayerName, loadHighScores, submitHighScore } from './storage';
import {
  connectWallet,
  disconnectWallet,
  getAddress as getWalletAddress,
  signMessage,
} from './wallet';

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
/**
 * Boards are addressed by storage key: "<mapId>:<difficulty>" for campaign
 * runs and "weekly:<weekKey>" for the Weekly Trench — identical to the local
 * high-score keys and to what the server/ Worker stores.
 */
export interface LeaderboardEntry {
  key: string;
  player: string;
  score: number;
  wave: number;
  address?: string;
  /** EIP-191 signature proving `address` owns this score (added at submit). */
  signature?: string;
}

/**
 * Canonical message a player signs to claim a score under their wallet. MUST
 * stay byte-identical to buildScoreMessage in server/src/eip191.js.
 */
function buildScoreMessage(e: {
  key: string;
  score: number;
  wave: number;
  address: string;
}): string {
  return [
    'NIKO: Guardian of Base — verified score',
    `board: ${e.key}`,
    `score: ${e.score}`,
    `wave: ${e.wave}`,
    `wallet: ${e.address.toLowerCase()}`,
  ].join('\n');
}

export interface LeaderboardProvider {
  submit(entry: LeaderboardEntry): Promise<void>;
  top(key: string, limit: number): Promise<LeaderboardEntry[]>;
}

/** Local stand-in: records personal bests only. */
const localLeaderboard: LeaderboardProvider = {
  async submit(entry) {
    submitHighScore(entry.key, entry.score);
  },
  async top(key) {
    const score = loadHighScores()[key];
    return score !== undefined ? [{ key, player: 'You', score, wave: 0 }] : [];
  },
};

/** Talks to the deployed server/ Worker (see server/README.md). */
function createRemoteLeaderboard(baseUrl: string): LeaderboardProvider {
  return {
    async submit(entry) {
      // Claiming a wallet address requires signing the score. If the player
      // declines (or has no wallet), fall back to an anonymous submission so
      // the run still counts — just without the verified address.
      let payload = entry;
      if (entry.address) {
        const message = buildScoreMessage({
          key: entry.key,
          score: entry.score,
          wave: entry.wave,
          address: entry.address,
        });
        const signature = await signMessage(message);
        payload = signature
          ? { ...entry, signature }
          : { ...entry, address: undefined, player: getPlayerName() };
      }
      try {
        await fetch(`${baseUrl}/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        /* offline / API down — local records still work */
      }
    },
    async top(key, limit) {
      try {
        const res = await fetch(
          `${baseUrl}/scores?key=${encodeURIComponent(key)}&limit=${limit}`,
        );
        if (!res.ok) return [];
        const data = (await res.json()) as { entries: Omit<LeaderboardEntry, 'key'>[] };
        return data.entries.map((e) => ({ ...e, key }));
      } catch {
        return [];
      }
    },
  };
}

export const leaderboard: LeaderboardProvider = FEATURES.leaderboardApiUrl
  ? createRemoteLeaderboard(FEATURES.leaderboardApiUrl)
  : localLeaderboard;

/** True when the global (server-backed) leaderboard is configured. */
export const globalLeaderboardEnabled = Boolean(FEATURES.leaderboardApiUrl);

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
