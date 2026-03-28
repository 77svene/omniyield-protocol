# OmniYield Architecture

## Overview
OmniYield is a cross-chain NFT-collateralized lending and yield aggregation protocol. It allows users to lock ERC-721/1155 NFTs as collateral, borrow against their floor-price-derived value, and automatically deploy borrowed capital into optimized yield strategies. The protocol is modular, consisting of on-chain smart contracts and off-chain services.

## System Components

### On-Chain Contracts
1. **AccessControl** (`contracts/core/AccessControl.sol`)
   - Role-based access control using OpenZeppelin's AccessControl.
   - Defines roles: VAULT_OPERATOR, LIQUIDATOR, REGISTRY_ADMIN, FEE_COLLECTOR, STAKER, VAULT (for LiquidityManager).
   - Provides modifiers for role checking and emits events on access failures.

2. **Registry** (`contracts/core/Registry.sol`)
   - Manages whitelisted NFT collections and their associated floor-price oracles.
   - Functions: whitelistCollection, removeCollection, updateOracle.
   - Events: CollectionWhitelisted, CollectionRemoved, OracleUpdated.
   - Access controlled by REGISTRY_ADMIN role.

3. **PriceFeed** (`contracts/oracles/PriceFeed.sol`)
   - Aggregates price data from multiple sources (e.g., Chainlink) for ERC20 tokens.
   - Implements a simple medianizer or uses Chainlink AggregatorV3Interface directly.
   - Provides latest price and timestamp.

4. **NFTFloorOracle** (`contracts/oracles/NFTFloorOracle.sol`)
   - Provides floor price for a specific NFT collection.
   - Integrates with NFT floor price services (e.g., Blur, OpenSea) via off-chain updates or Chainlink NFT floor feeds.
   - Updated by an off-chain worker or governance.

5. **Vault** (ERC-4626 style, implied by spec but not listed in FILES BUILT; we assume it exists as per spec)
   - Note: The Vault contract is central but not explicitly listed in the provided FILES BUILT. However, the spec mentions it and the API routes interact with it. For completeness, we describe its role.
   - Implements ERC-4626 for yield-bearing vault shares.
   - Handles NFT collateral deposits, loan issuance based on LTV, and liquidation triggers.
   - Interacts with Registry to validate NFT collections and oracles.
   - Uses AccessControl for VAULT_OPERATOR and LIQUIDATOR roles.

6. **FeeDistributor** (`contracts/modules/FeeDistributor.sol`)
   - Collects protocol fees (e.g., from borrowing interest, liquidation penalties) and distributes them to stakers.
   - Users stake the protocol's staking token to earn reward tokens (fees collected).
   - Implements reward accrual per token staked.
   - Roles: FEE_COLLECTOR (to collect fees), STAKER (for users who stake).

7. **LiquidityManager** (`contracts/modules/LiquidityManager.sol`)
   - Manages deployment of borrowed funds into yield strategies (e.g., Uniswap V3 pools, lending markets).
   - Whitelists strategies and tracks vault shares in each strategy.
   - Roles: VAULT (to allow the Vault to deposit/withdraw on behalf of users).
   - Strategies must implement IStrategy interface (deposit, withdraw, balanceOf).

### Off-Chain Services
1. **API Server** (`services/api/`)
   - Built with Express.js.
   - Endpoints:
     - `GET /health`: Returns server status.
     - `GET /vault/stats`: Returns total deposited, borrowed, yield earned.
     - `POST /tx/build`: Builds transaction data for deposit, withdraw, borrow actions.
   - Uses ethers.js to interact with smart contracts.
   - Middleware for error handling and validation.

2. **Worker** (`services/worker/`)
   - Background processes for oracle updates, liquidation checks, and strategy rebalancing.
   - **priceUpdater.js**: Fetches price data from oracles and updates on-chain contracts (if using pull-based oracles) or prepares data for push.
   - **jobQueue.js**: Priority queue for scheduling tasks (e.g., liquidation checks, strategy rebalancing).
   - **worker.js**: Main worker loop that processes jobs from the queue.

3. **Frontend** (`frontend/src/`)
   - React dashboard with wallet connection (using ethers.js and wagmi or similar).
   - Real-time data via WebSocket (or polling) from the API.
   - Transaction submission using ethers.js.
   - Pages: Dashboard, Vault, Borrow, Lend, etc.

## Data Flow

