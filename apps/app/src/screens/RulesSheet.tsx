import { Fragment } from 'react';
import { RULES, type Rank } from '@tysiac/engine';
import { Sheet } from '../ui/Sheet';
import { useT } from '../i18n/useT';
import { SUIT_TEXT } from '../game/cards';
import './screens.css';

const LOW_FIRST: readonly Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];
const BY_POINTS: readonly Rank[] = ['A', '10', 'K', 'Q', 'J', '9'];

export function RulesSheet({ onClose }: { onClose(): void }) {
  const t = useT();
  const rank = (r: Rank) => t(`card.rank.${r}`);
  const mv = RULES.marriageValues;
  const strength = [...RULES.ranks].sort((a, b) => RULES.rankStrength[b] - RULES.rankStrength[a]) as Rank[];
  const down = RULES.roundUpFrom - 1;
  const sections = [
    [
      t('rules.cards.title'),
      t('rules.cards', {
        ranks: LOW_FIRST.map(rank).join(', '),
        points: BY_POINTS.map(r => `${rank(r)} ${RULES.cardPoints[r]}`).join(', '),
        total: RULES.pointsPerRound,
        strength: strength.map(rank).join(' > '),
      }),
    ],
    [
      t('rules.marriages.title'),
      t('rules.marriages', {
        king: rank('K'),
        queen: rank('Q'),
        values: RULES.marriageOrder.map(s => `${SUIT_TEXT[s]} ${mv[s]}`).join(', '),
      }),
    ],
    [
      t('rules.dealing.title'),
      t('rules.dealing', { hand: RULES.handSize, talon: RULES.talonSize, ace: RULES.talonAcePoints, redeal: RULES.redealBelow }),
    ],
    [t('rules.bidding.title'), t('rules.bidding', { auto: RULES.autoBid, step: RULES.bidStep, base: RULES.maxBidBase })],
    [t('rules.talon.title'), t('rules.talon', { auto: RULES.autoBid, share: Math.floor(RULES.throwPool / 2) })],
    [t('rules.tricks.title'), t('rules.tricks')],
    [
      t('rules.scoring.title'),
      t('rules.scoring', {
        up: RULES.roundUpFrom,
        downEx: 100 + down,
        upEx: 100 + RULES.roundUpFrom,
        barrel: RULES.barrelAt,
        last: RULES.winAt - 1,
        win: RULES.winAt,
      }),
    ],
  ];
  return (
    <Sheet title={t('common.rules')} onClose={onClose}>
      <div className="rules">
        {sections.map(([title, text]) => (
          <Fragment key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </Fragment>
        ))}
      </div>
    </Sheet>
  );
}
