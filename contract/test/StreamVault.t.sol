// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { StreamVault } from "../src/StreamVault.sol";
import { IStreamVault } from "../src/interfaces/IStreamVault.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

contract StreamVaultTest is Test {
    StreamVault internal vault;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal business = makeAddr("business");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant DEPOSIT = 10_000e6; // $10,000
    uint256 internal constant STREAM_TOTAL = 2_592_000e6; // divisible by 30 days of seconds
    uint40 internal constant THIRTY_DAYS = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new StreamVault(address(usdc), owner);

        usdc.mint(business, 100_000_000e6);
        vm.prank(business);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    function _deposit(uint256 amount) internal {
        vm.prank(business);
        vault.deposit(amount);
    }

    function _createStream(address recipient, uint256 total, uint40 duration, bool cancelable)
        internal
        returns (uint256)
    {
        vm.prank(business);
        return vault.createStream(recipient, total, uint40(block.timestamp) + duration, cancelable);
    }

    // ─── Deposit ──────────────────────────────────────────────────────────

    function test_deposit() public {
        _deposit(DEPOSIT);
        assertEq(vault.vaultBalance(business), DEPOSIT);
        assertEq(usdc.balanceOf(address(vault)), DEPOSIT);
    }

    function test_deposit_revertsOnZero() public {
        vm.prank(business);
        vm.expectRevert(StreamVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    // ─── Create Stream ────────────────────────────────────────────────────

    function test_createStream() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);

        IStreamVault.Stream memory s = vault.getStream(id);
        assertEq(s.business, business);
        assertEq(s.recipient, alice);
        assertEq(s.ratePerSecond, STREAM_TOTAL / THIRTY_DAYS);
        assertEq(s.deposit, STREAM_TOTAL); // divisible: no dust
        assertEq(uint8(s.status), uint8(IStreamVault.StreamStatus.Active));
        assertEq(vault.vaultBalance(business), 0);

        uint256[] memory bStreams = vault.getBusinessStreams(business);
        uint256[] memory rStreams = vault.getRecipientStreams(alice);
        assertEq(bStreams[0], id);
        assertEq(rStreams[0], id);
    }

    function test_createStream_returnsDustToVault() public {
        _deposit(DEPOSIT);
        // 10_000e6 over 30 days → rate 3858, actual deposit 3858 * 2592000 = 9_999_9...
        uint256 id = _createStream(alice, DEPOSIT, THIRTY_DAYS, true);

        IStreamVault.Stream memory s = vault.getStream(id);
        uint256 expectedRate = DEPOSIT / uint256(THIRTY_DAYS);
        uint256 expectedDeposit = expectedRate * THIRTY_DAYS;
        assertEq(s.deposit, expectedDeposit);
        assertEq(vault.vaultBalance(business), DEPOSIT - expectedDeposit);
    }

    function test_createStream_revertsOnInsufficientBalance() public {
        _deposit(100e6);
        vm.prank(business);
        vm.expectRevert(
            abi.encodeWithSelector(StreamVault.InsufficientVaultBalance.selector, 200e6, 100e6)
        );
        vault.createStream(alice, 200e6, uint40(block.timestamp) + THIRTY_DAYS, true);
    }

    function test_createStream_revertsOnPastEndTime() public {
        _deposit(DEPOSIT);
        vm.prank(business);
        vm.expectRevert(StreamVault.InvalidTimeRange.selector);
        vault.createStream(alice, 100e6, uint40(block.timestamp), true);
    }

    function test_createStream_revertsOnRateTooLow() public {
        _deposit(DEPOSIT);
        vm.prank(business);
        // 1 unit (0.000001 USDC) over 30 days → rate rounds to 0
        vm.expectRevert(StreamVault.RateTooLow.selector);
        vault.createStream(alice, 1, uint40(block.timestamp) + THIRTY_DAYS, true);
    }

    // ─── Accrual & Withdraw ───────────────────────────────────────────────

    function test_accrual_linearOverTime() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);
        uint256 rate = STREAM_TOTAL / uint256(THIRTY_DAYS);

        assertEq(vault.accruedBalance(id), 0);

        vm.warp(block.timestamp + 1 hours);
        assertEq(vault.accruedBalance(id), rate * 1 hours);

        vm.warp(block.timestamp + 100 days); // way past end
        assertEq(vault.accruedBalance(id), STREAM_TOTAL);
    }

    function test_withdraw_midStream() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);
        uint256 rate = STREAM_TOTAL / uint256(THIRTY_DAYS);

        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        uint256 amount = vault.withdraw(id);

        assertEq(amount, rate * 10 days);
        assertEq(usdc.balanceOf(alice), amount);
        assertEq(vault.accruedBalance(id), 0);

        // accrual continues after a withdrawal
        vm.warp(block.timestamp + 1 days);
        assertEq(vault.accruedBalance(id), rate * 1 days);
    }

    function test_withdraw_fullAtEnd_marksCompleted() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);

        vm.warp(block.timestamp + THIRTY_DAYS);
        vm.prank(alice);
        uint256 amount = vault.withdraw(id);

        assertEq(amount, STREAM_TOTAL);
        IStreamVault.Stream memory s = vault.getStream(id);
        assertEq(uint8(s.status), uint8(IStreamVault.StreamStatus.Completed));
    }

    function test_withdraw_revertsForNonRecipient() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);

        vm.warp(block.timestamp + 1 days);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(StreamVault.NotStreamRecipient.selector, id));
        vault.withdraw(id);
    }

    function test_withdraw_revertsWhenNothingAccrued() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(StreamVault.NothingToWithdraw.selector, id));
        vault.withdraw(id);
    }

    // ─── Pause / Resume ───────────────────────────────────────────────────

    function test_pause_freezesAccrual() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);
        uint256 rate = STREAM_TOTAL / uint256(THIRTY_DAYS);

        vm.warp(block.timestamp + 5 days);
        vm.prank(business);
        vault.pauseStream(id);

        uint256 frozen = vault.accruedBalance(id);
        assertEq(frozen, rate * 5 days);

        vm.warp(block.timestamp + 10 days);
        assertEq(vault.accruedBalance(id), frozen); // no accrual while paused
    }

    function test_withdraw_whilePaused_keepsAccruedFunds() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);
        uint256 rate = STREAM_TOTAL / uint256(THIRTY_DAYS);

        vm.warp(block.timestamp + 5 days);
        vm.prank(business);
        vault.pauseStream(id);

        vm.warp(block.timestamp + 3 days);
        vm.prank(alice);
        uint256 amount = vault.withdraw(id);
        assertEq(amount, rate * 5 days);
    }

    function test_resume_preservesAccruedAndTotal() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);
        uint256 rate = STREAM_TOTAL / uint256(THIRTY_DAYS);
        uint40 originalEnd = uint40(block.timestamp) + THIRTY_DAYS;

        vm.warp(block.timestamp + 5 days);
        vm.prank(business);
        vault.pauseStream(id);

        vm.warp(block.timestamp + 7 days); // paused for a week
        vm.prank(business);
        vault.resumeStream(id);

        // accrued-but-unwithdrawn survives the pause
        assertEq(vault.accruedBalance(id), rate * 5 days);

        IStreamVault.Stream memory s = vault.getStream(id);
        assertEq(s.endTime, originalEnd + 7 days);
        assertEq(s.ratePerSecond, rate); // rate never drifts

        // full amount still vests by the (shifted) end
        vm.warp(s.endTime);
        assertEq(vault.accruedBalance(id), STREAM_TOTAL);
    }

    function test_pause_onlyBusiness() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(StreamVault.NotStreamBusiness.selector, id));
        vault.pauseStream(id);
    }

    // ─── Cancel ───────────────────────────────────────────────────────────

    function test_cancel_splitsFundsCorrectly() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);
        uint256 rate = STREAM_TOTAL / uint256(THIRTY_DAYS);

        vm.warp(block.timestamp + 12 days);
        vm.prank(business);
        vault.cancelStream(id);

        uint256 accrued = rate * 12 days;
        assertEq(usdc.balanceOf(alice), accrued);
        assertEq(vault.vaultBalance(business), STREAM_TOTAL - accrued);

        IStreamVault.Stream memory s = vault.getStream(id);
        assertEq(uint8(s.status), uint8(IStreamVault.StreamStatus.Cancelled));
        assertEq(vault.accruedBalance(id), 0);
    }

    function test_cancel_afterPartialWithdraw() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);
        uint256 rate = STREAM_TOTAL / uint256(THIRTY_DAYS);

        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        vault.withdraw(id);

        vm.warp(block.timestamp + 5 days);
        vm.prank(business);
        vault.cancelStream(id);

        // alice: 10 days withdrawn + 5 days paid on cancel
        assertEq(usdc.balanceOf(alice), rate * 15 days);
        assertEq(vault.vaultBalance(business), STREAM_TOTAL - rate * 15 days);
    }

    function test_cancel_revertsWhenNotCancelable() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, false);

        vm.prank(business);
        vm.expectRevert(abi.encodeWithSelector(StreamVault.StreamNotCancelable.selector, id));
        vault.cancelStream(id);
    }

    function test_cancel_whilePaused() public {
        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);
        uint256 rate = STREAM_TOTAL / uint256(THIRTY_DAYS);

        vm.warp(block.timestamp + 5 days);
        vm.prank(business);
        vault.pauseStream(id);

        vm.warp(block.timestamp + 10 days);
        vm.prank(business);
        vault.cancelStream(id);

        // only the 5 active days are owed to alice
        assertEq(usdc.balanceOf(alice), rate * 5 days);
        assertEq(vault.vaultBalance(business), STREAM_TOTAL - rate * 5 days);
    }

    // ─── Vault Withdraw ───────────────────────────────────────────────────

    function test_withdrawVault() public {
        _deposit(DEPOSIT);
        vm.prank(business);
        vault.withdrawVault(4_000e6);

        assertEq(vault.vaultBalance(business), 6_000e6);
        assertEq(usdc.balanceOf(business), 100_000_000e6 - 6_000e6);
    }

    function test_withdrawVault_revertsAboveBalance() public {
        _deposit(100e6);
        vm.prank(business);
        vm.expectRevert(
            abi.encodeWithSelector(StreamVault.InsufficientVaultBalance.selector, 200e6, 100e6)
        );
        vault.withdrawVault(200e6);
    }

    // ─── Protocol Fee ─────────────────────────────────────────────────────

    function test_protocolFee() public {
        vm.prank(owner);
        vault.setProtocolFee(100); // 1%

        _deposit(STREAM_TOTAL);
        uint256 id = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);

        uint256 fee = STREAM_TOTAL / 100;
        assertEq(vault.accruedProtocolFees(), fee);

        IStreamVault.Stream memory s = vault.getStream(id);
        uint256 expectedRate = (STREAM_TOTAL - fee) / uint256(THIRTY_DAYS);
        assertEq(s.ratePerSecond, expectedRate);

        vm.prank(owner);
        vault.claimProtocolFees();
        assertEq(usdc.balanceOf(owner), fee);
        assertEq(vault.accruedProtocolFees(), 0);
    }

    function test_setProtocolFee_capped() public {
        vm.prank(owner);
        vm.expectRevert("Max 1%");
        vault.setProtocolFee(101);
    }

    // ─── Solvency invariant ───────────────────────────────────────────────

    function test_vaultStaysSolvent_throughFullLifecycle() public {
        _deposit(STREAM_TOTAL * 2);
        uint256 id1 = _createStream(alice, STREAM_TOTAL, THIRTY_DAYS, true);
        uint256 id2 = _createStream(bob, STREAM_TOTAL, THIRTY_DAYS, true);

        vm.warp(block.timestamp + 15 days);
        vm.prank(alice);
        vault.withdraw(id1);
        vm.prank(business);
        vault.cancelStream(id2);

        vm.warp(block.timestamp + 15 days);
        vm.prank(alice);
        vault.withdraw(id1);

        vm.startPrank(business);
        vault.withdrawVault(vault.vaultBalance(business));
        vm.stopPrank();

        // every claim paid out; nothing stuck, nothing over-paid
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(usdc.balanceOf(alice), STREAM_TOTAL);
    }
}
