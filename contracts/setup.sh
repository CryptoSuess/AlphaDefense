#!/usr/bin/env bash
# Fetches the Solidity dependencies into lib/ (kept out of git). Run once after
# cloning before `forge build` / `forge test`.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p lib

if [ ! -d lib/forge-std ]; then
  echo "Fetching forge-std…"
  git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
fi

if [ ! -d lib/openzeppelin-contracts ]; then
  echo "Fetching openzeppelin-contracts v5.1.0…"
  git clone --depth 1 --branch v5.1.0 \
    https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
fi

echo "Done. Now run: forge test"
