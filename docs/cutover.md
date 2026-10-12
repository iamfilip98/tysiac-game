# Tysiąc cutover checklist

**Every step below is OWNER-GATED.** No agent, script or CI job may perform any of them without the owner
explicitly saying "yes, do step N" in the conversation. Each step is done on its own, then checked, before moving to the next.
Record each one as `- [x] N. … (YYYY-MM-DD, confirmed by owner)`.

## 0. Ready check (no changes)
- [ ] M4 merged into `rebuild`; CI green on `rebuild` (typecheck, unit, build budget, e2e local, e2e worker).
- [ ] `pnpm --filter @tysiac/worker ship` deployed the current `rebuild` to https://tysiac.iamfilip98.workers.dev and its smoke test passed.
- [ ] The owner played a full game on the iPhone home-screen app (portrait and landscape), and a friend went through Learn to play.

## 1. Vercel: send the old app to the new URL — OWNER-GATED
This goes first, so that merging into `main` later can't break a Vercel build of `apps/web`.
- Option A (no code): Vercel dashboard → project → Settings → Domains → each domain → "Redirect to" `tysiac.iamfilip98.workers.dev` (307 to start with, 308 once the owner is happy).
- Option B (code, on a branch the owner chooses): replace `vercel.json` with
  `{"$schema":"https://openapi.vercel.sh/vercel.json","redirects":[{"source":"/(.*)","destination":"https://tysiac.iamfilip98.workers.dev/$1","permanent":false}]}`
  and set the project's Framework to "Other" with no build command.
- Check: opening the old URL and an old `/game/...` link both land on the new app.

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
- The owner creates a Cloudflare API token (Workers Scripts edit, D1 edit, account 28218e648f55d8177931a703d4da7292) and adds it as the GitHub secret `CLOUDFLARE_API_TOKEN`, plus `DEBUG_KEY` (the same value as `apps/worker/.secrets.json`).
- Add a `deploy` job to `.github/workflows/ci.yml` that runs only on `push` to `main` after `e2e` and runs `pnpm --filter @tysiac/worker ship` (or `wrangler deploy` with those secrets), followed by `node apps/worker/scripts/smoke.mjs https://tysiac.iamfilip98.workers.dev --require-app`.

## 6. Afterwards
- CLAUDE.md already documents the Worker debugging (M4 Task 5); remove any leftover mention of Render/Fastify if one is found.
- Remove stale worktrees (`git worktree list`; `git worktree remove …`), only those the owner names.
