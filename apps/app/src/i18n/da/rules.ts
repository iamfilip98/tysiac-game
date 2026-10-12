import type { AreaOf } from '../types';
import type { rules as en } from '../en/rules';

export const rules = {
  'rules.cards.title': 'Kort',
  'rules.cards': '24 kort: {ranks} i ♣ ♦ ♥ ♠. Point: {points}, i alt {total} per runde. Styrke: {strength}.',
  'rules.marriages.title': 'Mariager',
  'rules.marriages': '{king} + {queen} i samme kulør: {values}. Spiller du damen ud, mens du har kongen, meldes mariagen automatisk, og kuløren bliver straks trumf. Mariagepoint tæller kun, hvis du vinder mindst ét stik.',
  'rules.dealing.title': 'Kortgivning',
  'rules.dealing': '{hand} kort til hver og {talon} til talonen. Med 4 spillere sidder giveren over og får talonens mariager plus {ace} for hvert es i den. En hånd under {redeal} point uden mariage betyder, at der gives om.',
  'rules.bidding.title': 'Budrunde',
  'rules.bidding': 'Spilleren til venstre for giveren har automatisk {auto}. Når det er din tur, byder du præcis {step} mere end det nuværende bud eller melder pas. Dit højeste bud er {base} + dine mariager. Budrunden slutter, når to spillere har meldt pas; den højeste byder vinder.',
  'rules.talon.title': 'Talon, giv op og afgiv kort',
  'rules.talon': 'Ved {auto} ser kun budvinderen talonen. Vinder et bud over {auto}, ser alle talonen og bekræfter med Set, før budvinderen fortsætter. Budvinderen kan give op: ved {auto} får ingen point; over det mister budvinderen buddet, og de andre får {share} hver (0 på tønden). Ellers giver budvinderen ét kort til hver modstander.',
  'rules.tricks.title': 'Stik',
  'rules.tricks': 'Budvinderen spiller først ud. Alle skal bekende kulør, hvis de kan. Kun den første spiller efter udspilleren skal også stikke udspillet over, hvis muligt. Kan du ikke bekende, må du spille hvad som helst: der er ingen pligt til at trumfe. En trumf slår alle andre kulører.',
  'rules.scoring.title': 'Pointtælling',
  'rules.scoring': 'Point afrundes til nærmeste 10 (en rest på {up} eller mere rundes op: {downEx} bliver 100, {upEx} bliver 110). Budvinderen skal have mindst buddet i rå point og får så sine point afrundet; ellers trækkes buddet fra. Modspillerne får deres egne point afrundet. På tønden ({barrel}–{last}) får modspillere 0: du scorer kun som budvinder. Der er ingen grænse for forsøg på tønden. Den første til {win} vinder.',
} as const satisfies AreaOf<typeof en>;
