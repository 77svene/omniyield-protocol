// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IStrategy {
    function deposit(uint256 amount) external returns (uint256 shares);
    function withdraw(uint256 shares) external returns (uint256 amount);
    function balanceOf(address user) external view returns (uint256);
}

contract LiquidityManager is AccessControl, ReentrancyGuard {
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    
    IERC20 public immutable token;
    address public vault;
    
    mapping(address => bool) public isStrategyWhitelisted;
    mapping(address => uint256) public vaultShares; // strategy => shares owned by the vault
    
    event StrategyWhitelisted(address indexed strategy, address indexed token);
    event StrategyRemoved(address indexed strategy);
    event Deposited(address indexed strategy, address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(address indexed strategy, address indexed user, uint256 amount, uint256 shares);
    event YieldCollected(address indexed token, uint256 amount);
    
    constructor(address _token, address _vault) {
        require(_token != address(0), "LiquidityManager: zero token");
        require(_vault != address(0), "LiquidityManager: zero vault");
        token = IERC20(_token);
        vault = _vault;
        
        _setupRole(VAULT_ROLE, _vault);
    }
        modifier onlyVault() {
        if (!hasRole(VAULT_ROLE, msg.sender)) {
            revert("LiquidityManager: only vault");
        }
        _;
    }
    
    /**
     * @dev Whitelists a strategy for the given token.
     * Only callable by the vault.
     * @param strategy Address of the strategy contract
     */
    function whitelistStrategy(address strategy) external onlyVault {
        require(strategy != address(0), "LiquidityManager: zero strategy");
        require(!isStrategyWhitelisted[strategy], "LiquidityManager: already whitelisted");
        
        isStrategyWhitelisted[strategy] = true;
        
        emit StrategyWhitelisted(strategy, token);
    }
    
    /**
     * @dev Removes a strategy from the whitelist.
     * Only callable by the vault.
     * @param strategy Address of the strategy contract
     */
    function removeStrategy(address strategy) external onlyVault {
        require(isStrategyWhitelisted[strategy], "LiquidityManager: not whitelisted");
        
        isStrategyWhitelisted[strategy] = false;
        
        emit StrategyRemoved(strategy);
    }
    
    /**
     * @dev Deposits tokens into a strategy on behalf of the vault.
     * The vault must have already transferred the tokens to this contract.
     * Only callable by the vault.
     * @param strategy Address of the strategy     * @param amount Amount of tokens to deposit
     */
    function depositToStrategy(address strategy, uint256 amount) external onlyVault nonReentrant {
        require(isStrategyWhitelisted[strategy], "LiquidityManager: strategy not whitelisted");
        require(amount > 0, "LiquidityManager: zero amount");
        
        // Approve the strategy to spend tokens from this contract
        require(token.approve(strategy, amount), "LiquidityManager: approve failed");
        
        uint256 shares = IStrategy(strategy).deposit(amount);
        require(shares > 0, "LiquidityManager: zero shares");
        
        // Record the vault's shares in this strategy
        vaultShares[strategy] += shares;
        
        emit Deposited(strategy, vault, amount, shares);
    }
    
    /**
     * @dev Withdraws shares from a strategy and sends the tokens to the vault.
     * Only callable by the vault.
     * @param strategy Address of the strategy
     * @param shares Number of shares to withdraw
     */
    function withdrawFromStrategy(address strategy, uint256 shares) external onlyVault nonReentrant {
        require(isStrategyWhitelisted[strategy], "LiquidityManager: strategy not whitelisted");
        require(shares > 0, "LiquidityManager: zero shares");
                uint256 vaultSharesBalance = vaultShares[strategy];
        require(vaultSharesBalance >= shares, "LiquidityManager: insufficient shares");
        
        uint256 amount = IStrategy(strategy).withdraw(shares);
        require(amount > 0, "LiquidityManager: zero amount");
        
        // Update the vault's shares
        vaultShares[strategy] = vaultSharesBalance - shares;
        
        // Send the tokens to the vault
        require(token.transfer(vault, amount), "LiquidityManager: transfer failed");
        
        emit Withdrawn(strategy, vault, amount, shares);
        // Emit YieldCollected as the amount withdrawn (includes principal and yield)
        emit YieldCollected(token, amount);
    }
    
    /**
     * @dev Allows the vault to withdraw all shares from a strategy.
     * Only callable by the vault.
     * @param strategy Address of the strategy
     */
    function withdrawAllFromStrategy(address strategy) external onlyVault nonReentrant {
        uint256 shares = vaultShares[strategy];
        require(shares > 0, "LiquidityManager: no shares to withdraw");
        withdrawFromStrategy(strategy, shares);
    }
}