// app.js
// Constants
const CONTRACT_ADDRESS = "0x7118e3327466FD1254bd848992fa8Eb9fBfE2d15";
const BASE_RPC = "https://mainnet.base.org";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const ABI = [
  { "type": "constructor", "inputs": [], "stateMutability": "nonpayable" },
  {
    "type": "function",
    "name": "clearPlan",
    "inputs": [{ "name": "_day", "type": "uint8", "internalType": "enum MealPlanner.Day" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getMeal",
    "inputs": [
      { "name": "_user", "type": "address", "internalType": "address" },
      { "name": "_day", "type": "uint8", "internalType": "enum MealPlanner.Day" },
      { "name": "dayTime", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      {
        "name": "meal",
        "type": "tuple",
        "internalType": "struct MealPlanner.Meal",
        "components": [
          { "name": "name", "type": "string", "internalType": "string" },
          { "name": "recipeUrl", "type": "string", "internalType": "string" },
          { "name": "calories", "type": "uint16", "internalType": "uint16" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recipeUri",
    "inputs": [
      { "name": "_user", "type": "address", "internalType": "address" },
      { "name": "_day", "type": "uint8", "internalType": "enum MealPlanner.Day" },
      { "name": "dayTime", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "uri", "type": "string", "internalType": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "sOwner",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setMeal",
    "inputs": [
      { "name": "_day", "type": "uint8", "internalType": "enum MealPlanner.Day" },
      { "name": "_name", "type": "string[3]", "internalType": "string[3]" },
      { "name": "_url", "type": "string[3]", "internalType": "string[3]" },
      { "name": "_calories", "type": "uint16[3]", "internalType": "uint16[3]" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "weeklyPlans",
    "inputs": [
      { "name": "user", "type": "address", "internalType": "address" },
      { "name": "day", "type": "uint8", "internalType": "enum MealPlanner.Day" },
      { "name": "", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "name", "type": "string", "internalType": "string" },
      { "name": "recipeUrl", "type": "string", "internalType": "string" },
      { "name": "calories", "type": "uint16", "internalType": "uint16" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "MealUpdated",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "day", "type": "uint8", "indexed": false, "internalType": "enum MealPlanner.Day" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NewRecipeName",
    "inputs": [{ "name": "newName", "type": "uint256", "indexed": true, "internalType": "uint256" }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PlanCleared",
    "inputs": [{ "name": "day", "type": "uint8", "indexed": true, "internalType": "enum MealPlanner.Day" }],
    "anonymous": false
  },
  { "type": "error", "name": "MealPlanner__NotAuthorized", "inputs": [] }
];

// App State Variables
let userAddress = null;
let viewingAddress = null;
let currentTab = "planner";

let provider = null;
let signer = null;
let contract = null; // Wallet connected contract
let readOnlyContract = null; // Base Mainnet RPC fallback contract

// Cache of loaded meals
let currentPlanData = {};

// Initialization
window.addEventListener("DOMContentLoaded", async () => {
  renderEmptyPlannerGrid();
  lucide.createIcons();
  await initReadOnlyContract();

  // Try auto connect
  if (window.ethereum) {
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_accounts", []);
      if (accounts.length > 0) {
        await connectWallet(false);
      } else {
        await reloadData();
      }
    } catch (e) {
      console.error("Wallet auto-connect failed:", e);
      await reloadData();
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
  } else {
    await reloadData();
  }
});

async function initReadOnlyContract() {
  try {
    const publicProvider = new ethers.JsonRpcProvider(BASE_RPC);
    readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, publicProvider);

    readOnlyContract.sOwner().then(owner => {
      document.getElementById("metaOwnerAddress").innerText = `${owner.slice(0, 6)}...${owner.slice(-4)}`;
      document.getElementById("metaOwnerAddress").title = owner;
    }).catch(e => {
      document.getElementById("metaOwnerAddress").innerText = "Error fetching owner";
    });
  } catch (err) {
    console.error("Failed to initialize Base RPC provider: ", err);
  }
}

// Toggle Connection
async function toggleWalletConnection() {
  if (userAddress) {
    userAddress = null;
    signer = null;
    contract = null;
    viewingAddress = null;
    updateUIState();
    showToast("info", "Wallet Disconnected", "Cleared connection session.");
    await reloadData();
  } else {
    await connectWallet(true);
  }
}

// Connect Wallet core logic
async function connectWallet(explicitConnect = true) {
  if (!window.ethereum) {
    if (explicitConnect) {
      showToast("error", "Wallet Not Found", "Please install a browser wallet like MetaMask.");
    }
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);

    if (accounts.length === 0) {
      if (explicitConnect) showToast("error", "Access Denied", "No accounts were selected.");
      return;
    }

    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    // Switch/check network (Base Mainnet is Chain ID 8453 / 0x2105)
    const network = await provider.getNetwork();
    if (network.chainId !== 8453n) {
      if (explicitConnect) {
        showToast("info", "Wrong Network", "Switching wallet connection to Base Mainnet...");
      }
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }],
        });
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      } catch (switchError) {
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base Mainnet',
                rpcUrls: [BASE_RPC],
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                blockExplorerUrls: ['https://basescan.org']
              }],
            });
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
          } catch (addError) {
            showToast("error", "Configuration Required", "Please add the Base Mainnet to your wallet.");
            return;
          }
        } else {
          showToast("error", "Switch Network", "Please change network to Base Mainnet in your wallet.");
          return;
        }
      }
    }

    const finalNetwork = await provider.getNetwork();
    if (finalNetwork.chainId === 8453n) {
      userAddress = await signer.getAddress();
      if (!viewingAddress) {
        viewingAddress = userAddress;
      }
      updateUIState();
      showToast("success", "Connected", `Successfully verified Base Mainnet session.`);
      await reloadData();
    } else {
      updateUIStateWrongNetwork();
    }
  } catch (err) {
    console.error("Wallet connection error:", err);
    showToast("error", "Connection Failed", err.message || "Failed to establish Ethers session.");
  }
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    userAddress = null;
    signer = null;
    contract = null;
    viewingAddress = null;
    updateUIState();
    showToast("info", "Session Terminated", "Wallet disconnected.");
    reloadData();
  } else {
    connectWallet(false);
  }
}

