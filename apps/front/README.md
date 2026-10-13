# apps/front

The public link https://tysiac-game.pages.dev. A Cloudflare Pages project whose
`_worker.js` forwards every request, WebSockets included, to the `tysiac` Worker
(apps/worker) through a service binding. The app itself is deployed with
`pnpm --filter @tysiac/worker ship`; this front only needs redeploying if these
files change:

    cd apps/front && pnpm exec wrangler pages deploy
