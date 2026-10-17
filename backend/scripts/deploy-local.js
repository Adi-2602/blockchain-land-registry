// LandRegistry.json ke bytecode se contract deploy karo (Hardhat compile ki zaroorat nahi).
// Usage: GANACHE_URL=... PRIVATE_KEY=... node scripts/deploy-local.js  → prints address
const { ethers } = require("ethers");
const artifact = require("../LandRegistry.json");

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet).deploy();
  await contract.waitForDeployment();
  console.log(await contract.getAddress());
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
