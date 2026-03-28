// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract AccessControl is AccessControl {
    bytes32 public constant VAULT_OPERATOR_ROLE = keccak256("VAULT_OPERATOR_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    event VaultOperatorAccessFailure(address indexed caller, uint256 timestamp);
    event LiquidatorAccessFailure(address indexed caller, uint256 timestamp);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(VAULT_OPERATOR_ROLE, msg.sender);
        _setupRole(LIQUIDATOR_ROLE, msg.sender);
    }

    modifier onlyVaultOperator() {
        if (!hasRole(VAULT_OPERATOR_ROLE, msg.sender)) {
            emit VaultOperatorAccessFailure(msg.sender, block.timestamp);
            revert("AccessControl: missing vault operator role");
        }
        _;
    }

    modifier onlyLiquidator() {
        if (!hasRole(LIQUIDATOR_ROLE, msg.sender)) {
            emit LiquidatorAccessFailure(msg.sender, block.timestamp);
            revert("AccessControl: missing liquidator role");
        }
        _;
    }
}