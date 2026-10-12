import type { Msg } from '../types';

export const common = {
  'common.settings': 'Settings',
  'common.close': 'Close',
  'common.language': 'Language',
  'common.theme': 'Theme',
  'common.sound': 'Sound',
  'common.coachHints': 'Coach hints',
  'common.speed': 'Animation speed',
  'common.speed.normal': 'Normal',
  'common.speed.fast': 'Fast',
  'common.profile': 'Profile',
  'common.save': 'Save',
  'common.rules': 'Rules',
  'common.points': { one: '{n} pt', other: '{n} pts' },
} as const satisfies Record<string, Msg>;
