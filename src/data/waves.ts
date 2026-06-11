import type { EnemyTypeId, SpawnEntry } from '../types';

/** The campaign ends (in victory) after this wave is cleared. */
export const TOTAL_WAVES = 25;

/** FUD Beast boss appears every Nth wave. */
export const BOSS_EVERY = 5;

export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % BOSS_EVERY === 0;
}

/**
 * Enemy HP multiplier for a wave (difficulty multiplier applied separately).
 * Linear ramp plus a gentle exponential so late waves stay threatening.
 * Past the campaign (endless mode) the ramp steepens so every run ends.
 */
export function waveHpMult(wave: number): number {
  const base = (1 + 0.12 * (wave - 1)) * Math.pow(1.04, wave - 1);
  const endlessExtra = wave > TOTAL_WAVES ? Math.pow(1.06, wave - TOTAL_WAVES) : 1;
  return base * endlessExtra;
}

/** Paws awarded for clearing a wave. */
export function waveClearBonus(wave: number): number {
  return 20 + wave * 4;
}

/** Score awarded for clearing a wave. */
export function waveClearScore(wave: number): number {
  return 50 * wave;
}

interface Group {
  type: EnemyTypeId;
  count: number;
  /** Seconds between spawns inside the group. */
  interval: number;
}

/**
 * Procedurally builds the spawn timeline for a wave.
 * Groups spawn one after another with a short gap, so waves read as
 * distinct "pushes" rather than a uniform stream.
 *
 * `countMult` scales group sizes (weekly challenge modifiers); bosses are
 * never multiplied.
 */
export function buildWave(wave: number, countMult = 1): SpawnEntry[] {
  const groups: Group[] = [];
  const boss = isBossWave(wave);
  const scale = (n: number) => Math.max(1, Math.round(n * countMult));

  // Jeets: present in every wave, growing steadily.
  groups.push({ type: 'jeet', count: scale(5 + wave * 2), interval: 0.7 });

  // Ruggers: tanky pressure from wave 2.
  if (wave >= 2) {
    groups.push({ type: 'rugger', count: scale(1 + wave), interval: 1.3 });
  }

  // Bot Swarm: large packs of weak units from wave 3.
  if (wave >= 3) {
    groups.push({ type: 'bot', count: scale(8 + wave * 2), interval: 0.28 });
  }

  // Snipers: fast and evasive from wave 6.
  if (wave >= 6) {
    groups.push({ type: 'sniper', count: scale(2 + Math.floor(wave / 2)), interval: 0.9 });
  }

  // Shillers: pump the bags of nearby enemies (heal aura) from wave 8.
  // Spaced out so they escort different parts of the push.
  if (wave >= 8) {
    groups.push({ type: 'shiller', count: scale(1 + Math.floor(wave / 7)), interval: 4 });
  }

  // Boss waves: FUD Beast(s) arrive after the regular push.
  if (boss) {
    groups.push({ type: 'fudBeast', count: Math.floor(wave / BOSS_EVERY), interval: 6 });
  }

  // Flatten groups into a single timeline.
  const entries: SpawnEntry[] = [];
  let t = 0.8; // small delay before the first spawn
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      entries.push({ type: g.type, time: t });
      t += g.interval;
    }
    t += 2.2; // breather between groups
  }
  return entries;
}
