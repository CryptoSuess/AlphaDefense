#!/usr/bin/env node
/**
 * Off-chain winners -> Merkle pipeline for the NIKO prize pool.
 *
 * Reads a Weekly Trench leaderboard board (live API or a saved JSON file),
 * applies the prize curve, builds the OpenZeppelin StandardMerkleTree the
 * NikoPrizePool contract verifies, and writes a public winners file with proofs.
 *
 * Usage:
 *   node build-winners.mjs --week 2026-W26 --pool 25000 \
 *     --api https://niko-leaderboard.<acct>.workers.dev
 *   node build-winners.mjs --week 2026-W26 --pool 25000 --file board.json
 *
 * Flags:
 *   --week <key>      ISO week key, e.g. 2026-W26 (required)
 *   --pool <amount>   Pool size in whole $NIKO, e.g. 25000 (required)
 *   --api <url>       Leaderboard API base URL (reads weekly:<week>)
 *   --file <path>     Read the board from JSON instead of the API
 *                     (array of entries, or { entries: [...] })
 *   --token <addr>    ERC-20 address (default: $NIKO on Base)
 *   --season <id>     Season id to record in the output (informational)
 *   --decimals <n>    Token decimals (default 18)
 *   --curve <csv>     Prize curve percentages (default 35,20,12,8,6,5,5,3,3,3)
 *   --deadline-days <n>  Record a suggested claim deadline N days out
 *   --out <dir>       Output directory (default ./winners)
 *
 * Output: <out>/winners-<week>.json — publish this (repo/IPFS) so anyone can
 * verify the root and self-serve their claim proof. The printed `merkleRoot`
 * and `allocated` are the args for finalizeSeason(id, root, allocated, deadline).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWinners, DEFAULT_CURVE, NIKO_TOKEN, formatUnits } from './lib.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return args;
}

async function loadEntries({ file, api, week }) {
  if (file) {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : (raw.entries ?? []);
  }
  if (!api) throw new Error('provide --api <url> or --file <path>');
  const base = api.replace(/\/+$/, '');
  const url = `${base}/scores?key=${encodeURIComponent(`weekly:${week}`)}&limit=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`leaderboard API ${res.status} for ${url}`);
  const data = await res.json();
  return data.entries ?? [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const week = args.week;
  const pool = args.pool;
  if (!week || !pool) {
    console.error('Required: --week <key> --pool <amount>. See header for usage.');
    process.exit(1);
  }

  const decimals = Number(args.decimals ?? 18);
  const curve = args.curve ? args.curve.split(',').map((s) => Number(s.trim())) : DEFAULT_CURVE;
  const token = args.token ?? NIKO_TOKEN;
  const season = args.season !== undefined ? Number(args.season) : undefined;
  const outDir = args.out ?? './winners';

  let claimDeadline = null;
  if (args['deadline-days']) {
    claimDeadline = Math.floor(Date.now() / 1000) + Number(args['deadline-days']) * 86400;
  }

  const entries = await loadEntries({ file: args.file, api: args.api, week });
  const result = buildWinners({ entries, week, pool, decimals, curve, token, season, claimDeadline });

  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `winners-${week}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');

  console.log(`NIKO prize pool — winners for ${week}`);
  console.log(`  eligible (wallet-verified): ${result.eligibleCount}`);
  console.log(`  winners:                    ${result.winnerCount}`);
  console.log(`  pool:                       ${result.pool} (${result.poolBase} base units)`);
  console.log(`  allocated:                  ${result.allocatedFormatted} (${result.allocated})`);
  const dust = BigInt(result.poolBase) - BigInt(result.allocated);
  console.log(`  unallocated (swept later):  ${formatUnits(dust, decimals)}`);
  console.log('');
  console.log('  finalizeSeason args:');
  console.log(`    merkleRoot = ${result.merkleRoot}`);
  console.log(`    allocated  = ${result.allocated}`);
  if (claimDeadline) console.log(`    deadline   = ${claimDeadline} (unix)`);
  console.log('');
  console.log(`  wrote ${outPath}`);
  console.table(
    result.winners.map((w) => ({
      rank: w.rank,
      address: w.address,
      score: w.score,
      NIKO: w.amountFormatted,
    })),
  );
}

main().catch((err) => {
  console.error('error:', err.message);
  process.exit(1);
});