function handleChainChanged(chainId) {
  window.location.reload();
}

function updateUIStateWrongNetwork() {
  const badge = document.getElementById("networkBadge");
  const dot = document.getElementById("networkDot");
  const text = document.getElementById("networkText");

  badge.classList.remove("hidden");
  badge.classList.add("wrong");
  dot.className = "network-dot wrong";
  text.innerText = "Wrong Network (Use Base)";
}

function updateUIState() {
  const connectBtn = document.getElementById("connectBtn");
  const connectBtnText = document.getElementById("connectBtnText");
  const networkBadge = document.getElementById("networkBadge");
  const networkDot = document.getElementById("networkDot");
  const networkText = document.getElementById("networkText");

  if (userAddress) {
    connectBtnText.innerText = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    connectBtn.classList.add("connected");

    networkBadge.classList.remove("hidden");
    networkBadge.classList.remove("wrong");
    networkDot.className = "network-dot connected";
    networkText.innerText = "Base Mainnet";
  } else {
    connectBtnText.innerText = "Connect Wallet";
    connectBtn.classList.remove("connected");

    networkBadge.classList.add("hidden");
    networkBadge.classList.remove("wrong");
    networkDot.className = "network-dot";
    networkText.innerText = "Not Connected";
  }

  const viewingBanner = document.getElementById("viewingBanner");
  const viewingAddressText = document.getElementById("viewingAddressText");

  if (viewingAddress && viewingAddress.toLowerCase() !== (userAddress || "").toLowerCase()) {
    viewingBanner.classList.remove("hidden");
    viewingAddressText.innerText = viewingAddress;
  } else {
    viewingBanner.classList.add("hidden");
  }
}

// Navigation Tabs Switcher
function switchTab(tabId) {
  currentTab = tabId;

  const tabPlanner = document.getElementById("tab-planner");
  const tabSocial = document.getElementById("tab-social");
  const tabExplorer = document.getElementById("tab-explorer");

  const viewPlanner = document.getElementById("view-planner");
  const viewSocial = document.getElementById("view-social");
  const viewExplorer = document.getElementById("view-explorer");

  [tabPlanner, tabSocial, tabExplorer].forEach(tab => {
    tab.classList.remove("active");
  });

  [viewPlanner, viewSocial, viewExplorer].forEach(view => view.classList.add("hidden"));

  const activeTab = document.getElementById(`tab-${tabId}`);
  activeTab.classList.add("active");

  const activeView = document.getElementById(`view-${tabId}`);
  activeView.classList.remove("hidden");
}

