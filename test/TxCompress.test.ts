// test/TxCompress.test.ts
import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("TxCompress7702Delegate", function () {
  
  async function deployFixture() {
    const [owner, alice, bob, charlie] = await hre.viem.getWalletClients();
    const txCompress = await hre.viem.deployContract("TxCompress7702Delegate");
    const publicClient = await hre.viem.getPublicClient();
    
    return { txCompress, owner, alice, bob, charlie, publicClient };
  }
  
  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { txCompress } = await deployFixture();
      expect(txCompress.address).to.be.properAddress;
    });
    
    it("Should have correct initial values", async function () {
      const { txCompress } = await deployFixture();
      
      const totalBatches = await txCompress.read.totalBatchesExecuted();
      const totalSaved = await txCompress.read.totalGasSaved();
      const maxBatchSize = await txCompress.read.MAX_BATCH_SIZE();
      
      expect(totalBatches).to.equal(0n);
      expect(totalSaved).to.equal(0n);
      expect(maxBatchSize).to.equal(100n);
    });
  });
  
  describe("Batch Execution", function () {
    it("Should execute simple ETH transfers", async function () {
      const { txCompress, alice, bob, charlie, owner, publicClient } = await deployFixture();
      
      const calls = [
        {
          target: alice.account.address,
          value: parseEther("1.0"),
          data: "0x" as `0x${string}`,
        },
        {
          target: bob.account.address,
          value: parseEther("2.0"),
          data: "0x" as `0x${string}`,
        },
        {
          target: charlie.account.address,
          value: parseEther("3.0"),
          data: "0x" as `0x${string}`,
        },
      ];
      
      const aliceBalanceBefore = await publicClient.getBalance({ 
        address: alice.account.address 
      });
      
      await txCompress.write.executeBatch([calls], {
        value: parseEther("6.0"),
        account: owner.account,
      });
      
      const aliceBalanceAfter = await publicClient.getBalance({ 
        address: alice.account.address 
      });
      
      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(parseEther("1.0"));
    });
    
    it("Should revert on empty batch", async function () {
      const { txCompress, owner } = await deployFixture();
      
      await expect(
        txCompress.write.executeBatch([[]], {
          account: owner.account,
        })
      ).to.be.rejected;
    });
    
    it("Should revert on insufficient value", async function () {
      const { txCompress, alice, owner } = await deployFixture();
      
      const calls = [{
        target: alice.account.address,
        value: parseEther("1.0"),
        data: "0x" as `0x${string}`,
      }];
      
      await expect(
        txCompress.write.executeBatch([calls], {
          value: parseEther("0.5"),
          account: owner.account,
        })
      ).to.be.rejected;
    });
  });
  
  describe("Gas Savings", function () {
    it("Should save gas compared to individual transactions", async function () {
      const { txCompress, alice, bob, charlie, owner, publicClient } = await deployFixture();
      
      console.log("\n📊 GAS COMPARISON: 3 ETH Transfers");
      console.log("=".repeat(60));
      
      // Individual transactions
      const hash1 = await owner.sendTransaction({
        to: alice.account.address,
        value: parseEther("1.0"),
      });
      const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
      
      const hash2 = await owner.sendTransaction({
        to: bob.account.address,
        value: parseEther("2.0"),
      });
      const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
      
      const hash3 = await owner.sendTransaction({
        to: charlie.account.address,
        value: parseEther("3.0"),
      });
      const receipt3 = await publicClient.waitForTransactionReceipt({ hash: hash3 });
      
      const individualGas = receipt1.gasUsed + receipt2.gasUsed + receipt3.gasUsed;
      
      // Batched transaction
      const calls = [
        { target: alice.account.address, value: parseEther("1.0"), data: "0x" as `0x${string}` },
        { target: bob.account.address, value: parseEther("2.0"), data: "0x" as `0x${string}` },
        { target: charlie.account.address, value: parseEther("3.0"), data: "0x" as `0x${string}` },
      ];
      
      const batchHash = await txCompress.write.executeBatch([calls], {
        value: parseEther("6.0"),
        account: owner.account,
      });
      const batchReceipt = await publicClient.waitForTransactionReceipt({ hash: batchHash });
      const batchedGas = batchReceipt.gasUsed;
      
      const savings = ((individualGas - batchedGas) * 100n) / individualGas;
      
      console.log(`  Individual Gas: ${individualGas.toLocaleString()} gas`);
      console.log(`  Batched Gas:    ${batchedGas.toLocaleString()} gas`);
      console.log(`  Gas Saved:      ${(individualGas - batchedGas).toLocaleString()} gas`);
      console.log(`  💰 Savings:     ${savings}%`);
      console.log("=".repeat(60) + "\n");
      
      expect(batchedGas).to.be.lessThan(individualGas);
    });
  });
  
  describe("Statistics", function () {
    it("Should track user batch count", async function () {
      const { txCompress, alice, owner } = await deployFixture();
      
      const calls = [{
        target: alice.account.address,
        value: parseEther("1.0"),
        data: "0x" as `0x${string}`,
      }];
      
      await txCompress.write.executeBatch([calls], { 
        value: parseEther("1.0"),
        account: owner.account,
      });
      await txCompress.write.executeBatch([calls], { 
        value: parseEther("1.0"),
        account: owner.account,
      });
      await txCompress.write.executeBatch([calls], { 
        value: parseEther("1.0"),
        account: owner.account,
      });
      
      const [batchCount] = await txCompress.read.getUserStats([owner.account.address]);
      expect(batchCount).to.equal(3n);
    });
    
    it("Should estimate gas savings", async function () {
      const { txCompress, alice, bob, charlie } = await deployFixture();
      
      const calls = [
        { target: alice.account.address, value: parseEther("1.0"), data: "0x" as `0x${string}` },
        { target: bob.account.address, value: parseEther("2.0"), data: "0x" as `0x${string}` },
        { target: charlie.account.address, value: parseEther("3.0"), data: "0x" as `0x${string}` },
      ];
      
      const [, , savingsPercent] = await txCompress.read.estimateBatchGas([calls]);
      
      console.log(`\n💡 Estimated Savings: ${savingsPercent}%\n`);
      expect(savingsPercent).to.be.greaterThanOrEqual(30n);
    });
  });
});