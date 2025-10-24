// Location: D:\TransactionReducer\scripts\test-batch.ts
// Test script to demonstrate gas savings on Sepolia

import hre from "hardhat";
import { formatEther, parseEther, parseGwei } from "viem";

// REPLACE THIS with your deployed contract address
const CONTRACT_ADDRESS = "0x642c3e6ba6193782471598854b3da3d1533c501f" as `0x${string}`;

async function main() {
  console.log("🧪 Testing TxCompress on Sepolia...\n");
  
  // Get clients
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  
  console.log(`👛 Tester address: ${deployer.account.address}`);
  
  // Check balance
  const balance = await publicClient.getBalance({ 
    address: deployer.account.address 
  });
  console.log(`💰 Balance: ${formatEther(balance)} ETH\n`);
  
  if (balance < parseEther("0.01")) {
    throw new Error("❌ Insufficient balance! Need at least 0.01 ETH for testing.");
  }
  
  // Get contract instance
  const txCompress = await hre.viem.getContractAt(
    "TxCompress7702Delegate",
    CONTRACT_ADDRESS
  );
  
  console.log("📊 Contract Info:");
  const maxBatchSize = await txCompress.read.MAX_BATCH_SIZE();
  const [totalBatches, totalSaved] = await txCompress.read.getPlatformStats();
  console.log(`   Max Batch Size: ${maxBatchSize}`);
  console.log(`   Total Batches: ${totalBatches}`);
  console.log(`   Total Gas Saved: ${totalSaved}\n`);
  
  // Create 3 test recipient addresses
  const recipients = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  ] as `0x${string}`[];
  
  console.log("🔬 Test Scenario: Send 0.001 ETH to 3 addresses\n");
  
  // ========================================
  // TEST 1: Individual Transactions (Baseline)
  // ========================================
  console.log("📍 TEST 1: Individual Transactions");
  console.log("─".repeat(50));
  
  const individualGasUsed: bigint[] = [];
  
  for (let i = 0; i < recipients.length; i++) {
    console.log(`   Sending to ${recipients[i]}...`);
    
    const hash = await deployer.sendTransaction({
      to: recipients[i],
      value: parseEther("0.001"),
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    individualGasUsed.push(receipt.gasUsed);
    
    console.log(`   ✅ Gas used: ${receipt.gasUsed.toString()}`);
  }
  
  const totalIndividualGas = individualGasUsed.reduce((a, b) => a + b, 0n);
  console.log(`\n   📊 Total Gas (Individual): ${totalIndividualGas.toString()}`);
  
  // Wait a bit before next test
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // ========================================
  // TEST 2: Batched Transaction
  // ========================================
  console.log("\n📍 TEST 2: Batched Transaction");
  console.log("─".repeat(50));
  
  // Create batch calls
  const calls = recipients.map(recipient => ({
    target: recipient,
    value: parseEther("0.001"),
    data: "0x" as `0x${string}`,
  }));
  
  console.log("   Executing batch...");
  
  const batchHash = await txCompress.write.executeBatch([calls], {
    value: parseEther("0.003"), // 3 * 0.001 ETH
  });
  
  console.log(`   📝 Transaction hash: ${batchHash}`);
  
  const batchReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: batchHash 
  });
  
  const batchGasUsed = batchReceipt.gasUsed;
  console.log(`   ✅ Gas used: ${batchGasUsed.toString()}`);
  
  // ========================================
  // Calculate Savings
  // ========================================
  console.log("\n💰 GAS SAVINGS ANALYSIS");
  console.log("=".repeat(50));
  
  const gasSaved = totalIndividualGas - batchGasUsed;
  const savingsPercent = (gasSaved * 100n) / totalIndividualGas;
  
  // Calculate costs (assuming current gas price)
  const gasPrice = await publicClient.getGasPrice();
  const individualCost = totalIndividualGas * gasPrice;
  const batchCost = batchGasUsed * gasPrice;
  const costSaved = individualCost - batchCost;
  
  console.log(`\n📊 Gas Usage:`);
  console.log(`   Individual: ${totalIndividualGas.toString()} gas`);
  console.log(`   Batched:    ${batchGasUsed.toString()} gas`);
  console.log(`   Saved:      ${gasSaved.toString()} gas`);
  console.log(`   Savings:    ${savingsPercent.toString()}%`);
  
  console.log(`\n💵 Cost Analysis (at ${formatEther(gasPrice)} ETH/gas):`);
  console.log(`   Individual: ${formatEther(individualCost)} ETH`);
  console.log(`   Batched:    ${formatEther(batchCost)} ETH`);
  console.log(`   Saved:      ${formatEther(costSaved)} ETH`);
  
  // Assuming ETH = $3000
  const ethPrice = 3000;
  const savedUSD = Number(formatEther(costSaved)) * ethPrice;
  console.log(`   Saved:      $${savedUSD.toFixed(4)} USD`);
  
  console.log("\n✅ Test Complete!");
  
  // Summary for demo
  console.log("\n🎯 DEMO SUMMARY:");
  console.log("─".repeat(50));
  console.log(`✅ Contract: ${CONTRACT_ADDRESS}`);
  console.log(`✅ Gas Savings: ${savingsPercent}%`);
  console.log(`✅ Cost Savings: $${savedUSD.toFixed(4)} USD`);
  console.log(`✅ Transaction Hash: ${batchHash}`);
  console.log(`✅ Block: ${batchReceipt.blockNumber}`);
  
  return {
    contractAddress: CONTRACT_ADDRESS,
    individualGas: totalIndividualGas.toString(),
    batchedGas: batchGasUsed.toString(),
    savingsPercent: savingsPercent.toString(),
    transactionHash: batchHash,
    blockNumber: batchReceipt.blockNumber.toString(),
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });