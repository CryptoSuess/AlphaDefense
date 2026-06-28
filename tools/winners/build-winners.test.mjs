import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import {
  buildWinners,
  selectEligible,
  allocate,
  toBaseUnits,
  validateCurve,
  DEFAULT_CURVE,
} from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const board = JSON.parse(readFileSync(join(here, 'sample-board.json'), 'utf8')).entries;

const POOL = 25000;
const DECIMALS = 18;
const result = buildWinners({ entries: board, week: '2026-W26', pool: POOL, decimals: DECIMALS });

test('excludes anonymous (no-wallet) entries', () => {
  const eligible = selectEligible(board);
  assert.ok(eligible.every((e) => /^0x[0-9a-f]{40}$/.test(e.address)));
  // Two Wolf-#### entries in the sample have no address; none should appear.
  assert.ok(!eligible.some((e) => e.player?.startsWith('Wolf-')));
});

test('dedups by address, keeping the best score', () => {
  const eligible = selectEligible(board);
  const dupAddr = '0x1111111111111111111111111111111111111111';
  const hits = eligible.filter((e) => e.address === dupAddr);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].score, 98200); // best of 98200 / 60000
});

test('ranks by score descending', () => {
  const scores = result.winners.map((w) => w.score);
  const sorted = [...scores].sort((a, b) => b - a);
  assert.deepEqual(scores, sorted);
});

test('allocated equals the sum of winner amounts and never exceeds the pool', () => {
  const sum = result.winners.reduce((acc, w) => acc + BigInt(w.amount), 0n);
  assert.equal(sum.toString(), result.allocated);
  assert.ok(BigInt(result.allocated) <= BigInt(result.poolBase));
});

test('amounts follow the curve ratios', () => {
  // rank1:rank2 should be 35:20; rank1 of 25k = 8750 NIKO.
  assert.equal(result.winners[0].amountFormatted, '8750');
  assert.equal(result.winners[1].amountFormatted, '5000');
  assert.equal(result.winners[2].amountFormatted, '3000');
});

test('full top-10 curve sums to the whole pool with no dust', () => {
  // 10 eligible wallets in the sample -> all 10 ranks filled, 100% allocated.
  assert.equal(result.winnerCount, 10);
  assert.equal(result.allocatedFormatted, '25000');
});

test('every winner proof verifies against the published root', () => {
  for (const w of result.winners) {
    const ok = StandardMerkleTree.verify(
      result.merkleRoot,
      ['uint256', 'address', 'uint256'],
      [String(w.index), w.address, w.amount],
      w.proof,
    );
    assert.ok(ok, `proof failed for index ${w.index}`);
  }
});

test('dumped tree re-derives the same root', () => {
  const tree = StandardMerkleTree.load(result.tree);
  assert.equal(tree.root, result.merkleRoot);
});

test('fewer eligible than curve length -> only that many winners', () => {
  const few = board.filter((e) => e.address).slice(0, 3);
  const r = buildWinners({ entries: few, week: 'x', pool: POOL, decimals: DECIMALS });
  assert.equal(r.winnerCount, 3);
  // With only 3 winners the tail (ranks 4-10) is unallocated and swept.
  assert.ok(BigInt(r.allocated) < BigInt(r.poolBase));
});

test('the default curve is valid and sums to 100%', () => {
  assert.equal(validateCurve(DEFAULT_CURVE), 100);
});

test('rejects a curve that sums to more than 100%', () => {
  assert.throws(() => buildWinners({ entries: board, week: 'x', pool: POOL, curve: [60, 60] }), /100%/);
});

test('rejects a non-numeric / negative curve entry', () => {
  assert.throws(() => validateCurve([50, Number('abc')]), /invalid curve/);
  assert.throws(() => validateCurve([50, -10]), /invalid curve/);
});

test('allocate floors so the sum stays within the pool (rounding dust)', () => {
  // A pool that does not divide evenly by the curve leaves dust unallocated.
  const poolBase = toBaseUnits('1', 0); // 1 base unit, indivisible
  const amounts = allocate(poolBase, DEFAULT_CURVE, 10);
  const sum = amounts.reduce((a, b) => a + b, 0n);
  assert.ok(sum <= poolBase);
});
