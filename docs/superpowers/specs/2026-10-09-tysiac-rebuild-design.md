# Tysiąc rebuild — design spec

Date: 2026-10-09 · Branch: `rebuild` · Status: approved by owner ("write spec and build it")

## 1. Goals

Rebuild the Tysiąc (1000) multiplayer card game so it:

- opens in < 1 s from the iPhone home screen on repeat visits (< 2 s first visit on 4G),
- never shifts, clips or scrolls the game screen on any phone (portrait primary, landscape supported),
- plays a card instantly (optimistic) with ~1 s of pacing per trick instead of ~3 s,
- is hosted **for free** with limits that reset **daily** (Cloudflare Workers free plan, no card),
- keeps the existing house rules exactly (see §3), the bots, and adds a coach + scripted tutorial for new players,
- is for friends playing via shared link (sometimes physically together), not strangers.

Non-goals (dropped): Clerk accounts, matchmaking/quick play, public room browser, Elo/ranked, emotes, Storybook, Postgres/Drizzle, Socket.io, Next.js. Old code remains in git history.

## 2. Architecture

```
one Cloudflare Worker (single deploy, single origin, e.g. tysiac.<sub>.workers.dev)
├─ static assets: Vite + React SPA (PWA, service-worker cached, SPA fallback)
├─ POST /api/rooms            → create room, returns code
├─ GET  /ws/:code             → WebSocket upgrade → Room Durable Object (one per room)
├─ GET  /api/history?player=  → D1: finished games, head-to-head, leaderboard
└─ GET  /api/debug/rooms/:code (header x-debug-key = secret DEBUG_KEY) → room state + action log
```

Repo (pnpm workspace, TypeScript strict everywhere):

```
packages/engine/     pure TS, zero runtime deps: cards, rules config, reduce, legalActions,
                     viewFor, wykladana, scoring, bots (AI), coach, seeded RNG. Vitest.
packages/protocol/   client↔server message types + zod schemas for client messages.
apps/worker/         Worker entry, Room DO (SQLite-backed), D1 schema/migrations, wrangler.jsonc.
                     Tests with @cloudflare/vitest-pool-workers.
apps/app/            Vite + React SPA. zustand, motion (LazyMotion + domAnimation), CSS variables
                     for themes, vite-plugin-pwa. Playwright (webkit) e2e in apps/app/e2e.
```

Delete after port: `apps/web`, `apps/server`, `packages/shared`, `packages/game-logic`, root `tests/`, `playwright.config.ts`, `vercel.json`, `render.yaml`, `railway.json`, `turbo.json` (replace with plain pnpm scripts) — once the new code covers them.

Cloudflare constraints to respect (free plan): Durable Objects must be **SQLite-backed** (`new_sqlite_classes` migration); use the **WebSocket Hibernation API** (`ctx.acceptWebSocket`, `webSocketMessage`, `serializeAttachment`) so idle rooms bill no duration; a DO has **one alarm** — keep a small schedule (bot move, away-timeout, cleanup) in storage and set the alarm to the earliest entry. Daily limits: 100k requests (WS messages count 20:1), 100k SQLite row writes, 13k GB-s duration — far above friend-group usage.

## 3. Rules (source of truth = original `apps/server/src/game/*`, confirmed by owner)

Deck 24 cards: 9,10,J,Q,K,A × ♣♦♥♠. Points A11 10:10 K4 Q3 J2 9:0 (120/round). Strength A>10>K>Q>J>9.
Marriages (K+Q same suit): ♥100 ♦80 ♣60 ♠40.

Players 3 or 4. Seat order = clockwise order chosen in lobby. 4 players: dealer sits out each round.

1. **Deal**: dealer = chosen first dealer for round 1, then next seat clockwise each round (also advances after a pass-at-100 redeal). 7 cards to each of the 3 active players, 3 to talon. Redeal (new shuffle) while any active hand has < 18 points and no marriage.
2. **Bidding**: first active player left of dealer automatically holds 100. Bidding starts with the next active player and goes clockwise among active players. On your turn: **Bid (current + 10)** or **Pass** — no other amounts. Max bid = 120 + total marriage value in your hand; if current+10 exceeds it, only Pass. The current high bidder is skipped. Passed players are out. Bidding ends when two players have passed; the high bidder wins (if both others pass immediately, the auto-100 player wins at 100).
3. **Talon**: if the winning bid is 100 only the bidder sees the talon; if > 100 it is revealed to all. Talon goes into the bidder's hand (10 cards).
4. **Play or throw**: bidder decides. Throw at 100 → no score change, redeal (next round number, dealer advances). Throw at > 100 → bidder −bid; each other active player +⌊120 / others⌋ (=60) unless on the barrel (0); then next round.
5. **Hand-out**: bidder gives exactly 1 card to each other active player (8 cards each).
6. **Wykładana**: immediately after hand-out, if the bidder's 8 cards guarantee all 8 tricks (algorithm in original `wykladana.ts`, ported verbatim with its doc comment): round ends; bidder gets 120 trick points + all marriages in hand (trump = first marriage found). Celebrated in UI; not a blocking step.
7. **Tricks**: bidder leads trick 1; trick winner leads next. Everyone must follow the led suit if able. **Only the first player to respond after the leader must beat the lead card if able** (with a higher card of the led suit; if the led suit is trump, a higher trump). The remaining player only follows suit. If you cannot follow suit you may play anything (no obligation to trump). Winner: highest trump if any trump played, else highest card of the led suit.
8. **Marriage**: leading a Q while holding the K of that suit (not yet declared) automatically declares it: +value to the player, that suit becomes trump immediately (including for this trick). Allowed on any trick including the first. Marriage points count only if the player wins ≥ 1 trick.
9. **Scoring** (round to 10: remainder ≥ 6 rounds up, else down):
   - Bidder: made if raw (tricks + counted marriages) ≥ bid — rounding never helps. Made → +round(raw). Failed → −bid.
   - Defenders: +round(tricks + counted marriages); 0 if on the barrel.
   - 4-player sitting-out dealer: +round(talon marriages + 50 per ace in talon); 0 if on the barrel.
   - Scores may go negative.
10. **Barrel**: score ≥ 800 and < 1000. No attempt limit. On the barrel you score only as bidder (defending/sitting out = 0). Failing a bid can drop you below 800.
11. **Win**: after scoring, anyone ≥ 1000 wins. If several: the bidder if among them, else highest score, else first clockwise from the bidder.

Rules live in one `RULES` config object (numbers above) used by engine, rules page and coach text. Port the original 94 tests in `validation.test.ts`/`scoring.test.ts` (adapting signatures) — they must pass unchanged in meaning, except the README-only claims that contradict §3.

## 4. Engine (`packages/engine`)

All state in one JSON-serializable object — nothing on the side.

```ts
type Phase = 'lobby' | 'bidding' | 'decision' | 'handout' | 'tricks' | 'roundEnd' | 'gameEnd';
interface GameState {
  v: 1; seq: number;               // increments on every accepted action
  rng: string;                     // seeded RNG state (deterministic shuffles)
  seats: Seat[];                   // clockwise: {id, name, avatar, isBot, botFor?: string}
  firstDealer: number; maxPlayers: 3|4;
  phase: Phase; round: Round | null;
  scores: Record<PlayerId, {total: number; history: number[]}>;
  rounds: RoundSummary[];          // for score sheet + history
  paused: { by: PlayerId; at: number } | null;
  winner: PlayerId | null;
}
interface Round { number; dealer; active: PlayerId[]; hands; talon; talonPublic: boolean;
  bid: { high: PlayerId; amount: number; turn: PlayerId | null; passed: PlayerId[] };
  trump: Suit | null; marriages: Record<PlayerId, Suit[]>; trick: {leader; cards: {p, card}[]};
  tricksWon: Record<PlayerId, Card[][]>; handoutGiven: Record<PlayerId, Card> | null; lastTrick?: ... }
```

