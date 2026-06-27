// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {NikoPrizePool} from "../src/NikoPrizePool.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/**
 * End-to-end integration: drives the contract with the ACTUAL output of the
 * off-chain winners pipeline (tools/winners) — the committed fixture in
 * test/fixtures/winners-sample.json. Proves the Merkle root and per-winner
 * proofs the pipeline publishes are consumable on-chain through the full
 * fund -> finalize -> claim -> sweep loop. Regenerate the fixture with:
 *   cd tools/winners && node build-winners.mjs --week sample --pool 25000 \
 *     --season 1 --file sample-board.json --out ../../contracts/test/fixtures
 */
contract IntegrationTest is Test {
    using stdJson for string;

    NikoPrizePool internal pool;
    MockERC20 internal token;
    string internal json;
    uint256 internal constant SEASON = 1;

    function setUp() public {
        token = new MockERC20(); // mints 1B to this contract (the operator)
        pool = new NikoPrizePool(token, address(this));
        token.approve(address(pool), type(uint256).max);
        json = vm.readFile("test/fixtures/winners-sample.json");
    }

    function test_PipelineOutput_FullClaimAndSweep() public {
        bytes32 root = json.readBytes32(".merkleRoot");
        uint256 allocated = vm.parseUint(json.readString(".allocated"));
        uint256 poolBase = vm.parseUint(json.readString(".poolBase"));
        uint256 count = json.readUint(".winnerCount");

        pool.createSeason(SEASON, "sample");
        pool.fundSeason(SEASON, poolBase);
        pool.finalizeSeason(SEASON, root, allocated, uint64(block.timestamp + 7 days));

        // Claim every winner using the proof straight from the pipeline file.
        uint256 totalClaimed;
        for (uint256 i = 0; i < count; i++) {
            string memory base = string.concat(".winners[", vm.toString(i), "]");
            uint256 index = json.readUint(string.concat(base, ".index"));
            address account = json.readAddress(string.concat(base, ".address"));
            uint256 amount = vm.parseUint(json.readString(string.concat(base, ".amount")));
            bytes32[] memory proof = json.readBytes32Array(string.concat(base, ".proof"));

            pool.claim(SEASON, index, account, amount, proof);
            assertEq(token.balanceOf(account), amount, "winner did not receive prize");
            totalClaimed += amount;
        }
        assertEq(totalClaimed, allocated, "claims must sum to allocated");

        // Sweep the rounding/unfilled remainder back to the operator.
        vm.warp(block.timestamp + 8 days);
        uint256 before = token.balanceOf(address(this));
        pool.sweepUnclaimed(SEASON);
        assertEq(token.balanceOf(address(this)) - before, poolBase - allocated, "wrong sweep amount");
        assertEq(token.balanceOf(address(pool)), 0, "pool should be drained");
    }
}