async function loadSocialPlan() {
  const addressInput = document.getElementById("socialAddressInput").value.trim();
  if (!ethers.isAddress(addressInput)) {
    showToast("error", "Invalid Address", "Please enter a valid Ethereum address.");
    return;
  }
  viewingAddress = addressInput;
  updateUIState();
  switchTab("planner");
  await reloadData();
}

function resetToUserPlan() {
  viewingAddress = userAddress || null;
  updateUIState();
  reloadData();
}

// Recipe Explorer Lookup
async function queryRecipeUri() {
  const address = document.getElementById("explorerAddressInput").value.trim();
  const day = parseInt(document.getElementById("explorerDaySelect").value);
  const time = parseInt(document.getElementById("explorerTimeSelect").value);

  if (!ethers.isAddress(address)) {
    showToast("error", "Invalid Address", "Please enter a valid Ethereum address.");
    return;
  }

  const activeContract = contract || readOnlyContract;
  if (!activeContract) {
    showToast("error", "Contract Unreachable", "RPC connection is currently unavailable.");
    return;
  }

  showToast("info", "Querying Base...", "Fetching recipe URI directly from blockchain state...");

  try {
    const uri = await activeContract.recipeUri(address, day, time);

    const container = document.getElementById("recipeResultContainer");
    const textEl = document.getElementById("recipeResultText");
    const linkEl = document.getElementById("recipeResultLink");

    container.classList.remove("hidden");

    if (uri && uri.trim() !== "") {
      textEl.innerText = uri;
      linkEl.href = uri;
      linkEl.classList.remove("hidden");
      showToast("success", "URI Fetched", "Successfully resolved recipe reference.");
    } else {
      textEl.innerText = "No Recipe URL configured for this day/time slot.";
      linkEl.classList.add("hidden");
      showToast("info", "Query Complete", "Slot is currently blank.");
    }
  } catch (err) {
    console.error(err);
    showToast("error", "Query Failed", "Ensure target user has configured a plan for this day/time index.");
  }
}

function pasteToInput(inputId) {
  navigator.clipboard.readText().then(text => {
    document.getElementById(inputId).value = text.trim();
  }).catch(err => {
    showToast("error", "Clipboard Error", "Permission denied for browser clipboard reads.");
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("success", "Copied", "Address copied to clipboard.");
  }).catch(err => {
    showToast("error", "Clipboard Error", "Failed to write value.");
  });
}

// Render Blank States
function renderEmptyPlannerGrid() {
  const grid = document.getElementById("weeklyGrid");
  grid.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    grid.appendChild(createEmptyDayCard(i));
  }
}

function createEmptyDayCard(dayId) {
  const card = document.createElement("div");
  card.className = "day-card empty";
  card.innerHTML = `
    <div>
      <div class="day-header">
        <span class="day-title">${DAYS[dayId]}</span>
        <span class="day-status">Empty</span>
      </div>
      <div class="card-empty-state">
        <i data-lucide="cookie" class="card-empty-icon"></i>
        <p class="card-empty-text">No meals configured</p>
      </div>
    </div>
    <button onclick="openEditModal(${dayId})" class="btn-card-action">
      Set Meal Plan
    </button>
  `;
  return card;
}

