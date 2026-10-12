import type { AreaOf } from '../types';
import type { common as en } from '../en/common';

export const common: AreaOf<typeof en> = {
  'common.settings': 'Ustawienia',
  'common.close': 'Zamknij',
  'common.language': 'Język',
  'common.theme': 'Motyw',
  'common.sound': 'Dźwięk',
  'common.coachHints': 'Podpowiedzi trenera',
  'common.speed': 'Szybkość animacji',
  'common.speed.normal': 'Normalna',
  'common.speed.fast': 'Szybka',
  'common.profile': 'Profil',
  'common.save': 'Zapisz',
  'common.rules': 'Zasady',
  'common.points': { one: '{n} punkt', few: '{n} punkty', many: '{n} punktów', other: '{n} punktu' },
};
