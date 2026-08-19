// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract MealPlanner {
    // errors
    error MealPlanner__NotAuthorized();

    // Custom types
    struct Meal {
        string name;
        string recipeUrl;
        uint16 calories;
    }

    // Day of week enum (0 = Monday, 6 = Sunday)
    enum Day {
        Mon,
        Tue,
        Wed,
        Thu,
        Fri,
        Sat,
        Sun
    }

    // State Variables
    address public sOwner;
    /**
     * @notice User => Day => Meal array of dayTime
     * 0 = morning, 1 = afternoon, 2 = evening
     */
    mapping(address user => mapping(Day day => Meal[] meal)) public weeklyPlans;

    // Events
    event MealUpdated(address indexed user, Day day);
    event PlanCleared(Day indexed day);
    event NewRecipeName(uint256 indexed newName);

    // Modifiers
    modifier onlysOwner() {
        if (msg.sender != sOwner) revert MealPlanner__NotAuthorized();
        _;
    }

    // Functions
    constructor() {
        sOwner = msg.sender;
    }

    // public/external
    function setMeal(
        Day _day,
        string[3] memory _name,
        string[3] memory _url,
        uint16[3] memory _calories
    ) external {
        // reset meal array if exists
        if (weeklyPlans[msg.sender][_day].length >= 1) {
            delete weeklyPlans[msg.sender][_day];
        }
        // assign new meals
        for (uint256 i = 0; i < 3; i++) {
            Meal memory meal = Meal({
                name: _name[i],
                recipeUrl: _url[i],
                calories: _calories[i]
            });
            weeklyPlans[msg.sender][_day].push(meal);
        }

        emit MealUpdated(msg.sender, _day);
    }

    function clearPlan(Day _day) external {
        delete weeklyPlans[msg.sender][_day];
        emit PlanCleared(_day);
    }

    function recipeUri(
        address _user,
        Day _day,
        uint256 dayTime
    ) external view returns (string memory uri) {
        uri = weeklyPlans[_user][_day][dayTime].recipeUrl;
    }

    // getters
    function getMeal(
        address _user,
        Day _day,
        uint256 dayTime
    ) external view returns (Meal memory meal) {
        meal = weeklyPlans[_user][_day][dayTime];
    }
}