API (pure, no I/O, no Date.now — time passed in):

- `createGame(opts: {seed, seats, maxPlayers, firstDealer}): GameState`
- `reduce(state, playerId, action, now): { ok: true; state; events: GameEvent[] } | { ok: false; error: RuleError }` — atomic; rejects anything not in `legalActions`.
- `legalActions(state, playerId): Action[]`
- `viewFor(state, playerId): PlayerView` — the only data that leaves the server: own hand, opponents' card counts, talon only when allowed, current trick, trump, scores, bids, last completed trick, cards played this round (public), whose turn, legal actions for this viewer.
- `explainIllegal(view, card): string` — e.g. "You must follow ♦", "First to respond must beat K♦ if you can".
- `botAction(view, rng): Action` — port of original `apps/server/src/ai/index.ts` heuristics; sees only its view.
- `advise(view): Advice` — `{ action, headline, reasons: string[] }` for bid/decision/handout/play; plus `explainEvent(event, view): string | null` for trick won by trump, marriage → trump, round scoring breakdown, throw/pass outcomes.

Actions: `bid`, `pass`, `play` (decision: play), `throw` (decision: throw), `handout {to: Record<PlayerId, Card>}`, `card {card}`, `pause`, `resume`. Lobby/seat/bot management is room-level, not engine.

Events (for animation & coach): `dealt`, `bid`, `passed`, `biddingWon`, `talonRevealed`, `threw`, `handedOut`, `wykladana`, `cardPlayed`, `marriage`, `trickWon`, `roundScored`, `gameWon`, `paused`, `resumed`. Events carry only info the recipient may see (filter per player like views).

Tests: ported rule/scoring tests; per-phase reducer tests; **simulation** of ≥ 2,000 seeded bot-vs-bot games (3p and 4p) asserting: 24 cards conserved, 120 trick points per played round, every applied action was legal, scores follow §3, `viewFor` never contains another player's hand or a hidden talon, games terminate; coach scenario tests; wykładana cases from original tests.

## 5. Protocol (`packages/protocol`)

JSON over WebSocket. Client → server (validated by zod):

```
hello   { playerId, secret, name, avatar }          // first message; claims/reclaims seat
act     { id, action }                               // engine action; id echoes in ack/reject
lobby   { op: 'addBot' | 'removeBot' | 'swapSeats' | 'setFirstDealer' | 'start', ... }  // host-only except swapSeats (anyone)
botFor  { playerId }                                 // let a bot play for an away player (after 30 s away)
rematch {}
ping    {}
```

Server → client:

```
room    { code, maxPlayers, hostId, seats: [{id,name,avatar,isBot,connected,awaySince?,coach?}], firstDealer, status }
state   { seq, view: PlayerView, events: GameEvent[] }   // after every change, personalised
reject  { id, error }                                     // illegal action → client rolls back optimistic move
error   { message }
```

Reconnect: client auto-reconnects with backoff (0.5 s → 5 s), re-sends `hello`, receives current `room` + `state` (events empty). The client never derives turn order itself.

## 6. Room Durable Object (`apps/worker`)

