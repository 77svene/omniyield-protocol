const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Initialize provider and signer from environment variablesconst provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
const signer = new ethers.Wallet(process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);

// Load contract ABIs from artifactsconst artifactsDir = path.join(__dirname, '..', '..', 'artifacts', 'contracts');
const vaultAbi = JSON.parse(fs.readFileSync(path.join(artifactsDir, 'Vault.sol', 'Vault.json'), 'utf8')).abi;
const registryAbi = JSON.parse(fs.readFileSync(path.join(artifactsDir, 'Registry.sol', 'Registry.json'), 'utf8')).abi;

// Contract addresses from environment variables
const vaultAddress = process.env.VAULT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const registryAddress = process.env.REGISTRY_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// Initialize contract instances
const vaultContract = new ethers.Contract(vaultAddress, vaultAbi, signer);
const registryContract = new ethers.Contract(registryAddress, registryAbi, signer);

/**
 * GET /health
 * Returns 200 and chain ID
 */
router.get('/health', async (req, res) => {
  try {
    const network = await provider.getNetwork();
    res.status(200).json({ 
      status: 'OK',       chainId: network.chainId.toString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Service unavailable' });
  }
});

/**
 * GET /vault/stats * Returns totalDeposited, totalBorrowed, totalYieldEarned from Vault
 */
router.get('/vault/stats', async (req, res) => {
  try {
    // Assuming the Vault has these view functions
    const [totalDeposited, totalBorrowed, totalYieldEarned] = await Promise.all([
      vaultContract.totalDeposited(),
      vaultContract.totalBorrowed(),
      vaultContract.totalYieldEarned()
    ]);

    res.status(200).json({
      totalDeposited: totalDeposited.toString(),
      totalBorrowed: totalBorrowed.toString(),
      totalYieldEarned: totalYieldEarned.toString()
    });
  } catch (error) {
    console.error('Vault stats error:', error);
    res.status(500).json({ error: 'Failed to fetch vault statistics' });
  }
});

/**
 * POST /tx/build
 * Builds transaction data for deposit, withdraw, borrow, or repay actions
 */
router.post('/tx/build', express.json(), async (req, res) => {
  const { action, params } = req.body;

  if (!action || !params) {
    return res.status(400).json({ error: 'Action and params are required' });
  }

  try {
    let tx;

    switch (action) {
      case 'deposit':
        // params: { nftContract, tokenId }
        tx = await vaultContract.deposit.populateTransaction(
          params.nftContract,
          params.tokenId
        );
        break;
      case 'withdraw':
        // params: { nftContract, tokenId }
        tx = await vaultContract.withdraw.populateTransaction(
          params.nftContract,
          params.tokenId
        );
        break;
      case 'borrow':
        // params: { amount }
        tx = await vaultContract.borrow.populateTransaction(
          params.amount
        );
        break;
      case 'repay':
        // params: { amount }
        tx = await vaultContract.repay.populateTransaction(
          params.amount
        );
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.status(200).json({
      to: tx.to,
      data: tx.data,
      value: tx.value ? tx.value.toString() : '0',
      gasLimit: tx.gasLimit ? tx.gasLimit.toString() : '0'
    });
  } catch (error) {
    console.error('Transaction build error:', error);
    res.status(500).json({ error: 'Failed to build transaction' });
  }
});

module.exports = router;