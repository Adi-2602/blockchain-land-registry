require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.28",   // jo version already likha hai wahi rehne de
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
      // Ganache ki koi private key env mein do: DEPLOYER_KEY=0x... npx hardhat run ...
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : []
    }
  }
};
