// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract Registry is AccessControl {
    bytes32 public constant REGISTRY_ADMIN_ROLE = keccak256("REGISTRY_ADMIN_ROLE");

    // Mapping from NFT collection address to oracle address
    mapping(address => address) public collectionToOracle;
    // Set of whitelisted collections
    mapping(address => bool) public isCollectionWhitelisted;

    event CollectionWhitelisted(address indexed collection, address indexed oracle);
    event CollectionRemoved(address indexed collection);
    event OracleUpdated(address indexed collection, address indexed oracle);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(REGISTRY_ADMIN_ROLE, msg.sender);
    }

    modifier onlyRegistryAdmin() {
        if (!hasRole(REGISTRY_ADMIN_ROLE, msg.sender)) {
            revert("Registry: missing registry admin role");
        }
        _;
    }

    /**
     * @dev Whitelists an NFT collection and sets its oracle address     * @param collection Address of the NFT collection (ERC-721 or ERC-1155)
     * @param oracle Address of the floor-price oracle for this collection
     */
    function whitelistCollection(address collection, address oracle) external onlyRegistryAdmin {
        require(collection != address(0), "Registry: zero collection address");
        require(oracle != address(0), "Registry: zero oracle address");
        require(!isCollectionWhitelisted[collection], "Registry: already whitelisted");

        isCollectionWhitelisted[collection] = true;
        collectionToOracle[collection] = oracle;

        emit CollectionWhitelisted(collection, oracle);
    }

    /**
     * @dev Removes a collection from the whitelist     * @param collection Address of the NFT collection to remove
     */
    function removeCollection(address collection) external onlyRegistryAdmin {
        require(isCollectionWhitelisted[collection], "Registry: not whitelisted");

        isCollectionWhitelisted[collection] = false;
        collectionToOracle[collection] = address(0);

        emit CollectionRemoved(collection);
    }

    /**
     * @dev Updates the oracle address for a whitelisted collection
     * @param collection Address of the NFT collection
     * @param oracle New oracle address
     */
    function updateOracle(address collection, address oracle) external onlyRegistryAdmin {
        require(isCollectionWhitelisted[collection], "Registry: collection not whitelisted");
        require(oracle != address(0), "Registry: zero oracle address");

        collectionToOracle[collection] = oracle;
        emit OracleUpdated(collection, oracle);
    }

    /**
     * @dev Checks if a collection is whitelisted
     * @param collection Address of the NFT collection
     * @return True if whitelisted, false otherwise
     */
    function isWhitelisted(address collection) public view returns (bool) {
        return isCollectionWhitelisted[collection];
    }

    /**
     * @dev Gets the oracle address for a whitelisted collection
     * @param collection Address of the NFT collection     * @return Oracle address, or zero address if not whitelisted
     */
    function getOracle(address collection) public view returns (address) {
        return isCollectionWhitelisted[collection] ? collectionToOracle[collection] : address(0);
    }
}