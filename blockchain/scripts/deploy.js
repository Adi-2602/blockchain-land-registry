import hre from "hardhat";
import fs from "fs";

const { ethers } = hre;

async function main() {
  const LandRegistry = await ethers.getContractFactory("LandRegistry");
  const contract = await LandRegistry.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("LandRegistry deployed to:", address);

  // Optional: ek aur registrar wallet (jaise tumhara MetaMask account) approve karo
  const extra = process.env.REGISTRAR_ADDRESS;
  if (extra) {
    await (await contract.addRegistrar(extra)).wait();
    console.log("Registrar added:", extra);
  }

  // Naya ABI backend aur frontend dono mein copy karo
  const artifact = await hre.artifacts.readArtifact("LandRegistry");
  fs.writeFileSync("../backend/LandRegistry.json", JSON.stringify(artifact, null, 2));
  fs.writeFileSync("../frontend/src/LandRegistry.json", JSON.stringify({ abi: artifact.abi }, null, 2));
  console.log("ABI copied to backend/ and frontend/src/");

  console.log("\nPut this address in backend/.env (CONTRACT_ADDRESS) and frontend/.env (VITE_CONTRACT_ADDRESS)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
