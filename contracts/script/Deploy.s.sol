// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {NikoPrizePool} from "../src/NikoPrizePool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Deploys NikoPrizePool.
 *
 * Env:
 *   NIKO_TOKEN  - $NIKO ERC-20 address (Base: 0x4222...8453)
 *   POOL_OWNER  - operator address (a Gnosis Safe multisig is recommended;
 *                 for testnet a deployer EOA is fine, transfer to the Safe
 *                 afterward via Ownable2Step).
 *
 * Example (Base Sepolia):
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url "$BASE_SEPOLIA_RPC" --broadcast --use ~/bin/solc
 */
contract Deploy is Script {
    function run() external returns (NikoPrizePool pool) {
        address token = vm.envAddress("NIKO_TOKEN");
        address owner = vm.envAddress("POOL_OWNER");
        vm.startBroadcast();
        pool = new NikoPrizePool(IERC20(token), owner);
        vm.stopBroadcast();
        console2.log("NikoPrizePool deployed:", address(pool));
        console2.log("  token:", token);
        console2.log("  owner:", owner);
    }
}
