// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Script } from "forge-std/Script.sol";
import { MealPlanner } from "../src/Planner.sol";

contract DeployPlanner is Script {
    MealPlanner planner;

    function run() external returns(MealPlanner) {
        vm.startBroadcast();
        planner = new MealPlanner();
        vm.stopBroadcast();

        return planner;
    }
}