import type { Msg } from '../types';

/** The Learn lesson: scripted coach lines and hints (beat texts are added in the lesson task). */
export const learn = {
  'learn.advice.bid': 'Bid {amount}',
  'learn.advice.bidWhy': 'Your marriage lets you bid up to {max}.',
  'learn.advice.pass': 'Pass',
  'learn.advice.play': 'Play the hand',
  'learn.advice.throw': 'Throw in',
  'learn.advice.plan': "That's the plan for this hand — later the coach will help you choose.",
  'learn.advice.declare': 'Lead {card} to declare your marriage',
  'learn.advice.declareWhy': '+{points} for you, and {suit} becomes trump.',
  'learn.hint.lesson': 'Lesson: {text}.',
  'learn.hint.noPause': 'The lesson waits for you — no need to pause.',
  'learn.hint.wait': 'Not yet — wait for your turn.',
} as const satisfies Record<string, Msg>;
