# NIKO leaderboard API (Cloudflare Worker)

A tiny global leaderboard for **NIKO: Guardian of Base**. One Worker + one KV
namespace; fits comfortably in Cloudflare's free tier.

## Deploy option A: from GitHub Actions (easiest)

The repo ships `.github/workflows/deploy-leaderboard.yml`, which creates the
KV namespace and deploys the Worker for you.

1. Create a free Cloudflare account.
2. Create an API token at <https://dash.cloudflare.com/profile/api-tokens>
   using the **"Edit Cloudflare Workers"** template.
3. In the GitHub repo: Settings → Secrets and variables → Actions → add
   `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID` from the dashboard
   sidebar — recommended).
4. Run the **Deploy Leaderboard** workflow from the Actions tab. The run
   summary prints the Worker URL.
5. Set `leaderboardApiUrl` in `src/data/features.ts` to that URL and merge.

Note: if the very first deploy fails mentioning a missing `workers.dev`
subdomain, open the Workers page in the Cloudflare dashboard once (it
registers your subdomain) and re-run the workflow.

## Deploy option B: from your machine

1. `npm i -g wrangler && wrangler login`
2. From this `server/` directory: `npx wrangler kv namespace create SCORES`
   …and paste the printed `id` into `wrangler.toml`.
3. `npx wrangler deploy` — prints the Worker URL.
4. Set `leaderboardApiUrl` in `src/data/features.ts` to that URL and merge.

## API

| Method | Path      | Description |
| ------ | --------- | ----------- |
| GET    | `/scores?key=<board>&limit=10` | Top scores for a board |
| POST   | `/scores` `{ key, player, score, wave, address? }` | Submit a score |

Board keys match the game's local storage keys: `"<mapId>:<difficulty>"`
(campaign) and `"weekly:<isoWeek>"` (Weekly Trench).

## Anti-cheat: current state and roadmap

Baseline protections (implemented):

- Strict payload validation, plausibility cap (score ≤ 3000 × wave reached),
  per-IP hourly rate limit, one entry per player name (best wins), future
  week keys rejected, CORS locked to the game origin.

Honest limitations: a determined cheater can still craft a plausible fake
score — client-submitted scores can never be fully trusted. Before attaching
prizes/tournaments, add (in rough order of value):

1. **Wallet signatures** — require an EIP-191 signature of
   `{key, score, wave}` by `address` (verify with viem in the Worker), so
   entries are at least bound to a real wallet.
2. **Replay validation** — the game engine is deterministic given a seed and
   an input log; submitting the input log lets the server re-simulate and
   verify the score exactly. The Weekly Trench is already seeded, so it's the
   natural first target.
3. **Durable Object per board** — removes the KV read-modify-write race if
   submission volume grows.
