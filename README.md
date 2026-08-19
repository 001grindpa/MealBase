# Meal Base

Meal Base is a decentralized weekly meal planner for Base Mainnet. It lets users save breakfast, lunch, and dinner for each day of the week, including a recipe URL and calorie count, directly in the `MealPlanner` smart contract.

The static web app connects to Base Mainnet through Ethers.js and a browser wallet such as MetaMask. A wallet is required to create or clear a plan. Plans are public on-chain data, so the app can also inspect another address's weekly plan and look up individual recipe URLs without connecting a wallet.

## Features

- Store three meals per day for a seven-day weekly plan.
- Save meal names, recipe URLs, and calorie counts on-chain.
- View weekly calorie totals, daily averages, and planned days.
- Inspect the plan associated with any wallet address.
- Look up a recipe URL by address, day, and meal time.
- Connect to Base Mainnet automatically and prompt the wallet to switch networks when needed.

## Project Structure

```text
src/Planner.sol             MealPlanner smart contract
script/DeployPlanner.s.sol  Foundry deployment script
test/Planner.t.sol          Smart contract tests
static/app.js               Browser app logic and contract ABI
static/style.css            Frontend styles
index.html                  Frontend entry point
foundry.toml                Foundry project configuration
```

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) for compiling, testing, and deploying the contract.
- A modern browser.
- A browser wallet configured for Base Mainnet, such as MetaMask, if you want to write to the contract.
- Base Mainnet ETH for transaction fees when saving or clearing a plan.

The frontend loads Ethers.js and Lucide from public CDNs, so a network connection is required when opening the app.

## Run the Frontend Locally

From the repository root, start any static HTTP server. Python is usually available on Linux:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080> in your browser. Do not open `index.html` directly with a `file://` URL; serving the files over HTTP avoids browser security and provider issues.

The current frontend is configured for the deployed Base Mainnet contract at `0x7118e3327466FD1254bd848992fa8Eb9fBfE2d15` and reads through `https://mainnet.base.org`. These values are currently constants in `static/app.js`; the browser app does not read `.env` files.

## Build and Test the Contract

Install Foundry, then run the following commands from the repository root:

```bash
forge build
forge test
```

For more detailed test output:

```bash
forge test -vvv
```

## Configure Environment Variables

Create a local environment file from the template before deploying:

```bash
cp .env.example .env
```

Set the deployment values in `.env`. Keep `.env` private; it is ignored by Git. See [.env.example](.env.example) for the variable descriptions and example commands.

## Deploy to Base

After setting `BASE_RPC_URL` and `PRIVATE_KEY` in `.env`, load the variables into the current shell and broadcast the deployment:

```bash
source .env
forge script script/DeployPlanner.s.sol:DeployPlanner \\
	--rpc-url "$BASE_RPC_URL" \\
	--private-key "$PRIVATE_KEY" \\
	--broadcast
```

The deployer account becomes the contract owner. After deploying a new instance, update `CONTRACT_ADDRESS` in `static/app.js` and the matching address shown in `index.html` before publishing the frontend.

To deploy without broadcasting, omit `--broadcast`:

```bash
forge script script/DeployPlanner.s.sol:DeployPlanner \\
	--rpc-url "$BASE_RPC_URL" \\
	--private-key "$PRIVATE_KEY"
```

## Deployment Records

Foundry writes broadcast artifacts under `broadcast/`. The repository includes the existing deployment records for Base Mainnet and Sepolia. Do not commit private keys or a populated `.env` file.

## Contract Notes

- Days are encoded as `0` through `6`, from Monday through Sunday.
- Meal times are encoded as `0` morning, `1` afternoon, and `2` evening.
- `setMeal` replaces the complete meal set for one day.
- `clearPlan` deletes the connected user's meals for one day.
- Meal plans and recipe URLs are public because they are stored on-chain.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
