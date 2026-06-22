// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title NikoPrizePool
 * @notice Sponsored, season-based prize pool for *NIKO: Guardian of Base*.
 *
 * v1 model (see docs/prize-pool-design.md): the treasury funds a season's pool
 * in $NIKO, play is free, and winners are decided OFF-CHAIN (the game cannot
 * prove skill scores on-chain). The operator publishes the winner list as a
 * Merkle root; winners claim with a proof. The operator can never take a
 * winner's allocation, claim on their behalf, or rewrite a finalized root —
 * it can only fund, post the (one-shot) root, pause, and sweep funds that go
 * UNclaimed past the deadline.
 *
 * The Merkle leaf is the OpenZeppelin StandardMerkleTree encoding:
 *   keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))))
 * Build the off-chain tree with the OpenZeppelin "merkle-tree" JS library using
 * the leaf encoding ["uint256","address","uint256"] => (index, account, amount).
 */
contract NikoPrizePool is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The ERC-20 paid out and accepted as funding ($NIKO on Base).
    IERC20 public immutable token;

    struct Season {
        uint256 funded; // total deposited for this season
        uint256 allocated; // total promised by the merkle root (<= funded)
        uint256 claimed; // total claimed so far (<= allocated)
        uint64 claimDeadline; // unix seconds; 0 until finalized
        bool finalized; // root posted; funding locked
        bool swept; // leftover returned to owner
        bytes32 merkleRoot; // 0x0 until finalized
        string weekKey; // e.g. "2026-W26" (indexing/UX)
    }

    /// @notice Season state by id.
    mapping(uint256 => Season) public seasons;
    /// @notice Whether a season id has been created.
    mapping(uint256 => bool) public seasonExists;
    /// @dev seasonId => bitmap word => 256 claimed bits.
    mapping(uint256 => mapping(uint256 => uint256)) private _claimedBitmap;

    event SeasonCreated(uint256 indexed id, string weekKey);
    event SeasonFunded(uint256 indexed id, address indexed from, uint256 amount, uint256 totalFunded);
    event SeasonFinalized(uint256 indexed id, bytes32 merkleRoot, uint256 allocated, uint64 claimDeadline);
    event Claimed(uint256 indexed id, uint256 index, address indexed account, uint256 amount);
    event Swept(uint256 indexed id, address indexed to, uint256 amount);

    error ZeroAddress();
    error SeasonAlreadyExists();
    error SeasonNotFound();
    error AlreadyFinalized();
    error NotFinalized();
    error AllocationExceedsFunded();
    error InvalidDeadline();
    error ClaimWindowClosed();
    error ClaimWindowOpen();
    error AlreadyClaimed();
    error InvalidProof();
    error AlreadySwept();

    /**
     * @param token_ The $NIKO ERC-20.
     * @param owner_ The operator (recommended: a Gnosis Safe multisig).
     */
    constructor(IERC20 token_, address owner_) Ownable(owner_) {
        // Ownable(owner_) already rejects a zero owner (OwnableInvalidOwner).
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
    }

    // -------------------------------------------------------------------------
    // Operator
    // -------------------------------------------------------------------------

    /// @notice Creates an empty season ready to be funded.
    function createSeason(uint256 id, string calldata weekKey) external onlyOwner {
        if (seasonExists[id]) revert SeasonAlreadyExists();
        seasonExists[id] = true;
        seasons[id].weekKey = weekKey;
        emit SeasonCreated(id, weekKey);
    }

    /// @notice Deposits `amount` of $NIKO into season `id`. Allowed until finalize.
    function fundSeason(uint256 id, uint256 amount) external onlyOwner {
        Season storage s = seasons[id];
        if (!seasonExists[id]) revert SeasonNotFound();
        if (s.finalized) revert AlreadyFinalized();
        s.funded += amount;
        emit SeasonFunded(id, msg.sender, amount, s.funded);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Posts the winner Merkle root for a season. One-shot: cannot be
     * changed once set, so players can trust the published results.
     * @param allocated Sum of all leaf amounts; must be <= funded.
     * @param claimDeadline Unix time after which unclaimed funds can be swept.
     */
    function finalizeSeason(uint256 id, bytes32 merkleRoot, uint256 allocated, uint64 claimDeadline)
        external
        onlyOwner
    {
        Season storage s = seasons[id];
        if (!seasonExists[id]) revert SeasonNotFound();
        if (s.finalized) revert AlreadyFinalized();
        if (allocated > s.funded) revert AllocationExceedsFunded();
        if (claimDeadline <= block.timestamp) revert InvalidDeadline();
        s.merkleRoot = merkleRoot;
        s.allocated = allocated;
        s.claimDeadline = claimDeadline;
        s.finalized = true;
        emit SeasonFinalized(id, merkleRoot, allocated, claimDeadline);
    }

    /// @notice Returns funds not claimed by the deadline to the owner (treasury).
    function sweepUnclaimed(uint256 id) external onlyOwner nonReentrant {
        Season storage s = seasons[id];
        if (!s.finalized) revert NotFinalized();
        if (block.timestamp <= s.claimDeadline) revert ClaimWindowOpen();
        if (s.swept) revert AlreadySwept();
        s.swept = true;
        uint256 amount = s.funded - s.claimed;
        emit Swept(id, owner(), amount);
        if (amount > 0) token.safeTransfer(owner(), amount);
    }

    /// @notice Emergency stop for claims (cannot move or redirect funds).
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // Winners
    // -------------------------------------------------------------------------

    /**
     * @notice Claims a prize for `account` (anyone may submit; funds always go
     * to `account`). Reverts unless the (index, account, amount) leaf is in the
     * finalized root and hasn't been claimed.
     */
    function claim(uint256 id, uint256 index, address account, uint256 amount, bytes32[] calldata proof)
        external
        nonReentrant
        whenNotPaused
    {
        Season storage s = seasons[id];
        if (!s.finalized) revert NotFinalized();
        if (block.timestamp > s.claimDeadline) revert ClaimWindowClosed();
        if (isClaimed(id, index)) revert AlreadyClaimed();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))));
        if (!MerkleProof.verify(proof, s.merkleRoot, leaf)) revert InvalidProof();

        _setClaimed(id, index);
        s.claimed += amount;
        emit Claimed(id, index, account, amount);
        token.safeTransfer(account, amount);
    }

    /// @notice Whether the leaf at `index` in season `id` has been claimed.
    function isClaimed(uint256 id, uint256 index) public view returns (bool) {
        uint256 word = index >> 8;
        uint256 bit = index & 0xff;
        return (_claimedBitmap[id][word] >> bit) & 1 == 1;
    }

    function _setClaimed(uint256 id, uint256 index) private {
        uint256 word = index >> 8;
        uint256 bit = index & 0xff;
        _claimedBitmap[id][word] |= (1 << bit);
    }
}
