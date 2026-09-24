require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.28",   // jo version already likha hai wahi rehne de
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
      // Private key ab code mein nahi — env se lo. Khali chhodoge to Ganache ke
      // unlocked accounts use honge (pehla account = admin).
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : "remote",
    },
  },
};
