import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

/**
 * Pure functions for turning a leaderboard board into a prize allocation and a
 * Merkle tree the NikoPrizePool contract can verify. Kept side-effect free so
 * they're unit-testable; the CLI (build-winners.mjs) wires fetch/file IO around
 * them.
 *
 * The on-chain leaf is the OpenZeppelin StandardMerkleTree encoding
 *   keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))))
 * with leaf types ["uint256","address","uint256"]. NikoPrizePool.claim verifies
 * exactly this, so we build the tree with the same library the contract's design
 * spec names — no hand-rolled hashing in a money path.
 */

/** $NIKO on Base (design spec §8). Override with --token for testnet mocks. */
export const NIKO_TOKEN = '0x422273666D77F504E30E2573c063c7c50CCE8453';

/** Locked Season-1 prize curve, percentages by rank (design spec §6). */
export const DEFAULT_CURVE = [35, 20, 12, 8, 6, 5, 5, 3, 3, 3];

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Selects prize-eligible entries from a raw leaderboard board.
 * - Only wallet-verified entries (a valid `address`) can receive tokens; an
 *   anonymous `Wolf-####` cannot (design spec §6).
 * - Dedups by address (a wallet keeps only its best result) so one player can't
 *   occupy multiple prize ranks.
 * - Ranks by score desc, then wave reached desc, then earliest submission.
 */
export function selectEligible(entries) {
  const best = new Map(); // lowercased address -> entry
  for (const e of entries ?? []) {
    if (typeof e?.address !== 'string' || !ADDRESS_RE.test(e.address)) continue;
    const score = Number(e.score);
    const wave = Number(e.wave) || 0;
    if (!Number.isFinite(score)) continue;
    const key = e.address.toLowerCase();
    const prev = best.get(key);
    if (!prev || score > prev.score || (score === prev.score && wave > prev.wave)) {
      best.set(key, { address: key, player: e.player, score, wave, ts: Number(e.ts) || 0 });
    }
  }
  return [...best.values()].sort(
    (a, b) => b.score - a.score || b.wave - a.wave || a.ts - b.ts,
  );
}

/**
 * Allocates base-unit amounts to the top `count` ranks per the curve.
 * Integer math throughout (BigInt); each amount is floored, so the sum is always
 * <= the pool and the rounding dust stays unallocated (swept back to treasury,
 * per design spec §6). `curve` percentages may be fractional (basis-point
 * precision). Returns an array of BigInt base units, length `count`.
 */
export function allocate(poolBase, curve, count) {
  const n = Math.min(curve.length, count);
  const out = [];
  for (let i = 0; i < n; i++) {
    const bps = BigInt(Math.round(curve[i] * 100)); // percent -> basis points
    out.push((poolBase * bps) / 10000n);
  }
  return out;
}

/** Converts whole-token amount (number|string) to base units for `decimals`. */
export function toBaseUnits(pool, decimals) {
  const [whole, frac = ''] = String(pool).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
}

/** Human-readable token amount from base units (display only). */
export function formatUnits(base, decimals) {
  const s = base.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, -decimals) || '0';
  const frac = s.slice(-decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Builds the full winners payload from a board: eligibility, allocation, Merkle
 * tree, and a per-winner proof. Returns everything needed to (a) call
 * finalizeSeason(root, allocated, deadline) and (b) publish a verifiable winners
 * file so each winner can self-serve their claim proof.
 */
export function buildWinners({
  entries,
  week,
  pool,
  decimals = 18,
  curve = DEFAULT_CURVE,
  token = NIKO_TOKEN,
  season,
  claimDeadline,
}) {
  const poolBase = toBaseUnits(pool, decimals);
  const eligible = selectEligible(entries);
  const amounts = allocate(poolBase, curve, eligible.length);

  // Only positive allocations become leaves; index is the leaf's slot (and the
  // contract's bitmap key), assigned sequentially.
  const rows = [];
  amounts.forEach((amount, rank) => {
    if (amount <= 0n) return;
    rows.push({ rank, amount, entry: eligible[rank] });
  });

  const values = rows.map((r, index) => [String(index), r.entry.address, r.amount.toString()]);
  const tree = StandardMerkleTree.of(values, ['uint256', 'address', 'uint256']);

  const winners = rows.map((r, index) => ({
    index,
    rank: r.rank + 1,
    address: r.entry.address,
    player: r.entry.player,
    score: r.entry.score,
    wave: r.entry.wave,
    amount: r.amount.toString(),
    amountFormatted: formatUnits(r.amount, decimals),
    proof: tree.getProof(index),
  }));

  const allocated = rows.reduce((sum, r) => sum + r.amount, 0n);

  return {
    week,
    season,
    token,
    decimals,
    pool: String(pool),
    poolBase: poolBase.toString(),
    merkleRoot: tree.root,
    allocated: allocated.toString(),
    allocatedFormatted: formatUnits(allocated, decimals),
    eligibleCount: eligible.length,
    winnerCount: winners.length,
    claimDeadline: claimDeadline ?? null,
    winners,
    tree: tree.dump(), // lets anyone re-derive any proof from the published file
  };
}
