import type { AreaOf } from '../types';
import type { learn as en } from '../en/learn';

export const learn = {
  'learn.advice.bid': 'Byd {amount}',
  'learn.advice.bidWhy': 'Din mariage gør, at du kan byde op til {max}.',
  'learn.advice.pass': 'Pas',
  'learn.advice.play': 'Spil hånden',
  'learn.advice.throw': 'Giv op',
  'learn.advice.plan': 'Det er planen for denne hånd — senere hjælper træneren dig med at vælge.',
  'learn.advice.declare': 'Spil {card} ud for at melde din mariage',
  'learn.advice.declareWhy': '+{points} til dig, og {suit} bliver trumf.',
  'learn.hint.lesson': 'Lektion: {text}.',
  'learn.hint.noPause': 'Lektionen venter på dig — du behøver ikke at holde pause.',
  'learn.hint.wait': 'Ikke endnu — vent på din tur.',
} as const satisfies AreaOf<typeof en>;
