import type { SynergyDef, TowerTypeId } from '../types';

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'burnProtocol',
    label: 'Burn Protocol',
    color: '#f97316',
    requires: ['packScout', 'blueFlame'],
  },
  {
    id: 'howlingDiamond',
    label: 'Howling Diamond',
    color: '#facc15',
    requires: ['diamondPaw', 'howlCannon'],
  },
];

export const SYNERGY_BY_ID: Record<string, SynergyDef> = Object.fromEntries(
  SYNERGIES.map((s) => [s.id, s]),
);

export const SYNERGY_BY_TOWER: Partial<Record<TowerTypeId, string[]>> = {};
for (const s of SYNERGIES) {
  for (const t of s.requires) {
    (SYNERGY_BY_TOWER[t] ??= []).push(s.id);
  }
}
