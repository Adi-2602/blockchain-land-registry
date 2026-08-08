require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.28",   // jo version already likha hai wahi rehne de
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
      // Ganache terminal se koi bhi ek private key copy karke yahan daal:
      accounts: ["0x5a317609f674c74ddca66dced535eb8d53158bb91f771f3ff9a5d1cd541eeb56"]
    }
  }
};
