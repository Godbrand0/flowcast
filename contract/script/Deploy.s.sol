// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { StreamVault } from "../src/StreamVault.sol";
import { BatchStream } from "../src/BatchStream.sol";

/// @notice Deploys StreamVault + BatchStream to Arc Testnet.
///
/// Usage:
///   source .env
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $ARC_TESTNET_RPC_URL --private-key $PRIVATE_KEY --broadcast
///
/// .env:
///   ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
///   PRIVATE_KEY=0x...
///   ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        StreamVault vault = new StreamVault(usdc, deployer);
        BatchStream batch = new BatchStream(address(vault));

        vm.stopBroadcast();

        console.log("StreamVault:", address(vault));
        console.log("BatchStream:", address(batch));
        console.log("Owner:      ", deployer);
    }
}
