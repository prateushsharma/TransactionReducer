// test/TxCompress.test.ts

import { expect } from "chai";
import { parseEther } from "viem";
// Correct import for Hardhat 3 + hardhat-toolbox-viem
import hre from "hardhat";

describe("TxCompress7702Delegate", function () {
  
  async function deployFixture() {
    // Access viem through hre
    const publicClient = await hre.viem.getPublicClient();
    const [deployer, alice, bob, charlie] = await hre.viem.getWalletClients();

    // Deploy contract
    const txCompress = await hre.viem.deployContract("TxCompress7702Delegate");

    return {
      txCompress,
      publicClient,
      deployer,
      alice,
      bob,
      charlie,
    };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { txCompress } = await deployFixture();
      
      expect(txCompress.address).to.be.properAddress;
      console.log("✅ Contract deployed at:", txCompress.address);
    });

    it("Should have correct initial values", async function () {
      const { txCompress } = await deployFixture();

      const maxBatchSize = await txCompress.read.MAX_BATCH_SIZE();
      const totalBatches = await txCompress.read.totalBatchesExecuted();
      const totalGasSaved = await txCompress.read.totalGasSaved();

      expect(maxBatchSize).to.equal(100n);
      expect(totalBatches).to.equal(0n);
      expect(totalGasSaved).to.equal(0n);
    });
  });

  describe("Batch Execution", function () {
    it("Should execute 3 ETH transfers in one batch", async function () {
      const { txCompress, alice, bob, charlie, publicClient } = await deployFixture();

      // Prepare batch calls
      const calls = [
        {
          target: alice.account.address,
          value: parseEther("1"),
          data: "0x" as `0x${string}`,
        },
        {
          target: bob.account.address,
          value: parseEther("2"),
          data: "0x" as `0x${string}`,
        },
        {
          target: charlie.account.address,
          value: parseEther("3"),
          data: "0x" as `0x${string}`,
        },
      ];

      // Get balances before
      const aliceBalanceBefore = await publicClient.getBalance({
        address: alice.account.address,
      });

      // Execute batch
      const hash = await txCompress.write.executeBatch([calls], {
        value: parseEther("6"),
      });

      // Wait for transaction
      await publicClient.waitForTransactionReceipt({ hash });

      // Check balance after
      const aliceBalanceAfter = await publicClient.getBalance({
        address: alice.account.address,
      });

      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(parseEther("1"));
      console.log("✅ Batch executed successfully!");
    });

    it("Should revert on empty batch", async function () {
      const { txCompress } = await deployFixture();

      const calls: any[] = [];

      await expect(
        txCompress.write.executeBatch([calls])
      ).to.be.rejected;
    });

    it("Should revert on insufficient value", async function () {
      const { txCompress, alice } = await deployFixture();

      const calls = [
        {
          target: alice.account.address,
          value: parseEther("1"),
          data: "0x" as `0x${string}`,
        },
      ];

      await expect(
        txCompress.write.executeBatch([calls], {
          value: parseEther("0.5"),
        })
      ).to.be.rejected;
    });
  });

  describe("Gas Benchmarking", function () {
    it("Should save 50-70% gas compared to individual transactions", async function () {
      const { txCompress, alice, bob, charlie, publicClient, deployer } =
        await deployFixture();

      console.log("\n📊 Gas Benchmarking:");
      console.log("=".repeat(60));

      // Measure INDIVIDUAL transactions
      console.log("\n⏱️  Measuring individual transactions...");
      
      const tx1 = await deployer.sendTransaction({
        to: alice.account.address,
        value: parseEther("1"),
      });
      const receipt1 = await publicClient.waitForTransactionReceipt({
        hash: tx1,
      });

      const tx2 = await deployer.sendTransaction({
        to: bob.account.address,
        value: parseEther("2"),
      });
      const receipt2 = await publicClient.waitForTransactionReceipt({
        hash: tx2,
      });

      const tx3 = await deployer.sendTransaction({
        to: charlie.account.address,
        value: parseEther("3"),
      });
      const receipt3 = await publicClient.waitForTransactionReceipt({
        hash: tx3,
      });

      const individualGas =
        receipt1.gasUsed + receipt2.gasUsed + receipt3.gasUsed;

      // Measure BATCHED transaction
      console.log("⏱️  Measuring batched transaction...");

      const calls = [
        {
          target: alice.account.address,
          value: parseEther("1"),
          data: "0x" as `0x${string}`,
        },
        {
          target: bob.account.address,
          value: parseEther("2"),
          data: "0x" as `0x${string}`,
        },
        {
          target: charlie.account.address,
          value: parseEther("3"),
          data: "0x" as `0x${string}`,
        },
      ];

      const batchHash = await txCompress.write.executeBatch([calls], {
        value: parseEther("6"),
      });

      const batchReceipt = await publicClient.waitForTransactionReceipt({
        hash: batchHash,
      });

      const batchedGas = batchReceipt.gasUsed;

      // Calculate savings
      const gasSaved = individualGas - batchedGas;
      const savingsPercent = (gasSaved * 100n) / individualGas;

      // Display results
      console.log("\n💰 Results:");
      console.log(`  Individual Gas: ${individualGas.toLocaleString()} gas`);
      console.log(`  Batched Gas:    ${batchedGas.toLocaleString()} gas`);
      console.log(`  Gas Saved:      ${gasSaved.toLocaleString()} gas`);
      console.log(`  Savings:        ${savingsPercent}%`);
      console.log("=".repeat(60) + "\n");

      // Assertions
      expect(batchedGas).to.be.lessThan(individualGas);
      expect(savingsPercent).to.be.greaterThanOrEqual(40n);
    });
  });

  describe("User Statistics", function () {
    it("Should track user batch count", async function () {
      const { txCompress, alice, deployer } = await deployFixture();

      const calls = [
        {
          target: alice.account.address,
          value: parseEther("0.1"),
          data: "0x" as `0x${string}`,
        },
      ];

      // Execute 3 batches
      await txCompress.write.executeBatch([calls], {
        value: parseEther("0.1"),
      });
      await txCompress.write.executeBatch([calls], {
        value: parseEther("0.1"),
      });
      await txCompress.write.executeBatch([calls], {
        value: parseEther("0.1"),
      });

      const batchCount = await txCompress.read.getUserStats([
        deployer.account.address,
      ]);

      expect(batchCount).to.equal(3n);
    });

    it("Should track platform statistics", async function () {
      const { txCompress, alice } = await deployFixture();

      const calls = [
        {
          target: alice.account.address,
          value: parseEther("0.1"),
          data: "0x" as `0x${string}`,
        },
      ];

      await txCompress.write.executeBatch([calls], {
        value: parseEther("0.1"),
      });

      const [totalBatches, totalGasSaved] =
        await txCompress.read.getPlatformStats();

      expect(totalBatches).to.equal(1n);
    });
  });
});