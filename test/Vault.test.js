const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Vault", function () {
  let vault, registry, nft, priceFeed, nftOracle, feeDistributor, liquidityManager, liquidationEngine;
  let owner, user, liquidator;
  const VAULT_OPERATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
  const LIQUIDATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LIQUIDATOR_ROLE"));

  beforeEach(async function () {
    [owner, user, liquidator] = await ethers.getSigners();

    // Deploy mock ERC721 NFT collection
    const MockERC721 = await ethers.getContractFactory("MockERC721");
    nft = await MockERC721.deploy("Mock NFT", "MNFT");
    await nft.deployed();

    // Deploy mock price feed (ETH/USD)
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    priceFeed = await MockPriceFeed.deploy();
    await priceFeed.deployed();
    await priceFeed.updateAnswer(ethers.utils.parseUnits("2000", 8)); // $2000/ETH with 8 decimals

    // Deploy mock NFT floor oracle
    const MockNFTFloorOracle = await ethers.getContractFactory("MockNFTFloorOracle");
    nftOracle = await MockNFTFloorOracle.deploy(priceFeed.address);
    await nftOracle.deployed();

    // Deploy Registry
    const Registry = await ethers.getContractFactory("Registry");
    registry = await Registry.deploy();
    await registry.deployed();
    await registry.whitelistCollection(nft.address, nftOracle.address);

    // Deploy FeeDistributor (mock reward and staking tokens)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const rewardToken = await MockERC20.deploy("Reward Token", "REWARD", 18);
    const stakingToken = await MockERC20.deploy("Staking Token", "STAKE", 18);
    await rewardToken.deployed();
    await stakingToken.deployed();
    const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
    feeDistributor = await FeeDistributor.deploy(rewardToken.address, stakingToken.address);
    await feeDistributor.deployed();

    // Deploy LiquidityManager (mock token and vault)
    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    liquidityManager = await LiquidityManager.deploy(rewardToken.address, ethers.constants.AddressZero);
    await liquidityManager.deployed();

    // Deploy LiquidationEngine (mock)
    const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
    liquidationEngine = await LiquidationEngine.deploy();
    await liquidationEngine.deployed();

    // Deploy Vault
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(
      registry.address,
      feeDistributor.address,
      liquidityManager.address,
      liquidationEngine.address
    );
    await vault.deployed();

    // Setup roles
    await vault.grantRole(VAULT_OPERATOR_ROLE, owner.address);
    await vault.grantRole(LIQUIDATOR_ROLE, liquidator.address);

    // Approve Vault to transfer NFTs from user    await nft.connect(user).setApprovalForAll(vault.address, true);
  });

  describe("Deposit", function () {
    it("Should allow user to deposit NFT and receive yTokens", async function () {
      const depositAmount = ethers.utils.parseUnits("1", 0); // 1 NFT
      await expect(vault.connect(user).deposit(nft.address, 1, depositAmount))
        .to.emit(vault, "Deposit")
        .withArgs(user.address, nft.address, 1, depositAmount);

      const shares = await vault.balanceOf(user.address);
      expect(shares).to.equal(depositAmount);
    });

    it("Should revert if collection not whitelisted", async function () {
      const MockERC721 = await ethers.getContractFactory("MockERC721");
      const randomNFT = await MockERC721.deploy("Random NFT", "RND");
      await randomNFT.deployed();
      await nft.connect(user).setApprovalForAll(vault.address, true);

      await expect(
        vault.connect(user).deposit(randomNFT.address, 1, ethers.utils.parseUnits("1", 0))
      ).to.be.revertedWith("Registry: collection not whitelisted");
    });
  });

  describe("Borrow", function () {
    beforeEach(async function () {
      // Deposit 1 NFT first
      await vault.connect(user).deposit(nft.address, 1, ethers.utils.parseUnits("1", 0));
      // Set floor price to 1 ETH = $2000
      await priceFeed.updateAnswer(ethers.utils.parseUnits("2000", 8));
    });

    it("Should allow user to borrow against deposited NFT", async function () {
      const borrowAmount = ethers.utils.parseUnits("500", 8); // $500
      await expect(vault.connect(user).borrow(borrowAmount))
        .to.emit(vault, "Borrow")
        .withArgs(user.address, borrowAmount);

      const debt = await vault.debtOf(user.address);
      expect(debt).to.equal(borrowAmount);
    });

    it("Should calculate LTV correctly", async function () {
      // Borrow 50% of collateral value ($1000 collateral, borrow $500)
      await vault.connect(user).borrow(ethers.utils.parseUnits("500", 8));
      const ltv = await vault.calculateLTV(user.address);
      expect(ltv).to.equal(5000); // 50.00% with 4 decimal precision
    });

    it("Should revert if borrow exceeds max LTV", async function () {
      // Max LTV is 60% (6000 in 4 decimal precision)
      await expect(
        vault.connect(user).borrow(ethers.utils.parseUnits("700", 8)) // $700 > 60% of $1000
      ).to.be.revertedWith("Vault: LTV too high");
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      await vault.connect(user).deposit(nft.address, 1, ethers.utils.parseUnits("1", 0));
      await priceFeed.updateAnswer(ethers.utils.parseUnits("2000", 8));
      await vault.connect(user).borrow(ethers.utils.parseUnits("400", 8)); // $400 debt
    });

    it("Should allow user to withdraw after repaying debt", async function () {
      // Repay debt
      await vault.connect(user).repay(ethers.utils.parseUnits("400", 8));
      // Withdraw deposit
      await expect(vault.connect(user).withdraw(ethers.utils.parseUnits("1", 0)))
        .to.emit(vault, "Withdraw")
        .withArgs(user.address, nft.address, 1, ethers.utils.parseUnits("1", 0));

      expect(await nft.ownerOf(1)).to.equal(user.address);
      expect(await vault.balanceOf(user.address)).to.equal(0);
    });

    it("Should revert if withdrawal would cause unhealthy LTV", async function () {
      // Try to withdraw without repaying - should fail
      await expect(
        vault.connect(user).withdraw(ethers.utils.parseUnits("1", 0))
      ).to.be.revertedWith("Vault: withdrawal would cause unhealthy LTV");
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      await vault.connect(user).deposit(nft.address, 1, ethers.utils.parseUnits("1", 0));
      await priceFeed.updateAnswer(ethers.utils.parseUnits("2000", 8));
      // Borrow close to max LTV (60%)
      await vault.connect(user).borrow(ethers.utils.parseUnits("1100", 8)); // $1100 debt on $2000 collateral = 55% LTV    });

    it("Should allow liquidator to liquidate unhealthy position", async function () {
      // Drop price to make position unhealthy ($1500/ETH -> collateral value $1500, debt $1100 = 73% LTV > 60% max)
      await priceFeed.updateAnswer(ethers.utils.parseUnits("1500", 8));

      await expect(vault.connect(liquidator).liquidate(user.address))
        .to.emit(vault, "LiquidationCall")
        .withArgs(user.address, nft.address, 1, ethers.utils.parseUnits("1100", 8));

      expect(await nft.ownerOf(1)).to.equal(liquidator.address);
      expect(await vault.debtOf(user.address)).to.equal(0);
    });
  });
});