// Data Loaders
async function reloadData() {
  const activeContract = contract || readOnlyContract;
  const targetAddress = viewingAddress || userAddress;

  if (!activeContract) {
    renderFallbackMessage("Setup RPC fallback connection failed. Please install MetaMask to interact with dApp.");
    return;
  }

  if (!targetAddress) {
    renderConnectPrompt();
    updateStats();
    return;
  }

  const grid = document.getElementById("weeklyGrid");
  grid.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 4rem 0; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
      <div style="border: 3px solid rgba(0, 82, 255, 0.1); border-top: 3px solid var(--accent-base); border-radius: 50%; width: 2rem; height: 2rem; animation: spin 1s linear infinite;"></div>
      <p>Querying Base Mainnet storage for ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}</p>
    </div>
  `;

  // Custom spin animation if not loaded
  if (!document.getElementById("spinnerStyle")) {
    const style = document.createElement('style');
    style.id = "spinnerStyle";
    style.innerHTML = "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }

  try {
    const plan = {};
    for (let day = 0; day < 7; day++) {
      try {
        const m0 = await activeContract.getMeal(targetAddress, day, 0);
        const m1 = await activeContract.getMeal(targetAddress, day, 1);
        const m2 = await activeContract.getMeal(targetAddress, day, 2);

        plan[day] = [
          { name: m0.name, recipeUrl: m0.recipeUrl, calories: Number(m0.calories) },
          { name: m1.name, recipeUrl: m1.recipeUrl, calories: Number(m1.calories) },
          { name: m2.name, recipeUrl: m2.recipeUrl, calories: Number(m2.calories) }
        ];
      } catch (e) {
        plan[day] = null;
      }
    }

    currentPlanData = plan;
    renderPlanData(plan);
    updateStats(plan);
  } catch (err) {
    console.error(err);
    showToast("error", "Data Load Failed", "Failed to retrieve meals from smart contract.");
    renderFallbackMessage("Error loading planner data. Ensure Base Mainnet network is active.");
  }
}

function renderConnectPrompt() {
  const grid = document.getElementById("weeklyGrid");
  grid.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 4rem 0; text-align: center; max-width: 28rem; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 1.25rem;">
      <div style="width: 4rem; height: 4rem; border-radius: 50%; background: rgba(0, 82, 255, 0.1); border: 1px solid rgba(0, 82, 255, 0.15); display: flex; align-items: center; justify-content: center; color: var(--accent-base);">
        <i data-lucide="shield-alert" style="width: 2rem; height: 2rem;"></i>
      </div>
      <div>
        <h3 style="font-size: 1.125rem; font-weight: 700; color: #ffffff; font-family: var(--font-display);">Wallet Connection Required</h3>
        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">Connect your Web3 browser wallet to load your weekly plans, customize your routine, and trigger on-chain planner events on Base.</p>
      </div>
      <button onclick="toggleWalletConnection()" class="btn-primary" style="padding: 0.75rem 1.75rem; font-size: 0.875rem;">
        Connect Wallet
      </button>
    </div>
  `;
  lucide.createIcons();
}

