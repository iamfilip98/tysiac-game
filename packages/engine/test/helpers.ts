import type { Seat } from '../src/types';

export const SEATS3: Seat[] = [
  { id: 'a', name: 'Ala', avatar: '🦊', isBot: false },
  { id: 'b', name: 'Bartek', avatar: '🐻', isBot: false },
  { id: 'c', name: 'Celina', avatar: '🦉', isBot: false },
];

export const SEATS4: Seat[] = [...SEATS3, { id: 'd', name: 'Darek', avatar: '🐺', isBot: false }];
