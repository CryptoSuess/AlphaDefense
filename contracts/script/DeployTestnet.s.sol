// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {NikoPrizePool} from "../src/NikoPrizePool.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/**
 * Testnet-only deploy. Spins up a mock $NIKO (its `mint` is public, so it
 * doubles as a faucet) plus the pool owned by the broadcasting deployer, so the
 * full fund -> finalize -> claim -> sweep loop can be exercised on Base Sepolia
 * without real $NIKO.
 *
 * DO NOT use on mainnet — there, use Deploy.s.sol with the real token and
 * transfer ownership to the Gnosis Safe.
 *
 * Example (Base Sepolia):
 *   forge script script/DeployTestnet.s.sol:DeployTestnet \
 *     --rpc-url base_sepolia --broadcast --verify --use ~/bin/solc
 */
contract DeployTestnet is Script {
    function run() external returns (NikoPrizePool pool, MockERC20 token) {
        // Guard against an accidental mainnet run (Ethereum L1 or Base). The
        // mock token has a public mint and is for testing only — mainnet must
        // go through Deploy.s.sol with the real $NIKO.
        require(block.chainid != 1 && block.chainid != 8453, "DeployTestnet: refusing to run on mainnet");

        vm.startBroadcast();
        address deployer = msg.sender;
        token = new MockERC20(); // mints 1B test NIKO to the deployer
        pool = new NikoPrizePool(token, deployer);
        vm.stopBroadcast();

        console2.log("MockERC20 (test NIKO):", address(token));
        console2.log("NikoPrizePool:        ", address(pool));
        console2.log("owner (deployer):     ", deployer);
    }
}
