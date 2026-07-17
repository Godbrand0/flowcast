// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStreamVault {
    enum StreamStatus {
        Active,
        Paused,
        Cancelled,
        Completed
    }

    struct Stream {
        address business;
        address recipient;
        uint256 deposit;
        uint256 ratePerSecond;
        uint40 startTime;
        uint40 endTime;
        uint40 pausedAt;
        uint256 withdrawn;
        StreamStatus status;
        bool cancelable;
    }

    function deposit(uint256 amount) external;

    function createStream(
        address recipient,
        uint256 totalAmount,
        uint40 endTime,
        bool cancelable
    ) external returns (uint256 streamId);

    function createStreamFor(
        address business,
        address recipient,
        uint256 totalAmount,
        uint40 endTime,
        bool cancelable
    ) external returns (uint256 streamId);

    function withdraw(uint256 streamId) external returns (uint256 amount);

    function pauseStream(uint256 streamId) external;

    function resumeStream(uint256 streamId) external;

    function cancelStream(uint256 streamId) external;

    function withdrawVault(uint256 amount) external;

    function setOperator(address operator, bool approved) external;

    function getStream(uint256 streamId) external view returns (Stream memory);

    function accruedBalance(uint256 streamId) external view returns (uint256);

    function vaultBalance(address business) external view returns (uint256);

    function getBusinessStreams(address business) external view returns (uint256[] memory);

    function getRecipientStreams(address recipient) external view returns (uint256[] memory);
}
