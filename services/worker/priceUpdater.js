require('dotenv').config();
const { ethers } = require('ethers');
const cron = require('node-cron');

// Configuration from environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat default
const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // Placeholder
const ETH_USD_FEED = process.env.ETH_USD_FEED || '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419'; // Chainlink ETH/USD on Sepoliaconst RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

// Minimal ABI for Chainlink AggregatorV3Interfaceconst aggregatorAbi = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];

// Minimal ABI for NFTFloorOracle (assuming updateFloorPrice function)
const oracleAbi = [
  "function updateFloorPrice(uint256 price) external"
];

async function updatePrice() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    // Fetch ETH/USD price from Chainlink
    const aggregator = new ethers.Contract(ETH_USD_FEED, aggregatorAbi, signer);
    const roundData = await aggregator.latestRoundData();
    const price = roundData.answer; // int256, but we know it's positive
    
    if (price <= 0) {
      throw new Error(`Invalid price from aggregator: ${price}`);
    }
    
    // Convert to uint256 (price is in USD with 8 decimals)
    const priceUint = ethers.BigNumber.from(price);
    
    // Update NFTFloorOracle
    const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleAbi, signer);
    const tx = await oracle.updateFloorPrice(priceUint);
    await tx.wait();
    
    console.log(`[${new Date().toISOString()}] Updated ETH price: ${ethers.formatUnits(priceUint, 8)} USD`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to update price:`, error.message);
  }
}

// Run every minute
cron.schedule('* * * * *', updatePrice);

// Run immediately on start
updatePrice().catch(console.error);

module.exports = { updatePrice };