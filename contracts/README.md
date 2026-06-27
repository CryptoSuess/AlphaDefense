# NIKO Prize Pool — contracts

Foundry project for `NikoPrizePool`, the sponsored season-based prize pool for
*NIKO: Guardian of Base*. Design rationale and the trust model are in
[`../docs/prize-pool-design.md`](../docs/prize-pool-design.md).

> Status: **v1, testnet-ready, unaudited.** Do not put mainnet funds of material
> value in this before an external audit.

## What it does

- The operator (a Gnosis Safe multisig) **creates** a season, **funds** it with
  $NIKO, then after the contest **finalizes** it by posting a Merkle root of
  `(index, winner, amount)`.
- Winners **claim** with a Merkle proof; funds always go to the winner address
  (anyone may submit the claim tx). Double-claims are blocked by a bitmap.
- After the claim deadline the operator **sweeps** unclaimed funds back to the
  treasury. The operator can never take a claimable allocation or rewrite a
  finalized root.

Built on OpenZeppelin `Ownable2Step`, `SafeERC20`, `MerkleProof`,
`ReentrancyGuard`, `Pausable`.

## Build & test

```bash
./setup.sh          # fetch forge-std + openzeppelin-contracts into lib/
forge test          # or: forge test --use /path/to/solc
```

Dependencies in `lib/` and build output (`out/`, `cache/`) are git-ignored.

### Sandboxed / offline solc

Standard Foundry downloads the compiler from `binaries.soliditylang.org`. Where
that host is blocked, point Foundry at a local compiler:

```bash
forge test --use /path/to/solc        # e.g. a solc 0.8.24 binary
```

## Base Sepolia walkthrough (testnet)

Real $NIKO isn't on Sepolia, so the testnet deploy ships a mock token (its
`mint` is a public faucet) alongside the pool. Copy `.env.example` to `.env`
and fill in `BASE_SEPOLIA_RPC`, a throwaway `PRIVATE_KEY` (funded with Sepolia
ETH), and optionally `BASESCAN_API_KEY` for verification.

```bash
# 1. Deploy mock token + pool (owner = deployer) and (optionally) verify.
forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url base_sepolia --broadcast --verify --use ~/bin/solc \
  --private-key "$PRIVATE_KEY"
# -> prints MockERC20 and NikoPrizePool addresses. Export them:
export TOKEN=0x...   POOL=0x...

# 2. Build the winner set off-chain (see ../tools/winners). For a dry run:
#    cd ../tools/winners && node build-winners.mjs --week 2026-W26 --pool 25000 \
#      --season 1 --deadline-days 30 --file sample-board.json
#    -> prints merkleRoot + allocated; writes winners-<week>.json.

# 3. Operator: create + fund the season, then finalize with the root.
cast send "$POOL" "createSeason(uint256,string)" 1 "2026-W26" \
  --rpc-url base_sepolia --private-key "$PRIVATE_KEY"
cast send "$TOKEN" "approve(address,uint256)" "$POOL" \
  25000000000000000000000 --rpc-url base_sepolia --private-key "$PRIVATE_KEY"
cast send "$POOL" "fundSeason(uint256,uint256)" 1 25000000000000000000000 \
  --rpc-url base_sepolia --private-key "$PRIVATE_KEY"
cast send "$POOL" "finalizeSeason(uint256,bytes32,uint256,uint64)" \
  1 "$ROOT" "$ALLOCATED" "$DEADLINE" --rpc-url base_sepolia --private-key "$PRIVATE_KEY"

# 4. Anyone submits a winner's claim (funds go to the winner address). The
#    index/account/amount/proof come from winners-<week>.json.
cast send "$POOL" "claim(uint256,uint256,address,uint256,bytes32[])" \
  1 0 "$WINNER" "$AMOUNT" "[$PROOF_ELEMS]" --rpc-url base_sepolia --private-key "$PRIVATE_KEY"

# 5. After the deadline, operator sweeps the unclaimed remainder.
cast send "$POOL" "sweepUnclaimed(uint256)" 1 \
  --rpc-url base_sepolia --private-key "$PRIVATE_KEY"
```

`test/Integration.t.sol` runs this entire loop in-process against the actual
pipeline output (`test/fixtures/winners-sample.json`) — a fast, RPC-free check
that the off-chain root and proofs are consumable on-chain before you spend
testnet gas.

## Deploy (mainnet)

```bash
export NIKO_TOKEN=0x422273666D77F504E30E2573c063c7c50CCE8453   # $NIKO on Base
export POOL_OWNER=0xYourSafeOrDeployer
forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast --use /path/to/solc
```

Deploy with a deployer key, then transfer ownership to the Gnosis Safe via
`transferOwnership` / `acceptOwnership` (`Ownable2Step`).

## Off-chain winners tree

The winner set / Merkle tree is built by [`../tools/winners`](../tools/winners)
using the OpenZeppelin `merkle-tree` library with leaf encoding
`["uint256","address","uint256"]` => `(index, account, amount)`. The on-chain
leaf is `keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))))`.
That tool publishes the full winners file (addresses, amounts, proofs) so anyone
can verify the root and self-serve their proof.
