// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NikoPrizePool} from "../src/NikoPrizePool.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NikoPrizePoolTest is Test {
    NikoPrizePool internal pool;
    MockERC20 internal token;

    address internal owner = address(this);
    address internal attacker = makeAddr("attacker");

    // Season 1 (25,000 NIKO pool); we model the top 4 winners as a 4-leaf tree.
    uint256 internal constant FUNDED = 25_000 ether;
    uint256 internal constant SEASON = 1;
    string internal constant WEEK = "2026-W26";

    address internal w0 = makeAddr("winner0");
    address internal w1 = makeAddr("winner1");
    address internal w2 = makeAddr("winner2");
    address internal w3 = makeAddr("winner3");
    uint256 internal a0 = 8_750 ether;
    uint256 internal a1 = 5_000 ether;
    uint256 internal a2 = 3_000 ether;
    uint256 internal a3 = 2_000 ether;

    bytes32 internal root;
    bytes32[4] internal leaves;

    function setUp() public {
        token = new MockERC20(); // mints 1B to this contract (owner)
        pool = new NikoPrizePool(token, owner);
        token.approve(address(pool), type(uint256).max);

        leaves[0] = _leaf(0, w0, a0);
        leaves[1] = _leaf(1, w1, a1);
        leaves[2] = _leaf(2, w2, a2);
        leaves[3] = _leaf(3, w3, a3);
        bytes32 nodeA = _hashPair(leaves[0], leaves[1]);
        bytes32 nodeB = _hashPair(leaves[2], leaves[3]);
        root = _hashPair(nodeA, nodeB);
    }

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    function test_FullFlow_FundFinalizeClaimSweep() public {
        uint256 allocated = a0 + a1 + a2 + a3; // 18,750
        _createFundFinalize(allocated);

        // Each winner claims; funds land at the winner address.
        pool.claim(SEASON, 0, w0, a0, _proof(0));
        pool.claim(SEASON, 1, w1, a1, _proof(1));
        pool.claim(SEASON, 2, w2, a2, _proof(2));
        pool.claim(SEASON, 3, w3, a3, _proof(3));

        assertEq(token.balanceOf(w0), a0);
        assertEq(token.balanceOf(w1), a1);
        assertEq(token.balanceOf(w2), a2);
        assertEq(token.balanceOf(w3), a3);
        assertTrue(pool.isClaimed(SEASON, 0));
        assertTrue(pool.isClaimed(SEASON, 3));

        (, , uint256 claimed, , , , , ) = pool.seasons(SEASON);
        assertEq(claimed, allocated);

        // Sweep the unallocated/unclaimed remainder (25,000 - 18,750) to owner.
        uint256 ownerBefore = token.balanceOf(owner);
        vm.warp(block.timestamp + 8 days);
        pool.sweepUnclaimed(SEASON);
        assertEq(token.balanceOf(owner) - ownerBefore, FUNDED - allocated);
        assertEq(token.balanceOf(address(pool)), 0);
    }

    function test_Claim_AnyoneCanSubmit_FundsGoToWinner() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        vm.prank(attacker); // attacker pays gas, but funds go to w0
        pool.claim(SEASON, 0, w0, a0, _proof(0));
        assertEq(token.balanceOf(w0), a0);
        assertEq(token.balanceOf(attacker), 0);
    }

    function test_Fund_NoFeeOnTransfer_BalanceMatches() public {
        pool.createSeason(SEASON, WEEK);
        pool.fundSeason(SEASON, FUNDED);
        assertEq(token.balanceOf(address(pool)), FUNDED); // plain ERC-20 assumption
        (uint256 funded, , , , , , , ) = pool.seasons(SEASON);
        assertEq(funded, FUNDED);
    }

    // -------------------------------------------------------------------------
    // Claim guards
    // -------------------------------------------------------------------------

    function test_DoubleClaim_Reverts() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        pool.claim(SEASON, 0, w0, a0, _proof(0));
        vm.expectRevert(NikoPrizePool.AlreadyClaimed.selector);
        pool.claim(SEASON, 0, w0, a0, _proof(0));
    }

    function test_WrongAmount_Reverts() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        vm.expectRevert(NikoPrizePool.InvalidProof.selector);
        pool.claim(SEASON, 0, w0, a0 + 1, _proof(0));
    }

    function test_WrongAccount_Reverts() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        vm.expectRevert(NikoPrizePool.InvalidProof.selector);
        pool.claim(SEASON, 0, attacker, a0, _proof(0));
    }

    function test_ClaimBeforeFinalize_Reverts() public {
        pool.createSeason(SEASON, WEEK);
        pool.fundSeason(SEASON, FUNDED);
        vm.expectRevert(NikoPrizePool.NotFinalized.selector);
        pool.claim(SEASON, 0, w0, a0, _proof(0));
    }

    function test_ClaimAfterDeadline_Reverts() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        vm.warp(block.timestamp + 8 days);
        vm.expectRevert(NikoPrizePool.ClaimWindowClosed.selector);
        pool.claim(SEASON, 0, w0, a0, _proof(0));
    }

    function test_PauseBlocksClaim_ThenUnpause() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        pool.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        pool.claim(SEASON, 0, w0, a0, _proof(0));
        pool.unpause();
        pool.claim(SEASON, 0, w0, a0, _proof(0));
        assertEq(token.balanceOf(w0), a0);
    }

    // -------------------------------------------------------------------------
    // Finalize / sweep guards
    // -------------------------------------------------------------------------

    function test_Finalize_AllocationExceedsFunded_Reverts() public {
        pool.createSeason(SEASON, WEEK);
        pool.fundSeason(SEASON, FUNDED);
        vm.expectRevert(NikoPrizePool.AllocationExceedsFunded.selector);
        pool.finalizeSeason(SEASON, root, FUNDED + 1, uint64(block.timestamp + 7 days));
    }

    function test_Finalize_PastDeadline_Reverts() public {
        pool.createSeason(SEASON, WEEK);
        pool.fundSeason(SEASON, FUNDED);
        vm.expectRevert(NikoPrizePool.InvalidDeadline.selector);
        pool.finalizeSeason(SEASON, root, a0, uint64(block.timestamp));
    }

    function test_Finalize_Twice_Reverts() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        vm.expectRevert(NikoPrizePool.AlreadyFinalized.selector);
        pool.finalizeSeason(SEASON, root, a0, uint64(block.timestamp + 7 days));
    }

    function test_Sweep_BeforeDeadline_Reverts() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        vm.expectRevert(NikoPrizePool.ClaimWindowOpen.selector);
        pool.sweepUnclaimed(SEASON);
    }

    function test_Sweep_Twice_Reverts() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        vm.warp(block.timestamp + 8 days);
        pool.sweepUnclaimed(SEASON);
        vm.expectRevert(NikoPrizePool.AlreadySwept.selector);
        pool.sweepUnclaimed(SEASON);
    }

    function test_FundAfterFinalize_Reverts() public {
        _createFundFinalize(a0 + a1 + a2 + a3);
        vm.expectRevert(NikoPrizePool.AlreadyFinalized.selector);
        pool.fundSeason(SEASON, 1 ether);
    }

    function test_CreateDuplicate_Reverts() public {
        pool.createSeason(SEASON, WEEK);
        vm.expectRevert(NikoPrizePool.SeasonAlreadyExists.selector);
        pool.createSeason(SEASON, WEEK);
    }

    // -------------------------------------------------------------------------
    // Access control
    // -------------------------------------------------------------------------

    function test_OnlyOwner_Functions() public {
        bytes4 sel = Ownable.OwnableUnauthorizedAccount.selector;
        vm.startPrank(attacker);
        vm.expectRevert(abi.encodeWithSelector(sel, attacker));
        pool.createSeason(SEASON, WEEK);
        vm.expectRevert(abi.encodeWithSelector(sel, attacker));
        pool.fundSeason(SEASON, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(sel, attacker));
        pool.finalizeSeason(SEASON, root, a0, uint64(block.timestamp + 1 days));
        vm.expectRevert(abi.encodeWithSelector(sel, attacker));
        pool.sweepUnclaimed(SEASON);
        vm.expectRevert(abi.encodeWithSelector(sel, attacker));
        pool.pause();
        vm.stopPrank();
    }

    function test_Constructor_ZeroToken_Reverts() public {
        vm.expectRevert(NikoPrizePool.ZeroAddress.selector);
        new NikoPrizePool(IERC20(address(0)), owner);
    }

    function test_Constructor_ZeroOwner_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new NikoPrizePool(token, address(0));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _createFundFinalize(uint256 allocated) internal {
        pool.createSeason(SEASON, WEEK);
        pool.fundSeason(SEASON, FUNDED);
        pool.finalizeSeason(SEASON, root, allocated, uint64(block.timestamp + 7 days));
    }

    function _leaf(uint256 index, address account, uint256 amount) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))));
    }

    /// @dev Proof for a 4-leaf, sorted-pair tree (matches MerkleProof.verify).
    function _proof(uint256 index) internal view returns (bytes32[] memory p) {
        p = new bytes32[](2);
        if (index == 0) {
            p[0] = leaves[1];
            p[1] = _hashPair(leaves[2], leaves[3]);
        } else if (index == 1) {
            p[0] = leaves[0];
            p[1] = _hashPair(leaves[2], leaves[3]);
        } else if (index == 2) {
            p[0] = leaves[3];
            p[1] = _hashPair(leaves[0], leaves[1]);
        } else {
            p[0] = leaves[2];
            p[1] = _hashPair(leaves[0], leaves[1]);
        }
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
}
