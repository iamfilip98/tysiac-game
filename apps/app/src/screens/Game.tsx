import { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useShallow } from 'zustand/react/shallow';
import { advise, cardEquals, cardKey, explainIllegal, type Advice, type Card, type PlayerId } from '@tysiac/engine';
import { coachOn, useRoom } from '../store/room';
import { isIdle } from '../store/client';
import { useSelection } from '../game/selection';
import { useNow } from '../game/useNow';
import { TopBar } from '../game/TopBar';
import { Opponents } from '../game/Opponents';
import { Table } from '../game/Table';
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
import './game.css';

type SheetName = 'menu' | 'score' | 'settings' | 'rules' | 'why';

/** Cards the coach suggests that are still in the hand: the card to play, or the hand-out cards not yet given. */
function recommendedKeys(advice: Advice | null, given: Card[]): string[] {
  if (advice?.action.type === 'card') return [cardKey(advice.action.card)];
  if (advice?.action.type !== 'handout') return [];
  return Object.values(advice.action.to)
    .filter(c => !given.some(g => cardEquals(g, c)))
    .map(cardKey);
}

export default function Game() {
  const s = useRoom(
    useShallow(st => ({
      me: st.me, room: st.room, view: st.view, shown: st.shown, queue: st.queue, holding: st.holding, sweepTo: st.sweepTo,
      pending: st.pending, inflight: st.inflight, shake: st.shake, toast: st.toast, roundResult: st.roundResult, note: st.note,
      clockOffset: st.clockOffset,
    })),
  );
  const sel = useSelection();
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
  const advice = useMemo(() => {
    if (!(coach && idle && shown && shown.turn === shown.me && !shown.paused)) return null;
    return lesson ? lesson.advice(shown) : advise(shown, { handoutGiven });
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
    const t = setTimeout(() => useRoom.getState().clearShake(), 600);
    return () => clearTimeout(t);
  }, [s.shake]);

  if (!shown) {
    return (
      <main className="game game--loading">
        <p>Dealing…</p>
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

  const onCardTap = (card: Card) => {
    room.clearToast();
    const key = cardKey(card);
    if (shown.phase === 'tricks') {
      if (!myTurn) {
        sel.setHint(explainIllegal(shown, card) ?? 'One moment…');
        return;
      }
      if (!isLegal(card)) {
        // A dimmed card shakes and explains itself; it never raises.
        sel.select(null);
        sel.setHint(explainIllegal(shown, card) ?? "You can't play that card now");
        useRoom.setState({ shake: key });
        return;
      }
      sel.setHint(null);
      sel.select(sel.selected === key ? null : key);
      return;
    }
    if (shown.phase === 'handout' && myTurn) {
      sel.setHint(null);
      sel.select(sel.selected === key ? null : key);
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
  const onTarget = (p: PlayerId) => {
    if (selectedCard) sel.give(p, selectedCard);
  };
  const leave = () => {
    room.detach();
    navigate('/');
  };
  const close = () => setSheet(null);

  return (
    <>
      <main className="game" data-phase={shown.phase} data-seq={s.view?.seq ?? 0}>
        <TopBar view={shown} onMenu={() => setSheet('menu')} onScores={() => setSheet('score')} />
        <Opponents
          view={shown}
          room={s.room}
          given={sel.given}
          targetable={myTurn && shown.phase === 'handout' && selectedCard !== null}
          onTarget={onTarget}
          onUngive={sel.ungive}
        />
        <Table view={shown} pending={s.pending?.card ?? null} sweepTo={s.sweepTo} />
        <ActionZone
          view={shown}
          room={s.room}
          idle={idle}
          busy={s.inflight !== null || s.pending !== null}
          selected={selectedCard}
          given={sel.given}
          hint={sel.hint ?? s.toast}
          coach={coach}
          advice={advice}
          note={s.note}
          now={now}
          onAct={a => room.act(a)}
          onPlay={onPlay}
          onConfirmHandout={onConfirmHandout}
          onBotFor={p => room.send({ t: 'botFor', playerId: p })}
          onWhy={() => setSheet('why')}
        />
        <SelfStrip view={shown} coach={coach} />
        <Hand
          cards={hand}
          selected={sel.selected}
          isPlayable={isPlayable}
          recommended={recommended}
          declared={r?.marriages[shown.me] ?? []}
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
      {sheet === 'why' && advice && <WhySheet advice={advice} onClose={close} />}
    </>
  );
}
