// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract PriceFeed {
    AggregatorV3Interface internal immutable aggregator;
    uint256 internal immutable maxStaleness;
    int256 internal immutable minAnswer;
    int256 internal immutable maxAnswer;

    // Fallback storage for last good price
    int256 private lastGoodPrice;
    uint256 private lastGoodTimestamp;

    event PriceUpdated(int256 price, uint256 timestamp);
    event OracleCallFailed(string reason);
    event StaleDataUsed(uint256 age);

    /**
     * @param _aggregator Address of the Chainlink AggregatorV3Interface
     * @param _maxStaleness Maximum age of data in seconds before considered stale
     * @param _minAnswer Minimum valid answer from oracle
     * @param _maxAnswer Maximum valid answer from oracle
     */
    constructor(
        address _aggregator,
        uint256 _maxStaleness,
        int256 _minAnswer,
        int256 _maxAnswer
    ) {
        require(_aggregator != address(0), "PriceFeed: zero aggregator address");
        require(_maxStaleness > 0, "PriceFeed: max staleness must be greater than 0");
        require(_minAnswer < _maxAnswer, "PriceFeed: invalid answer range");
        aggregator = AggregatorV3Interface(_aggregator);
        maxStaleness = _maxStaleness;
        minAnswer = _minAnswer;
        maxAnswer = _maxAnswer;
    }

    /**
     * @return Latest price rounded to 8 decimals, with fallback to last good price on failure or staleness
     */
    function latestAnswer() external view returns (int256) {
        (uint80 roundID, int256 answer, , uint256 updatedAt, ) = tryAggregatorLatestRoundData();
        
        // If we got a valid response from the oracle
        if (updatedAt != 0) {
            // Check if answer is within valid range
            if (answer < minAnswer || answer > maxAnswer) {
                // Invalid answer, try fallback
                if (lastGoodPrice == 0 && lastGoodTimestamp == 0) {
                    revert("PriceFeed: invalid price and no fallback");
                }
                emit StaleDataUsed(block.timestamp - lastGoodTimestamp);
                return lastGoodPrice;
            }
            
            // Check if data is stale
            if (block.timestamp - updatedAt > maxStaleness) {
                // Stale data, use fallback if available
                if (lastGoodPrice == 0 && lastGoodTimestamp == 0) {
                    revert("PriceFeed: stale price and no fallback");
                }
                emit StaleDataUsed(block.timestamp - updatedAt);
                return lastGoodPrice;
            }
            
            // Valid and fresh data - update fallback and return
            lastGoodPrice = answer;
            lastGoodTimestamp = updatedAt;
            emit PriceUpdated(answer, updatedAt);
            return answer;
        }
        
        // Oracle call failed - use fallback if available        if (lastGoodPrice == 0 && lastGoodTimestamp == 0) {
            revert("PriceFeed: oracle call failed and no fallback");
        }
        emit StaleDataUsed(block.timestamp - lastGoodTimestamp);
        return lastGoodPrice;
    }

    /**
     * @dev Try/catch wrapper for aggregator.latestRoundData() to prevent DoS from reverting oracle     * @return Tuple of (roundID, answer, startedAt, updatedAt, answeredInRound) or zeros on failure
     */
    function tryAggregatorLatestRoundData()
        internal        view
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        try aggregator.latestRoundData() returns (
            uint80 roundID,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            return (roundID, answer, startedAt, updatedAt, answeredInRound);
        } catch (bytes memory reason) {
            // Log the failure but don't revert - return zeros to indicate failure
            emit OracleCallFailed(string(reason));
            return (0, 0, 0, 0, 0);
        }
    }
}