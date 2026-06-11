# 🐺 NIKO: Guardian of Base

**Defend the Chain. Protect the Pack.**

A browser tower defense game for the NIKO meme coin brand. NIKO — the black
and blue wolf guardian — defends the **Base Vault** against 25 waves of Jeets,
Ruggers, Bot Swarms, Snipers and the dreaded **FUD Beast**.

Built with **React + Vite + TypeScript**, an **HTML5 Canvas** game engine and
**Tailwind CSS** UI. Fully playable on desktop and mobile (tap-to-place
controls). No backend required — high scores persist in local storage.

## Play online

Every merge to `main` auto-deploys to GitHub Pages via
`.github/workflows/deploy.yml` (the same workflow type-checks and builds every
pull request). Once the repository is public and the first deploy has run, the
game is live at:

> https://cryptosuess.github.io/AlphaDefense/

## Running locally

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

Production build:

```bash
npm run build    # type-checks and outputs to dist/
npm run preview  # serve the production build locally
```

## How to play

1. Pick a battlefield (Vault Run / The Gauntlet / FUD Spiral) and a difficulty
   (Pup / Guardian / Alpha Wolf), then press **Defend the Chain**.
2. Press **Start Wave** to send in the next wave (Enter also works).
3. Tap a tower card in the build bar, then tap any open tile to place it.
4. Towers fire automatically; kills earn **Paws 🐾**.
5. Tap a placed tower to **upgrade** (2 upgrade tiers) or **sell** (70% refund).
6. Every 5th wave a **FUD Beast** boss enters the trenches.
7. Survive all **25 waves** to win. If the Vault's health hits zero, game over.
8. After victory, choose **Keep Defending — Endless** to push past wave 25.
   Scaling steepens each endless wave, so every run eventually ends — chase
   the high score (saved per map + difficulty).

Desktop niceties: hover previews tower range before placing, **Space** pauses,
**Enter** starts the next wave. The **2x** button fast-forwards.

## Towers

| Tower           | Role                          | Cost |
| --------------- | ----------------------------- | ---- |
| Diamond Paw     | Balanced single-target DPS    | 50   |
| Pack Scout      | Slows enemies                 | 60   |
| Blue Flame      | Damage over time (burn)       | 80   |
| Howl Cannon     | Splash damage                 | 90   |
| Guardian NIKO   | Hero tower, massive damage    | 250  |

Towers have a player-cyclable **targeting mode** (First / Strong / Close), and
Diamond Paw and Howl Cannon can **specialize** at max level into one of two
final-tier branches (e.g. Alpha Howl's stunning splash vs. Seismic Howl's
massive blast radius).

## Enemies

| Enemy     | Behavior                                          |
| --------- | ------------------------------------------------- |
| Jeet      | Fast, low HP                                      |
| Rugger    | Slow, high HP, costs 2 lives if it leaks          |
| Bot Swarm | Many weak units in rapid succession               |
| Sniper    | Fast; 30% chance to dodge direct hits             |
| Shiller   | Heals nearby enemies (aura) — focus it down first |
| FUD Beast | Boss every 5th wave; splits into a bot swarm on death; costs 10 lives |

## Sound

All audio is **synthesized live with the Web Audio API** — zero audio assets,
nothing to download. Each effect (shots, splashes, kills, leak alarms, boss
growl, fanfares) is built from enveloped oscillators and noise bursts in
`src/game/sound.ts`, plus a quiet ambient bass loop under the action. The HUD
speaker button toggles everything (persisted). To use recorded SFX later,
replace the matching case in `synthesize()` — engine call sites don't change.

## Progression

- **Achievements** — 11 unlockables ("Jeet Exterminator", "Flawless Vault",
  "Diamond Hands"...) tracked across runs in local storage and shown on the
  start screen. Lifetime stats (kills, bosses, victories) accumulate per
  device and will gate NFT skin unlocks later.
- **Run stats** — the end screen breaks down each run: kills, bosses,
  towers/upgrades bought, Paws earned and run time.
- **Weekly Trench** — a seeded tournament mode. The challenge (map + two
  wave modifiers) derives from the ISO week, so every player worldwide faces
  identical waves with no backend; weekly bests are stored per week key and
  a future global leaderboard can rank the same keys server-side.

## PWA & sharing

The game is an installable **PWA**: `public/manifest.webmanifest` + a small
service worker (`public/sw.js`, network-first app shell, cache-first hashed
assets) make it work offline and installable to phone home screens. Social
links unfurl with Open Graph / Twitter cards; the icons and the OG card are
generated placeholders — regenerate with `node scripts/generate-images.mjs`
or drop real brand art into `public/`.

## Web3 (groundwork)

Feature-flagged in `src/data/features.ts`:

- **Connect Wallet** (on by default): dependency-free EIP-1193 integration in
  `src/utils/wallet.ts` — works with Coinbase Wallet, MetaMask or any injected
  provider and switches/adds the **Base** chain (8453). Connection state shows
  on the start screen. Nothing on-chain is required to play.
- **Pack Records** (on by default): local best-score table on the start
  screen, reading the same data a global leaderboard will serve later.

Flip a flag to `false` to ship without that surface.

## Project structure

```
src/
  components/   React UI (start screen, HUD, build bar, overlays)
  game/         Canvas engine: Engine, Enemy, Tower, Projectile,
                renderer (placeholder vector art), sprites registry,
                WebAudio sound synth
  assets/       Art drop-zone + sprite key documentation
  data/         Balance tables: towers, enemies, waves, maps, difficulty,
                copy, feature flags
  hooks/        React <-> engine bridge, high scores, wallet state
  utils/        math, localStorage, wallet (EIP-1193), integration seams
  types/        Shared TypeScript types
```

Design notes:

- **Engine vs React:** the simulation runs in `src/game/Engine.ts` on
  `requestAnimationFrame` and renders straight to canvas; React only receives
  throttled UI snapshots (~8/s), so the DOM never re-renders per frame.
- **Art is swappable:** every drawable looks up the sprite registry first and
  falls back to placeholder vector shapes — see `src/assets/README.md`.
- **Balance lives in data:** all tower/enemy/wave numbers are plain tables in
  `src/data/`, so tuning needs no engine changes.

## Future-ready seams (`src/utils/integrations.ts`)

- **Wallet connect** — live (injected EIP-1193 on Base); swap
  `src/utils/wallet.ts` for wagmi/viem when richer on-chain reads are needed.
- **Leaderboard** — `LeaderboardProvider` interface with a local-storage
  implementation (powers the Pack Records panel); swap in an API client later.
- **NFT skin unlocks** — `SkinProvider` feeds key→URL overrides into the
  sprite registry (flag off until skins exist).
- **Weekly tournament** — `TournamentProvider` supplies a shared weekly seed
  for identical wave schedules (flag off until a backend exists).
- **Telegram sharing** — already live on the end screen via `t.me/share`.

---

*The Pack Holds.* 🐾
