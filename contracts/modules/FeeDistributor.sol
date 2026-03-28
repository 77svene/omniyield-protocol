// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract FeeDistributor is AccessControl, ReentrancyGuard {
    bytes32 public constant FEE_COLLECTOR_ROLE = keccak256("FEE_COLLECTOR_ROLE");
    bytes32 public constant STAKER_ROLE = keccak256("STAKER_ROLE");

    IERC20 public immutable rewardToken; // Token in which fees are distributed (e.g., USDC)
    IERC20 public immutable stakingToken; // Token that users stake to earn rewards

    uint256 public totalStake; // Total amount of stakingToken staked
    uint256 public totalRewards; // Total amount of rewardToken collected as fees
    uint256 public rewardPerToken; // Accrued reward per token of stakingToken (with 1e18 precision)

    mapping(address => uint256) public stake; // User's staked amount
    mapping(address => uint256) public rewardPerTokenPaid; // User's last rewardPerToken debt

    event FeesCollected(address indexed collector, uint256 amount);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 rewardAmount);

    constructor(address _rewardToken, address _stakingToken) {
        require(_rewardToken != address(0), "FeeDistributor: zero reward token");
        require(_stakingToken != address(0), "FeeDistributor: zero staking token");
        rewardToken = IERC20(_rewardToken);
        stakingToken = IERC20(_stakingToken);
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(FEE_COLLECTOR_ROLE, msg.sender);
        _setupRole(STAKER_ROLE, msg.sender);
    }

    modifier onlyFeeCollector() {
        if (!hasRole(FEE_COLLECTOR_ROLE, msg.sender)) {
            revert("FeeDistributor: missing fee collector role");
        }
        _;
    }

    modifier onlyStaker() {
        if (!hasRole(STAKER_ROLE, msg.sender)) {
            revert("FeeDistributor: missing staker role");
        }
        _;
    }

    /**
     * @dev Collects protocol fees from Vault or LiquidityManager
     * @param amount Amount of rewardToken to add to the reward pool
     */
    function depositFees(uint256 amount) external onlyFeeCollector nonReentrant {
        require(amount > 0, "FeeDistributor: zero amount");
        require(rewardToken.transferFrom(msg.sender, address(this), amount), "FeeDistributor: transfer failed");
        
        totalRewards += amount;
        _updateRewardPerToken();
        
        emit FeesCollected(msg.sender, amount);
    }

    /**
     * @dev Stakes stakingToken to earn rewards     * @param amount Amount of stakingToken to stake
     */
    function stake(uint256 amount) external onlyStaker nonReentrant {
        require(amount > 0, "FeeDistributor: zero stake amount");
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "FeeDistributor: stake transfer failed");
        
        _updateReward(msg.sender);
        totalStake += amount;
        stake[msg.sender] += amount;
        _updateRewardPerToken();
        
        emit Staked(msg.sender, amount);
    }

    /**
     * @dev Withdraws staked stakingToken
     * @param amount Amount of stakingToken to withdraw
     */
    function withdraw(uint256 amount) external onlyStaker nonReentrant {
        require(amount > 0, "FeeDistributor: zero withdraw amount");
        require(stake[msg.sender] >= amount, "FeeDistributor: insufficient stake");
        
        _updateReward(msg.sender);
        stake[msg.sender] -= amount;
        totalStake -= amount;
        _updateRewardPerToken();
        
        require(stakingToken.transfer(msg.sender, amount), "FeeDistributor: withdraw transfer failed");
        
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @dev Claims accrued rewards     */
    function getReward() external onlyStaker nonReentrant {
        uint256 reward = _earned(msg.sender);
        if (reward > 0) {
            rewardPerTokenPaid[msg.sender] = rewardPerToken;
            require(rewardToken.transfer(msg.sender, reward), "FeeDistributor: reward transfer failed");
            emit RewardPaid(msg.sender, reward);
        }
    }

    /**
     * @dev Returns the accrued reward for a user
     * @param user Address of the user
     * @return Accrued reward in rewardToken (wei)
     */
    function earned(address user) public view returns (uint256) {
        return _earned(user);
    }

    function _earned(address user) internal view returns (uint256) {
        return (stake[user] * (rewardPerToken - rewardPerTokenPaid[user])) / 1e18;
    }

    function _updateRewardPerToken() private {
        if (totalStake > 0) {
            rewardPerToken = (totalRewards * 1e18) / totalStake;
        } else {
            rewardPerToken = 0;
        }
    }

    function _updateReward(address user) private {
        uint256 earned = _earned(user);
        if (earned > 0) {
            rewardPerTokenPaid[user] = rewardPerToken;
        }
    }
}