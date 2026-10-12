import type { AreaOf } from '../types';
import type { errors as en } from '../en/errors';

export const errors = {
  'errors.offline': 'Brak połączenia. Łączę ponownie…',
  'errors.notPlaying': 'Gra jeszcze się nie zaczęła',
  'errors.unreachable': 'Brak połączenia z serwerem',
  'errors.unreachableRetry': 'Brak połączenia z serwerem. Spróbuj ponownie.',
  'errors.createFailed': 'Nie udało się założyć pokoju. Spróbuj ponownie.',
  'errors.badCode': 'Kod pokoju ma 6 liter lub cyfr.',
  'errors.noRoom': 'Nie ma pokoju o kodzie {code}.',
  'errors.serverStatus': 'Błąd serwera (HTTP {status})',
  'errors.badResponse': 'Nieoczekiwana odpowiedź serwera.',
  'errors.langLoadFailed': 'Nie udało się wczytać tego języka. Sprawdź połączenie.',
  'errors.generic': 'Coś poszło nie tak.',
  'errors.roomFull': 'Ten pokój jest pełny.',
  'errors.gameInProgress': 'Ta gra zaczęła się już bez ciebie.',
  'errors.badSecret': 'To miejsce należy do innego urządzenia.',
  'errors.versionMismatch': 'Aplikacja została zaktualizowana. Odśwież stronę.',
  'errors.notInRoom': 'Nie ma takiego pokoju. Mógł wygasnąć.',
  'errors.badMessage': 'Połączenie przesłało coś nieoczekiwanego.',
  'errors.notHost': 'Tylko gospodarz może to zrobić.',
  'errors.rateLimited': 'Za dużo ruchów naraz. Trochę wolniej.',
  'errors.lesson': 'Trzymaj się lekcji. Podpowiedź trenera mówi, co zrobić.',
} as const satisfies AreaOf<typeof en>;
