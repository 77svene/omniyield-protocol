# OmniYield

Cross-chain NFT-collateralized lending and yield aggregator protocol.

## Overview

OmniYield enables users to lock ERC-721/1155 NFTs as collateral to borrow against their floor-price-derived value, then automatically deploy borrowed capital into optimized yield strategies across chains. The protocol creates a new liquidity layer for idle NFT collections by minting yield-bearing synthetic assets.

## Core Components

- **Registry**: Tracks whitelisted NFT collections and their floor-price oracles- **Vault**: ERC-4626 compliant vault for NFT collateral with dynamic LTV calculations
- **AccessControl**: Role-based permissions for governance and emergency actions
- **LiquidityManager**: Routes borrowed funds to highest-yielding strategies
- **FeeDistributor**: Accrues and distributes protocol fees to stakers and treasury
- **LiquidationEngine**: Autonomous Dutch-style auctions for under-collateralized NFTs

## Quick Start

### Prerequisites

- Node.js >= 18
- Hardhat
- Sepolia testnet RPC URL (for deployment)
- Private key with Sepolia ETH for gas

### Installation```bash
git clone https://github.com/your-omniyield/repo.git
cd omniyield
npm install
```

### Environment SetupCreate a `.env` file in the root directory:

```env
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
PRIVATE_KEY="YOUR_PRIVATE_KEY"
ETHERSCAN_API_KEY="YETHERSCAN_API_KEY"
```

### Deployment

Deploy to Sepolia testnet:

```bash
npx hardhat deploy --network sepolia
```

The deployment script will:
1. Deploy core contracts (Registry, Vault, AccessControl)
2. Deploy oracle contracts (PriceFeed, NFTFloorOracle)
3. Deploy module contracts (LiquidityManager, FeeDistributor, LiquidationEngine)
4. Set up cross-contract linkages
5. Verify contracts on Etherscan (if API key provided)

### Running Tests

```bash
npx hardhat test
```

### Local Development Node

Start a local Hardhat node:

```bash
npx hardhat node
```

Deploy to local network:

```bash
npx hardhat deploy --network localhost
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed subsystem interactions, data flow, and upgrade paths.

## API Documentation

See [API.md](API.md) for Express API endpoints, request/response schemas, and usage examples.

## Security Notes

### Smart Contract Security

- All contracts inherit from OpenZeppelin's battle-tested libraries
- AccessControl module enforces role-based permissions for sensitive operations
- ReentrancyGuard protects against reentrancy attacks in fee distribution and liquidity management
- External calls use check-effects-interactions pattern
- All user inputs are validated with require statements and custom error messages
- Oracle price feeds use median of multiple sources to resist manipulation
- Liquidation engine includes time-weighted average prices (TWAP) to prevent flash loan attacks

### Off-Chain Security

- API service validates all incoming requests and sanitizes inputs
- Worker service uses signed messages for privileged operations
- All RPC connections use environment-configured endpoints with timeout handling- Private keys are never logged or exposed in error messages
- Rate limiting prevents abuse of public endpoints### Risk Disclosures

- NFT floor prices are volatile and may decrease rapidly
- Yield strategies carry smart contract risk of underlying protocols
- Liquidation may occur if collateral value drops below threshold
- Cross-chain bridges introduce additional risk vectors
- Users should conduct independent research before interacting with the protocol

## License

MIT License

Copyright (c) 2026 OmniYieldPermission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Contact

For questions or support, please join our [Discord community](https://discord.gg/omniyield) or email us at [omniyield@example.com](mailto:omniyield@example.com).