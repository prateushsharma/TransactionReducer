// Location: D:\TransactionReducer\scripts\test-batch-backup.ts
// Backup gas savings test script (bypasses hre.viem)

import { createWalletClient, createPublicClient, http, parseEther, formatEther, parseGwei } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// ⬇️ REPLACE THIS WITH YOUR DEPLOYED CONTRACT ADDRESS ⬇️
const CONTRACT_ADDRESS = "0x642c3e6ba6193782471598854b3da3d1533c501f" as `0x${string}`;

// Test recipient addresses
const RECIPIENTS = [
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
] as `0x${string}`[];

async function main() {
  console.log("🧪 Testing TxCompress Gas Savings on Sepolia...\n");
  console.log("=".repeat(60));
  
  // Validate environment
  if (!process.env.SEPOLIA_PRIVATE_KEY) {
    throw new Error("❌ SEPOLIA_PRIVATE_KEY not found in .env");
  }
  if (!process.env.ALCHEMY_API_KEY) {
    throw new Error("❌ ALCHEMY_API_KEY not found in .env");
  }
  
  // Check contract address is set
  if (CONTRACT_ADDRESS === "0xYOUR_CONTRACT_ADDRESS_HERE") {
    throw new Error("❌ Please edit line 14 and add your contract address!");
  }
  
  // Create account
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY.startsWith('0x') 
    ? process.env.SEPOLIA_PRIVATE_KEY as `0x${string}`
    : `0x${process.env.SEPOLIA_PRIVATE_KEY}` as `0x${string}`;
  
  const account = privateKeyToAccount(privateKey);
  console.log(`\n👛 Tester address: ${account.address}`);
  
  // Create clients
  const rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });
  
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${formatEther(balance)} ETH`);
  
  if (balance < parseEther("0.01")) {
    throw new Error("❌ Insufficient balance! Need at least 0.01 ETH for testing.");
  }
  
  // Load contract ABI
  console.log("\n📦 Loading contract ABI...");
  const artifactPath = path.join(
    process.cwd(),
    "artifacts",
    "contracts",
    "TxCompress7702Delegate.sol",
    "TxCompress7702Delegate.json"
  );
  
  if (!fs.existsSync(artifactPath)) {
    throw new Error("❌ Contract artifact not found! Run: npx hardhat compile");
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  
  // Verify contract exists
  console.log(`📍 Contract address: ${CONTRACT_ADDRESS}`);
  const code = await publicClient.getBytecode({ address: CONTRACT_ADDRESS });
  
  if (!code || code === "0x") {
    throw new Error("❌ No contract found at this address! Check your contract address.");
  }
  
  console.log("✅ Contract verified on chain");
  
  // Get contract info
  console.log("\n📊 Reading contract info...");
  
  const maxBatchSize = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "MAX_BATCH_SIZE",
  }) as bigint;
  
  const [totalBatches, totalSaved] = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "getPlatformStats",
  }) as [bigint, bigint];
  
  console.log(`   Max Batch Size: ${maxBatchSize}`);
  console.log(`   Total Batches Executed: ${totalBatches}`);
  console.log(`   Total Gas Saved: ${totalSaved}`);
  
  console.log("\n" + "=".repeat(60));
  console.log("🔬 Test Scenario: Send 0.001 ETH to 3 addresses");
  console.log("=".repeat(60));
  
  // ========================================
  // TEST 1: Individual Transactions
  // ========================================
  console.log("\n📍 TEST 1: Individual Transactions (Baseline)");
  console.log("─".repeat(60));
  
  const individualGasUsed: bigint[] = [];
  const individualHashes: string[] = [];
  
  for (let i = 0; i < RECIPIENTS.length; i++) {
    console.log(`\n   Sending 0.001 ETH to ${RECIPIENTS[i]}...`);
    
    const hash = await walletClient.sendTransaction({
      to: RECIPIENTS[i],
      value: parseEther("0.001"),
    });
    
    individualHashes.push(hash);
    console.log(`   📝 Tx hash: ${hash}`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    individualGasUsed.push(receipt.gasUsed);
    
    console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
  }
  
  const totalIndividualGas = individualGasUsed.reduce((a, b) => a + b, 0n);
  console.log(`\n   📊 Total Gas (Individual): ${totalIndividualGas.toString()}`);
  
  // Wait a bit before batched test
  console.log("\n   ⏳ Waiting 10 seconds before batched test...");
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // ========================================
  // TEST 2: Batched Transaction
  // ========================================
  console.log("\n📍 TEST 2: Batched Transaction");
  console.log("─".repeat(60));
  
  // Create batch calls
  const calls = RECIPIENTS.map(recipient => ({
    target: recipient,
    value: parseEther("0.001"),
    data: "0x" as `0x${string}`,
  }));
  
  console.log("\n   Preparing batch execution...");
  console.log(`   - Batching ${calls.length} transactions`);
  console.log(`   - Total value: ${formatEther(parseEther("0.003"))} ETH`);
  
  // Encode function call
  const encodedData = {
    abi: artifact.abi,
    functionName: "executeBatch",
    args: [calls],
  };
  
  // Execute batch
  console.log("\n   🚀 Executing batch...");
  
  const batchHash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "executeBatch",
    args: [calls],
    value: parseEther("0.003"), // 3 * 0.001 ETH
  });
  
  console.log(`   📝 Batch tx hash: ${batchHash}`);
  console.log("   ⏳ Waiting for confirmation...");
  
  const batchReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: batchHash 
  });
  
  const batchGasUsed = batchReceipt.gasUsed;
  
  console.log(`   ⛽ Gas used: ${batchGasUsed.toString()}`);
  console.log(`   ✅ Confirmed in block ${batchReceipt.blockNumber}`);
  console.log(`   📋 Status: ${batchReceipt.status === "success" ? "SUCCESS" : "FAILED"}`);
  
  // ========================================
  // Calculate Savings
  // ========================================
  console.log("\n" + "=".repeat(60));
  console.log("💰 GAS SAVINGS ANALYSIS");
  console.log("=".repeat(60));
  
  const gasSaved = totalIndividualGas - batchGasUsed;
  const savingsPercent = (gasSaved * 100n) / totalIndividualGas;
  
  // Get current gas price for cost calculation
  const gasPrice = await publicClient.getGasPrice();
  const individualCost = totalIndividualGas * gasPrice;
  const batchCost = batchGasUsed * gasPrice;
  const costSaved = individualCost - batchCost;
  
  console.log(`\n📊 Gas Usage:`);
  console.log(`   Individual: ${totalIndividualGas.toLocaleString()} gas`);
  console.log(`   Batched:    ${batchGasUsed.toLocaleString()} gas`);
  console.log(`   Saved:      ${gasSaved.toLocaleString()} gas`);
  console.log(`   Savings:    ${savingsPercent.toString()}%`);
  
  console.log(`\n💵 Cost Analysis (at ${formatEther(gasPrice)} ETH/gas):`);
  console.log(`   Individual Cost: ${formatEther(individualCost)} ETH`);
  console.log(`   Batched Cost:    ${formatEther(batchCost)} ETH`);
  console.log(`   Cost Saved:      ${formatEther(costSaved)} ETH`);
  
  // Calculate USD value (assuming ETH = $3000)
  const ethPrice = 3000;
  const savedUSD = Number(formatEther(costSaved)) * ethPrice;
  console.log(`   Cost Saved:      $${savedUSD.toFixed(4)} USD (at $3000/ETH)`);
  
  // ========================================
  // Transaction Links
  // ========================================
  console.log("\n🔗 Transaction Links:");
  console.log("\n   Individual Transactions:");
  individualHashes.forEach((hash, i) => {
    console.log(`   ${i + 1}. https://sepolia.etherscan.io/tx/${hash}`);
  });
  console.log(`\n   Batched Transaction:`);
  console.log(`   🎯 https://sepolia.etherscan.io/tx/${batchHash}`);
  
  // ========================================
  // Demo Summary
  // ========================================
  console.log("\n" + "=".repeat(60));
  console.log("🎯 DEMO SUMMARY (USE THIS FOR YOUR PRESENTATION!)");
  console.log("=".repeat(60));
  
  console.log(`\n✅ Contract: ${CONTRACT_ADDRESS}`);
  console.log(`✅ Network: Sepolia (Chain ID: ${sepolia.id})`);
  console.log(`✅ Gas Savings: ${savingsPercent}%`);
  console.log(`✅ Cost Savings: $${savedUSD.toFixed(4)} USD`);
  console.log(`✅ Batch Transaction: ${batchHash}`);
  console.log(`✅ Block Number: ${batchReceipt.blockNumber}`);
  
  console.log("\n📊 Proof of Savings:");
  console.log(`   • Individual gas: ${totalIndividualGas.toLocaleString()}`);
  console.log(`   • Batched gas: ${batchGasUsed.toLocaleString()}`);
  console.log(`   • Gas saved: ${gasSaved.toLocaleString()} (${savingsPercent}%)`);
  
  console.log("\n🎬 For Your Demo Video:");
  console.log("   1. Show this terminal output");
  console.log("   2. Open batch tx on Etherscan");
  console.log("   3. Highlight the gas savings");
  console.log("   4. Compare to individual transactions");
  
  console.log("\n✅ Test Complete!");
  console.log("=".repeat(60));
  
  // Save results to file
  const results = {
    contract: CONTRACT_ADDRESS,
    network: "sepolia",
    timestamp: new Date().toISOString(),
    individualGas: totalIndividualGas.toString(),
    batchedGas: batchGasUsed.toString(),
    gasSaved: gasSaved.toString(),
    savingsPercent: savingsPercent.toString(),
    costSavedETH: formatEther(costSaved),
    costSavedUSD: savedUSD.toFixed(4),
    batchTxHash: batchHash,
    blockNumber: batchReceipt.blockNumber.toString(),
    individualTxHashes: individualHashes,
  };
  
  const resultsPath = path.join(process.cwd(), "test-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${resultsPath}`);
  
  return results;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error.message || error);
    process.exit(1);
  });