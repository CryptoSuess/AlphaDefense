# NIKO winners pipeline

Off-chain step that turns a Weekly Trench leaderboard into the Merkle root the
[`NikoPrizePool`](../../contracts) contract pays out against. See the trust model
and prize curve in [`../../docs/prize-pool-design.md`](../../docs/prize-pool-design.md).

It reads a board (live leaderboard API or a saved JSON file), keeps only
wallet-verified entries, applies the prize curve, builds the OpenZeppelin
`StandardMerkleTree` (the exact leaf encoding `claim()` verifies), and writes a
public winners file with a proof per winner.

## Install & test

```bash
npm install
npm test            # node --test: eligibility, allocation, proofs verify
```

## Run

```bash
# From the live leaderboard:
node build-winners.mjs --week 2026-W26 --pool 25000 \
  --api https://niko-leaderboard.<account>.workers.dev --season 1 --deadline-days 30

# Or from a saved board (e.g. for a dry run before the API is live):
node build-winners.mjs --week 2026-W26 --pool 25000 --file sample-board.json
```

This writes `winners/winners-<week>.json` and prints the `merkleRoot` and
`allocated` to pass to `finalizeSeason(id, root, allocated, deadline)`.

| Flag | Description |
| ---- | ----------- |
| `--week` | ISO week key, e.g. `2026-W26` (required) |
| `--pool` | Pool size in whole $NIKO, e.g. `25000` (required) |
| `--api` | Leaderboard API base URL (reads `weekly:<week>`) |
| `--file` | Read the board from JSON instead of the API |
| `--token` | ERC-20 address (default: $NIKO on Base) |
| `--season` | Season id recorded in the output (informational) |
| `--decimals` | Token decimals (default 18) |
| `--curve` | Curve percentages (default `35,20,12,8,6,5,5,3,3,3`) |
| `--deadline-days` | Record a suggested claim deadline N days out |
| `--out` | Output directory (default `./winners`) |

## Output & eligibility

- **Eligible** = entries with a valid wallet `address` (anonymous `Wolf-####`
  cannot receive tokens). One wallet keeps only its best result; ranked by score,
  then wave reached, then earliest submission.
- **Allocation** uses integer (base-unit) math and floors each share, so the sum
  is always `<= pool`; rounding dust and any unfilled tail (fewer than 10
  eligible) stay unallocated and are swept back to treasury after the deadline.
- **`winners-<week>.json`** contains the root, allocated total, each winner's
  amount + proof, and a `tree` dump so anyone can independently re-derive the
  root and their own proof. Publish it (repo / IPFS) alongside finalizing.

The output is operator-attested (off-chain scoring) — the on-chain Merkle root
is what makes the payout list public, immutable once finalized, and verifiable.
