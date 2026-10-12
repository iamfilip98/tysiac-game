import type { Msg } from '../types';

/** Errors and rejections that do not come from the engine (worker, connection, local room). */
export const errors = {
  'errors.offline': "You're offline — reconnecting…",
  'errors.notPlaying': 'The game has not started yet',
  'errors.unreachable': "Can't reach the server",
  'errors.unreachableRetry': "Can't reach the server. Try again.",
  'errors.createFailed': "Couldn't create a room. Try again.",
  'errors.badCode': 'A room code has 6 letters or digits.',
  'errors.noRoom': 'No room with code {code}.',
  'errors.serverStatus': 'Server error (HTTP {status})',
  'errors.badResponse': 'Unexpected response from the server.',
  'errors.generic': 'Something went wrong.',
  'errors.roomFull': 'This room is full.',
  'errors.gameInProgress': 'This game has already started without you.',
  'errors.badSecret': 'This seat belongs to another device.',
  'errors.versionMismatch': 'The app was updated — please reload.',
  'errors.notInRoom': 'No such room — it may have expired.',
  'errors.badMessage': 'The connection sent something unexpected.',
  'errors.notHost': 'Only the host can do that.',
  'errors.rateLimited': 'Too many actions at once — slow down a little.',
  'errors.lesson': 'Follow the lesson — the coach line says what to do.',
} as const satisfies Record<string, Msg>;
