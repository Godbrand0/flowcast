// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IStreamVault } from "./interfaces/IStreamVault.sol";

/// @title BatchStream — one-transaction payroll runs on top of StreamVault
/// @notice A business approves this contract as an operator on the vault
///         (`vault.setOperator(batchStream, true)`), then creates a whole
///         payroll run of streams in a single transaction.
contract BatchStream {
    IStreamVault public immutable vault;

    struct BatchEntry {
        address recipient;
        uint256 totalAmount;
        uint40 endTime;
        bool cancelable;
    }

    event BatchCreated(address indexed business, uint256[] streamIds);

    error EmptyBatch();

    constructor(address _vault) {
        vault = IStreamVault(_vault);
    }

    /// @notice Create one stream per entry, all funded from the caller's vault
    ///         balance. Requires prior `deposit()` covering the batch total and
    ///         operator approval for this contract.
    function createBatch(BatchEntry[] calldata entries) external returns (uint256[] memory streamIds) {
        if (entries.length == 0) revert EmptyBatch();

        streamIds = new uint256[](entries.length);
        for (uint256 i = 0; i < entries.length; i++) {
            streamIds[i] = vault.createStreamFor(
                msg.sender,
                entries[i].recipient,
                entries[i].totalAmount,
                entries[i].endTime,
                entries[i].cancelable
            );
        }

        emit BatchCreated(msg.sender, streamIds);
    }
}
