import type { AreaOf } from '../types';
import type { learn as en } from '../en/learn';

export const learn = {
  'learn.advice.bid': 'Licytuj {amount}',
  'learn.advice.bidWhy': 'Dzięki meldunkowi możesz licytować do {max}.',
  'learn.advice.pass': 'Pas',
  'learn.advice.play': 'Gram',
  'learn.advice.throw': 'Bomba',
  'learn.advice.plan': 'Taki jest plan na to rozdanie — później trener pomoże ci wybierać.',
  'learn.advice.declare': 'Wyjdź z {card}, żeby zameldować',
  'learn.advice.declareWhy': '+{points} dla ciebie, a {suit} staje się atu.',
  'learn.hint.lesson': 'Lekcja: {text}.',
  'learn.hint.noPause': 'Lekcja na ciebie poczeka — nie trzeba pauzować.',
  'learn.hint.wait': 'Jeszcze nie — poczekaj na swój ruch.',
} as const satisfies AreaOf<typeof en>;
