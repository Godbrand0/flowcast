// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { StreamVault } from "../src/StreamVault.sol";
import { BatchStream } from "../src/BatchStream.sol";
import { IStreamVault } from "../src/interfaces/IStreamVault.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

contract BatchStreamTest is Test {
    StreamVault internal vault;
    BatchStream internal batch;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal business = makeAddr("business");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint40 internal constant THIRTY_DAYS = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new StreamVault(address(usdc), owner);
        batch = new BatchStream(address(vault));

        usdc.mint(business, 1_000_000e6);
        vm.startPrank(business);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000e6);
        vault.setOperator(address(batch), true);
        vm.stopPrank();
    }

    function _entries() internal view returns (BatchStream.BatchEntry[] memory entries) {
        uint40 end = uint40(block.timestamp) + THIRTY_DAYS;
        entries = new BatchStream.BatchEntry[](3);
        entries[0] = BatchStream.BatchEntry(alice, 259_200e6, end, true);
        entries[1] = BatchStream.BatchEntry(bob, 129_600e6, end, true);
        entries[2] = BatchStream.BatchEntry(carol, 51_840e6, end, false);
    }

    function test_createBatch() public {
        vm.prank(business);
        uint256[] memory ids = batch.createBatch(_entries());

        assertEq(ids.length, 3);

        IStreamVault.Stream memory s0 = vault.getStream(ids[0]);
        assertEq(s0.business, business);
        assertEq(s0.recipient, alice);
        assertEq(s0.deposit, 259_200e6);

        IStreamVault.Stream memory s2 = vault.getStream(ids[2]);
        assertEq(s2.recipient, carol);
        assertFalse(s2.cancelable);

        // total drawn from the business's own vault balance
        assertEq(vault.vaultBalance(business), 1_000_000e6 - 259_200e6 - 129_600e6 - 51_840e6);
        assertEq(vault.getBusinessStreams(business).length, 3);
    }

    function test_createBatch_revertsWithoutOperatorApproval() public {
        vm.prank(business);
        vault.setOperator(address(batch), false);

        vm.prank(business);
        vm.expectRevert(
            abi.encodeWithSelector(StreamVault.NotOperator.selector, business, address(batch))
        );
        batch.createBatch(_entries());
    }

    function test_createBatch_revertsOnEmpty() public {
        vm.prank(business);
        vm.expectRevert(BatchStream.EmptyBatch.selector);
        batch.createBatch(new BatchStream.BatchEntry[](0));
    }

    function test_createBatch_drawsFromCallerNotOperator() public {
        // a second business without funds cannot piggyback on the first
        address broke = makeAddr("broke");
        vm.startPrank(broke);
        vault.setOperator(address(batch), true);
        vm.expectRevert(
            abi.encodeWithSelector(
                StreamVault.InsufficientVaultBalance.selector, 259_200e6, 0
            )
        );
        batch.createBatch(_entries());
        vm.stopPrank();
    }
}
