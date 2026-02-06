# Claude Code Notes

## Deployment

### Split deployment: Vercel (web) + Railway (server)
- **Web (Vercel)**: Auto-deploys on every push to main
- **Server (Railway)**: Auto-deploys on every push to main
- Both deploy on `git push` — no manual steps needed
- After deploying server changes that affect game state/validation, tell the user to **start a new game** — existing games may be in a corrupted state from the old code

## Game Rules — Tysiąc Card Validation

These are the correct rules. Do not deviate from them:

1. **Must follow suit** — if you have cards of the lead suit, you must play one
2. **Must beat highest** — when following suit, you must beat the highest card of the lead suit in the trick (not just the lead card) if possible
3. **Must trump** — if you cannot follow suit and have trump cards, you MUST play a trump card
4. **Must overtrump** — when trumping, you must beat any existing trump cards in the trick if possible
5. **Any card** — only if you cannot follow suit AND have no trump cards, you may play any card
6. **Leading** — when leading a trick (playing first), any card is valid

## Animations & Sound

- Sound uses Web Audio API oscillator synthesis (no external files needed). The `SoundManager` in `apps/web/src/lib/sounds.ts` auto-initializes on first play call
- Marriage card effects should be lightweight — use CSS animations, not multiple concurrent Framer Motion infinite animations (causes jank on mobile)
- Deal animation: hide all game elements (opponent hands, player hand, talon) while the deal animation plays, otherwise cards flash on screen before being "dealt"
- Always disable expensive animations on mobile (check `isMobile`)

## Debugging Issues

When the user reports a game issue:
1. **Use the debug API** to find the relevant session/game logs
2. Query the debug endpoints to investigate:
   ```bash
   # List recent games
   curl -H "x-debug-key: $DEBUG_API_KEY" https://[server]/debug/games

   # Get logs for a specific game
   curl -H "x-debug-key: $DEBUG_API_KEY" https://[server]/debug/logs/game/[gameId]

   # Get error logs
   curl -H "x-debug-key: $DEBUG_API_KEY" https://[server]/debug/logs/errors

   # Get logs by event type (e.g., game:bid, game:playCard)
   curl -H "x-debug-key: $DEBUG_API_KEY" https://[server]/debug/logs/event/[eventType]
   ```
3. Analyze the logs to find the root cause before making code changes

## Key Architecture

- Game engine: `apps/server/src/game/engine.ts` — god object, ~1,700 lines
- Card validation: `apps/server/src/game/validation.ts` — `getValidCards()` is the core function
- Socket handlers: `apps/server/src/socket/handlers.ts` — ~1,800 lines
- GameBoard: `apps/web/src/components/game/GameBoard.tsx` — main UI component
- Sound: `apps/web/src/lib/sounds.ts` — synthesized sounds via Web Audio API
- Game events are wired in `apps/web/src/hooks/useSocket.ts`
