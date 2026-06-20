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
| POST   | `/scores` `{ key, player, score, wave, address?, signature? }` | Submit a score |

Board keys match the game's local storage keys: `"<mapId>:<difficulty>"`
(campaign, maps `vaultRun`/`gauntlet`/`fudSpiral`/`doubleCross`) and
`"weekly:<isoWeek>"` (Weekly Trench).

A submission that includes a wallet `address` **must** also include a
`signature`: an EIP-191 (`personal_sign`) signature of the canonical score
message (see `src/eip191.js`). The Worker rebuilds that message and rejects the
entry unless the signature recovers to `address`. Anonymous submissions (no
`address`, no `signature`) are still accepted under a `Wolf-####` name.

Dependencies: `@noble/curves` + `@noble/hashes` (signature recovery). The
deploy workflow runs `npm ci` before `wrangler deploy` so they're bundled; run
`npm test` in this directory to exercise the verification round-trip.

## Anti-cheat: current state and roadmap

Baseline protections (implemented):

- Strict payload validation, plausibility cap (score ≤ 3000 × wave reached),
  per-IP hourly rate limit, one entry per player name (best wins), future
  week keys rejected, CORS locked to the game origin.
- **Wallet signatures** — a claimed `address` must prove ownership with an
  EIP-191 signature over the score, so leaderboard entries that show a wallet
  are bound to that real wallet.

Honest limitations: a determined cheater can still craft a plausible fake
*anonymous* score — client-submitted scores can never be fully trusted. Before
attaching prizes/tournaments, add (in rough order of value):

1. **Replay validation** — the game engine is deterministic given a seed and
   an input log; submitting the input log lets the server re-simulate and
   verify the score exactly. The Weekly Trench is already seeded, so it's the
   natural first target.
2. **Durable Object per board** — removes the KV read-modify-write race if
   submission volume grows.
