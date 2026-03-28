// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/AccessControl.sol";

contract NFTFloorOracle is AccessControl {
    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");

    // Mapping from NFT collection address to its floor price (in wei, assuming USD value with 8 decimals)
    mapping(address => uint256) public floorPrice;
    // Timestamp of last update for each collection
    mapping(address => uint256) public lastUpdated;

    event FloorPriceUpdated(address indexed collection, uint256 price, uint256 timestamp);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ORACLE_UPDATER_ROLE, msg.sender);
    }

    modifier onlyOracleUpdater() {
        if (!hasRole(ORACLE_UPDATER_ROLE, msg.sender)) {
            revert("NFTFloorOracle: missing oracle updater role");
        }
        _;
    }

    /**
     * @dev Updates the floor price for a given NFT collection
     * @param collection Address of the NFT collection (ERC-721 or ERC-1155)
     * @param price Floor price in wei (assuming 8 decimals for USD equivalence, e.g., 2000 * 10^8 for $2000)
     */
    function updateFloorPrice(address collection, uint256 price) external onlyOracleUpdater {
        require(collection != address(0), "NFTFloorOracle: zero collection address");
        require(price > 0, "NFTFloorOracle: price must be positive");

        floorPrice[collection] = price;
        lastUpdated[collection] = block.timestamp;

        emit FloorPriceUpdated(collection, price, block.timestamp);
    }

    /**
     * @dev Returns the floor price and last update timestamp for a collection
     * @param collection Address of the NFT collection
     * @return price Current floor price in wei
     * @return timestamp Last update timestamp
     */
    function getFloorPrice(address collection) external view returns (uint256 price, uint256 timestamp) {
        require(floorPrice[collection] > 0, "NFTFloorOracle: no price set");
        return (floorPrice[collection], lastUpdated[collection]);
    }
}