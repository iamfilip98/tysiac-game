# Tysiąc cutover checklist

**Every step below is OWNER-GATED.** No agent, script or CI job may perform any of them without the owner
explicitly saying "yes, do step N" in the conversation. Each step is done on its own, then checked, before moving to the next.
Record each one as `- [x] N. … (YYYY-MM-DD, confirmed by owner)`.

## Before step 0. Push `rebuild` and check CI — OWNER-GATED
- The owner pushes `rebuild` to origin (`git push -u origin rebuild`) and checks that both CI jobs (`check` and `e2e`) go green on GitHub. CI has never run there yet.
- Expect a failing "Vercel" preview check on the push and on any PR: `vercel.json` still builds `apps/web`, which is excluded from the workspace. This is expected and harmless; step 1 removes the cause.

## 0. Ready check (no changes)
- [ ] M4 merged into `rebuild`; CI green on `rebuild` (typecheck, unit, build budget, e2e local, e2e worker).
- [ ] `pnpm --filter @tysiac/worker ship` deployed the current `rebuild` to https://tysiac.iamfilip98.workers.dev and its smoke test passed.
- [ ] The owner played a full game on the iPhone home-screen app (portrait and landscape), and a friend went through Learn to play.

## 1. Vercel: send the old app to the new URL — OWNER-GATED
This goes first, so that merging into `main` later can't break a Vercel build of `apps/web`.
- Option A (no code): Vercel dashboard → project → Settings → Domains → each domain → "Redirect to" `tysiac.iamfilip98.workers.dev` (307 to start with, 308 once the owner is happy). First check that "Redirect to" accepts an external `*.workers.dev` host; it may only offer domains attached to the same project. If it doesn't, use Option B.
- Option B (code, on a branch the owner chooses): replace `vercel.json` with
  `{"$schema":"https://openapi.vercel.sh/vercel.json","redirects":[{"source":"/(.*)","destination":"https://tysiac.iamfilip98.workers.dev/$1","permanent":false}]}`
  and set the project's Framework to "Other" with no build command.
- Check: opening the old URL and an old `/game/...` link both land on the new app.
- [x] 1. Done with option B (2026-10-13, owner asked to clean up the Vercel link): 307 redirect verified for / and /game/:code.

## 2. Merge `rebuild` → `main` — OWNER-GATED
- `gh pr create --base main --head rebuild --title "Tysiąc rebuild (Cloudflare)"`; the owner reviews and merges.
- Check: CI is green on `main`; Vercel (if still connected) only redirects.

## 3. Render shutdown — OWNER-GATED
- First ask the owner whether the old Postgres data (`DATABASE_URL` of `tysiac-server`) should be exported. If so: `pg_dump "$DATABASE_URL" > tysiac-legacy-$(date +%F).sql`, stored outside the repo.
- Render dashboard → `tysiac-server` → Suspend, then wait for the owner to confirm nothing broke, then Delete. Delete the Postgres instance only after a separate confirmation.
- Railway (`railway.json`): ask whether a Railway service still exists; if it does, remove it the same way.
- Check: the new app is unaffected (it never calls Render).

## 4. Delete legacy code — OWNER-GATED (one PR)
Remove: `apps/web`, `apps/server`, `packages/shared`, `packages/game-logic`, root `tests/`, root `playwright.config.ts`, `vercel.json` (unless option B is still in use), `render.yaml`, `railway.json`, `turbo.json`, and the four `!…` exclusions in `pnpm-workspace.yaml`; update `README.md` to describe the new stack.
- Run `pnpm install` (the lockfile shrinks), `pnpm typecheck`, `pnpm test` and `pnpm --filter @tysiac/app build`; CI must be green before merging.

## 5. Deploy on push to `main` — OWNER-GATED
- The owner creates a Cloudflare API token for account 28218e648f55d8177931a703d4da7292 and adds it as the GitHub secret `CLOUDFLARE_API_TOKEN`, plus `DEBUG_KEY` (the same value as in `apps/worker/.secrets.json`). `ship` (`apps/worker/scripts/deploy.mjs`) makes these calls, so the token needs:
  - `wrangler whoami`: Account Settings: Read and User Details: Read (it must list the account id);
  - `wrangler auth token --json`: no extra permission (it returns the token from the environment);
  - `GET`/`PUT /workers/subdomain`: Workers Scripts: Edit;
  - D1 list/create (`/d1/database`) and `wrangler d1 migrations apply --remote`: D1: Edit;
  - `wrangler deploy` (script and static assets): Workers Scripts: Edit.
  If `whoami` fails with the token, give the deploy job the explicit steps below instead of `ship`.
- Add a `deploy` job to `.github/workflows/ci.yml` that runs only on `push` to `main`, `needs: [check, e2e]`, with its own concurrency group so a newer push never cancels a deploy in progress:
  `concurrency: { group: deploy-production, cancel-in-progress: false }`.
- Its steps, in order (CI has no `.secrets.json`, and `ship` would otherwise generate a new key and deploy it, which would lock the owner out of the debug API):
  1. Checkout, `pnpm install --frozen-lockfile`.
  2. Write the key: `printf '{"DEBUG_KEY":"%s"}' "$DEBUG_KEY" > apps/worker/.secrets.json` with `DEBUG_KEY: ${{ secrets.DEBUG_KEY }}` in the step's `env` (never echo it), then `pnpm --filter @tysiac/worker ship` with `CLOUDFLARE_API_TOKEN` in `env`.
  3. Or, without `ship`: `pnpm --filter @tysiac/worker exec wrangler d1 migrations apply tysiac --remote`, `pnpm --filter @tysiac/app build`, `pnpm --filter @tysiac/worker exec wrangler deploy --secrets-file .secrets.json`, then `node apps/worker/scripts/smoke.mjs https://tysiac.iamfilip98.workers.dev --require-app`. (`ship` also does the wrangler.jsonc `database_id` lookup and `ensure-local.mjs`; check that `wrangler.jsonc` already holds the real `database_id` before taking this route.)
- Check: a trivial push to `main` deploys, smoke passes, and the debug API still accepts the existing key.

## 6. Afterwards
- CLAUDE.md already documents the Worker debugging (M4 Task 5); remove any leftover mention of Render/Fastify if one is found.
- Remove stale worktrees (`git worktree list`; `git worktree remove …`), only those the owner names.
