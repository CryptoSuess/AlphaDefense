# NIKO Prize Pool — Design Spec (v1: Sponsored Pool)

> Status: **design only — no contract code yet.** This document is the agreed
> blueprint for a sponsored, on-chain prize pool for *NIKO: Guardian of Base*.
> Implementation (Foundry project + audited contract + tests) follows sign-off.

## 1. Goal

Give players a real incentive to compete: a pool of **$NIKO** (our meme token,
already deployed on **Base**) is paid out to the top players of a contest
period. v1 is **sponsored** — the treasury (or sponsors) funds the pool, entry
is **free**, and the top of the leaderboard wins. No player funds are ever held
by the contract, which keeps us clear of the gambling/lottery exposure that
pay-to-enter would create (see §9).

Non-goals for v1: entry fees, staking, NFTs, fully trustless scoring. Those are
v2+ and are sketched in §10.

## 2. The trust model (read this first)

The game is a client-side canvas engine; scores are submitted to our Cloudflare
Worker. The EIP-191 signing we shipped proves **which wallet** submitted a
score — it does **not** prove the score is legitimate. A determined cheater can
fabricate a plausible score and sign it.

Therefore the contract **must not** read scores directly. Instead:

- **Off-chain, we (the operator) compute the winners** from the leaderboard and
  whatever anti-cheat we apply, then publish a **Merkle root** of
  `(winner address → prize amount)` on-chain.
- Players **claim** their prize by presenting a Merkle proof.

The trust assumption is explicit and acceptable for a sponsored pool: **players
trust the NIKO operator to score the contest honestly.** There is no entry fee,
so no player is risking their own money on that trust. The on-chain Merkle root
makes the payout list public, immutable once posted, and independently
verifiable (anyone can check their own allocation against the published winners
file).

This is the single most important design decision. If we later want
*trustless* pay-to-win, we need replay verification (§10), not just this.

## 3. Contest period = the Weekly Trench

We already have a deterministic, global, leaderboard-tracked contest period: the
**Weekly Trench** (`src/data/weekly.ts`), keyed by ISO week (e.g.
`2026-W26`). A prize-pool **season maps 1:1 to a week key.**

- `seasonId` (on-chain) = `keccak256("weekly:" + weekKey)`, or a simple
  incrementing `uint256` with the week key stored in the event for indexing.
  (Recommendation: incrementing `uint256 seasonId` + emit the week string — gas
  cheap, easy to enumerate.)
- The board scored is exactly the existing `weekly:<weekKey>` leaderboard board,
  so no new scoring surface is introduced.

This means: **no new gameplay is required** — we already produce a ranked,
seeded weekly board worldwide. The prize pool simply attaches money to it.

## 4. Season lifecycle

```
 OPEN ──fund──► FUNDED ──(week ends)──► PENDING ──finalize──► CLAIMABLE ──(deadline)──► SWEPT
   │                                                              │
   └──────────────── owner can topUp while OPEN/FUNDED ──────────┘
```

1. **Create / fund.** Owner creates season `N` for `weekKey`, deposits `amount`
   of $NIKO into the contract for that season. Multiple top-ups allowed until
   the week ends. Pool total is the sum of deposits.
2. **Play.** The week runs; players compete on the Weekly Trench as today. The
   contract does nothing during play.
3. **Finalize.** After the week closes, off-chain we compute final standings,
   apply anti-cheat, allocate prizes (§6), build the Merkle tree, and the owner
   calls `finalizeSeason(N, merkleRoot, totalAllocated, claimDeadline)`.
   Finalize is **one-shot** per season (cannot be overwritten) to prevent
   rug-style root swaps after players see the results.
4. **Claim.** Winners call `claim(N, amount, proof)` any time before
   `claimDeadline`. Each leaf claimable once.
5. **Sweep.** After `claimDeadline`, owner may `sweepUnclaimed(N)` to return
   leftover (unclaimed) funds to the treasury. Cannot touch already-claimable
   balances before the deadline.

## 5. Contract API (Base, Solidity ^0.8.24)

Built on audited OpenZeppelin primitives: `Ownable2Step`, `SafeERC20`,
`MerkleProof`, `ReentrancyGuard`, `Pausable`.

