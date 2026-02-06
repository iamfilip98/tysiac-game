import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

// Minimal type definitions matching the server's shared types
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export interface Card { suit: Suit; rank: Rank; }

export type GamePhase =
  | 'idle' | 'dealing' | 'bidding' | 'talonReveal'
  | 'playOrPassDecision' | 'talonDistribution' | 'wykladana'
  | 'trickPlaying' | 'roundScoring' | 'gameEnd';

export type ValidAction =
  | { type: 'bid'; minBid: number; maxBid: number }
  | { type: 'pass' }
  | { type: 'playOrPass' }
  | { type: 'playCard'; validCards: Card[] }
  | { type: 'distributeTalon'; cardsToGive: number }
  | { type: 'declareMarriage'; suits: Suit[] };

export interface ClientGameState {
  id: string;
  roomId: string;
  phase: GamePhase;
  players: { id: string; name: string; isAI: boolean; seatIndex: number }[];
  scores: Record<string, { totalScore: number; roundScores: number[]; isOnBarrel: boolean }>;
  round: {
    roundNumber: number;
    dealer: string;
    trumpSuit: Suit | null;
    bidWinner: string | null;
    finalBid: number;
    currentTrick: {
      cards: { playerId: string; card: Card }[];
      leadSuit: Suit | null;
      currentPlayer: string;
      trickNumber: number;
    } | null;
    completedTricks: number;
    playerTrickCounts: Record<string, number>;
    declaredMarriages: Record<string, Suit[]>;
  } | null;
  myHand: Card[];
  isSpectating?: boolean;
  talon: Card[] | null;
  cardsToDistribute: Card[] | null;
  winner: string | null;
  isPaused?: boolean;
}

export interface RoomData {
  id: string;
  code: string;
  name: string;
  hostId: string;
  players: { id: string; name: string; isReady: boolean; isHost: boolean; isAI: boolean }[];
  maxPlayers: 3 | 4;
  isPrivate: boolean;
  gameId: string | null;
}

export interface RoundResult {
  roundNumber: number;
  bidWinner: string;
  bid: number;
  bidderMadeBid: boolean;
  playerResults: {
    playerId: string;
    trickPoints: number;
    marriagePoints: number;
    totalRoundPoints: number;
    scoreChange: number;
    newTotalScore: number;
    wasOnBarrel: boolean;
    fellOffBarrel: boolean;
  }[];
}

interface EventLogEntry {
  event: string;
  data: unknown;
  timestamp: number;
}

/**
 * Socket.io client wrapper for E2E game testing.
 * Connects to the game server and tracks all incoming events.
 */
export class GameClient {
  private socket: Socket;
  private eventLog: EventLogEntry[] = [];

  playerId = '';
  playerName: string;
  sessionToken = '';
  roomCode = '';
  roomId = '';
  room: RoomData | null = null;
  gameState: ClientGameState | null = null;
  validActions: ValidAction[] = [];
  lastRoundResult: RoundResult | null = null;
  lastError: { code: string; message: string } | null = null;
  gameEnded = false;
  gameEndData: { winnerId: string; finalScores: Record<string, number> } | null = null;

