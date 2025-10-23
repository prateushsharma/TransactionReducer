// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TxCompress7702Delegate
 * @notice EIP-7702 delegation contract for batching transactions
 */
contract TxCompress7702Delegate is ReentrancyGuard {
    
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }
    
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public totalBatchesExecuted;
    uint256 public totalGasSaved;
    
    mapping(address => uint256) public userBatchCount;
    mapping(address => uint256) public userGasSaved;
    
    event BatchExecuted(
        address indexed executor,
        uint256 callCount,
        uint256 totalValue,
        uint256 indexed batchId
    );
    
    event CallExecuted(
        uint256 indexed batchId,
        uint256 callIndex,
        address indexed target,
        uint256 value,
        bool success
    );
    
    event GasSaved(address indexed user, uint256 gasSaved, uint256 batchSize);
    
    error EmptyBatch();
    error BatchTooLarge(uint256 size);
    error CallFailed(uint256 callIndex, bytes reason);
    error InsufficientValue(uint256 required, uint256 provided);
    
    function executeBatch(Call[] calldata calls) 
        external 
        payable 
        nonReentrant
        returns (bytes[] memory results) 
    {
        if (calls.length == 0) revert EmptyBatch();
        if (calls.length > MAX_BATCH_SIZE) revert BatchTooLarge(calls.length);
        
        uint256 totalRequired = 0;
        for (uint256 i = 0; i < calls.length; i++) {
            totalRequired += calls[i].value;
        }
        if (msg.value < totalRequired) {
            revert InsufficientValue(totalRequired, msg.value);
        }
        
        results = new bytes[](calls.length);
        uint256 batchId = totalBatchesExecuted++;
        
        for (uint256 i = 0; i < calls.length; i++) {
            Call calldata call = calls[i];
            
            (bool success, bytes memory result) = call.target.call{
                value: call.value
            }(call.data);
            
            if (!success) {
                revert CallFailed(i, result);
            }
            
            results[i] = result;
            emit CallExecuted(batchId, i, call.target, call.value, success);
        }
        
        userBatchCount[msg.sender]++;
        
        uint256 estimatedSavings = (21000 * calls.length) - (21000 + (2600 * calls.length));
        userGasSaved[msg.sender] += estimatedSavings;
        totalGasSaved += estimatedSavings;
        
        emit BatchExecuted(msg.sender, calls.length, totalRequired, batchId);
        emit GasSaved(msg.sender, estimatedSavings, calls.length);
        
        return results;
    }
    
    function estimateBatchGas(Call[] calldata calls) 
        external 
        view 
        returns (
            uint256 estimatedGas,
            uint256 estimatedSavings,
            uint256 savingsPercent
        ) 
    {
        if (calls.length == 0) return (0, 0, 0);
        
        uint256 individualGas = 21000 * calls.length;
        estimatedGas = 21000;
        
        for (uint256 i = 0; i < calls.length; i++) {
            estimatedGas += 2700;
            
            if (calls[i].value > 0) {
                estimatedGas += 9000;
            }
            
            estimatedGas += (calls[i].data.length * 16);
        }
        
        estimatedSavings = individualGas > estimatedGas 
            ? individualGas - estimatedGas 
            : 0;
        
        savingsPercent = individualGas > 0
            ? (estimatedSavings * 100) / individualGas
            : 0;
        
        return (estimatedGas, estimatedSavings, savingsPercent);
    }
    
    function getUserStats(address user) 
        external 
        view 
        returns (uint256 batchCount, uint256 gasSaved) 
    {
        return (userBatchCount[user], userGasSaved[user]);
    }
    
    function getPlatformStats() 
        external 
        view 
        returns (uint256 totalBatches, uint256 totalSaved) 
    {
        return (totalBatchesExecuted, totalGasSaved);
    }
    
    receive() external payable {}
    fallback() external payable {}
}