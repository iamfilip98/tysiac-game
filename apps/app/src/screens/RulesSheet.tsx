import { RULES } from '@tysiac/engine';
import { Sheet } from '../ui/Sheet';
import './screens.css';

export function RulesSheet({ onClose }: { onClose(): void }) {
  const pts = RULES.cardPoints;
  const mv = RULES.marriageValues;
  const share = Math.floor(RULES.throwPool / 2);
  const down = RULES.roundUpFrom - 1;
  return (
    <Sheet title="Rules" onClose={onClose}>
      <div className="rules">
        <h3>Cards</h3>
        <p>
          24 cards: 9, 10, J, Q, K, A in ♣ ♦ ♥ ♠. Points: A {pts.A}, 10 {pts['10']}, K {pts.K}, Q {pts.Q}, J {pts.J}, 9 {pts['9']} —{' '}
          {RULES.pointsPerRound} per round. Strength: A &gt; 10 &gt; K &gt; Q &gt; J &gt; 9.
        </p>
        <h3>Marriages</h3>
        <p>
          K + Q of one suit: ♥ {mv.hearts}, ♦ {mv.diamonds}, ♣ {mv.clubs}, ♠ {mv.spades}. Lead the Q while holding its K and the marriage is declared
          automatically — that suit becomes trump at once. Marriage points count only if you win at least one trick.
        </p>
        <h3>Dealing</h3>
        <p>
          {RULES.handSize} cards each and {RULES.talonSize} to the talon. With 4 players the dealer sits out and scores the talon's marriages plus{' '}
          {RULES.talonAcePoints} per ace in it. A hand under {RULES.redealBelow} points with no marriage means a redeal.
        </p>
        <h3>Bidding</h3>
        <p>
          The player left of the dealer automatically holds {RULES.autoBid}. On your turn, bid exactly {RULES.bidStep} more than the current bid, or pass.
          Your maximum is {RULES.maxBidBase} + your marriages. Bidding ends when two players have passed; the high bidder wins.
        </p>
        <h3>Talon, throw-in and hand-out</h3>
        <p>
          At {RULES.autoBid} only the bidder sees the talon; above that everyone does. The bidder may throw in: at {RULES.autoBid} nobody scores; above it the
          bidder loses the bid and the others get {share} each (0 on the barrel). Otherwise the bidder gives one card to each opponent.
        </p>
        <h3>Tricks</h3>
        <p>
          The bidder leads first. Everyone must follow suit if they can. Only the first player after the leader must also beat the lead card if able. If you
          can't follow suit, play anything — there is no obligation to trump. A trump beats every other suit.
        </p>
        <h3>Scoring</h3>
        <p>
          Points round to the nearest 10 (a remainder of {RULES.roundUpFrom} or more rounds up: {100 + down} becomes 100, {100 + RULES.roundUpFrom} becomes{' '}
          {110}). The bidder needs at least the bid in raw points and then scores their points rounded; otherwise the bidder scores minus the bid.
          Defenders score their own points rounded. On the barrel ({RULES.barrelAt}–{RULES.winAt - 1}) defenders score 0 — you only score as the
          bidder. There is no limit on barrel attempts. First to {RULES.winAt} wins.
        </p>
      </div>
    </Sheet>
  );
}