- Created via `POST /api/rooms {maxPlayers, playerId, name}` → code from alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (6 chars), `idFromName(code)`, init (retry on collision). Creator is host.
- **Identity**: device has `playerId` (uuid) + `secret` (uuid) in localStorage. Room stores `sha256(secret)` per seat; a `hello` with a known playerId must match. Seat claims are first-come until full.
- **Lobby**: seats in clockwise order; anyone may swap seats; host adds/removes bots (names: "Bot Basia", "Bot Zenek", "Bot Halina"), picks first dealer, presses Start when all seats filled. Rematch keeps seats and rotates first dealer.
- **Away handling**: on socket close mark seat `awaySince`. Game waits. After 30 s anyone may send `botFor` → bot plays for that seat until the player reconnects, then control returns automatically. No automatic replacement.
- **Pause**: blocks all engine actions; any player can resume.
- **Bots**: after each state change, if the player to act is a bot (or bot-for), schedule a bot move at `now + delay` (600–900 ms; +1100 ms when the previous event was `trickWon`, +1500 ms after `roundScored`) via the alarm schedule.
- **Persistence**: after every accepted action write `{state, log entry}` to DO SQLite storage (state as one value, action log append, capped at 5,000 entries; log = seed + actions → deterministic replay). On wake, load state. Cleanup alarm deletes room storage 7 days after last activity.
- **History**: on `gameWon`, insert into D1 (see §8). Errors here never affect the game.
- **Rate limit**: ≤ 20 messages/s per socket; messages > 4 KB rejected.

## 7. App (`apps/app`)

**Screens**: Home (first launch: name + avatar emoji; then New game [3|4 players], Join with code, Practice vs bots, Learn to play, History, Settings; Resume banner for an active room) · Lobby · Game · History · Settings · Rules. Routing: `/`, `/r/:code`, `/history`, `/learn`. Opening `/r/:code` asks for name if missing then joins.

**Game layout** (portrait) — one CSS grid filling `100dvh` (fallback: `--vvh` from `visualViewport`), `body` not fixed, no nested scroll, never scrolls:

```
[safe-top] [top bar: menu · round/contract/trump · scores] [opponents row]
[table: talon / trick / last trick] [action zone (reserved height)] [hand] [safe-bottom]
```

- Card size from CSS `clamp()`/`min(vw, dvh)`; no JS screen-size hooks; no SSR (static SPA), so no layout flip.
- Landscape (`orientation: landscape` and short height): two columns — table left; action zone + hand right.
- Safe-area insets on all four sides. Text inputs only on Home/Lobby (which scroll normally).
- Action zone per phase: bidding (current bid + who, "Your max: N (120 + marriages)", **Pass** / **Bid N+10**, Bid hidden when over max), decision (**Play** / **Throw in**, with cost text), hand-out (tap card → tap opponent; given card shown under them with ✕; **Confirm** enabled when complete), tricks (**Play X♦** button, coach note), waiting states ("Kuba is bidding…").
- **Card play**: tap raises a card (tap another moves selection, tap raised lowers). The **Play** button (names the card) commits. Never play by tapping a card. Wider visible hit strips; illegal cards dimmed, tap shows reason. On Play the card flies to the table immediately; on `reject` it returns with a shake.
- **Opponents**: avatar, name, score, card-count fan, bid chip / "pass", turn ring, away badge, 🎓 if coach on.
- **Score sheet**: top-right opens a sheet styled as a *zapis* (round-by-round, barrel markers, bids).
- **Round result / game over**: slide-up sheets; game over shows winner, final scores, a few stats (bids made/failed, marriages, best round) and **Rematch**.
- **Animation**: each card is one element with shared `layoutId` travelling hand → table → winner pile (spring). Event queue plays server events in order; trick stays visible ~1 s then sweeps. No infinite decorative animations, minimal `backdrop-filter`. Respects `prefers-reduced-motion` + speed setting.
- **Themes** (Settings, CSS variables on `<html data-theme>`, persisted): **Brass & Baize** (default: deep green felt, ivory cards, serif Fraunces indices, brass accent), **Wycinanki** (cream paper, navy ink, folk red, outlined cards with offset shadow, Young Serif), **Midnight** (near-black, white cards, coral accent, Inter). Visual reference: `.superpowers/brainstorm/*/content/visual-direction-v2.html` and `phases-v3.html`.
- **Settings**: theme, sound on/off, coach on/off, animation speed (normal/fast), rules, change name/avatar.
- **Sounds**: small set of real samples (card snap, shuffle, trick sweep, your-turn) from Kenney "Casino Audio" (CC0), committed under `apps/app/public/sounds`.
- **PWA**: manifest (standalone, theme colors, icons incl. apple-touch-icon), service worker precaches app shell + fonts (self-hosted via @fontsource) + sounds; `apple-mobile-web-app-capable`.
- **Performance budget**: initial JS ≤ 120 KB gzip; Lobby/Game/History/Learn lazy-loaded.

