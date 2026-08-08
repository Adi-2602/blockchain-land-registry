async function main() {
  const LandRegistry = await ethers.getContractFactory("LandRegistry");
  const contract = await LandRegistry.deploy();
  await contract.waitForDeployment();
  console.log("LandRegistry deployed to:", await contract.getAddress());
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});  