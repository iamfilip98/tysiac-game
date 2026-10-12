import type { AreaOf } from '../types';
import type { rules as en } from '../en/rules';

export const rules = {
  'rules.cards.title': 'Karty',
  'rules.cards': '24 karty: {ranks} w kolorach ♣ ♦ ♥ ♠. Punkty: {points}, razem {total} w rundzie. Starszeństwo: {strength}.',
  'rules.marriages.title': 'Meldunki',
  'rules.marriages': '{king} + {queen} w jednym kolorze to meldunek: {values}. Wyjdź damą, mając do niej króla, a meldunek zgłasza się sam: ten kolor od razu staje się atu. Punkty za meldunek liczą się tylko, jeśli weźmiesz choć jedną lewę.',
  'rules.dealing.title': 'Rozdanie',
  'rules.dealing': 'Każdy dostaje {hand} kart, {talon} idą do musiku. Przy 4 graczach rozdający pauzuje i dostaje meldunki z musiku oraz po {ace} za każdego asa w musiku. Ręka poniżej {redeal} punktów bez meldunku oznacza ponowne rozdanie.',
  'rules.bidding.title': 'Licytacja',
  'rules.bidding': 'Gracz po lewej stronie rozdającego ma z góry {auto}. W swojej kolejce podbij dokładnie o {step} albo powiedz „pas”. Najwyżej możesz licytować {base} + twoje meldunki. Licytacja kończy się, gdy dwie osoby spasują; wygrywa najwyższa oferta.',
  'rules.talon.title': 'Musik, bomba i oddawanie kart',
  'rules.talon': 'Przy {auto} musik widzi tylko grający. Gdy licytację wygrywa oferta powyżej {auto}, musik widzą wszyscy i każdy potwierdza „Widzę”, zanim grający ruszy dalej. Grający może rzucić bombę: przy {auto} nikt nie dostaje punktów; powyżej grający traci wartość licytacji, a pozostali dostają po {share} (0 na beczce). W przeciwnym razie grający oddaje po jednej karcie każdemu przeciwnikowi.',
  'rules.tricks.title': 'Lewy',
  'rules.tricks': 'Pierwszy wychodzi grający. Każdy musi dołożyć do koloru, jeśli może. Tylko pierwszy gracz po wychodzącym musi dodatkowo przebić kartę wyjścia, jeśli może. Jeśli nie masz koloru, zagraj cokolwiek: nie ma obowiązku przebijania atutem. Atu bije każdy inny kolor.',
  'rules.scoring.title': 'Punktacja',
  'rules.scoring': 'Punkty zaokrągla się do pełnych dziesiątek (reszta {up} lub więcej zaokrągla w górę: {downEx} to 100, {upEx} to 110). Grający musi zdobyć co najmniej tyle punktów, ile zalicytował, i wtedy dostaje swoje punkty po zaokrągleniu; w przeciwnym razie odejmuje mu się wartość licytacji. Obrońcy dostają swoje punkty po zaokrągleniu. Na beczce ({barrel}–{last}) obrońca dostaje 0: punkty zdobywasz tylko jako grający. Liczba prób na beczce jest nieograniczona. Wygrywa ten, kto pierwszy dojdzie do {win}.',
} as const satisfies AreaOf<typeof en>;
