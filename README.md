**🚀 OmniYield — Cross‑Chain NFT‑Collateralized Lending & Yield Aggregator**  
*Turn idle NFTs into programmable collateral that automatically earns yield across chains.*

---

## 📖 Table of Contents
- [Problem](#problem)
- [Solution](#solution)
- [Architecture](#architecture)
- [Setup](#setup)
- [API Endpoints](#api-endpoints)
- [Tech Stack](#tech-stack)
- [Demo Screenshots](#demo-screenshots)
- [Team](#team)
- [License](#license)

---

## Problem
NFT collections hold billions of dollars in value, yet most sit idle in wallets because:
- Traditional lending platforms require fungible collateral.
- Floor‑price volatility makes risk assessment difficult.
- Users cannot efficiently deploy borrowed capital into the highest‑yielding DeFi strategies across multiple chains without manual bridging and rebalancing.

## SolutionOmniYield creates a **cross‑chain, modular lending layer** where:
1. **Whitelisted NFT collections** are registered with reliable floor‑price oracles.
2. Users **deposit ERC‑721/1155 NFTs** into a secure, ERC‑4626‑style vault.
3. The vault computes a **dynamic loan‑to‑value (LTV)** based on the latest floor price and mints a **yield‑bearing synthetic asset**.
4. Borrowed funds are **automatically routed** by the LiquidityManager to the best‑yielding strategies (Uniswap V3 LP, lending markets, etc.) via LI.FI routing.
5. Fees are accrued, distributed, and **under‑collateralized positions are liquidated** through a Dutch‑style auction powered by Chainlink price feeds and NFT‑floor oracles.
6. An **off‑chain API + worker** keeps prices fresh, triggers liquidations, and rebalances strategies every block.
7. A **React dashboard** provides real‑time data, wallet connect, and one‑click transaction building.

The result: idle NFTs become liquid, programmable capital that earns yield while remaining safely collateralized.

---

## Architecture
```
+-------------------+        +-------------------+        +-------------------+
|   Frontend (React)│◄──────►│   API Service     │◄──────►│   Worker (Node)   |
|  (WebSocket,      │        |  (Express)        │        |  (priceUpdater,   |
|   ethers.js)      │        |  - /health        │        |   liquidation,    |
+-------------------+        |  - /vault/stats   │        |   rebalance)      |
        ▲                     |  - /tx/builder    │        +-------------------+
        │                     +-------------------+                ▲
        │                                                            │
        │                                                            │
+-------------------+        +-------------------+        +-------------------+
|   Contracts       │        |   Oracles         │        |   External        |
|  (Hardhat)        │◄──────►│  (Chainlink,      │◄──────►│  Bridges (LI.FI) |
|  - Registry       │        |   NFTFloorOracle) │        |                   |
|  - Vault (ERC4626)│        +-------------------+        +-------------------+
|  - AccessControl  │
|  - LiquidityManager│
|  - FeeDistributor │
|  - LiquidationEngine│
+-------------------+ 
```

---

## Setup

### Prerequisites
- Node.js ≥ 20- Yarn or npm
- Hardhat
- A .env file (see below)

### 1. Clone the repo
```bash
git clone https://github.com/77svene/omniyield-protocol.git
cd omniyield-protocol
```

### 2. Install dependencies
```bash
# Root (contracts + scripts)
npm install

# Frontend
cd frontendnpm install
cd ..

# API servicecd services/api
npm install
cd ../..

# Worker
cd services/worker
npm installcd ../..
```

### 3. Environment variables
Create a `.env` at the project root (copy from `.env.example` if present) and fill:

```env
# RPCsSEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<YOUR_INFURA_KEY>
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/<YOUR_INFURA_KEY>
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Private key for deployment (never commit!)
DEPLOYER_PRIVATE_KEY=0x...

# Oracles
CHAINLINK_API_KEY=<YOUR_CHAINLINK_KEY>
NFT_FLOOR_ORACLE_ADDRESS=0x...

# LI.FI Router
LI_FI_ROUTER_ADDRESS=0x...

# Treasury & Fee Distributor
TREASURY_ADDRESS=0x...
FEE_DISTRIBUTOR_ADDRESS=0x+

# API
API_PORT=3001API_HOST=0.0.0.0# Frontend
FRONTEND_PORT=3000
```

### 4. Compile contracts
```bash
npx hardhat compile
```

### 5. Deploy to Sepolia (idempotent)
```bashnode scripts/deploy/deploy.js   # deploys core + modules
node scripts/deploy/verify.js   # verifies on Etherscan (if API key set)
```

### 6. Start services
```bash
# In one terminal: API
cd services/api
npm start   # runs server.js on $API_PORT

# In another terminal: Worker
cd ../services/worker
npm start   # runs worker.js (price updates, liquidations, rebalancing)

# In another terminal: Frontend
cd ../frontend
npm start   # runs React dev server on $FRONTEND_PORT
```

Open <http://localhost:3000> to use the dashboard.

---

## API Endpoints
| Method | Path               | Description                                                            |
|--------|--------------------|------------------------------------------------------------------------|
| GET    | `/health`          | Returns `{ status: "ok" }` and timestamp.                              |
| GET    | `/vault/stats`     | `{ totalDeposited, totalBorrowed, totalYieldEarned, activePositions }` |
| POST   | `/tx/builder`      | Body: `{ action: "deposit\|withdraw\|borrow", params: {...} }`<br>Returns signed transaction data ready for `wallet.sendTransaction`. |

---

## Tech Stack
![Solidity](https://img.shields.io/badge/Solidity-^0.8.20-%23363636?logo=solidity)
![Hardhat](https://img.shields.io/badge/Hardhat-^2.22.0-%23ffdb00?logo=hardhat)
![ethers.js](https://img.shields.io/badge/ethers.js-^6.12.0-%233c3c3d?logo=ethers)
![React](https://img.shields.io/badge/React-^18.3.0-%2361dafb?logo=react)
![Express](https://img.shields.io/badge/Express-^4.19.2-%23000000?logo=express)
![Node.js](https://img.shields.io/badge/Node.js-^20.12.0-%23339933?logo=node.js)
![Chainlink](https://img.shields.io/badge/Chainlink-%23000000?logo=chainlink)
![LI.FI](https://img.shields.io/badge/LI.FI-%23ff6b35?logo=li-fi)
![Uniswap V3](https://img.shields.io/badge/Uniswap%20V3-%23ff8b00?logo=uniswap)
![Circle](https://img.shields.io/badge/Circle-%233b7fff?logo=circle)
![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## Demo Screenshots
![OmniYield Dashboard](./frontend/public/screenshots/dashboard.png)  
*Main dashboard showing portfolio, yield, and borrow UI.*

![Deposit Modal](./frontend/public/screenshots/deposit-modal.png)  
*Deposit NFTs, view floor‑price derived borrowing power.*

![Yield Allocation Chart](./frontend/public/screenshots/yield-chart.png)  *Real‑time chart of borrowed capital deployed across strategies.*

*(Images are generated via placeholder service; replace with actual screenshots after local run.)*

---

## Team
**Built by VARAKH BUILDER — autonomous AI agent**

---

## License
MIT © 2026 OmniYield Protocol. See [LICENSE](./LICENSE) for details.