function renderFallbackMessage(msg) {
  const grid = document.getElementById("weeklyGrid");
  grid.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 4rem 0; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
      <i data-lucide="cloud-off" style="width: 2rem; height: 2rem; color: rgba(255,255,255,0.05);"></i>
      <p style="font-size: 0.875rem; font-weight: 500;">${msg}</p>
    </div>
  `;
  lucide.createIcons();
}

function renderPlanData(plan) {
  const grid = document.getElementById("weeklyGrid");
  grid.innerHTML = "";

  const isReadOnly = viewingAddress && viewingAddress.toLowerCase() !== (userAddress || "").toLowerCase();

  for (let dayId = 0; dayId < 7; dayId++) {
    const dayPlan = plan[dayId];
    if (!dayPlan) {
      grid.appendChild(createEmptyDayCard(dayId));
      continue;
    }

    const totalCalories = dayPlan.reduce((acc, curr) => acc + curr.calories, 0);
    const budgetPercent = Math.min((totalCalories / 2000) * 100, 100);
    const isOverBudget = totalCalories > 2300;

    const card = document.createElement("div");
    card.className = "day-card hoverable";

    card.innerHTML = `
      <div>
        <div class="day-header">
          <span class="day-title">${DAYS[dayId]}</span>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${!isReadOnly ? `
              <button onclick="clearDayPlan(${dayId})" title="Clear Day Plan" class="btn-card-clear">
                <i data-lucide="trash-2" style="width: 1rem; height: 1rem;"></i>
              </button>
            ` : ""}
          </div>
        </div>

        <div class="meals-list">
          <div class="meal-item">
            <div class="meal-left">
              <div class="meal-badge">M</div>
              <div class="meal-info">
                <div class="meal-name">${dayPlan[0].name}</div>
                <div class="meal-calories">${dayPlan[0].calories} kcal</div>
              </div>
            </div>
            ${dayPlan[0].recipeUrl ? `
              <a href="${dayPlan[0].recipeUrl}" target="_blank" class="meal-link" title="Recipe Link">
                <i data-lucide="external-link" style="width: 0.875rem; height: 0.875rem;"></i>
              </a>
            ` : ""}
          </div>

          <div class="meal-item">
            <div class="meal-left">
              <div class="meal-badge">A</div>
              <div class="meal-info">
                <div class="meal-name">${dayPlan[1].name}</div>
                <div class="meal-calories">${dayPlan[1].calories} kcal</div>
              </div>
            </div>
            ${dayPlan[1].recipeUrl ? `
              <a href="${dayPlan[1].recipeUrl}" target="_blank" class="meal-link" title="Recipe Link">
                <i data-lucide="external-link" style="width: 0.875rem; height: 0.875rem;"></i>
              </a>
            ` : ""}
          </div>

          <div class="meal-item">
            <div class="meal-left">
              <div class="meal-badge">E</div>
              <div class="meal-info">
                <div class="meal-name">${dayPlan[2].name}</div>
                <div class="meal-calories">${dayPlan[2].calories} kcal</div>
              </div>
            </div>
            ${dayPlan[2].recipeUrl ? `
              <a href="${dayPlan[2].recipeUrl}" target="_blank" class="meal-link" title="Recipe Link">
                <i data-lucide="external-link" style="width: 0.875rem; height: 0.875rem;"></i>
              </a>
            ` : ""}
          </div>
        </div>
      </div>

      <div class="day-card-footer">
        <div class="calorie-summary">
          <span class="calorie-label">Day Calories</span>
          <span class="calorie-val ${isOverBudget ? 'excess' : ''}">${totalCalories} / 2000 kcal</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${isOverBudget ? 'excess' : ''}" style="width: ${budgetPercent}%"></div>
        </div>
        ${!isReadOnly ? `
          <button onclick="openEditModal(${dayId})" class="btn-card-action">
            <i data-lucide="pencil" style="width: 0.875rem; height: 0.875rem;"></i> Edit Meal Plan
          </button>
        ` : ""}
      </div>
    `;
    grid.appendChild(card);
  }
  lucide.createIcons();
}

function updateStats(plan = null) {
  const weeklyCaloriesText = document.getElementById("statWeeklyCalories");
  const avgCaloriesText = document.getElementById("statAvgCalories");
  const plannedDaysText = document.getElementById("statPlannedDays");

  if (!plan) {
    weeklyCaloriesText.innerText = "0 kcal";
    avgCaloriesText.innerText = "0 kcal";
    plannedDaysText.innerText = "0 / 7";
    return;
  }

  let totalCals = 0;
  let dayCount = 0;

  for (let day = 0; day < 7; day++) {
    if (plan[day]) {
      const daySum = plan[day].reduce((acc, curr) => acc + curr.calories, 0);
      totalCals += daySum;
      dayCount++;
    }
  }

  const avgCals = dayCount > 0 ? Math.round(totalCals / dayCount) : 0;

  weeklyCaloriesText.innerText = `${totalCals.toLocaleString()} kcal`;
  avgCaloriesText.innerText = `${avgCals.toLocaleString()} kcal`;
  plannedDaysText.innerText = `${dayCount} / 7`;
}

// Modal Control
function openEditModal(dayId) {
  const modal = document.getElementById("editModal");
  const title = document.getElementById("editModalTitle");
  const editDayId = document.getElementById("editDayId");
  const editDaySelect = document.getElementById("editDaySelect");

  editDayId.value = dayId;
  editDaySelect.value = dayId;
  title.innerText = `Update Meals - ${DAYS[dayId]}`;

  const dayData = currentPlanData[dayId];
  if (dayData) {
    document.getElementById("m0_name").value = dayData[0].name;
    document.getElementById("m0_url").value = dayData[0].recipeUrl;
    document.getElementById("m0_calories").value = dayData[0].calories;

    document.getElementById("m1_name").value = dayData[1].name;
    document.getElementById("m1_url").value = dayData[1].recipeUrl;
    document.getElementById("m1_calories").value = dayData[1].calories;

    document.getElementById("m2_name").value = dayData[2].name;
    document.getElementById("m2_url").value = dayData[2].recipeUrl;
    document.getElementById("m2_calories").value = dayData[2].calories;
  } else {
    document.getElementById("editForm").reset();
    editDaySelect.value = dayId;
  }

  editDaySelect.onchange = () => {
    const nextDayId = parseInt(editDaySelect.value);
    openEditModal(nextDayId);
  };

  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

function closeEditModal() {
  const modal = document.getElementById("editModal");
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

// Write Contract Transactions
async function submitMeals(event) {
  event.preventDefault();

  if (!contract) {
    showToast("error", "Wallet Disconnected", "Please connect your wallet to execute planner edits.");
    return;
  }

  const dayId = parseInt(document.getElementById("editDayId").value);

  const names = [
    document.getElementById("m0_name").value.trim(),
    document.getElementById("m1_name").value.trim(),
    document.getElementById("m2_name").value.trim()
  ];
  const urls = [
    document.getElementById("m0_url").value.trim(),
    document.getElementById("m1_url").value.trim(),
    document.getElementById("m2_url").value.trim()
  ];
  const calories = [
    parseInt(document.getElementById("m0_calories").value),
    parseInt(document.getElementById("m1_calories").value),
    parseInt(document.getElementById("m2_calories").value)
  ];

  closeEditModal();
  showToast("info", "Waiting for Signature", "Confirm transaction details in your wallet...");

  try {
    const tx = await contract.setMeal(dayId, names, urls, calories);
    showToast("info", "Transaction Submitted", "Writing meal configuration to Base Mainnet...", tx.hash);

    const receipt = await tx.wait(1);
    if (receipt.status === 1) {
      showToast("success", "Meals Saved", `Successfully updated meals for ${DAYS[dayId]}!`, tx.hash);
      await reloadData();
    } else {
      showToast("error", "Transaction Reverted", "The transaction executed but was reverted on-chain.");
    }
  } catch (err) {
    console.error(err);
    let errorMsg = err.message || "Unknown transaction rejection.";
    if (err.code === "ACTION_REJECTED") {
      errorMsg = "Transaction signature was rejected by user.";
    }
    showToast("error", "Save Failed", errorMsg);
  }
}

async function clearDayPlan(dayId) {
  if (!contract) {
    showToast("error", "Wallet Disconnected", "Wallet session required for state updates.");
    return;
  }

  if (!confirm(`Are you sure you want to clear your entire plan for ${DAYS[dayId]}?`)) {
    return;
  }

  showToast("info", "Waiting for Signature", `Confirm clearing ${DAYS[dayId]}'s plan in wallet...`);

  try {
    const tx = await contract.clearPlan(dayId);
    showToast("info", "Clear Request Sent", "Removing plan from smart contract state...", tx.hash);

    const receipt = await tx.wait(1);
    if (receipt.status === 1) {
      showToast("success", "Plan Cleared", `Successfully wiped meal plan for ${DAYS[dayId]}.`, tx.hash);
      await reloadData();
    } else {
      showToast("error", "Clear Failed", "State update transaction was reverted.");
    }
  } catch (err) {
    console.error(err);
    let errorMsg = err.message || "Failed to submit transaction.";
    if (err.code === "ACTION_REJECTED") {
      errorMsg = "User cancelled signature request.";
    }
    showToast("error", "Clear Failed", errorMsg);
  }
}

