const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OmniYield Integration Test", function () {
  let deployer, user, liquidator;
  let yToken, rewardToken, stakingToken, nft;
  let ethPriceFeed, nftFloorOracle;
  let registry, vault, liquidityManager, feeDistributor, liquidationEngine;
  let mockStrategy;

  beforeEach(async function () {
    [deployer, user, liquidator] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    yToken = await ERC20Mock.deploy("Yield Token", "YT", 18);
    rewardToken = await ERC20Mock.deploy("Reward Token", "RT", 18);
    stakingToken = await ERC20Mock.deploy("Staking Token", "ST", 18);

    // Deploy mock ERC721 for NFT collateral
    const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
    nft = await ERC721Mock.deploy();
    await nft.safeMint(user.address, 1);

    // Deploy mock price feeds
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    ethPriceFeed = await MockV3Aggregator.deploy(8, ethers.parseEther("2000")); // $2000/ETH
    const nftFloorFeed = await MockV3Aggregator.deploy(8, ethers.parseEther("10")); // 10 ETH/NFT
    const NFTFloorOracle = await ethers.getContractFactory("NFTFloorOracle");
    nftFloorOracle = await NFTFloorOracle.deploy(nftFloorFeed.target);

    // Deploy core protocol contracts
    const Registry = await ethers.getContractFactory("Registry");
    registry = await Registry.deploy();

    const PriceFeed = await ethers.getContractFactory("PriceFeed");
    const ethPriceFeedContract = await PriceFeed.deploy(ethPriceFeed.target);

    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(registry.target, ethPriceFeedContract.target, nftFloorOracle.target, yToken.target);

    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    liquidityManager = await LiquidityManager.deploy(yToken.target, vault.target);

    const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
    feeDistributor = await FeeDistributor.deploy(rewardToken.target, stakingToken.target);

    const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
    liquidationEngine = await LiquidationEngine.deploy(vault.target, liquidityManager.target, feeDistributor.target, deployer.address);

    // Setup roles and permissions
    await liquidityManager.grantRole(await liquidityManager.VAULT_ROLE(), vault.target);
    await feeDistributor.grantRole(await feeDistributor.FEE_COLLECTOR_ROLE(), vault.target);
    await vault.setLiquidityManager(liquidityManager.target);
    await vault.setFeeDistributor(feeDistributor.target);
    await registry.whitelistCollection(nft.target, nftFloorOracle.target);
    await nft.connect(user).setApprovalForAll(vault.target, true);
  });

  it("should execute full user flow: deposit, borrow, allocate, yield, liquidate", async function () {
    // Deposit NFT and borrow against it
    await vault.connect(user).depositNFT(nft.target, 1);
    let accountInfo = await vault.getUserAccountInfo(user.address);
    expect(accountInfo.debt).to.be.gt(0);

    // Approve and deposit borrowed yTokens into strategy
    await yToken.connect(user).approve(liquidityManager.target, accountInfo.debt);
    const MockStrategy = await ethers.getContractFactory("MockStrategy");
    mockStrategy = await MockStrategy.deploy(yToken.target);
    await liquidityManager.whitelistStrategy(mockStrategy.target);
    await liquidityManager.connect(user).depositToStrategy(mockStrategy.target, accountInfo.debt);

    // Simulate yield accrual
    const yieldAmount = accountInfo.debt / 10;
    await yToken.transfer(mockStrategy.target, yieldAmount);

    // Trigger liquidation by dropping NFT floor price
    await nftFloorFeed.update(ethers.parseEther("1")); // Drop to 1 ETH/NFT
    await liquidationEngine.connect(liquidator).liquidate(user.address);

    // Verify liquidation outcomes
    accountInfo = await vault.getUserAccountInfo(user.address);
    expect(accountInfo.debt).to.equal(0);
    expect(await nft.ownerOf(1)).to.not.equal(user.address);
  });
});