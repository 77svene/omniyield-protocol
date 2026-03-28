const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquidityManager", function () {
  let liquidityManager;
  let mockToken;
  let mockStrategy;
  let owner;
  let vault;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, vault, addr1, addr2] = await ethers.getSigners();

    // Deploy mock ERC20 token    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MTK", 18);
    await mockToken.waitForDeployment();

    // Deploy mock strategy
    const MockStrategy = await ethers.getContractFactory("MockStrategy");
    mockStrategy = await MockStrategy.deploy();
    await mockStrategy.waitForDeployment();

    // Deploy LiquidityManager
    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    liquidityManager = await LiquidityManager.deploy(mockToken.target, vault.address);
    await liquidityManager.waitForDeployment();

    // Whitelist the mock strategy
    await liquidityManager.whitelistStrategy(mockStrategy.target);
  });

  describe("Deposit", function () {
    it("Should deposit tokens to strategy and record shares", async function () {
      const depositAmount = ethers.parseEther("100");
      await mockToken.approve(liquidityManager.target, depositAmount);

      await expect(liquidityManager.depositToStrategy(mockStrategy.target, depositAmount))
        .to.emit(liquidityManager, "Deposited")
        .withArgs(mockStrategy.target, owner.address, depositAmount);

      // Check that token was transferred to liquidityManager
      expect(await mockToken.balanceOf(liquidityManager.target)).to.equal(depositAmount);

      // Check that strategy received deposit and returned shares
      const shares = await mockStrategy.sharesLastDeposited();
      expect(shares).to.be.gt(0);

      // Check that vaultShares mapping updated
      const vaultShares = await liquidityManager.vaultShares(mockStrategy.target);
      expect(vaultShares).to.equal(shares);
    });

    it("Should revert if caller is not vault", async function () {
      const depositAmount = ethers.parseEther("50");
      await mockToken.connect(addr1).approve(liquidityManager.target, depositAmount);

      await expect(
        liquidityManager.connect(addr1).depositToStrategy(mockStrategy.target, depositAmount)
      ).to.be.revertedWith("AccessControl: missing vault role");
    });

    it("Should revert if strategy not whitelisted", async function () {
      const depositAmount = ethers.parseEther("50");
      await mockToken.approve(liquidityManager.target, depositAmount);

      const nonWhitelistedStrategy = await MockStrategy.deploy();
      await nonWhitelistedStrategy.waitForDeployment();

      await expect(
        liquidityManager.depositToStrategy(nonWhitelistedStrategy.target, depositAmount)
      ).to.be.revertedWith("LiquidityManager: strategy not whitelisted");
    });
  });

  describe("Withdraw", function () {
    it("Should withdraw shares from strategy and return tokens", async function () {
      const depositAmount = ethers.parseEther("200");
      await mockToken.approve(liquidityManager.target, depositAmount);
      await liquidityManager.depositToStrategy(mockStrategy.target, depositAmount);

      const sharesBefore = await liquidityManager.vaultShares(mockStrategy.target);
      expect(sharesBefore).to.be.gt(0);

      await expect(liquidityManager.withdrawFromStrategy(mockStrategy.target, sharesBefore))
        .to.emit(liquidityManager, "Withdrawn")
        .withArgs(mockStrategy.target, owner.address, depositAmount);

      // Check that tokens returned to liquidityManager      expect(await mockToken.balanceOf(liquidityManager.target)).to.equal(depositAmount);

      // Check that vaultShares updated to zero
      const sharesAfter = await liquidityManager.vaultShares(mockStrategy.target);
      expect(sharesAfter).to.equal(0);
    });

    it("Should revert if caller is not vault", async function () {
      const depositAmount = ethers.parseEther("100");
      await mockToken.approve(liquidityManager.target, depositAmount);
      await liquidityManager.depositToStrategy(mockStrategy.target, depositAmount);

      const shares = await liquidityManager.vaultShares(mockStrategy.target);

      await expect(
        liquidityManager.connect(addr1).withdrawFromStrategy(mockStrategy.target, shares)
      ).to.be.revertedWith("AccessControl: missing vault role");
    });
  });

  describe("Yield accrual simulation", function () {
    it("Should increase strategy balance over time (simulated)", async function () {
      const depositAmount = ethers.parseEther("100");
      await mockToken.approve(liquidityManager.target, depositAmount);
      await liquidityManager.depositToStrategy(mockStrategy.target, depositAmount);

      const initialShares = await liquidityManager.vaultShares(mockStrategy.target);
      expect(initialShares).to.be.gt(0);

      // Simulate yield by increasing strategy's internal balance
      await mockStrategy.simulateYield(ethers.parseEther("10")); // Add 10 tokens worth of yield

      // Withdraw should now return more tokens than deposited
      const shares = await liquidityManager.vaultShares(mockStrategy.target);
      await liquidityManager.withdrawFromStrategy(mockStrategy.target, shares);

      // The liquidityManager should now hold more than the original deposit      const finalBalance = await mockToken.balanceOf(liquidityManager.target);
      expect(finalBalance).to.be.gt(depositAmount);
    });
  });
});

// Mock ERC20 contract for testing
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        balanceOf[to] += amount;
        balanceOf[msg.sender] -= amount;
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(allowance[from][msg.sender] >= amount, "ERC20: transfer amount exceeds allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }
}

// Mock Strategy contract for testing
contract MockStrategy {
    uint256 public sharesLastDeposited;
    uint256 public internalBalance; // Simulates strategy's underlying asset balance

    function deposit(uint256 amount) external returns (uint256 shares) {
        internalBalance += amount;
        shares = amount; // 1:1 share ratio for simplicity        sharesLastDeposited = shares;
        return shares;
    }

    function withdraw(uint256 shares) external returns (uint256 amount) {
        require(internalBalance >= shares, "Insufficient balance");
        amount = shares;
        internalBalance -= shares;
        return amount;
    }

    function balanceOf(address user) external view returns (uint256) {
        // Simplified: all shares belong to vault in test
        return internalBalance;
    }

    function simulateYield(uint256 yieldAmount) external {
        internalBalance += yieldAmount;
    }
}