```solidity
contract NikoPrizePool {
    IERC20 public immutable token;        // $NIKO on Base (set at deploy)

    struct Season {
        uint128 funded;        // total $NIKO deposited
        uint128 allocated;     // total promised by the merkle root
        uint128 claimed;       // total claimed so far
        uint64  claimDeadline; // unix; 0 until finalized
        bytes32 merkleRoot;    // 0x0 until finalized
        bool    swept;
        string  weekKey;       // e.g. "2026-W26" (for indexing/UX)
    }

    mapping(uint256 => Season) public seasons;
    mapping(uint256 => mapping(uint256 => uint256)) private claimedBitmap; // seasonId => word => bits

    // --- owner / operator ---
    function createSeason(uint256 id, string calldata weekKey) external onlyOwner;
    function fundSeason(uint256 id, uint256 amount) external onlyOwner;       // pulls token via transferFrom
    function finalizeSeason(uint256 id, bytes32 root, uint256 allocated, uint64 claimDeadline) external onlyOwner; // one-shot; allocated <= funded
    function sweepUnclaimed(uint256 id) external onlyOwner;                   // only after deadline
    function pause() / unpause() external onlyOwner;

    // --- players ---
    function claim(uint256 id, uint256 index, uint256 amount, bytes32[] calldata proof) external nonReentrant whenNotPaused;
    function isClaimed(uint256 id, uint256 index) external view returns (bool);

    // --- events ---
    event SeasonCreated(uint256 indexed id, string weekKey);
    event SeasonFunded(uint256 indexed id, uint256 amount, uint256 totalFunded);
    event SeasonFinalized(uint256 indexed id, bytes32 root, uint256 allocated, uint64 claimDeadline);
    event Claimed(uint256 indexed id, uint256 index, address indexed account, uint256 amount);
    event Swept(uint256 indexed id, uint256 amount);
}
```

**Merkle leaf:** `keccak256(abi.encodePacked(index, account, amount))`. The
`index` gives each winner a unique slot tracked in a bitmap (cheap,
double-claim-proof) — the standard Uniswap MerkleDistributor design.

### Key invariants / guards
- `finalizeSeason` requires `allocated <= funded` (can't promise more than is in
  the pool) and `merkleRoot == 0` beforehand (one-shot, no swaps).
- `claim` checks proof, marks the bitmap bit, increments `claimed`, then
  `SafeERC20.safeTransfer` (effects-before-interaction + `nonReentrant`).
