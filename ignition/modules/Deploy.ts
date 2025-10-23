// ignition/modules/Deploy.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TxCompressModule = buildModule("TxCompressModule", (m) => {
  const txCompress = m.contract("TxCompress7702Delegate");
  return { txCompress };
});

export default TxCompressModule;