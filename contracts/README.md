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

## Deploy (Base Sepolia first)

```bash
export NIKO_TOKEN=0x422273666D77F504E30E2573c063c7c50CCE8453   # $NIKO on Base
export POOL_OWNER=0xYourSafeOrDeployer
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC" --broadcast --use /path/to/solc
```

For mainnet, deploy with a deployer key then transfer ownership to the Gnosis
Safe via `transferOwnership` / `acceptOwnership` (`Ownable2Step`).

## Off-chain winners tree

Build the Merkle tree with the OpenZeppelin `merkle-tree` JS library using the
leaf encoding `["uint256","address","uint256"]` => `(index, account, amount)`.
The on-chain leaf is `keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))))`.
Publish the full winners file (addresses, amounts, proofs) so anyone can verify
the root and self-serve their proof.
