// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal mintable ERC-20 standing in for $NIKO in tests.
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock NIKO", "mNIKO") {
        _mint(msg.sender, 1_000_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
