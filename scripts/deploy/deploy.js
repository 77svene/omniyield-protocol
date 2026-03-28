// scripts/deploy/deploy.js
require("dotenv").config();
const fs = require("fs");
const { ethers } = require("hardhat");

async function main() {
  // Ensure we have a signer  const [deployer] = await ethers.getSigners();

  console.log(`Deploying contracts with account: ${deployer.address}`);
  console.log(`Account balance: ${(await deployer.getBalance()).toString()} wei`);

  const deployments = {};

  // ==== Deploy core contracts ====
  // AccessControl  const AccessControl = await ethers.getContractFactory("AccessControl");
  const accessControl = await AccessControl.deploy();
  await accessControl.waitForDeployment();
  deployments.AccessControl = await accessControl.getAddress();

  // Registry
  const Registry = await ethers.getContractFactory("Registry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  deployments.Registry = await registry.getAddress();

  // Vault
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();
  deployments.Vault = await vault.getAddress();

  // LiquidityManager
  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  const liquidityManager = await LiquidityManager.deploy();
  await liquidityManager.waitForDeployment();
  deployments.LiquidityManager = await liquidityManager.getAddress();

  // FeeDistributor (needs reward and staking tokens)
  const ERC20 = await ethers.getContractFactory("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
  const rewardToken = await ERC20.deploy("Reward Token", "RWD", 18);
  const stakingToken = await ERC20.deploy("Staking Token", "STK", 18);
  await rewardToken.waitForDeployment();
  await stakingToken.waitForDeployment();

  const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
  const feeDistributor = await FeeDistributor.deploy(rewardToken.target, stakingToken.target);
  await feeDistributor.waitForDeployment();
  deployments.FeeDistributor = await feeDistributor.getAddress();
  deployments.rewardToken = await rewardToken.getAddress();
  deployments.stakingToken = await stakingToken.getAddress();

  // PriceFeed (oracle)
  const PriceFeed = await ethers.getContractFactory("PriceFeed");
  const priceFeed = await PriceFeed.deploy();
  await priceFeed.waitForDeployment();
  deployments.PriceFeed = await priceFeed.getAddress();

  // NFTFloorOracle
  const NFTFloorOracle = await ethers.getContractFactory("NFTFloorOracle");
  const nftFloorOracle = await NFTFloorOracle.deploy();
  await nftFloorOracle.waitForDeployment();
  deployments.NFTFloorOracle = await nftFloorOracle.getAddress();

  // LiquidationEngine
  const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
  const liquidationEngine = await LiquidationEngine.deploy();
  await liquidationEngine.waitForDeployment();
  deployments.LiquidationEngine = await liquidationEngine.getAddress();

  // ==== Linkage phase ====
  // Set router address (use FeeDistributor as placeholder router)
  const routerAddress = deployments.FeeDistributor;

  // Attempt to set router on contracts that expose a setRouter(address) function
  try {
    const VaultInstance = await ethers.getContractAt("Vault", deployments.Vault);
    if (VaultInstance.interface.getFunction("setRouter(address)")) {
      const tx = await VaultInstance.setRouter(routerAddress);
      await tx.wait();
      console.log(" Set router on Vault");
    }
  } catch (e) {
    console.warn(" Vault setRouter not available or failed:", e.message);
  }

  try {
    const LiquidityManagerInstance = await ethers.getContractAt("LiquidityManager", deployments.LiquidityManager);
    if (LiquidityManagerInstance.interface.getFunction("setRouter(address)")) {
      const tx = await LiquidityManagerInstance.setRouter(routerAddress);
      await tx.wait();
      console.log("