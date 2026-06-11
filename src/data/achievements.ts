import type { AchievementDef } from '../types';

/**
 * Achievement definitions. Unlock logic lives in src/game/achievements.ts;
 * this file is pure data so the start screen can render the full list.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'firstBlood',
    name: 'First Blood',
    description: 'Defeat your first enemy.',
    icon: '🩸',
  },
  {
    id: 'packHunter',
    name: 'Pack Hunter',
    description: 'Defeat 100 enemies (lifetime).',
    icon: '🐺',
  },
  {
    id: 'jeetExterminator',
    name: 'Jeet Exterminator',
    description: 'Defeat 1,000 Jeets (lifetime).',
    icon: '⚡',
  },
  {
    id: 'fudSlayer',
    name: 'FUD Slayer',
    description: 'Slay your first FUD Beast.',
    icon: '🗡️',
  },
  {
    id: 'packHolds',
    name: 'The Pack Holds',
    description: 'Win a 25-wave campaign.',
    icon: '🏆',
  },
  {
    id: 'alphaGuardian',
    name: 'Alpha Guardian',
    description: 'Win a campaign on Alpha Wolf difficulty.',
    icon: '👑',
  },
  {
    id: 'flawlessVault',
    name: 'Flawless Vault',
    description: 'Win a campaign without losing a single life.',
    icon: '💎',
  },
  {
    id: 'deepTrenches',
    name: 'Deep Trenches',
    description: 'Clear wave 30 in endless mode.',
    icon: '🕳️',
  },
  {
    id: 'fullArsenal',
    name: 'Full Arsenal',
    description: 'Have all 5 tower types deployed at once.',
    icon: '🛡️',
  },
  {
    id: 'diamondHands',
    name: 'Diamond Hands',
    description: 'Hold 1,000 Paws at once.',
    icon: '🐾',
  },
  {
    id: 'specialist',
    name: 'Specialist',
    description: 'Buy a final-tier tower specialization.',
    icon: '⭐',
  },
];