// Toast Notifications
function showToast(type, title, message, txHash = null) {
  const container = document.getElementById("toastContainer");
  const toastId = "toast_" + Date.now();

  const toast = document.createElement("div");
  toast.id = toastId;
  toast.className = `toast ${type === "success" ? "success" : type === "error" ? "error" : ""}`;

  let icon = "info";
  if (type === "success") icon = "check-circle-2";
  else if (type === "error") icon = "alert-circle";

  toast.innerHTML = `
    <div class="toast-icon ${type}">
      <i data-lucide="${icon}" style="width: 1.25rem; height: 1.25rem;"></i>
    </div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
      ${txHash ? `
        <a href="https://basescan.org/tx/${txHash}" target="_blank" class="toast-tx-link">
          View on Basescan <i data-lucide="external-link" style="width: 0.75rem; height: 0.75rem;"></i>
        </a>
      ` : ""}
    </div>
    <button onclick="dismissToast('${toastId}')" class="btn-toast-close">
      <i data-lucide="x" style="width: 1rem; height: 1rem;"></i>
    </button>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Trigger browser flow transition
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  if (type === "success" || (type === "info" && !txHash)) {
    setTimeout(() => {
      dismissToast(toastId);
    }, 5000);
  }
}

function dismissToast(toastId) {
  const toast = document.getElementById(toastId);
  if (toast) {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }
}