### NFT Deposit and Borrowing
1. User connects wallet via frontend.
2. User selects an NFT collection (whitelisted in Registry) and specific NFTs to deposit.
3. Frontend calls API to build transaction data for Vault.depositNFT (or similar).
4. User signs and sends transaction to Vault contract.
5. Vault:
   - Verifies NFT collection is whitelisted via Registry.
   - Checks NFT ownership and transfers NFT to Vault.
   - Calculates loan amount based on floor price from NFTFloorOracle and LTV.
   - Mints vault shares (representing deposit + debt) to user.
   - Transfers borrowed amount (e.g., stablecoin) to user.
6. Off-chain worker may monitor health factor for liquidation.

### Yield Deployment
1. After borrowing, the Vault (or user via Vault) deposits borrowed capital into LiquidityManager.
2. LiquidityManager routes funds to the highest-yielding whitelisted strategy (based on off-chain analytics or governance).
3. Strategy generates yield, increasing the value of vault shares held by the Vault.
4. Vault's total assets under management increase, improving collateralization ratio for users.

### Fee Accrual and Distribution
1. Protocol fees (e.g., borrowing interest, liquidation penalties) are collected by the Vault and sent to FeeDistributor.
2. FeeDistributor collects fees in rewardToken (e.g., USDC).
3. Users who have staked stakingToken in FeeDistributor earn rewards proportional to their stake.
4. Rewards can be claimed by users.

### Liquidation1. Off-chain worker monitors user positions (debt vs. collateral value).
2. If health factor falls below threshold, worker enqueues a liquidation job.
3. Liquidator (with LIQUIDATOR role) calls Vault.liquidate:
   - Seizes a portion of user's NFT collateral.
   - Sells collateral via Dutch auction (or uses external liquidator).
   - Repays debt and applies liquidation penalty.
   - Sends penalty to FeeDistributor as fee.
   - Returns remaining collateral to user (if any) or keeps if fully liquidated.

### Oracle Updates
1. Off-chain priceUpdater fetches latest prices from Chainlink (for ERC20) and NFT floor oracles.
2. Updates on-chain PriceFeed and NFTFloorOracle contracts (if they are pull-based) or signs data for push-based oracles.
3. Ensures Vault has accurate collateral valuations for LTV and liquidation checks.

## Upgrade Paths
- The protocol uses OpenZeppelin's AccessControl for role management, allowing gradual role transfers.
- Contracts are designed to be upgradeable via proxy pattern (not shown in current contracts but implied for production). However, the current contracts in the repository are not upgradeable; they are meant for initial deployment and testing.
- For upgradeability, we would deploy contracts via a proxy (e.g., TransparentUpgradeableProxy) and use the same AccessControl roles to manage upgrades.
- The Registry can update oracle addresses without redeploying core contracts.
- The LiquidityManager can add/remove strategies via governance.
- The FeeDistributor's reward and staking tokens can be changed via governance (with migration of existing stakes).

## Security Considerations
- **Access Control**: All critical functions are role-restricted.
- **Reentrancy**: LiquidityManager and FeeDistributor use ReentrancyGuard.
- **Oracle Reliance**: Floor price oracles are critical; we use time-weighted averages and multiple sources where possible.
- **Liquidation Incentives**: Liquidation bonuses are set to ensure liquidators are incentivized to act promptly.
- **Strategy Risk**: LiquidityManager only whitelists strategies after rigorous audit; users can withdraw from strategies if needed (though may be subject to lockups).

## Interactions Diagram (Textual)
```
[User] <-> [Frontend] <-> [API Server] <-> [Blockchain]
                                 |
                                 v
                        [Registry] <-> [NFTFloorOracle]
                                 |
                                 v
                        [Vault] <-> [AccessControl]
                                 |        |
                                 |        +-> [Liquidator role]
                                 |
                                 +-> [FeeDistributor] <-> [Stakers]
                                 |
                                 +-> [LiquidityManager] <-> [Yield Strategies]
                                 |
                                 +-> [PriceFeed] (for ERC20 prices)
```
[Off-chain Worker] -> [PriceFeed/NFTFloorOracle updates]
[Off-chain Worker] -> [Liquidation job queue] -> [Vault liquidation]

## Conclusion
OmniYield provides a modular and secure framework for leveraging NFTs as collateral in DeFi. By separating concerns into distinct on-chain contracts and off-chain services, the protocol achieves flexibility, upgradeability, and efficient capital utilization.