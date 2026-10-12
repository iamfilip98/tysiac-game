import { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useShallow } from 'zustand/react/shallow';
import { advise, cardEquals, cardKey, explainIllegal, type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import { coachOn, useRoom } from '../store/room';
import { isIdle } from '../store/client';
import { nextRecipient, useSelection } from '../game/selection';
import { useNow } from '../game/useNow';
import { TopBar } from '../game/TopBar';
import { Opponents } from '../game/Opponents';
import { Table } from '../game/Table';
import { Ticker } from '../game/Ticker';
import { ReceivedCard } from '../game/ReceivedCard';
import { Hand } from '../game/Hand';
import { SelfStrip } from '../game/SelfStrip';
import { ActionZone } from '../game/ActionZone';
import { WhySheet } from '../game/WhySheet';
import { ScoreSheet } from '../game/ScoreSheet';
import { RoundResultSheet } from '../game/RoundResultSheet';
import { GameOverSheet } from '../game/GameOverSheet';
import { MenuSheet } from './MenuSheet';
import { SettingsSheet } from './SettingsSheet';
import { RulesSheet } from './RulesSheet';
import { LessonContext } from '../learn/context';
import { engineText, type CoachAdvice } from '../i18n/engineText';
import { textSuits } from '../game/cards';
import { useT } from '../i18n/useT';
import './game.css';

type SheetName = 'menu' | 'score' | 'settings' | 'rules' | 'why';

/** Cards the coach suggests that are still in the hand: the card to play, or the hand-out cards not yet given. */
function recommendedKeys(advice: CoachAdvice | null, given: Card[]): string[] {
  if (advice?.action.type === 'card') return [cardKey(advice.action.card)];
  if (advice?.action.type !== 'handout') return [];
  return Object.values(advice.action.to)
    .filter(c => !given.some(g => cardEquals(g, c)))
    .map(cardKey);
}

/** Why `card` can't be played now, in the active language, or null. */
function illegalText(view: PlayerView, card: Card): string | null {
  const m = explainIllegal(view, card);
  return m && textSuits(engineText(m, view));
}

export default function Game() {
  const s = useRoom(
    useShallow(st => ({
      me: st.me, room: st.room, view: st.view, shown: st.shown, queue: st.queue, holding: st.holding, sweepTo: st.sweepTo, marriage: st.marriage, held: st.held, announce: st.announce, received: st.received,
      pending: st.pending, inflight: st.inflight, shake: st.shake, toast: st.toast, roundResult: st.roundResult, note: st.note,
      clockOffset: st.clockOffset,
    })),
  );
  const sel = useSelection();
  const t = useT();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  // Coach default comes from the seat once per mount (the selector); the settings toggle overrides it locally.
  const [coachOverride, setCoachOverride] = useState<boolean | null>(null);
  const [, navigate] = useLocation();
  const shown = s.shown;
  const idle = isIdle(s);
  const lesson = useContext(LessonContext);
  const coach = lesson !== null || (coachOverride ?? coachOn(s));
  const anyAway = !!s.room?.seats.some(x => x && !x.isBot && !x.connected && !x.botFor);
  const now = useNow(anyAway, s.clockOffset);
  const phaseKey = shown ? `${shown.round?.number ?? 0}:${shown.phase}` : '';
  // Hints are private: only ever computed for the viewer's own turn. During the hand-out the coach
  // takes the cards already given into account and advises only on the rest.
  const handoutGiven = sel.given;
  const advice = useMemo((): CoachAdvice | null => {
    if (!(coach && idle && shown && shown.turn === shown.me && !shown.paused)) return null;
    return lesson ? lesson.advice(shown, { handoutGiven }) : advise(shown, { handoutGiven });
  }, [lesson, coach, idle, shown, handoutGiven]);

  useEffect(() => {
    useSelection.getState().reset();
  }, [phaseKey]);
  // Once the room echoes the seat's coach flag the seat is the source of truth again.
  const seatCoach = coachOn(s);
  useEffect(() => {
    if (coachOverride !== null && seatCoach === coachOverride) setCoachOverride(null);
  }, [coachOverride, seatCoach]);
  // A raised card never outlives my turn (pause, bot takeover, turn change).
  const turnLive = idle && !!shown && shown.turn === shown.me && !shown.paused;
  useEffect(() => {
    if (!turnLive) useSelection.getState().select(null);
  }, [turnLive]);
  useEffect(() => {
    if (!s.shake) return;
    const timer = setTimeout(() => useRoom.getState().clearShake(), 600);
    return () => clearTimeout(timer);
  }, [s.shake]);

  if (!shown) {
    return (
      <main className="game game--loading">
        <p>{t('game.dealing')}</p>
      </main>
    );
  }

  const room = useRoom.getState();
  const r = shown.round;
  const myTurn = idle && shown.turn === shown.me && !shown.paused;
  const givenCards = Object.values(sel.given);
  const hand = r ? r.hand.filter(c => !(s.pending && cardEquals(c, s.pending.card)) && !givenCards.some(g => cardEquals(g, c))) : [];
  const legalCards = shown.legal.flatMap(a => (a.type === 'card' ? [a.card] : []));
  const isLegal = (c: Card) => legalCards.some(l => cardEquals(l, c));
  const isPlayable = (c: Card) => shown.phase !== 'tricks' || !myTurn || isLegal(c);
  const selectedCard = hand.find(c => cardKey(c) === sel.selected) ?? null;
  const recommended = recommendedKeys(advice, givenCards);
  const isHost = s.room?.hostId === s.me;
  const handingOut = myTurn && shown.phase === 'handout';
  const recipients = r ? r.active.filter(p => p !== shown.me) : [];
  const next = handingOut ? nextRecipient(recipients, sel.given, sel.target) : null;

  const onCardTap = (card: Card) => {
    room.clearToast();
    const key = cardKey(card);
    if (shown.phase === 'tricks') {
      if (!myTurn) {
        sel.setHint(illegalText(shown, card) ?? t('game.hint.wait'));
        return;
      }
      if (!isLegal(card)) {
        // A dimmed card shakes and explains itself; it never raises.
        sel.select(null);
        sel.setHint(illegalText(shown, card) ?? t('game.hint.cantPlay'));
        useRoom.setState({ shake: key });
        return;
      }
      sel.setHint(null);
      sel.select(sel.selected === key ? null : key);
      return;
    }
    if (handingOut) {
      // One tap per card: it goes straight to the next empty slot (or the slot tapped first).
      sel.setHint(null);
      if (next) sel.give(next, card);
    }
  };
  const onPlay = (card: Card) => {
    room.playCard(card);
    sel.reset();
  };
  const onConfirmHandout = () => {
    // Keep `given` (cards stay out of the hand, chips stay) until the phase changes; a reject leaves it restorable.
    room.act({ type: 'handout', to: { ...sel.given } });
  };
  const onSlot = (p: PlayerId) => {
    if (sel.given[p]) sel.ungive(p);
    else sel.setTarget(p);
  };
  const leave = () => {
    room.detach();
    navigate('/');
  };
  const close = () => setSheet(null);

  return (
    <>
      <main
        className="game"
        data-phase={shown.phase}
        data-seq={s.view?.seq ?? 0}
        data-holding={s.holding || undefined}
        onClick={e => {
          // The table takes no taps (pointer-events: none), so a tap on it lands here: it skips the trick hold.
          if (e.target === e.currentTarget) room.skipHold();
        }}
      >
        <TopBar view={shown} onMenu={() => setSheet('menu')} onScores={() => setSheet('score')} />
        <Opponents
          view={shown}
          room={s.room}
          given={sel.given}
          targetable={handingOut}
          next={next}
          onTarget={onSlot}
        />
        <Table view={shown} pending={s.pending?.card ?? null} sweepTo={s.sweepTo} marriage={s.marriage} held={s.holding ? s.held : null} />
        <Ticker view={shown} announce={s.announce} />
        {s.received?.open && <ReceivedCard view={shown} received={s.received} onDismiss={() => room.clearReceived()} />}
        <ActionZone
          view={shown}
          room={s.room}
          idle={idle}
          busy={s.inflight !== null || s.pending !== null}
          selected={selectedCard}
          given={sel.given}
          next={next}
          waitFor={s.view?.turn ?? null}
          held={s.holding ? s.held : null}
          hint={sel.hint ?? s.toast}
          coach={coach}
          advice={advice}
          note={s.note}
          now={now}
          onAct={a => room.act(a)}
          onPlay={onPlay}
          onConfirmHandout={onConfirmHandout}
          onSlot={onSlot}
          onBotFor={p => room.send({ t: 'botFor', playerId: p })}
          onWhy={() => setSheet('why')}
        />
        <SelfStrip view={shown} coach={coach} myTurn={myTurn} />
        <Hand
          cards={hand}
          selected={sel.selected}
          isPlayable={isPlayable}
          recommended={recommended}
          declared={r?.marriages[shown.me] ?? []}
          trump={r?.trump ?? null}
          fresh={s.received ? cardKey(s.received.card) : null}
          shake={s.shake}
          onTap={onCardTap}
        />
      </main>
      {s.roundResult && (
        <RoundResultSheet summary={s.roundResult} view={shown} note={coach ? s.note : null} onContinue={() => room.dismissResult()} />
      )}
      {!s.roundResult && idle && shown.phase === 'gameEnd' && (
        <GameOverSheet view={shown} isHost={isHost} onRematch={() => room.send({ t: 'rematch' })} onHome={leave} />
      )}
      {sheet === 'score' && <ScoreSheet view={shown} onClose={close} />}
      {sheet === 'menu' && (
        <MenuSheet
          paused={!!shown.paused}
          onPause={() => {
            room.act({ type: 'pause' });
            close();
          }}
          onResume={() => {
            room.act({ type: 'resume' });
            close();
          }}
          onSettings={() => setSheet('settings')}
          onRules={() => setSheet('rules')}
          onLeave={leave}
          onClose={close}
        />
      )}
      {sheet === 'settings' && (
        <SettingsSheet
          allowProfile={false}
          coachOn={coach}
          onCoachChange={on => {
            setCoachOverride(on);
            room.send({ t: 'setCoach', coach: on });
          }}
          onRules={() => setSheet('rules')}
          onClose={close}
        />
      )}
      {sheet === 'rules' && <RulesSheet onClose={close} />}
      {sheet === 'why' && advice && <WhySheet view={shown} advice={advice} onClose={close} />}
    </>
  );
}
