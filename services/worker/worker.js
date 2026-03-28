const cron = require('node-cron');
const { exec } = require('child_process');
const JobQueue = require('./jobQueue');
const ethers = require('ethers');

let liquidationEngineAbi;
try {
  liquidationEngineAbi = require('../artifacts/contracts/modules/LiquidationEngine.sol/LiquidationEngine.json').abi;
} catch (e) {
  console.error('Failed to load LiquidationEngine ABI:', e.message);
  process.exit(1);
}

const LIQUIDATION_ENGINE_ADDRESS = process.env.LIQUIDATION_ENGINE_ADDRESS || '0x0000000000000000000000000000000000000000';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';
const HARDHAT_URL = process.env.HARDHAT_URL || 'http://localhost:8545';

if (LIQUIDATION_ENGINE_ADDRESS === '0x0000000000000000000000000000000000000000' || 
    PRIVATE_KEY === '0x0000000000000000000000000000000000000000000000000000000000000000') {
  console.warn('Using default LiquidationEngine address or private key. Set LIQUIDATION_ENGINE_ADDRESS and PRIVATE_KEY environment variables.');
}

const provider = new ethers.JsonRpcProvider(HARDHAT_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const liquidationEngine = new ethers.Contract(LIQUIDATION_ENGINE_ADDRESS, liquidationEngineAbi, wallet);

const jobQueue = new JobQueue();

function runPriceUpdater() {
  exec('node ' + __dirname + '/priceUpdater.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing priceUpdater: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Price updater stderr: ${stderr}`);
    }
    console.log(`Price updater stdout: ${stdout}`);
  });
}

async function processJobQueue() {
  let job;
  while ((job = jobQueue.dequeue()) !== null) {
    try {
      if (!job.vault || !job.nftCollection || typeof job.nftId !== 'number') {
        throw new Error('Invalid job parameters: missing vault, nftCollection, or nftId (number)');
      }
      const tx = await liquidationEngine.liquidateIfNeeded(job.vault, job.nftCollection, job.nftId);
      const receipt = await tx.wait();
      console.log(`Liquidation successful for vault ${job.vault}, NFT ${job.nftCollection}/${job.nftId}. Tx: ${tx.hash}`);
    } catch (err) {
      console.error('Error processing job for liquidation:', err.message);
    }
  }
}

cron.schedule('* * * * *', runPriceUpdater);
cron.schedule('* * * * *', processJobQueue);

console.log('Worker started');