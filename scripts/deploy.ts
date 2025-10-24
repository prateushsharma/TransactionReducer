// scripts/deploy.ts

import { formatEther } from "viem";

async function main() {
  console.log("🚀 Deploying TxCompress to Sepolia...\n");

  // Dynamic import for Hardhat 3
  const hre = await import("hardhat");
  
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  console.log("📍 Deploying with account:", deployer.account.address);

  const balance = await publicClient.getBalance({
    address: deployer.account.address,
  });
  console.log("💰 Account balance:", formatEther(balance), "ETH\n");

  if (balance < 1000000000000000n) {
    console.error("❌ Insufficient balance! Get Sepolia ETH from:");
    console.error("   https://sepoliafaucet.com/");
    process.exit(1);
  }

  console.log("📦 Deploying TxCompress7702Delegate...");

  const txCompress = await hre.viem.deployContract("TxCompress7702Delegate");

  console.log("\n✅ Deployment successful!");
  console.log("=".repeat(60));
  console.log("📍 Contract Address:", txCompress.address);
  console.log("🔗 Etherscan:", `https://sepolia.etherscan.io/address/${txCompress.address}`);
  console.log("=".repeat(60));

  console.log("\n📝 To verify, run:");
  console.log(`npx hardhat verify --network sepolia ${txCompress.address}`);

  // Save address for later use
  console.log("\n💾 Save this address for testing!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});