- `sweepUnclaimed` only after `claimDeadline`, transfers `funded - claimed`.
- `Pausable` lets us halt claims if a problem with the root is discovered before
  funds drain (a safety valve, not a backdoor — it can't redirect funds).
- `Ownable2Step` so the operator key can be rotated/handed to a multisig safely.

### Owner key (decided: Gnosis Safe multisig)
The owner is a privileged operator (creates/funds/finalizes). **Decision: the
owner is a Gnosis Safe multisig on Base**, not a single EOA. The owner cannot
steal claimable funds (it can only sweep *unclaimed* funds after the deadline,
and can't rewrite a posted root), but it *does* decide the root — so multisig +
a public, reproducible winners file is the integrity story.

Practical note: the Safe can be created at any time; for testnet dev we'll use a
plain deployer key, then transfer ownership to the Safe (via `Ownable2Step`)
before mainnet. **Open:** the Safe address + signer set (e.g. 2-of-3) — needed
only at the mainnet ownership-transfer step, not to build/test.

## 6. Off-chain scoring & Merkle pipeline

A small script/Worker route, run once per season after the week closes:

1. Pull the final `weekly:<weekKey>` board from the leaderboard KV.
2. **Anti-cheat pass** (v1, operator-judgment): drop entries failing
   plausibility heuristics; optionally manually review the top N. (v1 accepts
   that this is operator-trusted; v2 adds replay verification, §10.)
3. **Prize curve (decided):** a capped, skewed top-10 split by percentage —
   `35 / 20 / 12 / 8 / 6 / 5 / 5 / 3 / 3 / 3 (%)`. Percentages are configurable
   per season; the curve is applied to whatever that season's pool is.
   Only **wallet-verified** entries (signed, address present) are eligible — an
   anonymous `Wolf-####` can't receive tokens, which also nudges wallet
   connection. (If a season has fewer than 10 eligible finishers, the unfilled
   tail stays unallocated and is swept back to treasury.)

   **Season 1 (25,000 NIKO):**

   | Rank | Share | NIKO   |
   |------|-------|--------|
   | 1    | 35%   | 8,750  |
   | 2    | 20%   | 5,000  |
   | 3    | 12%   | 3,000  |
   | 4    | 8%    | 2,000  |
   | 5    | 6%    | 1,500  |
   | 6    | 5%    | 1,250  |
   | 7    | 5%    | 1,250  |
   | 8    | 3%    | 750    |
   | 9    | 3%    | 750    |
   | 10   | 3%    | 750    |
   | **Total** | **100%** | **25,000** |
4. Build the Merkle tree of `(index, address, amount)`; compute `allocated` =
   sum (≤ funded).
5. **Publish the full winners file** (addresses, amounts, proofs) to the repo /
   IPFS so anyone can verify the root and self-serve their proof.
6. Owner calls `finalizeSeason(...)` with the root.

The frontend reads the published winners file to show "You won X $NIKO — Claim"
and supply the proof to `claim`.

## 7. Frontend / UX integration

Reuses the existing Base wallet plumbing (`src/utils/wallet.ts`, already on
Base) and feature-flag pattern (`src/data/features.ts`).

- New flag block: `prizePool: { enabled, contractAddress, tokenAddress, chainId }`
  — off by default, mirroring `leaderboardApiUrl`.
- **Start screen:** a "Weekly Prize Pool" panel showing current pool size
  (read on-chain), the prize curve, and time left in the week.
- **End screen / leaderboard:** if the connected wallet has an unclaimed prize
  for a finalized season, show a **Claim** button that calls the contract with
  the proof from the published winners file.
- A minimal read layer: either add `viem` (clean, typed) for contract reads, or
  hand-roll `eth_call` to stay dependency-free like `wallet.ts` does today.
  Recommendation: introduce `viem` here — reads/writes get materially harder to
  hand-roll than the single `personal_sign` we have now.

## 8. Token specifics

- Chain: **Base mainnet** (8453) — matches existing wallet integration. ✅
- **$NIKO token contract:** `0x422273666D77F504E30E2573c063c7c50CCE8453` (Base).
  This is the ERC-20 the prize pool pays out and accepts as funding.
- **Type:** standard **ERC-20**, 1,000,000,000 minted total supply with
  **~800,000,000 circulating** after burns, paired against **WETH**. ✅
  (Confirmed by operator.) Season 1's 25,000 NIKO is ~0.003% of circulating —
  a deliberately small, low-risk first pool.
- **$NIKO/WETH liquidity pair:** `0xA800F8F40aFe96C15EAb496C7194F84CaE486990`
  (Base). Not used by the contract; the **frontend** can read its reserves
  (NIKO vs WETH) × an ETH/USD feed to show the pool's value in USD.
- **`decimals`:** assumed **18** (standard ERC-20 convention, consistent with a
  WETH pairing). ⏳ *To be read directly from the token on first contract wiring*
  — but this is **not a blocker**: the contract moves raw base units via
  `SafeERC20`, so decimals only affects human-readable amounts in the off-chain
  prize curve and the UI, not the Solidity.
- **No fee-on-transfer / rebase / blacklist** assumed (standard ERC-20). Will
  confirm with a one-line balance-delta check in the test suite; if it ever
  turns out otherwise, §5 accounting switches to measured deltas.

## 9. Legal / risk posture

- **Sponsored + free entry** is specifically chosen to avoid the
  consideration→prize structure that triggers lottery/gambling regulation in
  many jurisdictions. This is design risk-mitigation, **not legal advice** —
  a launch should still get a quick review for your target markets.
- The contract never custodies player funds (only treasury-deposited prize
  funds), minimizing custody risk and attack surface.
- Anti-cheat is operator-trusted in v1; we are upfront about that in the UI
  ("prizes awarded by NIKO based on the weekly leaderboard").
- Standard smart-contract risk: an **external audit** is recommended before any
  pool holds meaningful value, even with OZ primitives.

## 10. Roadmap to v2 (pay-to-enter) — not built yet

Only after legal review **and** real anti-cheat:
- `enter(seasonId)` collects an entry fee in $NIKO into the pool; configurable
  **rake** (e.g. 5–10%) to treasury; pool = sponsor funds + net entries.
- **Replay verification:** the engine is deterministic from `seed + input log`.
  Record the input log per run; re-simulate finalists server-side (later: a ZK
  proof) to verify scores exactly. This is the honest path to trustless skill
  contests and the prerequisite for money-in-from-players.
- Same finalize/claim payout machinery as v1 — the Solidity delta is small; the
  hard parts are anti-cheat and legal.

## 11. Decisions & remaining inputs

Decided:
1. ✅ **$NIKO contract:** `0x422273666D77F504E30E2573c063c7c50CCE8453` (Base);
   NIKO/WETH pair `0xA800F8F40aFe96C15EAb496C7194F84CaE486990`; standard ERC-20,
   1B minted / ~800M circulating. `decimals` assumed 18, verified at first
   contract wiring (§8).
2. ✅ **Plain ERC-20** (no fee-on-transfer / rebase / blacklist).
3. ✅ **Owner = Gnosis Safe multisig** (§5). Safe address/signer set supplied at
   the mainnet ownership-transfer step.
4. ✅ **Prize curve:** skewed top 10, `35/20/12/8/6/5/5/3/3/3 %` (§6).
5. ✅ **Season 1 pool = 25,000 NIKO** (small/low-risk start).
6. ✅ **Frontend read layer = viem** for contract reads + claim.

Still needed only at mainnet-deploy time (not blockers for building/testing):
- The Gnosis Safe address + signer threshold.
- The treasury wallet that will fund the 25,000 NIKO.
- A legal sanity-check for target markets (sponsored/free-entry keeps this low,
  but still worth a look — §9).

## 12. Implementation plan (once signed off)

1. `contracts/` Foundry project; `NikoPrizePool.sol` on OZ primitives.
2. Full test suite (fund → finalize → claim → double-claim revert → sweep →
   pause → access control → `allocated > funded` revert → fee-token cases).
3. Deploy + e2e on **Base Sepolia** with a mock ERC-20 first.
4. Off-chain scoring/Merkle script + published winners format.
5. Frontend: prize-pool panel + claim flow behind a feature flag.
6. External audit before mainnet funds of material size.
