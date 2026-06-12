import { ACHIEVEMENTS } from '../data/achievements';
import type { DifficultyId, EnemyTypeId, MapId } from '../types';
import {
  loadLifetimeStats,
  loadUnlockedAchievements,
  saveLifetimeStats,
  saveUnlockedAchievements,
  type LifetimeStats,
} from '../utils/storage';
import type { Tower } from './Tower';

/**
 * Tracks lifetime stats and unlocks achievements. The engine calls the
 * `on*` hooks at the relevant gameplay moments; unlocks fire the `onUnlock`
 * callback (the engine turns it into a toast).
 *
 * Lifetime counters update in memory on every kill but only persist on wave
 * end / run end, so localStorage isn't hammered 60x a second.
 */
export class AchievementTracker {
  private readonly lifetime: LifetimeStats = loadLifetimeStats();
  private readonly unlocked = loadUnlockedAchievements();

  constructor(private readonly onUnlock: (name: string, icon: string) => void) {
    this.lifetime.runs += 1;
  }

  private unlock(id: string): void {
    if (this.unlocked.has(id)) return;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    this.unlocked.add(id);
    saveUnlockedAchievements(this.unlocked);
    this.onUnlock(def.name, def.icon);
  }

  onKill(type: EnemyTypeId, boss: boolean): void {
    this.lifetime.kills[type] = (this.lifetime.kills[type] ?? 0) + 1;
    this.lifetime.totalKills += 1;
    if (boss) this.lifetime.bossesSlain += 1;

    if (this.lifetime.totalKills >= 1) this.unlock('firstBlood');
    if (this.lifetime.totalKills >= 100) this.unlock('packHunter');
    if ((this.lifetime.kills.jeet ?? 0) >= 1000) this.unlock('jeetExterminator');
    if ((this.lifetime.kills.whale ?? 0) >= 25) this.unlock('whaleWatcher');
    if (this.lifetime.bossesSlain >= 1) this.unlock('fudSlayer');
  }

  onTowersChanged(towers: Tower[]): void {
    const types = new Set(towers.map((t) => t.type));
    if (types.size >= 6) this.unlock('fullArsenal');
  }

  onPawsChanged(paws: number): void {
    if (paws >= 1000) this.unlock('diamondHands');
  }

  onBranchBought(): void {
    this.unlock('specialist');
  }

  onWaveCleared(wave: number): void {
    this.lifetime.bestWave = Math.max(this.lifetime.bestWave, wave);
    if (wave >= 30) this.unlock('deepTrenches');
    saveLifetimeStats(this.lifetime);
  }

  onVictory(difficulty: DifficultyId, lives: number, maxLives: number, mapId: MapId): void {
    this.lifetime.victories[difficulty] = (this.lifetime.victories[difficulty] ?? 0) + 1;
    this.unlock('packHolds');
    if (difficulty === 'alpha') this.unlock('alphaGuardian');
    if (lives >= maxLives) this.unlock('flawlessVault');
    if (mapId === 'doubleCross') this.unlock('doubleCrossed');
    saveLifetimeStats(this.lifetime);
  }

  onRunEnd(): void {
    saveLifetimeStats(this.lifetime);
  }
}
