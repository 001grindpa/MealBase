// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { Test, console } from "forge-std/Test.sol";
import { DeployPlanner } from "../script/DeployPlanner.s.sol";
import { MealPlanner } from "../src/Planner.sol";

contract TestPlanner is Test {
    DeployPlanner deployer;
    MealPlanner planner;
    // declare user
    address user = makeAddr("user");
    // state variables
    uint256 morning = 0; uint256 afternoon = 1; uint256 evening = 2;
    string[3] public names = ["Jollof Rice"/* morning */, "Afang soup"/* afternoon */, "Pap"/* evening */];
    string[3] public urls = ["recipe_url"/* morning */, "another_url"/* afternoon */, "last_url"/* evening */];
    uint16[3] public calories = [377/* morning */, 200/* afternoon */, 250/* evening */];

    // events
    event MealUpdated(address indexed user, MealPlanner.Day day);
    event PlanCleared(MealPlanner.Day indexed day);

    function setUp() external {
        deployer = new DeployPlanner();
        planner = deployer.run();
    }

    function testSetMeal() public {
        vm.prank(user);
        MealPlanner.Day day = MealPlanner.Day.Mon;
        planner.setMeal(day, names, urls, calories);
        console.log("meal setup successfull");

        MealPlanner.Meal memory meal = planner.getMeal(user, day, afternoon);
        
        console.log("Meal name: %s <--> Calories: %s", meal.name, meal.calories);
    }

    function testGetRecipeUri() public {
        vm.prank(user);
        MealPlanner.Day day = MealPlanner.Day.Fri;
        planner.setMeal(day, names, urls, calories);
        console.log("meal setup successfull");

        string memory uri = planner.recipeUri(user, day, afternoon);
        string memory dayString = (day == MealPlanner.Day.Mon)?"Monday":(day == MealPlanner.Day.Tue)?"Tuesday":(day == MealPlanner.Day.Wed)?"Wednesday":(day == MealPlanner.Day.Thu)?"Thursday":"Friday";

        console.log("ipfs uri for %s meal => %s", dayString, uri);
    }

    function testClearingPlan() public {
        vm.startPrank(user);
        MealPlanner.Day day = MealPlanner.Day.Mon;
        planner.setMeal(day, names, urls, calories);
        console.log("meal setup successfull");

        MealPlanner.Meal memory meal = planner.getMeal(user, day, morning);
        
        console.log("Meal name: %s <--> Calories: %s", meal.name, meal.calories);
        // clear plan
        console.log("Clearing meal plan...");
        planner.clearPlan(day);
        console.log("Meal plan cleared");
        vm.stopPrank();
    }

    function testSetMealEvent() public {
        MealPlanner.Day day = MealPlanner.Day.Mon;
        
        vm.prank(user);
        vm.expectEmit(true, false, false, false);
        emit MealUpdated(user, day);

        planner.setMeal(day, names, urls, calories);
    }

    function testClearPlanEvent() public {
        MealPlanner.Day day = MealPlanner.Day.Mon;
        // set meals first
        planner.setMeal(day, names, urls, calories);
        
        vm.prank(user);
        vm.expectEmit(true, false, false, false);
        emit PlanCleared(day);
        // clear meal
        planner.clearPlan(day);
    }

}