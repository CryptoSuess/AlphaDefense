import type { DifficultyDef, DifficultyId } from '../types';

/** Difficulty presets shown on the start screen. */
export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  pup: {
    id: 'pup',
    name: 'Pup',
    description: 'Chill run. Extra Paws, softer enemies. Learn the trenches.',
    hpMult: 0.8,
    rewardMult: 1.15,
    startingPaws: 160,
    startingLives: 25,
  },
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    description: 'The intended NIKO experience. Defend the Chain.',
    hpMult: 1.0,
    rewardMult: 1.0,
    startingPaws: 130,
    startingLives: 20,
  },
  alpha: {
    id: 'alpha',
    name: 'Alpha Wolf',
    description: 'Max FUD. Tougher enemies, tighter economy. The Pack must hold.',
    hpMult: 1.3,
    rewardMult: 0.85,
    startingPaws: 110,
    startingLives: 15,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['pup', 'guardian', 'alpha'];
