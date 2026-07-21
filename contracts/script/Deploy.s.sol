// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DimidiumNursery} from "../src/DimidiumNursery.sol";

/// @notice Deploys DimidiumNursery to Robinhood Chain Testnet.
///
/// Usage:
///   export DEPLOYER_PRIVATE_KEY=0x...
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url https://rpc.testnet.chain.robinhood.com \
///     --broadcast
///
/// Then point the frontend at the printed address:
///   VITE_DIMIDIUM_CONTRACT=<address> npm run build
contract Deploy is Script {
    function run() external returns (DimidiumNursery nursery) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(pk);
        nursery = new DimidiumNursery();
        vm.stopBroadcast();

        console.log("DimidiumNursery deployed at:", address(nursery));
        console.log("Chain id:", block.chainid);
    }
}
