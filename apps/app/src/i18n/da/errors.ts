import type { AreaOf } from '../types';
import type { errors as en } from '../en/errors';

export const errors = {
  'errors.offline': 'Du er offline — forbinder igen…',
  'errors.notPlaying': 'Spillet er ikke begyndt endnu',
  'errors.unreachable': 'Kan ikke nå serveren',
  'errors.unreachableRetry': 'Kan ikke nå serveren. Prøv igen.',
  'errors.createFailed': 'Kunne ikke oprette et rum. Prøv igen.',
  'errors.badCode': 'En rumkode har 6 bogstaver eller cifre.',
  'errors.noRoom': 'Der er intet rum med koden {code}.',
  'errors.serverStatus': 'Serverfejl (HTTP {status})',
  'errors.badResponse': 'Uventet svar fra serveren.',
  'errors.generic': 'Noget gik galt.',
  'errors.roomFull': 'Rummet er fuldt.',
  'errors.gameInProgress': 'Spillet er allerede begyndt uden dig.',
  'errors.badSecret': 'Pladsen tilhører en anden enhed.',
  'errors.versionMismatch': 'Appen er blevet opdateret — genindlæs.',
  'errors.notInRoom': 'Rummet findes ikke — det er måske udløbet.',
  'errors.badMessage': 'Forbindelsen sendte noget uventet.',
  'errors.notHost': 'Kun værten kan gøre det.',
  'errors.rateLimited': 'For mange handlinger på én gang — sæt tempoet lidt ned.',
  'errors.lesson': 'Følg lektionen — trænerens linje siger, hvad du skal gøre.',
} as const satisfies AreaOf<typeof en>;