## 8. History (D1)

```sql
players(id TEXT PK, name TEXT, avatar TEXT, last_seen INTEGER)
games(id TEXT PK, room_code TEXT, player_count INTEGER, started_at INTEGER, finished_at INTEGER,
      winner_id TEXT, rounds_json TEXT)
game_players(game_id TEXT, player_id TEXT, seat INTEGER, is_bot INTEGER, final_score INTEGER, won INTEGER,
      PRIMARY KEY(game_id, player_id))
```

`GET /api/history?player=<id>` → recent games (20), head-to-head W/L vs each human opponent, leaderboard among people you've played with (games, wins, win %). Bot games listed but excluded from leaderboard.

## 9. Coach & tutorial

- Coach on by default in Practice and for a device's first 3 games; per-player setting; private (only you see hints; others see 🎓).
- Shown in action zone as one line ("Coach: …") with **Why?** opening a sheet with `reasons`. Recommended card gets a thin accent outline. Event explanations appear briefly in the action zone.
- **Learn to play** (`/learn`): local-only (engine runs in the browser, no server) scripted round on a fixed seed vs 2 bots with forced actions and explanation steps: card values → bidding with a marriage → talon & play decision → hand-out → lead Q to declare marriage/trump → follow suit + first-responder-must-beat → tricks → scoring (made bid, rounding, barrel, win). Ends with **Practice with coach** (real room vs 2 bots, coach on).
- Practice vs bots uses a normal room (host + bots) so it behaves exactly like real games.

## 10. Testing & CI

- Engine: unit + ported tests + simulation + coach scenarios (vitest).
- Worker: `@cloudflare/vitest-pool-workers` — create/join, seat swap/first dealer/start, bot turns via alarms, disconnect → away → botFor → reclaim, pause blocks actions, persistence across DO restart, rematch, history insert.
- App: Playwright with WebKit on iPhone SE (375×667), iPhone 15/16 (393×852), Pro Max (440×956), landscape (852×393), desktop (1280×800): full game vs bots via UI; every phase asserts no element outside viewport and no document scroll; focusing name input then blurring leaves `scrollY === 0`.
- GitHub Actions: typecheck, unit, worker tests, e2e (against `wrangler dev`). Deploy on push to `main` with `CLOUDFLARE_API_TOKEN` secret (set up at cutover).

## 11. Rollout

1. Build on `rebuild`; old Vercel/Render app untouched.
2. Deploy with wrangler (already authenticated on the owner's machine) to `*.workers.dev`; create D1 db; set `DEBUG_KEY` secret.
3. Owner plays on iPhone. Then cutover: old Vercel app replaced by a redirect to the new URL; Render service/DB shut down (owner confirms); merge `rebuild` → `main`; update CLAUDE.md debug section.

## 12. Build order (each milestone tested before the next)

1. Engine (rules port, reducer, views, bots, simulation tests).
2. Protocol + Worker + Room DO + D1 + deploy pipeline.
3. App shell, Home/Lobby (seat ordering), Game screen + all phases, animations, themes, PWA → first playable deploy.
4. Coach, tutorial, rules page.
5. History screen, e2e suite, CI, cleanup of old code, docs.

## 13. Acceptance criteria

- Full 3- and 4-player games playable on iPhone Safari home-screen app with friends and bots; rules match §3.
- No layout shift/clipping/scroll on the listed viewports in any phase; keyboard never leaves the page offset.
- Repeat open < 1 s; Play → card moves < 50 ms; ~1 s pause per trick.
- Room survives Worker redeploy mid-game; reconnect restores state.
- $0 hosting on Cloudflare free plan.
