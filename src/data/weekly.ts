import { MAP_ORDER } from './map';
import type { WeeklyChallenge, WeeklyModifier } from '../types';

/**
 * The Weekly Trench: a seeded challenge derived from the ISO week, so every
 * player worldwide faces identical waves with identical modifiers — no
 * backend needed. Scores are stored under "weekly:<weekKey>"; a global
 * leaderboard can later rank them server-side using the same key.
 */

/** Candidate modifiers; two distinct ones are drawn per week. */
const MODIFIER_POOL: WeeklyModifier[] = [
  { id: 'fudSurge', label: 'FUD Surge (+25% enemy HP)', hpMult: 1.25 },
  { id: 'stampede', label: 'Stampede (+20% enemy speed)', speedMult: 1.2 },
  { id: 'horde', label: 'Horde (+30% enemies)', countMult: 1.3 },
  { id: 'bearMarket', label: 'Bear Market (-15% Paws)', rewardMult: 0.85 },
  { id: 'bullRun', label: 'Bull Run (+25% Paws, +15% HP)', rewardMult: 1.25, hpMult: 1.15 },
  { id: 'thinRanks', label: 'Thin Ranks (-15% enemies, +20% HP)', countMult: 0.85, hpMult: 1.2 },
];

/** Deterministic small PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple string hash (FNV-1a) for turning the week key into a seed. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** ISO-8601 week key, e.g. "2026-W24". Same for every timezone's Monday. */
export function getWeekKey(date = new Date()): string {
  // Work in UTC so all players agree on the week boundary.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weeks belong to the year containing their Thursday.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Builds this week's challenge (deterministic for a given week key). */
export function getWeeklyChallenge(weekKey = getWeekKey()): WeeklyChallenge {
  const rng = mulberry32(hashString(weekKey));
  const mapId = MAP_ORDER[Math.floor(rng() * MAP_ORDER.length)];
  // Draw two distinct modifiers.
  const pool = [...MODIFIER_POOL];
  const first = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const second = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  return { weekKey, seed: hashString(weekKey), mapId, modifiers: [first, second] };
}
