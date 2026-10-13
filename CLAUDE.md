# Claude Code Notes

## Debugging game issues (Cloudflare Worker `tysiac`)

Live: https://tysiac-game.pages.dev (the public link; a Pages front in `apps/front` forwards everything to the Worker through a service binding). The Worker itself is also reachable at https://tysiac.iamfilip98.workers.dev. One Worker (`apps/worker`) serves the app, `/api/*` and `/ws/:code`. `tysiac-game.vercel.app` (the old app) 307-redirects to the pages.dev link via `vercel.json`. Each room is a Durable Object (SQLite storage), and finished games go to D1 (`tysiac`). The old Render/Fastify server and its `/debug/*` API are retired, so don't use them.

When the user reports a game issue:
1. **Get the room code.** It is 6 characters and appears in the lobby and in the URL `/r/CODE`.
2. **Dump the room.** The key is `DEBUG_KEY` in `apps/worker/.secrets.json` (gitignored, written by `pnpm --filter @tysiac/worker ship`). Never print, log or commit it. If this checkout has no `.secrets.json`, copy it from `apps/worker/.secrets.json` in the main checkout (`/Users/filip/Code/tysiac-game`), or from the owner's password manager. Running `ship` without it generates and deploys a new key.
   ```bash
   KEY=$(node -p "require('./apps/worker/.secrets.json').DEBUG_KEY")
   curl -s -H "x-debug-key: $KEY" https://tysiac.iamfilip98.workers.dev/api/debug/rooms/CODE \
     | jq '{meta, phase: .state.phase, seq: .state.seq, schedule, connected, lastActions: .log[-15:]}'
   ```
   The response is `{ meta, state, gameOptions, log, schedule, connected }`:
   - `meta`: seats, host and status
   - `state`: the full engine `GameState`, including hidden hands
   - `gameOptions`: seed, seats and first dealer
   - `log`: the action log, at most 5,000 entries
   - `schedule`: the bot, away and cleanup alarm entries
   - `connected`: the player ids with a live socket

   A 404 means a wrong key or no such room. Rooms are deleted 7 days after the last activity.
3. **Live logs:** `cd apps/worker && pnpm exec wrangler tail tysiac --format pretty` (narrow it with `--status error` or `--search "history insert failed"`). Older logs are in the Cloudflare dashboard → Workers & Pages → tysiac → Logs (observability is on).
4. **Finished games:** `curl -s "https://tysiac.iamfilip98.workers.dev/api/history?player=<playerId>"`, or query D1 directly:
   `cd apps/worker && pnpm exec wrangler d1 execute tysiac --remote --command "SELECT id, room_code, winner_id, datetime(finished_at/1000,'unixepoch') AS finished FROM games ORDER BY finished_at DESC LIMIT 10"`
5. **Reproduce:** the game is deterministic. Replay `gameOptions` plus the `log` actions with `createGame`/`reduce` from `@tysiac/engine` in a vitest under `packages/engine/test`, and assert what went wrong. Action logs from before the talon-confirmation change (protocol v2) with a bid above 100 won't replay on the current engine; replay them against the commit before 0a0311c.
6. Find the root cause before changing code. The rules live in `packages/engine` (the source of truth). The app never re-implements them.

Local: `pnpm --filter @tysiac/worker dev` runs wrangler dev on :8787, with `DEBUG_KEY` in `apps/worker/.dev.vars`. The same debug curl works against `http://127.0.0.1:8787`. Real-Worker e2e: `pnpm --filter @tysiac/app e2e:worker`. Deploy: `pnpm --filter @tysiac/worker ship` (it builds the app, deploys and runs a live smoke test).