  constructor(name: string) {
    this.playerName = name;
    this.socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: false,
      timeout: 10_000,
    });
    this.setupListeners();
  }

  private setupListeners() {
    const track = (event: string, data: unknown) => {
      this.eventLog.push({ event, data, timestamp: Date.now() });
    };

    // Room events
    this.socket.on('room:created', (data: any) => {
      track('room:created', data);
      this.playerId = data.hostId;
      this.sessionToken = data.sessionToken;
      this.roomCode = data.code;
      this.roomId = data.id;
      this.room = data;
    });

    this.socket.on('room:joined', (data: any) => {
      track('room:joined', data);
      this.playerId = data.playerId;
      this.sessionToken = data.sessionToken;
      this.room = data.room;
      this.roomCode = data.room.code;
      this.roomId = data.room.id;
    });

    this.socket.on('room:updated', (room: any) => {
      track('room:updated', room);
      this.room = room;
    });

    this.socket.on('room:playerJoined', (player: any) => {
      track('room:playerJoined', player);
    });

    this.socket.on('room:playerLeft', (playerId: any) => {
      track('room:playerLeft', playerId);
    });

    this.socket.on('room:error', (error: any) => {
      track('room:error', error);
      this.lastError = error;
    });

    // Game events
    this.socket.on('game:started', (state: any) => {
      track('game:started', state);
      this.gameState = state;
    });

    this.socket.on('game:stateUpdate', (state: any) => {
      track('game:stateUpdate', state);
      this.gameState = state;
    });

    this.socket.on('game:phaseChange', (phase: any) => {
      track('game:phaseChange', phase);
      if (this.gameState) {
        this.gameState.phase = phase;
      }
    });

    this.socket.on('game:yourTurn', (data: any) => {
      track('game:yourTurn', data);
      this.validActions = data.validActions;
    });

    this.socket.on('game:cardPlayed', (data: any) => {
      track('game:cardPlayed', data);
    });

    this.socket.on('game:trickWon', (data: any) => {
      track('game:trickWon', data);
    });

    this.socket.on('game:marriageDeclared', (data: any) => {
      track('game:marriageDeclared', data);
    });

    this.socket.on('game:roundEnd', (data: any) => {
      track('game:roundEnd', data);
      this.lastRoundResult = data;
    });

    this.socket.on('game:ended', (data: any) => {
      track('game:ended', data);
      this.gameEnded = true;
      this.gameEndData = data;
    });

    this.socket.on('game:error', (error: any) => {
      track('game:error', error);
      this.lastError = error;
    });

    this.socket.on('game:playerPassedAt100', (data: any) => {
      track('game:playerPassedAt100', data);
    });

    this.socket.on('game:playerThrew', (data: any) => {
      track('game:playerThrew', data);
    });

    this.socket.on('game:wykladana', (data: any) => {
      track('game:wykladana', data);
    });

    this.socket.on('game:paused', (data: any) => {
      track('game:paused', data);
    });

    this.socket.on('game:resumed', (data: any) => {
      track('game:resumed', data);
    });
  }

  // --- Connection ---

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10_000);
      this.socket.on('connect', () => { clearTimeout(timeout); resolve(); });
      this.socket.on('connect_error', (err) => { clearTimeout(timeout); reject(err); });
      this.socket.connect();
    });
  }

  disconnect() {
    this.socket.disconnect();
  }

  get connected() {
    return this.socket.connected;
  }

  // --- Room actions ---

  createRoom(roomName = 'Test Room', maxPlayers: 3 | 4 = 3): Promise<RoomData> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('createRoom timeout')), 10_000);

      const onCreated = (data: any) => {
        clearTimeout(timeout);
        this.socket.off('room:error', onError);
        resolve(data);
      };
      const onError = (error: any) => {
        clearTimeout(timeout);
        this.socket.off('room:created', onCreated);
        reject(new Error(error.message));
      };

      this.socket.once('room:created', onCreated);
      this.socket.once('room:error', onError);
      this.socket.emit('room:create', {
        playerName: this.playerName,
        roomName,
        isPrivate: false,
        maxPlayers,
      });
    });
  }

  joinRoom(roomCode: string): Promise<RoomData> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('joinRoom timeout')), 10_000);

      const onJoined = (data: any) => {
        clearTimeout(timeout);
        this.socket.off('room:error', onError);
        resolve(data.room);
      };
      const onError = (error: any) => {
        clearTimeout(timeout);
        this.socket.off('room:joined', onJoined);
        reject(new Error(error.message));
      };

      this.socket.once('room:joined', onJoined);
      this.socket.once('room:error', onError);
      this.socket.emit('room:join', {
        playerName: this.playerName,
        roomCode,
      });
    });
  }

  ready(): void {
    this.socket.emit('room:ready', true);
  }

  unready(): void {
    this.socket.emit('room:ready', false);
  }

  addAI(): void {
    this.socket.emit('room:addAI');
  }

  removeAI(aiId: string): void {
    this.socket.emit('room:removeAI', aiId);
  }

  startGame(): void {
    this.socket.emit('room:startGame');
  }

  leaveRoom(): void {
    this.socket.emit('room:leave');
  }

  // --- Game actions ---

  bid(amount: number): void {
    this.socket.emit('game:bid', amount);
  }

  pass(): void {
    this.socket.emit('game:pass');
  }

  playCard(card: Card): void {
    this.socket.emit('game:playCard', card);
  }

  confirmTalon(): void {
    this.socket.emit('game:confirmTalon');
  }

  confirmWykladana(): void {
    this.socket.emit('game:confirmWykladana');
  }

  playOrPass(decision: 'play' | 'pass'): void {
    this.socket.emit('game:playOrPass', decision);
  }

  distributeTalon(distribution: { playerId: string; card: Card }[]): void {
    this.socket.emit('game:distributeTalon', distribution);
  }

  declareMarriage(suit: Suit): void {
    this.socket.emit('game:declareMarriage', suit);
  }

  // --- Helpers ---

  /** Returns the valid playable cards from current validActions */
  getPlayableCards(): Card[] {
    const playAction = this.validActions.find(a => a.type === 'playCard') as
      | { type: 'playCard'; validCards: Card[] }
      | undefined;
    return playAction?.validCards ?? [];
  }

  /** Returns the bid action if available */
  getBidAction(): { type: 'bid'; minBid: number; maxBid: number } | undefined {
    return this.validActions.find(a => a.type === 'bid') as any;
  }

  /** Returns whether this player can pass */
  canPass(): boolean {
    return this.validActions.some(a => a.type === 'pass');
  }

  /** Returns whether this player has a playOrPass decision */
  hasPlayOrPassDecision(): boolean {
    return this.validActions.some(a => a.type === 'playOrPass');
  }

  /** Returns available marriage suits */
  getMarriageSuits(): Suit[] {
    const action = this.validActions.find(a => a.type === 'declareMarriage') as
      | { type: 'declareMarriage'; suits: Suit[] }
      | undefined;
    return action?.suits ?? [];
  }

  /** Get my hand from game state */
  get myHand(): Card[] {
    return this.gameState?.myHand ?? [];
  }

  /** Get current phase */
  get phase(): GamePhase | null {
    return this.gameState?.phase ?? null;
  }

  /** Whether it's my turn (I have valid actions) */
  get isMyTurn(): boolean {
    return this.validActions.length > 0;
  }

  /** Wait for a specific game phase */
  waitForPhase(phase: GamePhase, timeout = 30_000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.gameState?.phase === phase) return resolve();

      const timer = setTimeout(() => {
        this.socket.off('game:stateUpdate', onUpdate);
        this.socket.off('game:phaseChange', onPhase);
        reject(new Error(`Timeout waiting for phase "${phase}" (current: "${this.gameState?.phase}")`));
      }, timeout);

      const check = (p: string) => {
        if (p === phase) {
          clearTimeout(timer);
          this.socket.off('game:stateUpdate', onUpdate);
          this.socket.off('game:phaseChange', onPhase);
          resolve();
        }
      };

      const onUpdate = (state: any) => check(state.phase);
      const onPhase = (p: any) => check(p);

      this.socket.on('game:stateUpdate', onUpdate);
      this.socket.on('game:phaseChange', onPhase);
    });
  }

  /** Wait until it's this player's turn (receives yourTurn event) */
  waitForTurn(timeout = 30_000): Promise<ValidAction[]> {
    return new Promise((resolve, reject) => {
      // If we already have valid actions and it looks like our turn, resolve
      if (this.validActions.length > 0 && this.isCurrentTrickPlayer()) {
        return resolve(this.validActions);
      }

      const timer = setTimeout(() => {
        this.socket.off('game:yourTurn', onTurn);
        reject(new Error(`Timeout waiting for turn (player: ${this.playerName})`));
      }, timeout);

      const onTurn = (data: any) => {
        clearTimeout(timer);
        resolve(data.validActions);
      };

      this.socket.once('game:yourTurn', onTurn);
    });
  }

  /** Wait for a specific event */
  waitForEvent(eventName: string, timeout = 15_000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.off(eventName, onEvent);
        reject(new Error(`Timeout waiting for event "${eventName}"`));
      }, timeout);

      const onEvent = (data: any) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.socket.once(eventName as any, onEvent);
    });
  }

  /** Wait for room:updated event */
  waitForRoomUpdate(timeout = 10_000): Promise<RoomData> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.off('room:updated', onUpdate);
        reject(new Error('Timeout waiting for room update'));
      }, timeout);

      const onUpdate = (room: any) => {
        clearTimeout(timer);
        resolve(room);
      };

      this.socket.once('room:updated', onUpdate);
    });
  }

  /** Wait for game:roundEnd event */
  waitForRoundEnd(timeout = 60_000): Promise<RoundResult> {
    return new Promise((resolve, reject) => {
      if (this.lastRoundResult) {
        const result = this.lastRoundResult;
        this.lastRoundResult = null;
        return resolve(result);
      }

      const timer = setTimeout(() => {
        this.socket.off('game:roundEnd', onEnd);
        reject(new Error('Timeout waiting for round end'));
      }, timeout);

      const onEnd = (data: any) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.socket.once('game:roundEnd', onEnd);
    });
  }

  /** Wait for game:ended event */
  waitForGameEnd(timeout = 120_000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.gameEnded) return resolve(this.gameEndData);

      const timer = setTimeout(() => {
        this.socket.off('game:ended', onEnd);
        reject(new Error('Timeout waiting for game end'));
      }, timeout);

      const onEnd = (data: any) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.socket.once('game:ended', onEnd);
    });
  }

  /** Check if this player is the current trick player */
  private isCurrentTrickPlayer(): boolean {
    return this.gameState?.round?.currentTrick?.currentPlayer === this.playerId;
  }

  /** Get all logged events of a specific type */
  getEvents(eventName: string): EventLogEntry[] {
    return this.eventLog.filter(e => e.event === eventName);
  }

  /** Clear valid actions (useful after taking an action) */
  clearActions() {
    this.validActions = [];
  }

  /** Reset state between games */
  resetGameState() {
    this.gameState = null;
    this.validActions = [];
    this.lastRoundResult = null;
    this.lastError = null;
    this.gameEnded = false;
    this.gameEndData = null;
    this.eventLog = [];
  }
}

/** Small delay helper */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Card equality check */
export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Pretty-print a card */
export function cardStr(card: Card): string {
  const suitSymbol: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  return `${card.rank}${suitSymbol[card.suit]}`;
}
