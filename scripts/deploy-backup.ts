// Location: D:\TransactionReducer\scripts\deploy-backup.ts
// Backup deployment script using direct viem client creation

import hre from "hardhat";
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🚀 Starting TxCompress Deployment (Backup Method)...\n");
  
  // Validate environment variables
  if (!process.env.SEPOLIA_PRIVATE_KEY) {
    throw new Error("❌ SEPOLIA_PRIVATE_KEY not found in .env");
  }
  if (!process.env.ALCHEMY_API_KEY) {
    throw new Error("❌ ALCHEMY_API_KEY not found in .env");
  }
  
  // Create account from private key
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY.startsWith('0x') 
    ? process.env.SEPOLIA_PRIVATE_KEY as `0x${string}`
    : `0x${process.env.SEPOLIA_PRIVATE_KEY}` as `0x${string}`;
  
  const account = privateKeyToAccount(privateKey);
  console.log(`👛 Deployer address: ${account.address}`);
  
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
  console.log(`💰 Balance: ${formatEther(balance)} ETH\n`);
  
  if (balance === 0n) {
    throw new Error("❌ Deployer has 0 ETH! Please fund your account.");
  }
  
  // Get contract bytecode and ABI from compilation artifacts
  console.log("📦 Loading contract artifacts...");
  const artifact = await hre.artifacts.readArtifact("TxCompress7702Delegate");
  
  console.log("🚀 Deploying contract...");
  
  // Deploy contract
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    account,
  });
  
  console.log(`📝 Transaction hash: ${hash}`);
  console.log("⏳ Waiting for confirmation...");
  
  // Wait for transaction receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (!receipt.contractAddress) {
    throw new Error("❌ Contract deployment failed - no contract address in receipt");
  }
  
  console.log(`\n✅ Contract deployed successfully!`);
  console.log(`📍 Contract address: ${receipt.contractAddress}`);
  console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`🔢 Block number: ${receipt.blockNumber}`);
  
  // Verify deployment
  const code = await publicClient.getBytecode({ address: receipt.contractAddress });
  if (code && code.length > 2) {
    console.log("✅ Contract bytecode verified!");
  }
  
  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    chainId: sepolia.id,
    contract: "TxCompress7702Delegate",
    address: receipt.contractAddress,
    deployer: account.address,
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    timestamp: new Date().toISOString(),
  };
  
  console.log("\n📝 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n📋 Next Steps:");
  console.log("1. Verify contract on Etherscan:");
  console.log(`   npx hardhat verify --network sepolia ${receipt.contractAddress}`);
  console.log("\n2. Test the contract:");
  console.log(`   npx hardhat run scripts/test-batch.ts --network sepolia`);
  
  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });