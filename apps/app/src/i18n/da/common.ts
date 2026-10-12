import type { AreaOf } from '../types';
import type { common as en } from '../en/common';

export const common = {
  'common.settings': 'Indstillinger',
  'common.close': 'Luk',
  'common.language': 'Sprog',
  'common.theme': 'Tema',
  'common.sound': 'Lyd',
  'common.coachHints': 'Trænerens tips',
  'common.speed': 'Animationshastighed',
  'common.speed.normal': 'Normal',
  'common.speed.fast': 'Hurtig',
  'common.profile': 'Profil',
  'common.save': 'Gem',
  'common.rules': 'Regler',
  'common.you': 'Du',
  'common.someone': 'Nogen',
  'card.rank.A': 'E',
  'card.rank.K': 'K',
  'card.rank.Q': 'D',
  'card.rank.J': 'B',
  'card.rank.10': '10',
  'card.rank.9': '9',
  'common.points': { one: '{n} point', other: '{n} point' },
} as const satisfies AreaOf<typeof en>;
