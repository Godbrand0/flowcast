// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IStreamVault } from "./interfaces/IStreamVault.sol";

/// @title StreamVault — pull-based USDC payment streaming on Arc
/// @notice Businesses deposit USDC into a per-address vault balance and open
///         per-second streams to recipients. Recipients withdraw accrued USDC
///         at any time; no keepers or automation required.
contract StreamVault is IStreamVault, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────

    IERC20 public immutable USDC;

    uint256 public nextStreamId = 1;

    /// streamId → Stream
    mapping(uint256 => Stream) private _streams;

    /// business address → vault balance (deposited but not yet streamed)
    mapping(address => uint256) public vaultBalance;

    /// business address → stream IDs
    mapping(address => uint256[]) public businessStreams;

    /// recipient address → stream IDs
    mapping(address => uint256[]) public recipientStreams;

    /// business → operator → approved (lets e.g. BatchStream open streams on their behalf)
    mapping(address => mapping(address => bool)) public isOperator;

    /// Protocol fee in basis points (0 at launch)
    uint16 public protocolFeeBps;

    /// Accumulated protocol fees
    uint256 public accruedProtocolFees;

    // ─── Events ───────────────────────────────────────────────────────────

    event Deposited(address indexed business, uint256 amount);
    event StreamCreated(
        uint256 indexed streamId,
        address indexed business,
        address indexed recipient,
        uint256 deposit,
        uint256 ratePerSecond,
        uint40 startTime,
        uint40 endTime
    );
    event Withdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event StreamPaused(uint256 indexed streamId);
    event StreamResumed(uint256 indexed streamId, uint40 newEndTime);
    event StreamCancelled(uint256 indexed streamId, uint256 businessRefund, uint256 recipientPayout);
    event StreamCompleted(uint256 indexed streamId);
    event VaultWithdrawn(address indexed business, uint256 amount);
    event OperatorSet(address indexed business, address indexed operator, bool approved);

    // ─── Errors ───────────────────────────────────────────────────────────

    error StreamNotFound(uint256 streamId);
    error NotStreamBusiness(uint256 streamId);
    error NotStreamRecipient(uint256 streamId);
    error StreamNotActive(uint256 streamId);
    error StreamNotPaused(uint256 streamId);
    error NothingToWithdraw(uint256 streamId);
    error StreamNotCancelable(uint256 streamId);
    error InsufficientVaultBalance(uint256 required, uint256 available);
    error InvalidTimeRange();
    error RateTooLow();
    error ZeroAmount();
    error ZeroAddress();
    error NotOperator(address business, address caller);

    // ─── Constructor ──────────────────────────────────────────────────────

    constructor(address _usdc, address _owner) Ownable(_owner) {
        if (_usdc == address(0)) revert ZeroAddress();
        USDC = IERC20(_usdc);
    }

    // ─── Business: Deposit ────────────────────────────────────────────────

    /// @notice Deposit USDC into the caller's vault balance.
    /// @dev Caller must approve this contract first. Multiple streams draw
    ///      from the same vault balance.
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        vaultBalance[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    // ─── Business: Create Stream ──────────────────────────────────────────

    /// @notice Open a stream funded from the caller's vault balance.
    /// @param recipient   Recipient wallet address
    /// @param totalAmount Total USDC (6 decimals) to stream
    /// @param endTime     Unix timestamp when the stream fully vests
    /// @param cancelable  Whether the business may cancel and reclaim unstreamed funds
    function createStream(
        address recipient,
        uint256 totalAmount,
        uint40 endTime,
        bool cancelable
    ) external nonReentrant whenNotPaused returns (uint256 streamId) {
        return _createStream(msg.sender, recipient, totalAmount, endTime, cancelable);
    }

    /// @notice Open a stream on behalf of `business`. Caller must be the
    ///         business itself or an approved operator (e.g. BatchStream).
    function createStreamFor(
        address business,
        address recipient,
        uint256 totalAmount,
        uint40 endTime,
        bool cancelable
    ) external nonReentrant whenNotPaused returns (uint256 streamId) {
        if (msg.sender != business && !isOperator[business][msg.sender]) {
            revert NotOperator(business, msg.sender);
        }
        return _createStream(business, recipient, totalAmount, endTime, cancelable);
    }

    /// @notice Approve or revoke an operator that may open streams from the
    ///         caller's vault balance.
    function setOperator(address operator, bool approved) external {
        if (operator == address(0)) revert ZeroAddress();
        isOperator[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    function _createStream(
        address business,
        address recipient,
        uint256 totalAmount,
        uint40 endTime,
        bool cancelable
    ) internal returns (uint256 streamId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (totalAmount == 0) revert ZeroAmount();
        if (endTime <= block.timestamp) revert InvalidTimeRange();
        if (vaultBalance[business] < totalAmount) {
            revert InsufficientVaultBalance(totalAmount, vaultBalance[business]);
        }

        uint40 startTime = uint40(block.timestamp);
        uint256 duration = endTime - startTime;

        uint256 fee = 0;
        if (protocolFeeBps > 0) {
            fee = (totalAmount * protocolFeeBps) / 10_000;
            accruedProtocolFees += fee;
        }

        uint256 netDeposit = totalAmount - fee;
        uint256 ratePerSecond = netDeposit / duration;
        if (ratePerSecond == 0) revert RateTooLow();
        uint256 actualDeposit = ratePerSecond * duration;

        // Deduct the full amount, then return sub-second dust to the vault.
        uint256 dust = netDeposit - actualDeposit;
        vaultBalance[business] -= totalAmount;
        if (dust > 0) vaultBalance[business] += dust;

        streamId = nextStreamId++;
        _streams[streamId] = Stream({
            business: business,
            recipient: recipient,
            deposit: actualDeposit,
            ratePerSecond: ratePerSecond,
            startTime: startTime,
            endTime: endTime,
            pausedAt: 0,
            withdrawn: 0,
            status: StreamStatus.Active,
            cancelable: cancelable
        });

        businessStreams[business].push(streamId);
        recipientStreams[recipient].push(streamId);

        emit StreamCreated(streamId, business, recipient, actualDeposit, ratePerSecond, startTime, endTime);
    }

    // ─── Recipient: Withdraw ──────────────────────────────────────────────

    /// @notice Withdraw all accrued USDC. Allowed while the stream is Active
    ///         or Paused — funds accrued before a pause belong to the recipient.
    /// @dev On Arc the received USDC also pays for future gas — no other token needed.
    function withdraw(uint256 streamId) external nonReentrant returns (uint256 amount) {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) revert StreamNotFound(streamId);
        if (stream.recipient != msg.sender) revert NotStreamRecipient(streamId);
        if (stream.status != StreamStatus.Active && stream.status != StreamStatus.Paused) {
            revert StreamNotActive(streamId);
        }

        amount = _accruedBalance(stream);
        if (amount == 0) revert NothingToWithdraw(streamId);

        stream.withdrawn += amount;

        if (stream.withdrawn >= stream.deposit) {
            stream.status = StreamStatus.Completed;
            emit StreamCompleted(streamId);
        }

        USDC.safeTransfer(msg.sender, amount);
        emit Withdrawn(streamId, msg.sender, amount);
    }

    // ─── Business: Pause / Resume / Cancel ────────────────────────────────

    /// @notice Pause a stream — halts accrual from this moment. Already-accrued
    ///         funds remain withdrawable by the recipient.
    function pauseStream(uint256 streamId) external {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) revert StreamNotFound(streamId);
        if (stream.business != msg.sender) revert NotStreamBusiness(streamId);
        if (stream.status != StreamStatus.Active) revert StreamNotActive(streamId);

        stream.pausedAt = uint40(block.timestamp);
        stream.status = StreamStatus.Paused;
        emit StreamPaused(streamId);
    }

    /// @notice Resume a paused stream. The stream window shifts forward by the
    ///         paused duration, so the rate and total are unchanged and accrual
    ///         continues exactly where it stopped.
    function resumeStream(uint256 streamId) external {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) revert StreamNotFound(streamId);
        if (stream.business != msg.sender) revert NotStreamBusiness(streamId);
        if (stream.status != StreamStatus.Paused) revert StreamNotPaused(streamId);

        uint40 pausedDuration = uint40(block.timestamp) - stream.pausedAt;
        stream.startTime += pausedDuration;
        stream.endTime += pausedDuration;
        stream.pausedAt = 0;
        stream.status = StreamStatus.Active;

        emit StreamResumed(streamId, stream.endTime);
    }

    /// @notice Cancel a cancelable stream. Accrued-but-unwithdrawn USDC is paid
    ///         to the recipient; the unstreamed remainder returns to the
    ///         business's vault balance.
    function cancelStream(uint256 streamId) external nonReentrant {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) revert StreamNotFound(streamId);
        if (stream.business != msg.sender) revert NotStreamBusiness(streamId);
        if (!stream.cancelable) revert StreamNotCancelable(streamId);
        if (stream.status != StreamStatus.Active && stream.status != StreamStatus.Paused) {
            revert StreamNotActive(streamId);
        }

        uint256 recipientOwed = _accruedBalance(stream);
        uint256 businessRefund = stream.deposit - stream.withdrawn - recipientOwed;

        stream.withdrawn += recipientOwed;
        stream.status = StreamStatus.Cancelled;

        if (businessRefund > 0) vaultBalance[msg.sender] += businessRefund;
        if (recipientOwed > 0) USDC.safeTransfer(stream.recipient, recipientOwed);

        emit StreamCancelled(streamId, businessRefund, recipientOwed);
    }

    // ─── Business: Withdraw Vault Balance ─────────────────────────────────

    /// @notice Withdraw unstreamed USDC from the caller's vault balance.
    function withdrawVault(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > vaultBalance[msg.sender]) {
            revert InsufficientVaultBalance(amount, vaultBalance[msg.sender]);
        }
        vaultBalance[msg.sender] -= amount;
        USDC.safeTransfer(msg.sender, amount);
        emit VaultWithdrawn(msg.sender, amount);
    }

    // ─── View Functions ───────────────────────────────────────────────────

    function getStream(uint256 streamId) external view returns (Stream memory) {
        if (_streams[streamId].business == address(0)) revert StreamNotFound(streamId);
        return _streams[streamId];
    }

    /// @notice USDC currently withdrawable by the stream's recipient.
    function accruedBalance(uint256 streamId) external view returns (uint256) {
        Stream storage stream = _streams[streamId];
        if (stream.business == address(0)) return 0;
        if (stream.status == StreamStatus.Cancelled || stream.status == StreamStatus.Completed) {
            return 0;
        }
        return _accruedBalance(stream);
    }

    function getBusinessStreams(address business) external view returns (uint256[] memory) {
        return businessStreams[business];
    }

    function getRecipientStreams(address recipient) external view returns (uint256[] memory) {
        return recipientStreams[recipient];
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    /// @dev Vested = ratePerSecond × active seconds elapsed. While paused, the
    ///      clock stops at `pausedAt`; resume shifts the window so only active
    ///      time ever counts.
    function _accruedBalance(Stream storage stream) internal view returns (uint256) {
        uint256 effectiveTime = stream.status == StreamStatus.Paused
            ? stream.pausedAt
            : block.timestamp;
        if (effectiveTime >= stream.endTime) effectiveTime = stream.endTime;
        if (effectiveTime <= stream.startTime) return 0;

        uint256 elapsed = effectiveTime - stream.startTime;
        uint256 totalVested = elapsed * stream.ratePerSecond;
        if (totalVested > stream.deposit) totalVested = stream.deposit;

        return totalVested > stream.withdrawn ? totalVested - stream.withdrawn : 0;
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    function setProtocolFee(uint16 feeBps) external onlyOwner {
        require(feeBps <= 100, "Max 1%");
        protocolFeeBps = feeBps;
    }

    function claimProtocolFees() external onlyOwner {
        uint256 amount = accruedProtocolFees;
        accruedProtocolFees = 0;
        USDC.safeTransfer(owner(), amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
